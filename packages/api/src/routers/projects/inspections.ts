// Inspection Module procedures (sprint-5.md scope item 2; ADR-003
// per-product routers, Andes Projects module). Forward-only lifecycle:
// content edits only while SCHEDULED; COMPLETED and CANCELLED are
// terminal. Isolation is the established belt-and-braces: explicit
// tenantId filters (layer 1) over ctx.tenantDb's RLS (layer 2).
import { TRPCError } from "@trpc/server";
import { Prisma } from "@andes/db";

import { router, tenantProcedure } from "../../trpc.js";
import {
  inspectionCreateSchema,
  inspectionIdSchema,
  inspectionListSchema,
  inspectionUpdateSchema,
} from "./inspection-schemas.js";

const projectSummary = {
  select: { id: true, code: true, name: true },
} as const;
const inspectorSummary = {
  select: { id: true, name: true, email: true },
} as const;

function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  );
}

// An inspectorId is user-controlled input, and User is global identity:
// only a Membership row proves the user is this tenant's staff
// (sprint-5-domain-model.md — the first User validation beyond the
// session's own).
async function assertInspectorIsMember(
  tenantDb: { membership: { findFirst(args: object): Promise<unknown> } },
  tenantId: string,
  inspectorId: string,
) {
  const membership = await tenantDb.membership.findFirst({
    where: { userId: inspectorId, tenantId },
    select: { id: true },
  });
  if (!membership) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Inspector is not a member of this tenant.",
    });
  }
}

// New inspections only on live projects; archived ones keep their
// history readable but accept no new work.
async function assertActiveProject(
  tenantDb: { project: { findFirst(args: object): Promise<unknown> } },
  tenantId: string,
  projectId: string,
) {
  const project = await tenantDb.project.findFirst({
    where: { id: projectId, tenantId, status: { not: "ARCHIVED" } },
    select: { id: true },
  });
  if (!project) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Project not found or archived.",
    });
  }
}

export const inspectionsRouter = router({
  list: tenantProcedure.input(inspectionListSchema).query(({ ctx, input }) =>
    ctx.tenantDb.inspection.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(input?.projectId ? { projectId: input.projectId } : {}),
        ...(input?.status ? { status: input.status } : {}),
      },
      include: {
        project: projectSummary,
        inspector: inspectorSummary,
        _count: { select: { findings: true } },
      },
      orderBy: { scheduledFor: "desc" },
    }),
  ),

  get: tenantProcedure
    .input(inspectionIdSchema)
    .query(async ({ ctx, input }) => {
      const inspection = await ctx.tenantDb.inspection.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        include: {
          project: projectSummary,
          inspector: inspectorSummary,
          findings: { orderBy: { position: "asc" } },
        },
      });
      if (!inspection) throw new TRPCError({ code: "NOT_FOUND" });
      return inspection;
    }),

  create: tenantProcedure
    .input(inspectionCreateSchema)
    .mutation(async ({ ctx, input }) => {
      await assertActiveProject(ctx.tenantDb, ctx.tenantId, input.projectId);
      await assertInspectorIsMember(
        ctx.tenantDb,
        ctx.tenantId,
        input.inspectorId,
      );
      try {
        return await ctx.tenantDb.inspection.create({
          data: {
            ...input,
            tenantId: ctx.tenantId,
            createdById: ctx.session.userId,
          },
          include: { project: projectSummary, inspector: inspectorSummary },
        });
      } catch (e) {
        if (isUniqueViolation(e)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `An inspection with code "${input.code}" already exists.`,
          });
        }
        throw e;
      }
    }),

  // Content edits are SCHEDULED-only: a completed inspection is what the
  // inspector reported; a cancelled one is scheduling history.
  update: tenantProcedure
    .input(inspectionUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, findings, inspectorId, ...fields } = input;
      const existing = await ctx.tenantDb.inspection.findFirst({
        where: { id, tenantId: ctx.tenantId },
        select: { status: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.status !== "SCHEDULED") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Only scheduled inspections can be edited.",
        });
      }
      if (inspectorId) {
        await assertInspectorIsMember(ctx.tenantDb, ctx.tenantId, inspectorId);
      }
      try {
        // Single nested write so the findings replacement is atomic; the
        // tenant scope was verified above and RLS backstops the update.
        return await ctx.tenantDb.inspection.update({
          where: { id },
          data: {
            ...fields,
            ...(inspectorId ? { inspectorId } : {}),
            ...(findings
              ? {
                  findings: {
                    deleteMany: {},
                    create: findings.map((finding, position) => ({
                      ...finding,
                      position,
                      tenantId: ctx.tenantId,
                    })),
                  },
                }
              : {}),
          },
          include: {
            project: projectSummary,
            inspector: inspectorSummary,
            findings: { orderBy: { position: "asc" } },
          },
        });
      } catch (e) {
        if (isUniqueViolation(e)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `An inspection with code "${fields.code}" already exists.`,
          });
        }
        throw e;
      }
    }),

  // SCHEDULED → COMPLETED: stamps performedAt and freezes the record —
  // it is now the report of what was found.
  complete: tenantProcedure
    .input(inspectionIdSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.tenantDb.inspection.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: { status: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.status !== "SCHEDULED") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Only scheduled inspections can be completed.",
        });
      }
      const performedAt = new Date();
      await ctx.tenantDb.inspection.updateMany({
        where: { id: input.id, tenantId: ctx.tenantId },
        data: { status: "COMPLETED", performedAt },
      });
      return { id: input.id, status: "COMPLETED" as const, performedAt };
    }),

  // SCHEDULED → CANCELLED: terminal, kept for the record.
  cancel: tenantProcedure
    .input(inspectionIdSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.tenantDb.inspection.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: { status: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.status !== "SCHEDULED") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Only scheduled inspections can be cancelled.",
        });
      }
      await ctx.tenantDb.inspection.updateMany({
        where: { id: input.id, tenantId: ctx.tenantId },
        data: { status: "CANCELLED" },
      });
      return { id: input.id, status: "CANCELLED" as const };
    }),
});
