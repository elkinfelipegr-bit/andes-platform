// Geotechnical Module procedures (sprint-7.md scope item 3; ADR-003
// per-product routers, Andes Geo module). The Sprint 6 calculation
// pattern verbatim: the server is @andes/geo's ONLY caller — the UI
// never computes — and every check stores inputs + outputs together
// (immutable evidence). Simpler than Structures: soil parameters live
// per check, so there is no record-level recompute cascade.
import { TRPCError } from "@trpc/server";
import { Prisma } from "@andes/db";
import { bearingCapacity, BearingCapacityInputError } from "@andes/geo";

import { router, tenantProcedure } from "../../trpc.js";
import { assertActiveProject } from "../projects/inspections.js";
import {
  bearingCheckAddSchema,
  bearingCheckIdSchema,
  bearingCheckUpdateSchema,
  geoRecordCreateSchema,
  geoRecordIdSchema,
  geoRecordListSchema,
  geoRecordUpdateSchema,
} from "./schemas.js";

const projectSummary = {
  select: { id: true, code: true, name: true },
} as const;

function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  );
}

interface CheckInputs {
  b: number;
  df: number;
  gamma: number;
  c: number;
  phi: number;
  fs: number;
  shape: "STRIP" | "SQUARE";
}

// Compute the stored outputs. BearingCapacityInputError means invalid
// engineering input — a 400, never a 500.
function computeOutputs(inputs: CheckInputs) {
  try {
    const result = bearingCapacity(inputs);
    return {
      nc: result.nc,
      nq: result.nq,
      ngamma: result.ngamma,
      qUlt: result.qUlt,
      qAdm: result.qAdm,
    };
  } catch (e) {
    if (e instanceof BearingCapacityInputError) {
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
  df: Prisma.Decimal;
  gamma: Prisma.Decimal;
  c: Prisma.Decimal;
  phi: Prisma.Decimal;
  fs: Prisma.Decimal;
  shape: string;
  nc: Prisma.Decimal;
  nq: Prisma.Decimal;
  ngamma: Prisma.Decimal;
  qUlt: Prisma.Decimal;
  qAdm: Prisma.Decimal;
}) {
  return {
    id: check.id,
    position: check.position,
    label: check.label,
    b: check.b.toNumber(),
    df: check.df.toNumber(),
    gamma: check.gamma.toNumber(),
    c: check.c.toNumber(),
    phi: check.phi.toNumber(),
    fs: check.fs.toNumber(),
    shape: check.shape as "STRIP" | "SQUARE",
    nc: check.nc.toNumber(),
    nq: check.nq.toNumber(),
    ngamma: check.ngamma.toNumber(),
    qUlt: check.qUlt.toNumber(),
    qAdm: check.qAdm.toNumber(),
  };
}

async function getDraftRecord(
  tenantDb: { geoRecord: { findFirst(args: object): Promise<unknown> } },
  tenantId: string,
  id: string,
) {
  const record = (await tenantDb.geoRecord.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true },
  })) as { id: string; status: string } | null;
  if (!record) throw new TRPCError({ code: "NOT_FOUND" });
  if (record.status !== "DRAFT") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Only draft geotechnical records can be edited.",
    });
  }
  return record;
}

export const geoRecordsRouter = router({
  list: tenantProcedure.input(geoRecordListSchema).query(({ ctx, input }) =>
    ctx.tenantDb.geoRecord.findMany({
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
    }),
  ),

  get: tenantProcedure
    .input(geoRecordIdSchema)
    .query(async ({ ctx, input }) => {
      const record = await ctx.tenantDb.geoRecord.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        include: {
          project: projectSummary,
          checks: { orderBy: { position: "asc" } },
        },
      });
      if (!record) throw new TRPCError({ code: "NOT_FOUND" });
      return { ...record, checks: record.checks.map(serializeCheck) };
    }),

  create: tenantProcedure
    .input(geoRecordCreateSchema)
    .mutation(async ({ ctx, input }) => {
      await assertActiveProject(ctx.tenantDb, ctx.tenantId, input.projectId);
      try {
        return await ctx.tenantDb.geoRecord.create({
          data: {
            ...input,
            tenantId: ctx.tenantId,
            createdById: ctx.session.userId,
          },
          include: { project: projectSummary },
        });
      } catch (e) {
        if (isUniqueViolation(e)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A geotechnical record with code "${input.code}" already exists.`,
          });
        }
        throw e;
      }
    }),

  update: tenantProcedure
    .input(geoRecordUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      await getDraftRecord(ctx.tenantDb, ctx.tenantId, id);
      try {
        await ctx.tenantDb.geoRecord.updateMany({
          where: { id, tenantId: ctx.tenantId },
          data: fields,
        });
      } catch (e) {
        if (isUniqueViolation(e)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A geotechnical record with code "${fields.code}" already exists.`,
          });
        }
        throw e;
      }
      const updated = await ctx.tenantDb.geoRecord.findFirst({
        where: { id, tenantId: ctx.tenantId },
        include: {
          project: projectSummary,
          checks: { orderBy: { position: "asc" } },
        },
      });
      return updated
        ? { ...updated, checks: updated.checks.map(serializeCheck) }
        : null;
    }),

  // DRAFT → ISSUED: freezes the memoria as professional evidence.
  issue: tenantProcedure
    .input(geoRecordIdSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.tenantDb.geoRecord.findFirst({
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
      await ctx.tenantDb.geoRecord.updateMany({
        where: { id: input.id, tenantId: ctx.tenantId },
        data: { status: "ISSUED", issuedAt },
      });
      return { id: input.id, status: "ISSUED" as const, issuedAt };
    }),

  addCheck: tenantProcedure
    .input(bearingCheckAddSchema)
    .mutation(async ({ ctx, input }) => {
      const { geoRecordId, label, ...inputs } = input;
      await getDraftRecord(ctx.tenantDb, ctx.tenantId, geoRecordId);
      const outputs = computeOutputs(inputs);
      const position = await ctx.tenantDb.bearingCheck.count({
        where: { geoRecordId, tenantId: ctx.tenantId },
      });
      const created = await ctx.tenantDb.bearingCheck.create({
        data: {
          ...inputs,
          ...outputs,
          label,
          position,
          geoRecordId,
          tenantId: ctx.tenantId,
        },
      });
      return serializeCheck(created);
    }),

  updateCheck: tenantProcedure
    .input(bearingCheckUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, label, ...inputs } = input;
      const check = await ctx.tenantDb.bearingCheck.findFirst({
        where: { id, tenantId: ctx.tenantId },
      });
      if (!check) throw new TRPCError({ code: "NOT_FOUND" });
      await getDraftRecord(ctx.tenantDb, ctx.tenantId, check.geoRecordId);
      const merged = {
        b: inputs.b ?? check.b.toNumber(),
        df: inputs.df ?? check.df.toNumber(),
        gamma: inputs.gamma ?? check.gamma.toNumber(),
        c: inputs.c ?? check.c.toNumber(),
        phi: inputs.phi ?? check.phi.toNumber(),
        fs: inputs.fs ?? check.fs.toNumber(),
        shape: inputs.shape ?? (check.shape as "STRIP" | "SQUARE"),
      };
      const outputs = computeOutputs(merged);
      await ctx.tenantDb.bearingCheck.updateMany({
        where: { id, tenantId: ctx.tenantId },
        data: { ...merged, ...outputs, ...(label ? { label } : {}) },
      });
      const updated = await ctx.tenantDb.bearingCheck.findFirst({
        where: { id, tenantId: ctx.tenantId },
      });
      return updated ? serializeCheck(updated) : null;
    }),

  removeCheck: tenantProcedure
    .input(bearingCheckIdSchema)
    .mutation(async ({ ctx, input }) => {
      const check = await ctx.tenantDb.bearingCheck.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: { geoRecordId: true },
      });
      if (!check) throw new TRPCError({ code: "NOT_FOUND" });
      await getDraftRecord(ctx.tenantDb, ctx.tenantId, check.geoRecordId);
      await ctx.tenantDb.bearingCheck.deleteMany({
        where: { id: input.id, tenantId: ctx.tenantId },
      });
      return { id: input.id };
    }),
});
