// Andes Projects procedures (sprint-2.md scope item 2; ADR-003 per-product
// routers). Isolation is belt-and-braces on every query: explicit tenantId
// where-clauses (RFC-001 layer 1) on top of ctx.tenantDb's RLS scoping
// (layer 2).
import { TRPCError } from "@trpc/server";
import { Prisma } from "@andes/db";

import { roleProcedure, router, tenantProcedure } from "../../trpc.js";
import { assertClientInTenant } from "../crm/index.js";
import {
  projectCreateSchema,
  projectIdSchema,
  projectListSchema,
  projectUpdateSchema,
} from "./schemas.js";

const clientSummary = { select: { id: true, name: true } } as const;

function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  );
}

export const projectsRouter = router({
  list: tenantProcedure.input(projectListSchema).query(({ ctx, input }) =>
    ctx.tenantDb.project.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(input?.status ? { status: input.status } : {}),
      },
      include: { client: clientSummary },
      orderBy: { createdAt: "desc" },
    }),
  ),

  get: tenantProcedure.input(projectIdSchema).query(async ({ ctx, input }) => {
    const project = await ctx.tenantDb.project.findFirst({
      where: { id: input.id, tenantId: ctx.tenantId },
      include: { client: clientSummary },
    });
    if (!project) throw new TRPCError({ code: "NOT_FOUND" });
    return project;
  }),

  create: tenantProcedure
    .input(projectCreateSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.clientId) {
        await assertClientInTenant(ctx.tenantDb, ctx.tenantId, input.clientId);
      }
      try {
        return await ctx.tenantDb.project.create({
          data: {
            ...input,
            tenantId: ctx.tenantId,
            createdById: ctx.session.userId,
          },
          include: { client: clientSummary },
        });
      } catch (e) {
        if (isUniqueViolation(e)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A project with code "${input.code}" already exists.`,
          });
        }
        throw e;
      }
    }),

  update: tenantProcedure
    .input(projectUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      if (data.clientId) {
        await assertClientInTenant(ctx.tenantDb, ctx.tenantId, data.clientId);
      }
      try {
        // updateMany so the tenantId filter is part of the write itself —
        // a foreign id yields count 0, indistinguishable from not-found.
        const updated = await ctx.tenantDb.project.updateMany({
          where: { id, tenantId: ctx.tenantId },
          data,
        });
        if (updated.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      } catch (e) {
        if (isUniqueViolation(e)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A project with code "${data.code}" already exists.`,
          });
        }
        throw e;
      }
      return ctx.tenantDb.project.findFirst({
        where: { id, tenantId: ctx.tenantId },
        include: { client: clientSummary },
      });
    }),

  // Lifecycle ends at ARCHIVED — no hard delete (sprint-2-domain-model.md,
  // process 5). OWNER_ADMIN only: the sprint's one role-gated action.
  archive: roleProcedure("OWNER_ADMIN")
    .input(projectIdSchema)
    .mutation(async ({ ctx, input }) => {
      const archived = await ctx.tenantDb.project.updateMany({
        where: { id: input.id, tenantId: ctx.tenantId },
        data: { status: "ARCHIVED" },
      });
      if (archived.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { id: input.id, status: "ARCHIVED" as const };
    }),
});

// The clients router moved to ../crm (Sprint 3) — CRM owns Client now;
// the project form consumes it through the same appRouter key.
