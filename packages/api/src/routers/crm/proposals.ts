// Proposal Generator procedures (sprint-4.md scope item 2; ADR-003
// per-product routers, CRM module). Forward-only lifecycle enforced here
// (ratified decision 3): content edits only in DRAFT; SENT moves to
// ACCEPTED/REJECTED/EXPIRED; decided states are terminal. Isolation is
// the established belt-and-braces: explicit tenantId filters (layer 1)
// over ctx.tenantDb's RLS (layer 2).
import { TRPCError } from "@trpc/server";
import { Prisma } from "@andes/db";

import { router, tenantProcedure } from "../../trpc.js";
import { assertClientInTenant } from "./index.js";
import {
  proposalConvertSchema,
  proposalCreateSchema,
  proposalDecideSchema,
  proposalIdSchema,
  proposalListSchema,
  proposalUpdateSchema,
} from "./proposal-schemas.js";
import { proposalTotal } from "./proposal-total.js";

const clientSummary = { select: { id: true, name: true } } as const;
const contactSummary = {
  select: { id: true, name: true, title: true, email: true },
} as const;
const projectSummary = {
  select: { id: true, code: true, name: true },
} as const;

function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  );
}

function serializeItem(item: {
  id: string;
  position: number;
  description: string;
  quantity: Prisma.Decimal;
  unit: string;
  unitPrice: Prisma.Decimal;
}) {
  return {
    id: item.id,
    position: item.position,
    description: item.description,
    quantity: item.quantity.toNumber(),
    unit: item.unit,
    unitPrice: item.unitPrice.toNumber(),
  };
}

// A recipient contact is user-controlled input: it must exist in this
// tenant AND belong to the proposal's client.
async function assertContactOfClient(
  tenantDb: { contact: { findFirst(args: object): Promise<unknown> } },
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

export const proposalsRouter = router({
  list: tenantProcedure
    .input(proposalListSchema)
    .query(async ({ ctx, input }) => {
      const proposals = await ctx.tenantDb.proposal.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(input?.status ? { status: input.status } : {}),
        },
        include: {
          client: clientSummary,
          items: { select: { quantity: true, unitPrice: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return proposals.map(({ items, ...p }) => ({
        ...p,
        total: proposalTotal(items),
        itemCount: items.length,
      }));
    }),

  get: tenantProcedure.input(proposalIdSchema).query(async ({ ctx, input }) => {
    const proposal = await ctx.tenantDb.proposal.findFirst({
      where: { id: input.id, tenantId: ctx.tenantId },
      include: {
        client: clientSummary,
        contact: contactSummary,
        project: projectSummary,
        items: { orderBy: { position: "asc" } },
      },
    });
    if (!proposal) throw new TRPCError({ code: "NOT_FOUND" });
    return {
      ...proposal,
      items: proposal.items.map(serializeItem),
      total: proposalTotal(proposal.items),
    };
  }),

  create: tenantProcedure
    .input(proposalCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const { items, contactId, ...fields } = input;
      await assertClientInTenant(ctx.tenantDb, ctx.tenantId, input.clientId);
      if (contactId) {
        await assertContactOfClient(
          ctx.tenantDb,
          ctx.tenantId,
          input.clientId,
          contactId,
        );
      }
      try {
        const created = await ctx.tenantDb.proposal.create({
          data: {
            ...fields,
            contactId,
            tenantId: ctx.tenantId,
            createdById: ctx.session.userId,
            items: {
              create: items.map((item, position) => ({
                ...item,
                position,
                tenantId: ctx.tenantId,
              })),
            },
          },
          include: { items: { orderBy: { position: "asc" } } },
        });
        return {
          ...created,
          items: created.items.map(serializeItem),
          total: proposalTotal(created.items),
        };
      } catch (e) {
        if (isUniqueViolation(e)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A proposal with code "${input.code}" already exists.`,
          });
        }
        throw e;
      }
    }),

  // Content edits are DRAFT-only: once sent, the proposal is what the
  // client saw (a revision is a new proposal — ratified decision 3).
  update: tenantProcedure
    .input(proposalUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, items, contactId, ...fields } = input;
      const existing = await ctx.tenantDb.proposal.findFirst({
        where: { id, tenantId: ctx.tenantId },
        select: { status: true, clientId: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.status !== "DRAFT") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Only draft proposals can be edited.",
        });
      }
      if (contactId) {
        await assertContactOfClient(
          ctx.tenantDb,
          ctx.tenantId,
          existing.clientId,
          contactId,
        );
      }
      try {
        // Single nested write so the item replacement is atomic; the
        // tenant scope was verified above and RLS backstops the update.
        const updated = await ctx.tenantDb.proposal.update({
          where: { id },
          data: {
            ...fields,
            ...(contactId !== undefined ? { contactId } : {}),
            ...(items
              ? {
                  items: {
                    deleteMany: {},
                    create: items.map((item, position) => ({
                      ...item,
                      position,
                      tenantId: ctx.tenantId,
                    })),
                  },
                }
              : {}),
          },
          include: { items: { orderBy: { position: "asc" } } },
        });
        return {
          ...updated,
          items: updated.items.map(serializeItem),
          total: proposalTotal(updated.items),
        };
      } catch (e) {
        if (isUniqueViolation(e)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A proposal with code "${fields.code}" already exists.`,
          });
        }
        throw e;
      }
    }),

  send: tenantProcedure
    .input(proposalIdSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.tenantDb.proposal.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: { status: true, _count: { select: { items: true } } },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.status !== "DRAFT") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Only draft proposals can be sent.",
        });
      }
      if (existing._count.items === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A proposal needs at least one item before sending.",
        });
      }
      await ctx.tenantDb.proposal.updateMany({
        where: { id: input.id, tenantId: ctx.tenantId },
        data: { status: "SENT" },
      });
      return { id: input.id, status: "SENT" as const };
    }),

  decide: tenantProcedure
    .input(proposalDecideSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.tenantDb.proposal.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: { status: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.status !== "SENT") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Only sent proposals can be decided.",
        });
      }
      await ctx.tenantDb.proposal.updateMany({
        where: { id: input.id, tenantId: ctx.tenantId },
        data: { status: input.decision },
      });
      return { id: input.id, status: input.decision };
    }),

  markExpired: tenantProcedure
    .input(proposalIdSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.tenantDb.proposal.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: { status: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.status !== "SENT") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Only sent proposals can expire.",
        });
      }
      await ctx.tenantDb.proposal.updateMany({
        where: { id: input.id, tenantId: ctx.tenantId },
        data: { status: "EXPIRED" },
      });
      return { id: input.id, status: "EXPIRED" as const };
    }),

  // ACCEPTED → Project, at most once (ratified decision 4). The nested
  // create makes project creation and the projectId stamp atomic.
  convertToProject: tenantProcedure
    .input(proposalConvertSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.tenantDb.proposal.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: { status: true, clientId: true, title: true, projectId: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.status !== "ACCEPTED") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Only accepted proposals can be converted.",
        });
      }
      if (existing.projectId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This proposal was already converted to a project.",
        });
      }
      try {
        const converted = await ctx.tenantDb.proposal.update({
          where: { id: input.id },
          data: {
            project: {
              create: {
                tenantId: ctx.tenantId,
                clientId: existing.clientId,
                code: input.projectCode,
                name: input.projectName ?? existing.title,
                createdById: ctx.session.userId,
              },
            },
          },
          include: { project: projectSummary },
        });
        return { id: input.id, project: converted.project };
      } catch (e) {
        if (isUniqueViolation(e)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A project with code "${input.projectCode}" already exists.`,
          });
        }
        throw e;
      }
    }),
});
