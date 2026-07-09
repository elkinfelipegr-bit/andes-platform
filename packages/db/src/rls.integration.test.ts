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
  let clientA!: { id: string };
  let projectA!: { id: string };
  let projectB!: { id: string };

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
    // Sprint 2 fixtures (sprint-2-domain-model.md): a client and a project
    // per tenant, to prove the same isolation holds for the new tables.
    clientA = await admin.client.create({
      data: { tenantId: tenantA.id, name: `Client A ${run}` },
    });
    projectA = await admin.project.create({
      data: {
        tenantId: tenantA.id,
        clientId: clientA.id,
        code: `P-A-${run}`,
        name: "Project in A",
        createdById: userInA.id,
      },
    });
    projectB = await admin.project.create({
      data: {
        tenantId: tenantB.id,
        code: `P-B-${run}`,
        name: "Project in B",
        createdById: userInA.id,
      },
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

  // ── Sprint 2: client / project (sprint-2-domain-model.md) ─────────────

  it("forTenant(A) sees only tenant A's projects and clients", async () => {
    const projects = await forTenant(app, tenantA.id).project.findMany();
    expect(projects.map((p) => p.id)).toContain(projectA.id);
    expect(projects.map((p) => p.id)).not.toContain(projectB.id);
    const clients = await forTenant(app, tenantA.id).client.findMany();
    expect(clients.map((c) => c.id)).toContain(clientA.id);
    expect(clients.every((c) => c.tenantId === tenantA.id)).toBe(true);
  });

  it("fails closed: no tenant context → no project/client rows at all", async () => {
    await expect(app.project.findMany()).resolves.toHaveLength(0);
    await expect(app.client.findMany()).resolves.toHaveLength(0);
  });

  it("rejects cross-tenant project writes (WITH CHECK)", async () => {
    await expect(
      forTenant(app, tenantA.id).project.create({
        data: {
          tenantId: tenantB.id,
          code: `EVIL-${run}`,
          name: "Evil project",
          createdById: userInA.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects cross-tenant project updates: tenant B's rows are not reachable", async () => {
    const updated = await forTenant(app, tenantA.id).project.updateMany({
      where: { id: projectB.id },
      data: { name: "Hijacked" },
    });
    expect(updated.count).toBe(0);
  });

  it("forUser grants nothing on project/client — no bootstrap branch by design", async () => {
    await expect(
      forUser(app, userInA.id).project.findMany(),
    ).resolves.toHaveLength(0);
    await expect(
      forUser(app, userInA.id).client.findMany(),
    ).resolves.toHaveLength(0);
  });

  // ── Sprint 3: contact (sprint-3-domain-model.md) ──────────────────────

  it("contact isolation: scoped reads, fail-closed, cross-tenant write denied, no forUser access", async () => {
    const contactA = await admin.contact.create({
      data: {
        tenantId: tenantA.id,
        clientId: clientA.id,
        name: `Contact A ${run}`,
      },
    });

    const seen = await forTenant(app, tenantA.id).contact.findMany();
    expect(seen.map((c) => c.id)).toContain(contactA.id);
    expect(seen.every((c) => c.tenantId === tenantA.id)).toBe(true);

    await expect(app.contact.findMany()).resolves.toHaveLength(0);

    await expect(
      forTenant(app, tenantB.id).contact.findMany(),
    ).resolves.toHaveLength(0);

    // Cross-tenant INSERT: tenant B context cannot plant a contact in A.
    await expect(
      forTenant(app, tenantB.id).contact.create({
        data: {
          tenantId: tenantA.id,
          clientId: clientA.id,
          name: `Evil ${run}`,
        },
      }),
    ).rejects.toThrow();

    await expect(
      forUser(app, userInA.id).contact.findMany(),
    ).resolves.toHaveLength(0);
  });

  // ── Sprint 4: proposal / proposal_item (sprint-4-domain-model.md) ─────

  it("proposal + item isolation: scoped reads, fail-closed, cross-tenant write denied, no forUser access", async () => {
    const proposalA = await admin.proposal.create({
      data: {
        tenantId: tenantA.id,
        clientId: clientA.id,
        code: `PR-A-${run}`,
        title: "Propuesta A",
        createdById: userInA.id,
        items: {
          create: [
            {
              tenantId: tenantA.id,
              position: 0,
              description: "Diseño estructural",
              quantity: 450,
              unit: "m²",
              unitPrice: 12000,
            },
          ],
        },
      },
    });

    const seen = await forTenant(app, tenantA.id).proposal.findMany();
    expect(seen.map((p) => p.id)).toContain(proposalA.id);
    const items = await forTenant(app, tenantA.id).proposalItem.findMany();
    expect(items.every((i) => i.tenantId === tenantA.id)).toBe(true);
    expect(items.length).toBeGreaterThan(0);

    await expect(app.proposal.findMany()).resolves.toHaveLength(0);
    await expect(app.proposalItem.findMany()).resolves.toHaveLength(0);

    await expect(
      forTenant(app, tenantB.id).proposal.findMany(),
    ).resolves.toHaveLength(0);

    await expect(
      forTenant(app, tenantB.id).proposal.create({
        data: {
          tenantId: tenantA.id,
          clientId: clientA.id,
          code: `PR-EVIL-${run}`,
          title: "Evil",
          createdById: userInA.id,
        },
      }),
    ).rejects.toThrow();

    await expect(
      forUser(app, userInA.id).proposal.findMany(),
    ).resolves.toHaveLength(0);
    await expect(
      forUser(app, userInA.id).proposalItem.findMany(),
    ).resolves.toHaveLength(0);
  });

  // ── Sprint 5: inspection / finding (sprint-5-domain-model.md) ─────────

  it("inspection + finding isolation: scoped reads, fail-closed, cross-tenant write denied, no forUser access", async () => {
    const inspectionA = await admin.inspection.create({
      data: {
        tenantId: tenantA.id,
        projectId: projectA.id,
        inspectorId: userInA.id,
        code: `INS-A-${run}`,
        title: "Visita de obra",
        scheduledFor: new Date("2026-08-01T09:00:00Z"),
        createdById: userInA.id,
        findings: {
          create: [
            {
              tenantId: tenantA.id,
              position: 0,
              description: "Fisura en viga eje 3",
              severity: "HIGH",
              location: "Piso 2",
            },
          ],
        },
      },
    });

    const seen = await forTenant(app, tenantA.id).inspection.findMany();
    expect(seen.map((i) => i.id)).toContain(inspectionA.id);
    const findings = await forTenant(app, tenantA.id).finding.findMany();
    expect(findings.every((f) => f.tenantId === tenantA.id)).toBe(true);
    expect(findings.length).toBeGreaterThan(0);

    await expect(app.inspection.findMany()).resolves.toHaveLength(0);
    await expect(app.finding.findMany()).resolves.toHaveLength(0);

    await expect(
      forTenant(app, tenantB.id).inspection.findMany(),
    ).resolves.toHaveLength(0);

    await expect(
      forTenant(app, tenantB.id).inspection.create({
        data: {
          tenantId: tenantA.id,
          projectId: projectA.id,
          inspectorId: userInA.id,
          code: `INS-EVIL-${run}`,
          title: "Evil",
          scheduledFor: new Date(),
          createdById: userInA.id,
        },
      }),
    ).rejects.toThrow();

    await expect(
      forUser(app, userInA.id).inspection.findMany(),
    ).resolves.toHaveLength(0);
    await expect(
      forUser(app, userInA.id).finding.findMany(),
    ).resolves.toHaveLength(0);
  });
});
