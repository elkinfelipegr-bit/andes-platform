// Integration tests for the pipeline router (sprint-15.md): lifecycle,
// the two proposal automations, the domain denials, and the cross-tenant
// sweep PROJECT_RULES.md mandates at the strict tier — including every
// user-controlled foreign id. Same harness as the proposals suite.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@andes/db";

import type { Context, SessionInfo } from "../../context.js";
import { createCallerFactory } from "../../trpc.js";
import { appRouter } from "../core.js";

const APP_URL = process.env.APP_DATABASE_URL;

describe.skipIf(!APP_URL)("opportunities router (integration)", () => {
  const admin = new PrismaClient();
  const app = new PrismaClient({ datasourceUrl: APP_URL });
  const createCaller = createCallerFactory(appRouter);

  const run = randomUUID().slice(0, 8);
  let tenantA!: { id: string };
  let tenantB!: { id: string };
  let userA!: { id: string };
  let userA2!: { id: string };
  let userB!: { id: string };

  function callerFor(tenantId: string, userId: string) {
    const session: SessionInfo = {
      userId,
      email: `opp-${run}@test.local`,
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
      data: { name: `Opp Test A ${run}`, slug: `opp-a-${run}` },
    });
    tenantB = await admin.tenant.create({
      data: { name: `Opp Test B ${run}`, slug: `opp-b-${run}` },
    });
    const roleA = await admin.role.create({
      data: { tenantId: tenantA.id, key: "ENGINEER", label: "Engineer" },
    });
    const roleB = await admin.role.create({
      data: { tenantId: tenantB.id, key: "ENGINEER", label: "Engineer" },
    });
    const mk = (tag: string) =>
      admin.user.create({
        data: { email: `opp-${tag}-${run}@test.local`, name: `Opp ${tag}` },
      });
    userA = await mk("a");
    userA2 = await mk("a2");
    userB = await mk("b");
    await admin.membership.createMany({
      data: [
        { tenantId: tenantA.id, userId: userA.id, roleId: roleA.id },
        { tenantId: tenantA.id, userId: userA2.id, roleId: roleA.id },
        { tenantId: tenantB.id, userId: userB.id, roleId: roleB.id },
      ],
    });
  });

  afterAll(async () => {
    await admin.tenant.deleteMany({
      where: { id: { in: [tenantA.id, tenantB.id] } },
    });
    await admin.user.deleteMany({
      where: { id: { in: [userA.id, userA2.id, userB.id] } },
    });
    await admin.$disconnect();
    await app.$disconnect();
  });

  it("lifecycle: create → log activity with next step → move → lose with reason → reopen", async () => {
    const caller = callerFor(tenantA.id, userA.id);
    const client = await caller.clients.create({ name: `Prospecto ${run}` });

    const created = await caller.opportunities.create({
      clientId: client.id,
      title: "Diseño estructural bodega",
      estimatedValue: 18_500_000,
      source: "Web",
    });
    expect(created.stage).toBe("LEAD");
    expect(created.ownerId).toBe(userA.id);
    expect(created.estimatedValue).toBe(18_500_000);

    await caller.opportunities.logActivity({
      opportunityId: created.id,
      type: "CALL",
      body: "Pidió cotización, envía planos el lunes.",
      nextAction: "Revisar planos y cotizar",
      nextActionAt: "2026-11-16",
    });
    await caller.opportunities.setStage({ id: created.id, stage: "CONTACTED" });
    await caller.opportunities.update({ id: created.id, ownerId: userA2.id });

    const detail = await caller.opportunities.get({ id: created.id });
    expect(detail.stage).toBe("CONTACTED");
    expect(detail.owner.id).toBe(userA2.id);
    expect(detail.nextAction).toBe("Revisar planos y cotizar");
    expect(detail.nextActionAt?.toISOString()).toBe("2026-11-16T00:00:00.000Z");
    expect(detail.activities).toHaveLength(1);
    expect(detail.activities[0]).toMatchObject({
      type: "CALL",
      createdBy: { id: userA.id },
    });

    // followUp is classified against the caller's calendar day.
    const at = async (today: string) =>
      (await caller.opportunities.list({ today })).find(
        (o) => o.id === created.id,
      )?.followUp;
    expect(await at("2026-11-17")).toBe("OVERDUE");
    expect(await at("2026-11-16")).toBe("TODAY");
    expect(await at("2026-11-10")).toBe("UPCOMING");
    expect(await at("2026-10-01")).toBe("LATER");

    // Losing needs a reason, stamps closedAt and clears the next step.
    await expect(
      caller.opportunities.setStage({ id: created.id, stage: "LOST" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await caller.opportunities.setStage({
      id: created.id,
      stage: "LOST",
      lostReason: "Precio",
    });
    const lost = await caller.opportunities.get({ id: created.id });
    expect(lost).toMatchObject({
      stage: "LOST",
      lostReason: "Precio",
      nextAction: null,
      nextActionAt: null,
    });
    expect(lost.closedAt).not.toBeNull();
    expect(await at("2026-11-17")).toBeNull();

    // Reopening is allowed and starts clean.
    await caller.opportunities.setStage({
      id: created.id,
      stage: "NEGOTIATION",
    });
    const reopened = await caller.opportunities.get({ id: created.id });
    expect(reopened).toMatchObject({
      stage: "NEGOTIATION",
      closedAt: null,
      lostReason: null,
    });
    expect(await at("2026-11-17")).toBe("NONE");
  });

  it("proposal automation: send → QUOTED, accept → WON; timestamps stamped; rejection leaves the stage", async () => {
    const caller = callerFor(tenantA.id, userA.id);
    const client = await caller.clients.create({ name: `Auto ${run}` });
    const opp = await caller.opportunities.create({
      clientId: client.id,
      title: "Reforzamiento",
      nextAction: "Enviar cotización",
      nextActionAt: "2026-11-20",
    });
    const item = {
      description: "Diseño",
      quantity: 1,
      unit: "global",
      unitPrice: 9_000_000,
    };

    const first = await caller.proposals.create({
      clientId: client.id,
      opportunityId: opp.id,
      code: `OA-${run}`,
      title: "Reforzamiento v1",
      items: [item],
    });
    await caller.proposals.send({ id: first.id });
    expect((await caller.opportunities.get({ id: opp.id })).stage).toBe(
      "QUOTED",
    );
    const sent = await caller.proposals.get({ id: first.id });
    expect(sent.sentAt).not.toBeNull();
    expect(sent.decidedAt).toBeNull();
    expect(sent.opportunity?.id).toBe(opp.id);

    // A rejection does not lose the opportunity.
    await caller.proposals.decide({ id: first.id, decision: "REJECTED" });
    expect((await caller.proposals.get({ id: first.id })).decidedAt).not.toBe(
      null,
    );
    expect((await caller.opportunities.get({ id: opp.id })).stage).toBe(
      "QUOTED",
    );

    // Sending a second quote must not pull a later stage back to QUOTED.
    await caller.opportunities.setStage({ id: opp.id, stage: "NEGOTIATION" });
    const second = await caller.proposals.create({
      clientId: client.id,
      opportunityId: opp.id,
      code: `OB-${run}`,
      title: "Reforzamiento v2",
      items: [item],
    });
    await caller.proposals.send({ id: second.id });
    expect((await caller.opportunities.get({ id: opp.id })).stage).toBe(
      "NEGOTIATION",
    );

    await caller.proposals.decide({ id: second.id, decision: "ACCEPTED" });
    const won = await caller.opportunities.get({ id: opp.id });
    expect(won).toMatchObject({
      stage: "WON",
      nextAction: null,
      nextActionAt: null,
    });
    expect(won.closedAt).not.toBeNull();
    expect(won.proposals.map((p) => p.code).sort()).toEqual(
      [`OA-${run}`, `OB-${run}`].sort(),
    );
    expect(won.proposals[0]?.total).toBe(9_000_000);
  });

  it("refuses foreign ids inside the tenant's own rules: contact of another client, non-member owner, opportunity of another client", async () => {
    const caller = callerFor(tenantA.id, userA.id);
    const clientOne = await caller.clients.create({ name: `Uno ${run}` });
    const clientTwo = await caller.clients.create({ name: `Dos ${run}` });
    const contactTwo = await caller.contacts.create({
      clientId: clientTwo.id,
      name: "De otro cliente",
    });

    await expect(
      caller.opportunities.create({
        clientId: clientOne.id,
        contactId: contactTwo.id,
        title: "x",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    // userB is a real platform user but not a member of tenant A.
    await expect(
      caller.opportunities.create({
        clientId: clientOne.id,
        title: "x",
        ownerId: userB.id,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const opp = await caller.opportunities.create({
      clientId: clientOne.id,
      title: "De cliente uno",
    });
    await expect(
      caller.opportunities.update({ id: opp.id, ownerId: userB.id }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.opportunities.update({ id: opp.id, contactId: contactTwo.id }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.proposals.create({
        clientId: clientTwo.id,
        opportunityId: opp.id,
        code: `OX-${run}`,
        title: "Cruce de clientes",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("denies cross-tenant access on every procedure and every foreign id", async () => {
    const a = callerFor(tenantA.id, userA.id);
    const b = callerFor(tenantB.id, userB.id);

    const clientA = await a.clients.create({ name: `Solo A ${run}` });
    const contactA = await a.contacts.create({
      clientId: clientA.id,
      name: "Persona A",
    });
    const oppA = await a.opportunities.create({
      clientId: clientA.id,
      title: `Secreto A ${run}`,
      estimatedValue: 1,
    });
    await a.opportunities.logActivity({
      opportunityId: oppA.id,
      body: "Nota privada de A",
    });
    const clientB = await b.clients.create({ name: `Solo B ${run}` });

    // Reads.
    expect((await b.opportunities.list()).map((o) => o.id)).not.toContain(
      oppA.id,
    );
    await expect(b.opportunities.get({ id: oppA.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    // Writes on A's row.
    await expect(
      b.opportunities.update({ id: oppA.id, title: "Hijacked" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      b.opportunities.setStage({ id: oppA.id, stage: "WON" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      b.opportunities.logActivity({ opportunityId: oppA.id, body: "Spy" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    // Planting rows that point at A's records from tenant B.
    await expect(
      b.opportunities.create({ clientId: clientA.id, title: "Spy" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      b.opportunities.create({
        clientId: clientB.id,
        contactId: contactA.id,
        title: "Spy",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      b.opportunities.create({
        clientId: clientB.id,
        title: "Spy",
        ownerId: userA.id,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      b.proposals.create({
        clientId: clientB.id,
        opportunityId: oppA.id,
        code: `SPY-${run}`,
        title: "Spy",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // Nothing moved in A.
    const intact = await a.opportunities.get({ id: oppA.id });
    expect(intact).toMatchObject({ title: `Secreto A ${run}`, stage: "LEAD" });
    expect(intact.activities).toHaveLength(1);
  });
});
