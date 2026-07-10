// Structural Module procedures (sprint-6.md scope item 3; ADR-003
// per-product routers, Andes Structures module). The server is
// @andes/structures' ONLY caller — the UI never computes — and every
// check stores inputs + outputs together at compute time (ratified
// decision 4: an issued memoria is immutable evidence). Forward-only:
// DRAFT-only edits; ISSUED is terminal. Isolation is the established
// belt-and-braces: explicit tenantId filters over ctx.tenantDb's RLS.
import { TRPCError } from "@trpc/server";
import { Prisma } from "@andes/db";
import { beamFlexure, BeamFlexureInputError } from "@andes/structures";

import { router, tenantProcedure } from "../../trpc.js";
import { assertActiveProject } from "../projects/inspections.js";
import {
  calcRecordCreateSchema,
  calcRecordIdSchema,
  calcRecordListSchema,
  calcRecordUpdateSchema,
  checkAddSchema,
  checkIdSchema,
  checkUpdateSchema,
} from "./schemas.js";

const projectSummary = {
  select: { id: true, code: true, name: true },
} as const;

function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  );
}

interface CheckGeometry {
  b: number;
  h: number;
  cover: number;
  mu: number;
}

// Compute the stored outputs. BeamFlexureInputError means the geometry the
// user typed is invalid engineering input — a 400, never a 500.
function computeOutputs(fc: number, fy: number, geometry: CheckGeometry) {
  try {
    const result = beamFlexure({ ...geometry, fc, fy });
    return {
      d: result.d,
      rhoRequired: result.rhoRequired,
      rhoMin: result.rhoMin,
      rhoMax: result.rhoMax,
      requiredAs: result.requiredAs,
      verdict: result.verdict,
    };
  } catch (e) {
    if (e instanceof BeamFlexureInputError) {
      throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
    }
    throw e;
  }
}

function serializeCheck(check: {
  id: string;
  position: number;
  label: string;
  b: Prisma.Decimal;
  h: Prisma.Decimal;
  cover: Prisma.Decimal;
  mu: Prisma.Decimal;
  d: Prisma.Decimal;
  rhoRequired: Prisma.Decimal | null;
  rhoMin: Prisma.Decimal;
  rhoMax: Prisma.Decimal;
  requiredAs: Prisma.Decimal | null;
  verdict: string;
}) {
  return {
    id: check.id,
    position: check.position,
    label: check.label,
    b: check.b.toNumber(),
    h: check.h.toNumber(),
    cover: check.cover.toNumber(),
    mu: check.mu.toNumber(),
    d: check.d.toNumber(),
    rhoRequired: check.rhoRequired?.toNumber() ?? null,
    rhoMin: check.rhoMin.toNumber(),
    rhoMax: check.rhoMax.toNumber(),
    requiredAs: check.requiredAs?.toNumber() ?? null,
    verdict: check.verdict as "OK" | "USE_MIN" | "INCREASE_SECTION",
  };
}

async function getDraftRecord(
  tenantDb: {
    calcRecord: { findFirst(args: object): Promise<unknown> };
  },
  tenantId: string,
  id: string,
) {
  const record = (await tenantDb.calcRecord.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true, fc: true, fy: true },
  })) as {
    id: string;
    status: string;
    fc: Prisma.Decimal;
    fy: Prisma.Decimal;
  } | null;
  if (!record) throw new TRPCError({ code: "NOT_FOUND" });
  if (record.status !== "DRAFT") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Only draft calculation records can be edited.",
    });
  }
  return record;
}

export const calcRecordsRouter = router({
  list: tenantProcedure
    .input(calcRecordListSchema)
    .query(async ({ ctx, input }) => {
      const records = await ctx.tenantDb.calcRecord.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(input?.projectId ? { projectId: input.projectId } : {}),
          ...(input?.status ? { status: input.status } : {}),
        },
        include: {
          project: projectSummary,
          _count: { select: { checks: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return records.map((record) => ({
        ...record,
        fc: record.fc.toNumber(),
        fy: record.fy.toNumber(),
      }));
    }),

  get: tenantProcedure
    .input(calcRecordIdSchema)
    .query(async ({ ctx, input }) => {
      const record = await ctx.tenantDb.calcRecord.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        include: {
          project: projectSummary,
          checks: { orderBy: { position: "asc" } },
        },
      });
      if (!record) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        ...record,
        fc: record.fc.toNumber(),
        fy: record.fy.toNumber(),
        checks: record.checks.map(serializeCheck),
      };
    }),

  create: tenantProcedure
    .input(calcRecordCreateSchema)
    .mutation(async ({ ctx, input }) => {
      await assertActiveProject(ctx.tenantDb, ctx.tenantId, input.projectId);
      try {
        const created = await ctx.tenantDb.calcRecord.create({
          data: {
            ...input,
            tenantId: ctx.tenantId,
            createdById: ctx.session.userId,
          },
          include: { project: projectSummary },
        });
        return {
          ...created,
          fc: created.fc.toNumber(),
          fy: created.fy.toNumber(),
        };
      } catch (e) {
        if (isUniqueViolation(e)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A calculation record with code "${input.code}" already exists.`,
          });
        }
        throw e;
      }
    }),

  // DRAFT-only. Changing materials recomputes every check in the record —
  // stored outputs must always match the record's criteria. The updates
  // run sequentially (drafts are re-editable; a retry heals any partial
  // failure), never on issued records.
  update: tenantProcedure
    .input(calcRecordUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const existing = await getDraftRecord(ctx.tenantDb, ctx.tenantId, id);

      const materialsChanged =
        (fields.fc !== undefined && fields.fc !== existing.fc.toNumber()) ||
        (fields.fy !== undefined && fields.fy !== existing.fy.toNumber());

      try {
        await ctx.tenantDb.calcRecord.updateMany({
          where: { id, tenantId: ctx.tenantId },
          data: fields,
        });
      } catch (e) {
        if (isUniqueViolation(e)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A calculation record with code "${fields.code}" already exists.`,
          });
        }
        throw e;
      }

      if (materialsChanged) {
        const fc = fields.fc ?? existing.fc.toNumber();
        const fy = fields.fy ?? existing.fy.toNumber();
        const checks = await ctx.tenantDb.beamFlexureCheck.findMany({
          where: { calcRecordId: id, tenantId: ctx.tenantId },
        });
        for (const check of checks) {
          const outputs = computeOutputs(fc, fy, {
            b: check.b.toNumber(),
            h: check.h.toNumber(),
            cover: check.cover.toNumber(),
            mu: check.mu.toNumber(),
          });
          await ctx.tenantDb.beamFlexureCheck.updateMany({
            where: { id: check.id, tenantId: ctx.tenantId },
            data: outputs,
          });
        }
      }

      const updated = await ctx.tenantDb.calcRecord.findFirst({
        where: { id, tenantId: ctx.tenantId },
        include: {
          project: projectSummary,
          checks: { orderBy: { position: "asc" } },
        },
      });
      return updated
        ? {
            ...updated,
            fc: updated.fc.toNumber(),
            fy: updated.fy.toNumber(),
            checks: updated.checks.map(serializeCheck),
          }
        : null;
    }),

  // DRAFT → ISSUED: freezes the memoria as professional evidence. Requires
  // at least one check — a memoria without calculations is not issuable.
  issue: tenantProcedure
    .input(calcRecordIdSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.tenantDb.calcRecord.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: { status: true, _count: { select: { checks: true } } },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.status !== "DRAFT") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Only draft records can be issued.",
        });
      }
      if (existing._count.checks === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A record needs at least one check before issuing.",
        });
      }
      const issuedAt = new Date();
      await ctx.tenantDb.calcRecord.updateMany({
        where: { id: input.id, tenantId: ctx.tenantId },
        data: { status: "ISSUED", issuedAt },
      });
      return { id: input.id, status: "ISSUED" as const, issuedAt };
    }),

  addCheck: tenantProcedure
    .input(checkAddSchema)
    .mutation(async ({ ctx, input }) => {
      const { calcRecordId, label, ...geometry } = input;
      const record = await getDraftRecord(
        ctx.tenantDb,
        ctx.tenantId,
        calcRecordId,
      );
      const outputs = computeOutputs(
        record.fc.toNumber(),
        record.fy.toNumber(),
        geometry,
      );
      const position = await ctx.tenantDb.beamFlexureCheck.count({
        where: { calcRecordId, tenantId: ctx.tenantId },
      });
      const created = await ctx.tenantDb.beamFlexureCheck.create({
        data: {
          ...geometry,
          ...outputs,
          label,
          position,
          calcRecordId,
          tenantId: ctx.tenantId,
        },
      });
      return serializeCheck(created);
    }),

  updateCheck: tenantProcedure
    .input(checkUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, label, ...geometry } = input;
      const check = await ctx.tenantDb.beamFlexureCheck.findFirst({
        where: { id, tenantId: ctx.tenantId },
      });
      if (!check) throw new TRPCError({ code: "NOT_FOUND" });
      const record = await getDraftRecord(
        ctx.tenantDb,
        ctx.tenantId,
        check.calcRecordId,
      );
      const merged = {
        b: geometry.b ?? check.b.toNumber(),
        h: geometry.h ?? check.h.toNumber(),
        cover: geometry.cover ?? check.cover.toNumber(),
        mu: geometry.mu ?? check.mu.toNumber(),
      };
      const outputs = computeOutputs(
        record.fc.toNumber(),
        record.fy.toNumber(),
        merged,
      );
      await ctx.tenantDb.beamFlexureCheck.updateMany({
        where: { id, tenantId: ctx.tenantId },
        data: { ...merged, ...outputs, ...(label ? { label } : {}) },
      });
      const updated = await ctx.tenantDb.beamFlexureCheck.findFirst({
        where: { id, tenantId: ctx.tenantId },
      });
      return updated ? serializeCheck(updated) : null;
    }),

  removeCheck: tenantProcedure
    .input(checkIdSchema)
    .mutation(async ({ ctx, input }) => {
      const check = await ctx.tenantDb.beamFlexureCheck.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: { calcRecordId: true },
      });
      if (!check) throw new TRPCError({ code: "NOT_FOUND" });
      await getDraftRecord(ctx.tenantDb, ctx.tenantId, check.calcRecordId);
      await ctx.tenantDb.beamFlexureCheck.deleteMany({
        where: { id: input.id, tenantId: ctx.tenantId },
      });
      return { id: input.id };
    }),
});
