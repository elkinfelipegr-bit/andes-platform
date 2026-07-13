// Conversation persistence helpers for the streaming chat route (which
// is a Next.js route handler, not a tRPC procedure — RFC-003 choice 3).
// Same discipline as the router: tenant + owner filters on every query.
import type { TenantClient } from "@andes/db";

export interface CopilotSessionCtx {
  tenantDb: TenantClient;
  tenantId: string;
  userId: string;
}

const TITLE_MAX = 60;

export function deriveTitle(firstMessage: string): string {
  const compact = firstMessage.replace(/\s+/g, " ").trim();
  return compact.length <= TITLE_MAX
    ? compact
    : `${compact.slice(0, TITLE_MAX - 1)}…`;
}

/** Owner-verified load; null when missing or not the caller's. */
export async function loadOwnConversation(
  ctx: CopilotSessionCtx,
  conversationId: string,
) {
  return ctx.tenantDb.aiConversation.findFirst({
    where: {
      id: conversationId,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
    },
    include: { messages: { orderBy: { position: "asc" } } },
  });
}

export async function createConversation(
  ctx: CopilotSessionCtx,
  firstMessage: string,
) {
  return ctx.tenantDb.aiConversation.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      title: deriveTitle(firstMessage),
    },
    include: { messages: true },
  });
}

export async function appendMessage(
  ctx: CopilotSessionCtx,
  conversationId: string,
  role: "USER" | "ASSISTANT",
  content: string,
) {
  const position = await ctx.tenantDb.aiMessage.count({
    where: { conversationId, tenantId: ctx.tenantId },
  });
  await ctx.tenantDb.aiMessage.create({
    data: { tenantId: ctx.tenantId, conversationId, role, content, position },
  });
  // Bump updatedAt so the conversation list orders by recent activity.
  await ctx.tenantDb.aiConversation.updateMany({
    where: { id: conversationId, tenantId: ctx.tenantId },
    data: { updatedAt: new Date() },
  });
}
