// AI Module procedures (sprint-9.md scope item 2; ADR-003 per-product
// routers, Andes AI module). Conversations are the platform's first
// USER-PRIVATE records: tenant scoping as everywhere (middleware + RLS)
// plus an owner filter on every procedure — a same-tenant colleague
// must never read another engineer's chats. Owner-deletable by
// ratified decision (working aid, not engineering evidence).
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { router, tenantProcedure } from "../../trpc.js";
import { chatMessageSchema, conversationIdSchema } from "./schemas.js";
import { deriveTitle } from "./service.js";

export const aiRouter = router({
  // Created BEFORE the first streamed turn so the chat route always
  // receives an owned conversation id — no id handshake mid-stream.
  createConversation: tenantProcedure
    .input(z.object({ firstMessage: chatMessageSchema }))
    .mutation(({ ctx, input }) =>
      ctx.tenantDb.aiConversation.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.session.userId,
          title: deriveTitle(input.firstMessage),
        },
      }),
    ),

  listConversations: tenantProcedure.query(({ ctx }) =>
    ctx.tenantDb.aiConversation.findMany({
      where: { tenantId: ctx.tenantId, userId: ctx.session.userId },
      include: { _count: { select: { messages: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ),

  getConversation: tenantProcedure
    .input(conversationIdSchema)
    .query(async ({ ctx, input }) => {
      const conversation = await ctx.tenantDb.aiConversation.findFirst({
        where: {
          id: input.id,
          tenantId: ctx.tenantId,
          userId: ctx.session.userId,
        },
        include: { messages: { orderBy: { position: "asc" } } },
      });
      if (!conversation) throw new TRPCError({ code: "NOT_FOUND" });
      return conversation;
    }),

  deleteConversation: tenantProcedure
    .input(conversationIdSchema)
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.tenantDb.aiConversation.deleteMany({
        where: {
          id: input.id,
          tenantId: ctx.tenantId,
          userId: ctx.session.userId,
        },
      });
      if (deleted.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { id: input.id };
    }),
});
