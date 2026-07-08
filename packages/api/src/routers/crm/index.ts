// Andes CRM procedures (sprint-3.md scope item 2; ADR-003 per-product
// routers). Owns Client (born in Sprint 2 as a minimal FK target) and
// Contact. Same belt-and-braces isolation as Projects: explicit tenantId
// where-clauses (RFC-001 layer 1) over ctx.tenantDb's RLS (layer 2).
import { TRPCError } from "@trpc/server";

import { roleProcedure, router, tenantProcedure } from "../../trpc.js";
import {
  clientCreateSchema,
  clientIdSchema,
  clientListSchema,
  clientUpdateSchema,
  contactCreateSchema,
  contactIdSchema,
  contactUpdateSchema,
} from "./schemas.js";

// A clientId from input is user-controlled: verify it exists inside THIS
// tenant before attaching anything to it (the FK alone cannot express
// same-tenant). Shared with the Projects router.
export async function assertClientInTenant(
  tenantDb: { client: { findFirst(args: object): Promise<unknown> } },
  tenantId: string,
  clientId: string,
) {
  const client = await tenantDb.client.findFirst({
    where: { id: clientId, tenantId },
    select: { id: true },
  });
  if (!client) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Client not found in this tenant.",
    });
  }
}

export const clientsRouter = router({
  // Active-only by default (ratified decision 1): archived clients leave
  // pickers but stay reachable via includeArchived.
  list: tenantProcedure.input(clientListSchema).query(({ ctx, input }) =>
    ctx.tenantDb.client.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(input?.includeArchived ? {} : { archivedAt: null }),
      },
      include: { _count: { select: { projects: true, contacts: true } } },
      orderBy: { name: "asc" },
    }),
  ),

  get: tenantProcedure.input(clientIdSchema).query(async ({ ctx, input }) => {
    const client = await ctx.tenantDb.client.findFirst({
      where: { id: input.id, tenantId: ctx.tenantId },
      include: {
        contacts: { orderBy: { name: "asc" } },
        projects: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            startDate: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!client) throw new TRPCError({ code: "NOT_FOUND" });
    return client;
  }),

  create: tenantProcedure.input(clientCreateSchema).mutation(({ ctx, input }) =>
    ctx.tenantDb.client.create({
      data: { ...input, tenantId: ctx.tenantId },
    }),
  ),

  update: tenantProcedure
    .input(clientUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updated = await ctx.tenantDb.client.updateMany({
        where: { id, tenantId: ctx.tenantId },
        data,
      });
      if (updated.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.tenantDb.client.findFirst({
        where: { id, tenantId: ctx.tenantId },
      });
    }),

  // Never deletes: projects reference clients and history survives
  // (ratified decision 1 — archival does not cascade to projects).
  archive: roleProcedure("OWNER_ADMIN")
    .input(clientIdSchema)
    .mutation(async ({ ctx, input }) => {
      const archivedAt = new Date();
      const archived = await ctx.tenantDb.client.updateMany({
        where: { id: input.id, tenantId: ctx.tenantId },
        data: { archivedAt },
      });
      if (archived.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { id: input.id, archivedAt };
    }),
});

export const contactsRouter = router({
  create: tenantProcedure
    .input(contactCreateSchema)
    .mutation(async ({ ctx, input }) => {
      await assertClientInTenant(ctx.tenantDb, ctx.tenantId, input.clientId);
      return ctx.tenantDb.contact.create({
        data: { ...input, tenantId: ctx.tenantId },
      });
    }),

  update: tenantProcedure
    .input(contactUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updated = await ctx.tenantDb.contact.updateMany({
        where: { id, tenantId: ctx.tenantId },
        data,
      });
      if (updated.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.tenantDb.contact.findFirst({
        where: { id, tenantId: ctx.tenantId },
      });
    }),

  // Hard delete by ratified decision 2: address-book data, no engineering
  // artifacts attached. Both roles may delete.
  delete: tenantProcedure
    .input(contactIdSchema)
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.tenantDb.contact.deleteMany({
        where: { id: input.id, tenantId: ctx.tenantId },
      });
      if (deleted.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { id: input.id };
    }),
});
