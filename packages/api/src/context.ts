import type { PrismaClient } from "@andes/db";
import type { ActiveMembership } from "@andes/auth";

// What the tRPC layer needs from an authenticated session — a projection of
// @andes/auth's session payload, so procedures depend on this shape, not on
// Better Auth internals (ADR-003: scoping via shared middleware).
export interface SessionInfo {
  userId: string;
  email: string;
  activeMembership: ActiveMembership | null;
}

export interface Context {
  db: PrismaClient;
  session: SessionInfo | null;
}
