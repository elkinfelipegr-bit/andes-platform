// Better Auth instance (ADR-002). Sessions resolve to the global User plus
// the tenant/role context RFC-001 requires on every authenticated request;
// the tRPC layer (@andes/api) reads that context, never the raw session.
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { customSession } from "better-auth/plugins";
import { forUser, prisma } from "@andes/db";

import { getActiveMembership } from "./membership.js";

export const auth = betterAuth({
  // Reads BETTER_AUTH_SECRET / BETTER_AUTH_URL from the environment.
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
  },
  advanced: {
    database: {
      // Let Prisma's @default(cuid()) generate ids, keeping id shape
      // uniform with the rest of the schema.
      generateId: false,
    },
  },
  plugins: [
    // Every session carries the user's tenant + role (ADR-002 consequence:
    // "Every authenticated session must resolve to a tenantId and role").
    // null activeMembership = authenticated but not yet in any tenant.
    // forUser: the lookup runs pre-tenant-context, so RLS admits it via
    // app.user_id — the user can only ever see their own memberships.
    customSession(async ({ user, session }) => ({
      user,
      session,
      activeMembership: await getActiveMembership(
        forUser(prisma, user.id),
        user.id,
      ),
    })),
  ],
});

export type Auth = typeof auth;
export type AuthSession = typeof auth.$Infer.Session;
