// Integration tests for lead intake (ADR-011). There is no session on
// this path, so the tenant comes from configuration — strict tier: a lead
// must land in the configured tenant only, and matching against existing
// clients must never cross the tenant boundary.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@andes/db";

import { intakeLead, LeadIntakeError } from "./lead.js";

const APP_URL = process.env.APP_DATABASE_URL;

describe.skipIf(!APP_URL)("lead intake (integration)", () => {
  const admin = new PrismaClient();
  const app = new PrismaClient({ datasourceUrl: APP_URL });
  const run = randomUUID().slice(0, 8);
  const email = `lead-${run}@example.com`;
  let tenantA!: { id: string };
  let tenantB!: { id: string };
  let empty!: { id: string };
  let engineer!: { id: string };
  let owner!: { id: string };

  beforeAll(async () => {
    const mkTenant = (tag: string) =>
      admin.tenant.create({
        data: { name: `Lead ${tag} ${run}`, slug: `lead-${tag}-${run}` },
      });
    tenantA = await mkTenant("a");
    tenantB = await mkTenant("b");
    empty = await mkTenant("e");
    const mkUser = (tag: string) =>
      admin.user.create({
        data: { email: `lead-${tag}-${run}@test.local`, name: `Lead ${tag}` },
      });
    engineer = await mkUser("eng");
    owner = await mkUser("own");
    const engRole = await admin.role.create({
      data: { tenantId: tenantA.id, key: "ENGINEER", label: "Engineer" },
    });
    const ownRole = await admin.role.create({
      data: { tenantId: tenantA.id, key: "OWNER_ADMIN", label: "Owner" },
    });
    // The engineer joined first; the lead must still go to the owner.
    await admin.membership.create({
      data: {
        tenantId: tenantA.id,
        userId: engineer.id,
        roleId: engRole.id,
        createdAt: new Date("2024-01-01"),
      },
    });
    await admin.membership.create({
      data: { tenantId: tenantA.id, userId: owner.id, roleId: ownRole.id },
    });
    // Tenant B already has a client with the very same email.
    await admin.client.create({
      data: { tenantId: tenantB.id, name: "B's client", email },
    });
  });

  afterAll(async () => {
    await admin.tenant.deleteMany({
      where: { id: { in: [tenantA.id, tenantB.id, empty.id] } },
    });
    await admin.user.deleteMany({
      where: { id: { in: [engineer.id, owner.id] } },
    });
    await admin.$disconnect();
    await app.$disconnect();
  });

  const lead = {
    name: "Ana Pérez",
    email,
    phone: "300 000 0000",
    subject: "Planificador de lote — casa 2 pisos",
    message: "Lote 8 x 20 m, dos pisos.",
    source: "Website · Lot planner",
  };

  it("records client, opportunity and first note in the configured tenant, owned by the OWNER_ADMIN and due today", async () => {
    const { opportunityId, clientId } = await intakeLead(app, tenantA.id, lead);

    const o = await admin.opportunity.findUniqueOrThrow({
      where: { id: opportunityId },
      include: { activities: true, client: true },
    });
    expect(o.tenantId).toBe(tenantA.id);
    expect(o).toMatchObject({
      stage: "LEAD",
      title: lead.subject,
      source: "Website · Lot planner",
      ownerId: owner.id,
      nextAction: "Responder la solicitud del sitio web",
    });
    expect(o.nextActionAt?.toISOString().slice(0, 10)).toBe(
      new Date().toISOString().slice(0, 10),
    );
    expect(o.client).toMatchObject({
      id: clientId,
      tenantId: tenantA.id,
      name: "Ana Pérez",
      email,
    });
    expect(o.activities).toHaveLength(1);
    expect(o.activities[0]).toMatchObject({
      tenantId: tenantA.id,
      type: "NOTE",
    });
    expect(o.activities[0]?.body).toContain("Lote 8 x 20 m");
    expect(o.activities[0]?.body).toContain("300 000 0000");
  });

  it("never matches a client across tenants, and reuses its own on a second request", async () => {
    // Tenant B's same-email client was not reused by the first intake…
    const clientsA = await admin.client.findMany({
      where: { tenantId: tenantA.id, email },
    });
    expect(clientsA).toHaveLength(1);
    // …and B gained nothing.
    expect(
      await admin.opportunity.count({ where: { tenantId: tenantB.id } }),
    ).toBe(0);
    expect(await admin.client.count({ where: { tenantId: tenantB.id } })).toBe(
      1,
    );

    // Same person writes again, different capitalisation: same client.
    const again = await intakeLead(app, tenantA.id, {
      ...lead,
      email: email.toUpperCase(),
      subject: "Segunda consulta",
    });
    expect(again.clientId).toBe(clientsA[0]?.id);
    expect(await admin.client.count({ where: { tenantId: tenantA.id } })).toBe(
      1,
    );
    expect(
      await admin.opportunity.count({ where: { tenantId: tenantA.id } }),
    ).toBe(2);
  });

  it("uses the company as the client name when given, and works without an email", async () => {
    const { clientId } = await intakeLead(app, tenantA.id, {
      name: "Luis",
      company: `Constructora ${run}`,
      subject: "Consulta",
      message: "Sin correo.",
    });
    const client = await admin.client.findUniqueOrThrow({
      where: { id: clientId },
    });
    expect(client.name).toBe(`Constructora ${run}`);
    expect(client.email).toBeNull();
  });

  it("refuses a tenant with no members and an unknown tenant, writing nothing", async () => {
    await expect(intakeLead(app, empty.id, lead)).rejects.toBeInstanceOf(
      LeadIntakeError,
    );
    await expect(intakeLead(app, `nope-${run}`, lead)).rejects.toBeInstanceOf(
      LeadIntakeError,
    );
    expect(await admin.client.count({ where: { tenantId: empty.id } })).toBe(0);
  });
});
