// The Copilot's streaming endpoint (RFC-003 choice 3: inside Andes Core,
// no new infrastructure; ADR-009: Anthropic via the Vercel AI SDK).
// Session and tenant context come from the same createContext the tRPC
// route uses; every tool call runs through a regular tRPC caller built
// from that context, so both RFC-001 isolation layers apply unchanged.
import { anthropic } from "@ai-sdk/anthropic";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  tool,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { z } from "zod";

import {
  appendMessage,
  chatMessageSchema,
  COPILOT_SYSTEM_PROMPT,
  copilotTools,
  createContext,
  createCopilotCaller,
  loadOwnConversation,
  type CopilotSessionCtx,
} from "@andes/api";
import { forTenant } from "@andes/db";

const bodySchema = z.object({
  conversationId: z.string().min(1),
  messages: z.array(z.custom<UIMessage>()),
});

// A model turn is minutes of tool calls + streaming, not the default 10s.
export const maxDuration = 60;

function lastUserText(messages: UIMessage[]): string | null {
  const last = [...messages].reverse().find((m) => m.role === "user");
  if (!last) return null;
  const text = last.parts
    .filter(
      (part): part is { type: "text"; text: string } => part.type === "text",
    )
    .map((part) => part.text)
    .join("\n");
  const parsed = chatMessageSchema.safeParse(text);
  return parsed.success ? parsed.data : null;
}

export async function POST(req: Request) {
  const ctx = await createContext(
    new Request("http://internal", { headers: req.headers }),
  );
  if (!ctx.session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const membership = ctx.session.activeMembership;
  if (!membership) {
    return Response.json({ error: "No tenant membership" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const { conversationId, messages } = parsed.data;

  const sessionCtx: CopilotSessionCtx = {
    tenantDb: forTenant(ctx.db, membership.tenantId),
    tenantId: membership.tenantId,
    userId: ctx.session.userId,
  };
  // Owner-verified: a colleague's (or another tenant's) conversation id
  // is a 404 before the model ever runs.
  const conversation = await loadOwnConversation(sessionCtx, conversationId);
  if (!conversation) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  const userText = lastUserText(messages);
  if (!userText) {
    return Response.json({ error: "No user message" }, { status: 400 });
  }

  // The read-only tool set (RFC-003), executed through the caller built
  // from THIS request's session.
  const caller = createCopilotCaller(ctx);
  const tools = Object.fromEntries(
    copilotTools.map((t) => [
      t.name,
      tool({
        description: t.description,
        inputSchema: t.inputSchema,
        execute: (input: unknown) => t.execute(caller, input),
      }),
    ]),
  );

  const result = streamText({
    model: anthropic(process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5"),
    system: COPILOT_SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: isStepCount(8),
    onFinish: async ({ text }) => {
      // Persist the turn only once it completed — a failed stream leaves
      // the conversation exactly as it was.
      await appendMessage(sessionCtx, conversation.id, "USER", userText);
      if (text.trim().length > 0) {
        await appendMessage(sessionCtx, conversation.id, "ASSISTANT", text);
      }
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
