// Tenant-scoping middleware — mandatory strict-tier tests per PROJECT_RULES
// and RFC-001 ("a scoping bug is a cross-customer data leak"). Unit tier:
// exercises the middleware chain via a caller with a disconnected Prisma
// client; the RLS layer itself (forTenant against real Postgres) is
// integration-tier and runs in CI (ADR-006, proposed).
import { describe, expect, it } from "vitest";
import { PrismaClient } from "@andes/db";

import type { Context, SessionInfo } from "./context.js";
import {
  createCallerFactory,
  protectedProcedure,
  publicProcedure,
  roleProcedure,
  router,
  tenantProcedure,
} from "./trpc.js";

const testRouter = router({
  whoami: publicProcedure.query(({ ctx }) => ctx.session?.userId ?? null),
  me: protectedProcedure.query(({ ctx }) => ctx.session.userId),
  tenantEcho: tenantProcedure.query(({ ctx }) => ({
    tenantId: ctx.tenantId,
    roleKey: ctx.roleKey,
    hasTenantDb: ctx.tenantDb !== undefined,
  })),
  adminOnly: roleProcedure("OWNER_ADMIN").query(({ ctx }) => ctx.roleKey),
});

const createCaller = createCallerFactory(testRouter);

// Never connects: middleware only composes the client; no query is issued.
const db = new PrismaClient({
  datasourceUrl: "postgresql://test:test@localhost:5432/never-connected",
});

function callerWith(session: SessionInfo | null) {
  const ctx: Context = { db, session };
  return createCaller(ctx);
}

const engineerSession: SessionInfo = {
  userId: "u1",
  email: "engineer@andes.example",
  activeMembership: {
    membershipId: "m1",
    tenantId: "t-andes",
    tenantSlug: "andes-engineering",
    roleKey: "ENGINEER",
    roleLabel: "Engineer",
  },
};

const ownerSession: SessionInfo = {
  ...engineerSession,
  userId: "u2",
  email: "owner@andes.example",
  activeMembership: {
    ...engineerSession.activeMembership!,
    membershipId: "m2",
    roleKey: "OWNER_ADMIN",
    roleLabel: "Owner / Admin",
  },
};

describe("publicProcedure", () => {
  it("runs without a session", async () => {
    await expect(callerWith(null).whoami()).resolves.toBeNull();
  });
});

describe("protectedProcedure", () => {
  it("rejects unauthenticated calls with UNAUTHORIZED", async () => {
    await expect(callerWith(null).me()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("passes the session through when authenticated", async () => {
    await expect(callerWith(engineerSession).me()).resolves.toBe("u1");
  });
});

describe("tenantProcedure", () => {
  it("rejects unauthenticated calls with UNAUTHORIZED", async () => {
    await expect(callerWith(null).tenantEcho()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects authenticated users without a tenant membership with FORBIDDEN", async () => {
    const noMembership: SessionInfo = { ...engineerSession, activeMembership: null };
    await expect(callerWith(noMembership).tenantEcho()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("injects the session's tenantId, roleKey, and an RLS-scoped client", async () => {
    await expect(callerWith(engineerSession).tenantEcho()).resolves.toEqual({
      tenantId: "t-andes",
      roleKey: "ENGINEER",
      hasTenantDb: true,
    });
  });
});

describe("roleProcedure", () => {
  it("rejects roles outside the allowed set with FORBIDDEN", async () => {
    await expect(callerWith(engineerSession).adminOnly()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("allows listed roles through", async () => {
    await expect(callerWith(ownerSession).adminOnly()).resolves.toBe("OWNER_ADMIN");
  });
});
