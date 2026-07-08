// Integration tests for the CRM routers — enrichment CRUD, contact
// lifecycle, role-gated archival, and the cross-tenant denials
// PROJECT_RULES.md mandates at the strict tier. Same harness as the
// Projects suite: real middleware chain, real Postgres as `andes_app`.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@andes/db";

import type { Context, SessionInfo } from "../../context.js";
import { createCallerFactory } from "../../trpc.js";
import { appRouter } from "../core.js";

const APP_URL = process.env.APP_DATABASE_URL;

describe.skipIf(!APP_URL)("clients/contacts routers (integration)", () => {
  const admin = new PrismaClient();
  const app = new PrismaClient({ datasourceUrl: APP_URL });
  const createCaller = createCallerFactory(appRouter);

  const run = randomUUID().slice(0, 8);
  let tenantA!: { id: string };
  let tenantB!: { id: string };
  let user!: { id: string };

  function callerFor(tenantId: string, roleKey: "OWNER_ADMIN" | "ENGINEER") {
    const session: SessionInfo = {
      userId: user.id,
      email: `crm-${run}@test.local`,
      activeMembership: {
        membershipId: `m-${run}`,
        tenantId,
        tenantSlug: `slug-${tenantId}`,
        roleKey,
        roleLabel: roleKey,
      },
    };
    const ctx: Context = { db: app, session };
    return createCaller(ctx);
  }

  beforeAll(async () => {
    tenantA = await admin.tenant.create({
      data: { name: `CRM Test A ${run}`, slug: `crm-a-${run}` },
    });
    tenantB = await admin.tenant.create({
      data: { name: `CRM Test B ${run}`, slug: `crm-b-${run}` },
    });
    user = await admin.user.create({
      data: { email: `crm-${run}@test.local`, name: "CRM Test User" },
    });
  });

  afterAll(async () => {
    await admin.tenant.deleteMany({
      where: { id: { in: [tenantA.id, tenantB.id] } },
    });
    await admin.user.delete({ where: { id: user.id } });
    await admin.$disconnect();
    await app.$disconnect();
  });

  it("client enrichment lifecycle: create → update → get with contacts and projects", async () => {
    const engineer = callerFor(tenantA.id, "ENGINEER");

    const client = await engineer.clients.create({
      name: `Constructora ${run}`,
      taxId: "900.123.456-7",
      city: "Bogotá",
    });
    expect(client.taxId).toBe("900.123.456-7");

    const updated = await engineer.clients.update({
      id: client.id,
      industry: "Infraestructura",
      email: "info@constructora.co",
      taxId: null,
    });
    expect(updated?.industry).toBe("Infraestructura");
    expect(updated?.taxId).toBeNull();

    const contact = await engineer.contacts.create({
      clientId: client.id,
      name: `Ana ${run}`,
      title: "Interventora",
    });
    const project = await engineer.projects.create({
      code: `CRM-${run}`,
      name: "Vía secundaria",
      clientId: client.id,
    });

    const detail = await engineer.clients.get({ id: client.id });
    expect(detail.contacts.map((c) => c.id)).toContain(contact.id);
    expect(detail.projects.map((p) => p.id)).toContain(project.id);
  });

  it("contact update and hard delete (both roles allowed)", async () => {
    const engineer = callerFor(tenantA.id, "ENGINEER");
    const client = await engineer.clients.create({ name: `Cliente ${run}` });
    const contact = await engineer.contacts.create({
      clientId: client.id,
      name: "Carlos",
    });

    const updated = await engineer.contacts.update({
      id: contact.id,
      title: "Gerente de compras",
    });
    expect(updated?.title).toBe("Gerente de compras");

    await expect(engineer.contacts.delete({ id: contact.id })).resolves.toEqual(
      { id: contact.id },
    );
    const detail = await engineer.clients.get({ id: client.id });
    expect(detail.contacts.map((c) => c.id)).not.toContain(contact.id);
  });

  it("archive is OWNER_ADMIN-gated and does not touch the client's projects", async () => {
    const engineer = callerFor(tenantA.id, "ENGINEER");
    const owner = callerFor(tenantA.id, "OWNER_ADMIN");

    const client = await engineer.clients.create({ name: `Archivable ${run}` });
    const project = await engineer.projects.create({
      code: `ARC-${run}`,
      name: "Obra en curso",
      clientId: client.id,
      status: "ACTIVE",
    });

    await expect(
      engineer.clients.archive({ id: client.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      owner.clients.archive({ id: client.id }),
    ).resolves.toMatchObject({ id: client.id });

    // Ratified decision 1: the project keeps its client and its status.
    const still = await engineer.projects.get({ id: project.id });
    expect(still.client?.id).toBe(client.id);
    expect(still.status).toBe("ACTIVE");

    // Archived client leaves the default list, stays via includeArchived.
    const active = await engineer.clients.list();
    expect(active.map((c) => c.id)).not.toContain(client.id);
    const all = await engineer.clients.list({ includeArchived: true });
    expect(all.map((c) => c.id)).toContain(client.id);
  });

  it("denies cross-tenant access: get/update/archive/contact ops on foreign rows", async () => {
    const engineerA = callerFor(tenantA.id, "ENGINEER");
    const engineerB = callerFor(tenantB.id, "ENGINEER");
    const ownerB = callerFor(tenantB.id, "OWNER_ADMIN");

    const clientA = await engineerA.clients.create({ name: `Solo A ${run}` });
    const contactA = await engineerA.contacts.create({
      clientId: clientA.id,
      name: "Persona A",
    });

    await expect(
      engineerB.clients.get({ id: clientA.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      engineerB.clients.update({ id: clientA.id, name: "Hijacked" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      ownerB.clients.archive({ id: clientA.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      engineerB.contacts.update({ id: contactA.id, name: "Hijacked" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      engineerB.contacts.delete({ id: contactA.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Planting a contact under tenant A's client from tenant B fails.
    await expect(
      engineerB.contacts.create({ clientId: clientA.id, name: "Spy" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
