// CRM pipeline procedures (sprint-15.md scope item 2; ADR-003 per-product
// routers, CRM module). Opportunities move freely between stages — the
// board is a working tool, not a document lifecycle (sprint-15-domain-
// model.md). Isolation is the established belt-and-braces: explicit
// tenantId filters (RFC-001 layer 1) over ctx.tenantDb's RLS (layer 2).
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@andes/db";

import { roleProcedure, router, tenantProcedure } from "../../trpc.js";
import { dayToDate, toDay } from "./follow-up.js";
import { daysSince, effectiveProbability, weightedValue } from "./health.js";
import { assertClientInTenant } from "./index.js";
import {
  activityLogSchema,
  isOpenStage,
  opportunityCreateSchema,
  opportunityIdSchema,
  opportunityListSchema,
  opportunitySetStageSchema,
  opportunityUpdateSchema,
} from "./opportunity-schemas.js";
import {
  buildFirmReport,
  mailConfigFromEnv,
  renderFirmReport,
  reportRecipients,
  sendMail,
} from "../../reminders/report.js";
import { readPipeline } from "./pipeline-read.js";
import { proposalTotal } from "./proposal-total.js";

const contactSummary = {
  select: { id: true, name: true, title: true, email: true, phone: true },
} as const;
const userSummary = { select: { id: true, name: true } } as const;

type TenantDb = {
  contact: { findFirst(args: object): Promise<unknown> };
  membership: { findFirst(args: object): Promise<unknown> };
};

// A contact is user-controlled input: it must exist in this tenant AND
// belong to the opportunity's client.
async function assertContactOfClient(
  tenantDb: TenantDb,
  tenantId: string,
  clientId: string,
  contactId: string,
) {
  const contact = await tenantDb.contact.findFirst({
    where: { id: contactId, tenantId, clientId },
    select: { id: true },
  });
  if (!contact) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "El contacto no pertenece a este cliente.",
    });
  }
}

// An ownerId is user-controlled input, and User is global identity: the
// FK alone would accept any platform user. Require membership here.
async function assertOwnerIsMember(
  tenantDb: TenantDb,
  tenantId: string,
  ownerId: string,
) {
  const membership = await tenantDb.membership.findFirst({
    where: { userId: ownerId, tenantId },
    select: { id: true },
  });
  if (!membership) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "El responsable no es miembro de esta firma.",
    });
  }
}

function money(value: Prisma.Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}

export const opportunitiesRouter = router({
  // The whole pipeline in one read: the board, the agenda and the closed
  // list are all views of it. followUp is classified against the caller's
  // calendar day.
  list: tenantProcedure
    .input(opportunityListSchema)
    .query(async ({ ctx, input }) => {
      return readPipeline(
        ctx.tenantDb,
        ctx.tenantId,
        input?.today ?? toDay(new Date()),
        new Date(),
      );
    }),

  get: tenantProcedure
    .input(opportunityIdSchema)
    .query(async ({ ctx, input }) => {
      const o = await ctx.tenantDb.opportunity.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        include: {
          client: {
            select: { id: true, name: true, phone: true, email: true },
          },
          contact: contactSummary,
          owner: userSummary,
          activities: {
            orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
            include: { createdBy: userSummary },
          },
          proposals: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              code: true,
              title: true,
              status: true,
              currency: true,
              sentAt: true,
              validUntil: true,
              items: { select: { quantity: true, unitPrice: true } },
            },
          },
        },
      });
      if (!o) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        ...o,
        estimatedValue: money(o.estimatedValue),
        probability: effectiveProbability(o.stage, o.probability),
        probabilityIsDefault: o.probability === null,
        weightedValue: weightedValue(
          money(o.estimatedValue),
          o.stage,
          o.probability,
        ),
        daysInStage: daysSince(o.stageChangedAt, new Date()) ?? 0,
        proposals: o.proposals.map(({ items, ...p }) => ({
          ...p,
          total: proposalTotal(items),
        })),
      };
    }),

  create: tenantProcedure
    .input(opportunityCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const { nextActionAt, expectedCloseAt, ownerId, ...fields } = input;
      await assertClientInTenant(ctx.tenantDb, ctx.tenantId, input.clientId);
      if (input.contactId) {
        await assertContactOfClient(
          ctx.tenantDb,
          ctx.tenantId,
          input.clientId,
          input.contactId,
        );
      }
      const owner = ownerId ?? ctx.session.userId;
      await assertOwnerIsMember(ctx.tenantDb, ctx.tenantId, owner);
      const created = await ctx.tenantDb.opportunity.create({
        data: {
          ...fields,
          nextActionAt: nextActionAt ? dayToDate(nextActionAt) : undefined,
          expectedCloseAt: expectedCloseAt
            ? dayToDate(expectedCloseAt)
            : undefined,
          ownerId: owner,
          tenantId: ctx.tenantId,
          createdById: ctx.session.userId,
        },
      });
      return { ...created, estimatedValue: money(created.estimatedValue) };
    }),

  update: tenantProcedure
    .input(opportunityUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, nextActionAt, expectedCloseAt, ...fields } = input;
      const existing = await ctx.tenantDb.opportunity.findFirst({
        where: { id, tenantId: ctx.tenantId },
        select: { clientId: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (fields.contactId) {
        await assertContactOfClient(
          ctx.tenantDb,
          ctx.tenantId,
          existing.clientId,
          fields.contactId,
        );
      }
      if (fields.ownerId) {
        await assertOwnerIsMember(ctx.tenantDb, ctx.tenantId, fields.ownerId);
      }
      await ctx.tenantDb.opportunity.updateMany({
        where: { id, tenantId: ctx.tenantId },
        data: {
          ...fields,
          ...(nextActionAt !== undefined
            ? { nextActionAt: nextActionAt ? dayToDate(nextActionAt) : null }
            : {}),
          ...(expectedCloseAt !== undefined
            ? {
                expectedCloseAt: expectedCloseAt
                  ? dayToDate(expectedCloseAt)
                  : null,
              }
            : {}),
        },
      });
      return { id };
    }),

  // Free movement, including reopening. Closing stamps closedAt and
  // clears the next step (nothing is pending on a closed opportunity);
  // reopening clears closedAt and the lost reason.
  setStage: tenantProcedure
    .input(opportunitySetStageSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.tenantDb.opportunity.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: { stage: true, closedAt: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      const closing = !isOpenStage(input.stage);
      // Same stage again is not a move: keep the time-in-stage clock.
      const stageChangedAt =
        existing.stage === input.stage ? undefined : new Date();
      await ctx.tenantDb.opportunity.updateMany({
        where: { id: input.id, tenantId: ctx.tenantId },
        data: closing
          ? {
              stageChangedAt,
              stage: input.stage,
              // Keep the original close date when moving WON ↔ LOST.
              closedAt: existing.closedAt ?? new Date(),
              lostReason: input.stage === "LOST" ? input.lostReason : null,
              nextAction: null,
              nextActionAt: null,
            }
          : {
              stageChangedAt,
              stage: input.stage,
              closedAt: null,
              lostReason: null,
            },
      });
      return { id: input.id, stage: input.stage };
    }),

  // Send the firm's pipeline report now (ADR-012) — the same email the
  // scheduler sends each morning, on demand. OWNER_ADMIN only. Goes to the
  // configured recipients, or to the caller when none are configured.
  sendReport: roleProcedure("OWNER_ADMIN")
    .input(opportunityListSchema)
    .mutation(async ({ ctx, input }) => {
      const config = mailConfigFromEnv(process.env);
      if (!config) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "El envío de correo no está configurado en la plataforma.",
        });
      }
      const configured = reportRecipients(process.env.DIGEST_TO_EMAIL);
      const to = configured.length > 0 ? configured : [ctx.session.email];
      const report = await buildFirmReport(
        ctx.db,
        ctx.tenantId,
        input?.today ?? toDay(new Date()),
        new Date(),
      );
      const ok = await sendMail(config, {
        to,
        ...renderFirmReport(report, config.baseUrl),
      });
      if (!ok) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: "El proveedor de correo rechazó el envío.",
        });
      }
      return { sentTo: to };
    }),

  // Hard delete, OWNER_ADMIN only (sprint-16-domain-model.md: for records
  // created by mistake or as a test). Activities go with it; its
  // proposals survive, unlinked — a sent quote is the firm's record.
  delete: roleProcedure("OWNER_ADMIN")
    .input(opportunityIdSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.tenantDb.opportunity.deleteMany({
        where: { id: input.id, tenantId: ctx.tenantId },
      });
      if (result.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { id: input.id };
    }),

  // Log an interaction and, in the same gesture, set what comes next.
  logActivity: tenantProcedure
    .input(activityLogSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.tenantDb.opportunity.findFirst({
        where: { id: input.opportunityId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      const activity = await ctx.tenantDb.opportunityActivity.create({
        data: {
          tenantId: ctx.tenantId,
          opportunityId: input.opportunityId,
          type: input.type,
          body: input.body,
          occurredAt: input.occurredAt ?? new Date(),
          createdById: ctx.session.userId,
        },
      });
      if (input.nextAction !== undefined || input.nextActionAt !== undefined) {
        await ctx.tenantDb.opportunity.updateMany({
          where: { id: input.opportunityId, tenantId: ctx.tenantId },
          data: {
            ...(input.nextAction !== undefined
              ? { nextAction: input.nextAction }
              : {}),
            ...(input.nextActionAt !== undefined
              ? {
                  nextActionAt: input.nextActionAt
                    ? dayToDate(input.nextActionAt)
                    : null,
                }
              : {}),
          },
        });
      }
      return activity;
    }),
});
