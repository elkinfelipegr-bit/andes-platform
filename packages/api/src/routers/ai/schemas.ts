// Zod input schemas for the AI Module (sprint-9-domain-model.md).
import { z } from "zod";

export const AI_MESSAGE_ROLES = ["USER", "ASSISTANT"] as const;
export const aiMessageRoleSchema = z.enum(AI_MESSAGE_ROLES);

export const conversationIdSchema = z.object({ id: z.string().min(1) });

// One user turn. Bounded: a question, not a document dump.
export const chatMessageSchema = z.string().trim().min(1).max(4000);

// The chat route's request body (validated there — it is not a tRPC
// procedure, but the boundary discipline is the same).
export const chatRequestSchema = z.object({
  conversationId: z.string().min(1).optional(),
  message: chatMessageSchema,
});
