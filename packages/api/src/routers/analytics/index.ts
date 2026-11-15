// Analytics procedures (sprint-14.md scope item 2; ADR-003 per-product
// routers). Analytics owns no entity: it reads what the other modules
// wrote. Every read goes through ctx.tenantDb MODEL operations — the
// tenant setting RLS keys on is applied to those, not to raw SQL — and
// the sums are done in the indicator library. An aggregate that counted
// another tenant's row would be a leak even with no row returned
// (RFC-001), hence the explicit tenantId filter on top (layer 1).
import { TRPCError } from "@trpc/server";

import { router, tenantProcedure } from "../../trpc.js";
import {
  commercialIndicators,
  engineeringIndicators,
  inspectionIndicators,
  periodBounds,
  projectIndicators,
} from "./indicators.js";
import { periodSchema } from "./schemas.js";

// A clientId filter is user-controlled: verify it inside this tenant so
// a foreign id yields an error, not a silently empty report.
async function assertClientFilter(
  tenantDb: { client: { findFirst(args: object): Promise<unknown> } },
  tenantId: string,
  clientId: string | undefined,
) {
  if (!clientId) return;
  const client = await tenantDb.client.findFirst({
    where: { id: clientId, tenantId },
    select: { id: true },
  });
  if (!client) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "El cliente no existe en esta firma.",
    });
  }
}

export const analyticsRouter = router({
  commercial: tenantProcedure
    .input(periodSchema)
    .query(async ({ ctx, input }) => {
      await assertClientFilter(ctx.tenantDb, ctx.tenantId, input.clientId);
      const rows = await ctx.tenantDb.proposal.findMany({
        where: {
          tenantId: ctx.tenantId,
          createdAt: periodBounds(input),
          ...(input.clientId ? { clientId: input.clientId } : {}),
        },
        select: {
          status: true,
          currency: true,
          createdAt: true,
          sentAt: true,
          decidedAt: true,
          items: { select: { quantity: true, unitPrice: true } },
        },
      });
      // Money is the firm's commercial position: OWNER_ADMIN only
      // (domain model, question 2). Counts stay visible to every member.
      return commercialIndicators(rows, input, {
        includeMoney: ctx.roleKey === "OWNER_ADMIN",
      });
    }),

  projects: tenantProcedure
    .input(periodSchema)
    .query(async ({ ctx, input }) => {
      await assertClientFilter(ctx.tenantDb, ctx.tenantId, input.clientId);
      const rows = await ctx.tenantDb.project.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(input.clientId ? { clientId: input.clientId } : {}),
        },
        select: {
          status: true,
          startDate: true,
          endDate: true,
          client: { select: { id: true, name: true } },
        },
      });
      return projectIndicators(rows, input);
    }),

  inspections: tenantProcedure
    .input(periodSchema)
    .query(async ({ ctx, input }) => {
      await assertClientFilter(ctx.tenantDb, ctx.tenantId, input.clientId);
      const bounds = periodBounds(input);
      const today = new Date().toISOString().slice(0, 10);
      const rows = await ctx.tenantDb.inspection.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(input.clientId ? { project: { clientId: input.clientId } } : {}),
          OR: [
            { scheduledFor: bounds },
            { performedAt: bounds },
            {
              status: "SCHEDULED",
              scheduledFor: { lt: new Date(`${today}T00:00:00.000Z`) },
            },
          ],
        },
        select: {
          status: true,
          scheduledFor: true,
          performedAt: true,
          findings: { select: { severity: true } },
        },
      });
      return inspectionIndicators(rows, input, today);
    }),

  engineering: tenantProcedure
    .input(periodSchema)
    .query(async ({ ctx, input }) => {
      await assertClientFilter(ctx.tenantDb, ctx.tenantId, input.clientId);
      const where = {
        tenantId: ctx.tenantId,
        createdAt: periodBounds(input),
        ...(input.clientId ? { project: { clientId: input.clientId } } : {}),
      };
      const [calc, geo] = await Promise.all([
        ctx.tenantDb.calcRecord.findMany({ where, select: { status: true } }),
        ctx.tenantDb.geoRecord.findMany({ where, select: { status: true } }),
      ]);
      return engineeringIndicators(calc, geo);
    }),
});
