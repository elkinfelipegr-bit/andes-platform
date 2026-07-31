// Zod input schemas for the Administration module (sprint-12-domain-model.md).
import { z } from "zod";

// Stored and compared lowercased — acceptance is email-bound and must
// not fail on casing.
export const inviteEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(200);

export const createInvitationSchema = z.object({
  email: inviteEmailSchema,
  roleId: z.string().min(1),
});

export const invitationIdSchema = z.object({ id: z.string().min(1) });

export const inviteTokenSchema = z.object({
  token: z.string().trim().min(20).max(200),
});

export const changeRoleSchema = z.object({
  membershipId: z.string().min(1),
  roleId: z.string().min(1),
});

export const membershipIdSchema = z.object({
  membershipId: z.string().min(1),
});

// Ratified: 7-day expiry, transitioned lazily on read/accept (no cron).
export const INVITE_TTL_DAYS = 7;
