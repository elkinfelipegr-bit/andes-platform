// Bridges Better Auth (ADR-002) into the tRPC Context (ADR-003): the only
// place the API layer touches the auth session shape.
import { auth } from "@andes/auth";
import { prisma } from "@andes/db";

import type { Context } from "./context.js";

export async function createContext(req: Request): Promise<Context> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return { db: prisma, session: null };
  }
  return {
    db: prisma,
    session: {
      userId: session.user.id,
      email: session.user.email,
      activeMembership: session.activeMembership ?? null,
    },
  };
}
