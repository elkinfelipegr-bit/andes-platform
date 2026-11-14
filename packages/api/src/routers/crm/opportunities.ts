// CRM pipeline procedures (sprint-15.md scope item 2; ADR-003 per-product
// routers, CRM module). Opportunities move freely between stages — the
// board is a working tool, not a document lifecycle (sprint-15-domain-
// model.md). Isolation is the established belt-and-braces: explicit
// tenantId filters (RFC-001 layer 1) over ctx.tenantDb's RLS (layer 2).
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@andes/db";

import { router, tenantProcedure } from "../../trpc.js";
import { dayToDate, followUpState, toDay } from "./follow-up.js";
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
import { proposalTotal } from "./proposal-total.js";

const clientSummary = { select: { id: true, name: true } } as const;
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
      message: "Contact not found for this client.",
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
      message: "Owner is not a member of this tenant.",
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
      const today = input?.today ?? toDay(new Date());
      const rows = await ctx.tenantDb.opportunity.findMany({
        where: { tenantId: ctx.tenantId },
        include: {
          client: clientSummary,
          owner: userSummary,
          activities: {
            orderBy: { occurredAt: "desc" },
            take: 1,
            select: { type: true, occurredAt: true },
          },
          _count: { select: { proposals: true, activities: true } },
        },
        orderBy: [{ nextActionAt: "asc" }, { updatedAt: "desc" }],
      });
      return rows.map(({ activities, estimatedValue, ...o }) => ({
        ...o,
        estimatedValue: money(estimatedValue),
        lastActivity: activities[0] ?? null,
        followUp: followUpState(
          { isOpen: isOpenStage(o.stage), nextActionAt: o.nextActionAt },
          today,
        ),
      }));
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
        proposals: o.proposals.map(({ items, ...p }) => ({
          ...p,
          total: proposalTotal(items),
        })),
      };
    }),

  create: tenantProcedure
    .input(opportunityCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const { nextActionAt, ownerId, ...fields } = input;
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
      const { id, nextActionAt, ...fields } = input;
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
      await ctx.tenantDb.opportunity.updateMany({
        where: { id: input.id, tenantId: ctx.tenantId },
        data: closing
          ? {
              stage: input.stage,
              // Keep the original close date when moving WON ↔ LOST.
              closedAt: existing.closedAt ?? new Date(),
              lostReason: input.stage === "LOST" ? input.lostReason : null,
              nextAction: null,
              nextActionAt: null,
            }
          : { stage: input.stage, closedAt: null, lostReason: null },
      });
      return { id: input.id, stage: input.stage };
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
