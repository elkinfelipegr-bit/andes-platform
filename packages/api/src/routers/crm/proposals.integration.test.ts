// Integration tests for the proposals router — the full commercial
// lifecycle, forward-only transition denials, conversion, and the
// cross-tenant sweep PROJECT_RULES.md mandates at the strict tier.
// Same harness as the CRM/Projects suites.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@andes/db";

import type { Context, SessionInfo } from "../../context.js";
import { createCallerFactory } from "../../trpc.js";
import { appRouter } from "../core.js";

const APP_URL = process.env.APP_DATABASE_URL;

describe.skipIf(!APP_URL)("proposals router (integration)", () => {
  const admin = new PrismaClient();
  const app = new PrismaClient({ datasourceUrl: APP_URL });
  const createCaller = createCallerFactory(appRouter);

  const run = randomUUID().slice(0, 8);
  let tenantA!: { id: string };
  let tenantB!: { id: string };
  let user!: { id: string };

  function callerFor(tenantId: string) {
    const session: SessionInfo = {
      userId: user.id,
      email: `prop-${run}@test.local`,
      activeMembership: {
        membershipId: `m-${run}`,
        tenantId,
        tenantSlug: `slug-${tenantId}`,
        roleKey: "ENGINEER",
        roleLabel: "Engineer",
      },
    };
    const ctx: Context = { db: app, session };
    return createCaller(ctx);
  }

  beforeAll(async () => {
    tenantA = await admin.tenant.create({
      data: { name: `Prop Test A ${run}`, slug: `prop-a-${run}` },
    });
    tenantB = await admin.tenant.create({
      data: { name: `Prop Test B ${run}`, slug: `prop-b-${run}` },
    });
    user = await admin.user.create({
      data: { email: `prop-${run}@test.local`, name: "Prop Test User" },
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

  it("full lifecycle: draft with items → edit → send → accept → convert to linked project", async () => {
    const caller = callerFor(tenantA.id);
    const client = await caller.clients.create({ name: `Cliente ${run}` });
    const contact = await caller.contacts.create({
      clientId: client.id,
      name: "Ana",
    });

    const created = await caller.proposals.create({
      clientId: client.id,
      contactId: contact.id,
      code: `PR-${run}`,
      title: "Diseño estructural edificio",
      items: [
        { description: "Diseño", quantity: 450, unitPrice: 12000, unit: "m²" },
      ],
    });
    expect(created.total).toBe(5_400_000);
    expect(created.status).toBe("DRAFT");

    // Edit in draft: replace items, totals follow.
    const updated = await caller.proposals.update({
      id: created.id,
      items: [
        { description: "Diseño", quantity: 450, unitPrice: 12000, unit: "m²" },
        {
          description: "Memorias de cálculo",
          quantity: 1,
          unitPrice: 1_500_000,
          unit: "global",
        },
      ],
    });
    expect(updated.total).toBe(6_900_000);
    expect(updated.items).toHaveLength(2);

    await expect(caller.proposals.send({ id: created.id })).resolves.toEqual({
      id: created.id,
      status: "SENT",
    });

    // Sent proposals are frozen.
    await expect(
      caller.proposals.update({ id: created.id, title: "Cambio tardío" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await expect(
      caller.proposals.decide({ id: created.id, decision: "ACCEPTED" }),
    ).resolves.toEqual({ id: created.id, status: "ACCEPTED" });

    const converted = await caller.proposals.convertToProject({
      id: created.id,
      projectCode: `P-${run}`,
    });
    expect(converted.project?.code).toBe(`P-${run}`);

    // The project exists, belongs to the same client, and links back.
    const project = await caller.projects.get({ id: converted.project!.id });
    expect(project.client?.id).toBe(client.id);
    expect(project.status).toBe("DRAFT");
    const detail = await caller.proposals.get({ id: created.id });
    expect(detail.project?.id).toBe(converted.project?.id);

    // At most one conversion.
    await expect(
      caller.proposals.convertToProject({
        id: created.id,
        projectCode: `P2-${run}`,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("enforces forward-only transitions and item preconditions", async () => {
    const caller = callerFor(tenantA.id);
    const client = await caller.clients.create({ name: `Cliente T ${run}` });
    const empty = await caller.proposals.create({
      clientId: client.id,
      code: `PRT-${run}`,
      title: "Sin items",
    });

    // No items → cannot send.
    await expect(caller.proposals.send({ id: empty.id })).rejects.toMatchObject(
      { code: "BAD_REQUEST" },
    );
    // DRAFT cannot be decided or expired.
    await expect(
      caller.proposals.decide({ id: empty.id, decision: "REJECTED" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      caller.proposals.markExpired({ id: empty.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    // DRAFT cannot convert.
    await expect(
      caller.proposals.convertToProject({ id: empty.id, projectCode: "X" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    // SENT → EXPIRED is terminal: no decide afterwards.
    await caller.proposals.update({
      id: empty.id,
      items: [{ description: "Item", quantity: 1, unitPrice: 100, unit: "un" }],
    });
    await caller.proposals.send({ id: empty.id });
    await expect(
      caller.proposals.markExpired({ id: empty.id }),
    ).resolves.toEqual({ id: empty.id, status: "EXPIRED" });
    await expect(
      caller.proposals.decide({ id: empty.id, decision: "ACCEPTED" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects duplicate codes, foreign contacts, and cross-tenant access", async () => {
    const callerA = callerFor(tenantA.id);
    const callerB = callerFor(tenantB.id);

    const clientA = await callerA.clients.create({ name: `A ${run}` });
    const otherClientA = await callerA.clients.create({ name: `A2 ${run}` });
    const contactOfOther = await callerA.contacts.create({
      clientId: otherClientA.id,
      name: "Persona equivocada",
    });

    // Recipient must belong to the proposal's client.
    await expect(
      callerA.proposals.create({
        clientId: clientA.id,
        contactId: contactOfOther.id,
        code: `PRX-${run}`,
        title: "Mal destinatario",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const proposal = await callerA.proposals.create({
      clientId: clientA.id,
      code: `PRD-${run}`,
      title: "Original",
    });
    await expect(
      callerA.proposals.create({
        clientId: clientA.id,
        code: `PRD-${run}`,
        title: "Duplicada",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    // Tenant B sees and touches nothing.
    await expect(
      callerB.proposals.get({ id: proposal.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      callerB.proposals.update({ id: proposal.id, title: "Hijacked" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      callerB.proposals.send({ id: proposal.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const listedInB = await callerB.proposals.list();
    expect(listedInB.map((p) => p.id)).not.toContain(proposal.id);
  });

  it("client detail lists its proposals (clients.get join)", async () => {
    const caller = callerFor(tenantA.id);
    const client = await caller.clients.create({ name: `Con props ${run}` });
    const proposal = await caller.proposals.create({
      clientId: client.id,
      code: `PRJ-${run}`,
      title: "Listada en el cliente",
    });
    const detail = await caller.clients.get({ id: client.id });
    expect(detail.proposals.map((p) => p.id)).toContain(proposal.id);
  });
});
