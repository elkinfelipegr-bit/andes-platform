// RLS integration tests — the strict-tier coverage RFC-001 mandates for
// tenant-isolation logic. These run against real Postgres as `andes_app`
// (non-superuser: superusers bypass RLS, so testing as `postgres` would
// prove nothing). Locally: `docker compose up -d` provides both identities;
// in CI a service container does (ADR-006).
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

import { forTenant, forUser } from "./tenant-client.js";

const APP_URL = process.env.APP_DATABASE_URL;

describe.skipIf(!APP_URL)("RLS tenant isolation (integration)", () => {
  // admin: superuser for fixture setup/teardown only.
  const admin = new PrismaClient();
  const app = new PrismaClient({ datasourceUrl: APP_URL });

  const run = randomUUID().slice(0, 8);
  let tenantA!: { id: string };
  let tenantB!: { id: string };
  let roleA!: { id: string };
  let roleB!: { id: string };
  let userInA!: { id: string };

  beforeAll(async () => {
    tenantA = await admin.tenant.create({
      data: { name: `RLS Test A ${run}`, slug: `rls-a-${run}` },
    });
    tenantB = await admin.tenant.create({
      data: { name: `RLS Test B ${run}`, slug: `rls-b-${run}` },
    });
    roleA = await admin.role.create({
      data: { tenantId: tenantA.id, key: "ENGINEER", label: "Engineer" },
    });
    roleB = await admin.role.create({
      data: { tenantId: tenantB.id, key: "ENGINEER", label: "Engineer" },
    });
    userInA = await admin.user.create({
      data: { email: `rls-${run}@test.local`, name: "RLS Test User" },
    });
    await admin.membership.create({
      data: { tenantId: tenantA.id, userId: userInA.id, roleId: roleA.id },
    });
  });

  afterAll(async () => {
    // Tenant delete cascades roles + memberships.
    await admin.tenant.deleteMany({
      where: { id: { in: [tenantA.id, tenantB.id] } },
    });
    await admin.user.delete({ where: { id: userInA.id } });
    await admin.$disconnect();
    await app.$disconnect();
  });

  it("forTenant(A) sees only tenant A's roles", async () => {
    const roles = await forTenant(app, tenantA.id).role.findMany();
    expect(roles.map((r) => r.id)).toContain(roleA.id);
    expect(roles.every((r) => r.tenantId === tenantA.id)).toBe(true);
    expect(roles.map((r) => r.id)).not.toContain(roleB.id);
  });

  it("fails closed: with no tenant context set, no rows are visible at all", async () => {
    await expect(app.role.findMany()).resolves.toHaveLength(0);
    await expect(app.membership.findMany()).resolves.toHaveLength(0);
  });

  it("forTenant(A) cannot see tenant B's memberships", async () => {
    const memberships = await forTenant(app, tenantA.id).membership.findMany();
    expect(memberships.every((m) => m.tenantId === tenantA.id)).toBe(true);
  });

  it("allows writes into the scoped tenant", async () => {
    const created = await forTenant(app, tenantA.id).role.create({
      data: { tenantId: tenantA.id, key: `TEMP_${run}`, label: "Temp" },
    });
    expect(created.tenantId).toBe(tenantA.id);
    await forTenant(app, tenantA.id).role.delete({ where: { id: created.id } });
  });

  it("rejects cross-tenant writes (WITH CHECK)", async () => {
    await expect(
      forTenant(app, tenantA.id).role.create({
        data: { tenantId: tenantB.id, key: `EVIL_${run}`, label: "Evil" },
      }),
    ).rejects.toThrow();
  });

  it("session bootstrap: forUser(u) resolves u's own membership incl. role, pre-tenant-context", async () => {
    const memberships = await forUser(app, userInA.id).membership.findMany({
      where: { userId: userInA.id },
      include: { role: true, tenant: true },
    });
    expect(memberships).toHaveLength(1);
    expect(memberships[0]!.tenantId).toBe(tenantA.id);
    expect(memberships[0]!.role.key).toBe("ENGINEER");
  });

  it("forUser(someone else) cannot see this user's memberships", async () => {
    const other = await forUser(app, "not-a-real-user").membership.findMany({
      where: { userId: userInA.id },
    });
    expect(other).toHaveLength(0);
  });

  it("forUser grants no blanket read: roles of tenants the user is not in stay invisible", async () => {
    const roles = await forUser(app, userInA.id).role.findMany();
    expect(roles.map((r) => r.id)).toContain(roleA.id); // own role via membership
    expect(roles.map((r) => r.id)).not.toContain(roleB.id);
  });
});
