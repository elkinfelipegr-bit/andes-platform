// Integration tests for sprint-16: aging and risks on the pipeline read,
// forecast fields, hard deletes and the firm report. Strict tier where a
// tenant boundary is involved: deletes cannot reach another tenant's
// rows, and the report contains nothing of another tenant.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@andes/db";

import type { Context, SessionInfo } from "../../context.js";
import { buildFirmReport, renderFirmReport } from "../../reminders/report.js";
import { createCallerFactory } from "../../trpc.js";
import { appRouter } from "../core.js";

const APP_URL = process.env.APP_DATABASE_URL;

describe.skipIf(!APP_URL)("crm pro (integration)", () => {
  const admin = new PrismaClient();
  const app = new PrismaClient({ datasourceUrl: APP_URL });
  const createCaller = createCallerFactory(appRouter);
  const run = randomUUID().slice(0, 8);
  const now = new Date();
  const ago = (d: number) => new Date(now.getTime() - d * 86_400_000);
  const today = now.toISOString().slice(0, 10);
  let tenantA!: { id: string };
  let tenantB!: { id: string };
  let user!: { id: string };

  function callerFor(tenantId: string, roleKey = "OWNER_ADMIN") {
    const session: SessionInfo = {
      userId: user.id,
      email: `pro-${run}@test.local`,
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
      data: { name: `Pro A ${run}`, slug: `pro-a-${run}` },
    });
    tenantB = await admin.tenant.create({
      data: { name: `Pro B ${run}`, slug: `pro-b-${run}` },
    });
    user = await admin.user.create({
      data: { email: `pro-${run}@test.local`, name: "Pro User" },
    });
    for (const t of [tenantA, tenantB]) {
      const role = await admin.role.create({
        data: { tenantId: t.id, key: "OWNER_ADMIN", label: "Owner" },
      });
      // One-active-tenant applies to real sessions; fixtures set both.
      await admin.membership.create({
        data: { tenantId: t.id, userId: user.id, roleId: role.id },
      });
    }
  });

  afterAll(async () => {
    await admin.tenant.deleteMany({
      where: { id: { in: [tenantA.id, tenantB.id] } },
    });
    await admin.user.delete({ where: { id: user.id } });
    await admin.$disconnect();
    await app.$disconnect();
  });

  // Builds one tenant's pipeline with a known shape of problems.
  async function seed(tenantId: string, tag: string) {
    const client = await admin.client.create({
      data: { tenantId, name: `Cliente ${tag}` },
    });
    const opp = (title: string, data: object = {}) =>
      admin.opportunity.create({
        data: {
          tenantId,
          clientId: client.id,
          title: `${title} ${tag}`,
          ownerId: user.id,
          createdById: user.id,
          createdAt: ago(3),
          stageChangedAt: ago(3),
          ...data,
        },
      });
    const act = (opportunityId: string, type: "CALL" | "REQUEST", d: number) =>
      admin.opportunityActivity.create({
        data: {
          tenantId,
          opportunityId,
          type,
          body: "x",
          occurredAt: ago(d),
          createdById: user.id,
        },
      });
    const overdue = await opp("Atrasada", {
      stage: "CONTACTED",
      nextAction: "Llamar",
      nextActionAt: new Date(`${ago(4).toISOString().slice(0, 10)}T00:00:00Z`),
      estimatedValue: 10_000_000,
    });
    await act(overdue.id, "CALL", 1);
    const quoted = await opp("Cotizada", {
      stage: "QUOTED",
      estimatedValue: 20_000_000,
      probability: 80,
      nextActionAt: new Date(`${ago(-5).toISOString().slice(0, 10)}T00:00:00Z`),
      stageChangedAt: ago(9),
    });
    await act(quoted.id, "CALL", 2);
    await admin.proposal.create({
      data: {
        tenantId,
        clientId: client.id,
        opportunityId: quoted.id,
        code: `PRO-${tag}-${run}`,
        title: "Propuesta",
        status: "SENT",
        sentAt: ago(9),
        createdById: user.id,
      },
    });
    const request = await opp("Solicitud web", {
      stage: "LEAD",
      source: "Sitio web · Contacto",
      nextAction: "Responder",
      nextActionAt: new Date(`${today}T00:00:00Z`),
      createdAt: ago(2),
    });
    await act(request.id, "REQUEST", 2);
    await opp("Fría", {
      stage: "NEGOTIATION",
      createdAt: ago(40),
      nextActionAt: new Date(`${ago(-9).toISOString().slice(0, 10)}T00:00:00Z`),
    });
    return { client, overdue, quoted, request };
  }

  it("pipeline read: aging, forecast and risks per opportunity", async () => {
    await seed(tenantA.id, "A");
    await seed(tenantB.id, "B");
    const rows = await callerFor(tenantA.id).opportunities.list({ today });
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.title.endsWith(" A"))).toBe(true);
    const by = (t: string) => rows.find((r) => r.title === `${t} A`)!;

    expect(by("Atrasada")).toMatchObject({
      risks: ["OVERDUE"],
      probability: 25,
      probabilityIsDefault: true,
      weightedValue: 2_500_000,
      daysInStage: 3,
      daysSinceActivity: 1,
    });
    expect(by("Cotizada")).toMatchObject({
      risks: ["QUOTE_WAITING"],
      probability: 80,
      probabilityIsDefault: false,
      weightedValue: 16_000_000,
      daysInStage: 9,
      daysQuoteWaiting: 9,
    });
    // The intake REQUEST is not a member's activity: still unanswered.
    expect(by("Solicitud web").risks).toEqual(["UNANSWERED_REQUEST"]);
    expect(by("Solicitud web")._count.activities).toBe(0);
    expect(by("Fría").risks).toEqual(["COLD"]);
    expect(by("Fría").daysSinceActivity).toBe(40);
  });

  it("moving stage restarts the time-in-stage clock; forecast fields update", async () => {
    const a = callerFor(tenantA.id);
    const row = (await a.opportunities.list({ today })).find(
      (r) => r.title === "Cotizada A",
    )!;
    await a.opportunities.setStage({ id: row.id, stage: "QUOTED" });
    expect((await a.opportunities.get({ id: row.id })).daysInStage).toBe(9); // same stage: clock untouched
    await a.opportunities.setStage({ id: row.id, stage: "NEGOTIATION" });
    await a.opportunities.update({
      id: row.id,
      probability: null,
      expectedCloseAt: "2027-01-15",
    });
    const moved = await a.opportunities.get({ id: row.id });
    expect(moved).toMatchObject({
      daysInStage: 0,
      probability: 75,
      probabilityIsDefault: true,
      weightedValue: 15_000_000,
    });
    expect(moved.expectedCloseAt?.toISOString().slice(0, 10)).toBe(
      "2027-01-15",
    );
    await expect(
      a.opportunities.update({ id: row.id, probability: 101 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("firm report: sections from the same read, nothing of another tenant", async () => {
    const report = await buildFirmReport(app, tenantA.id, today, new Date());
    expect(report.open).toBe(4);
    expect(report.overdue.map((l) => l.title)).toEqual(["Atrasada A"]);
    expect(report.overdue[0]?.detail).toContain("4 días de atraso");
    expect(report.dueToday.map((l) => l.title)).toEqual(["Solicitud web A"]);
    expect(report.newRequests.map((l) => l.title)).toEqual(["Solicitud web A"]);
    expect(report.quotesWaiting.map((l) => l.title)).toEqual(["Cotizada A"]);
    expect(report.quotesWaiting[0]?.detail).toContain("ya pasó mucho tiempo");
    expect(report.cold.map((l) => l.title)).toEqual(["Fría A"]);
    expect(report.totals).toEqual([
      { currency: "COP", value: 30_000_000, weighted: 17_500_000 },
    ]);
    const flat = JSON.stringify(report);
    expect(flat).not.toContain(" B");
    expect(flat).not.toContain("Cliente B");

    const mail = renderFirmReport(report, "https://app.example.com");
    expect(mail.subject).toBe("Seguimiento comercial: 2 pendientes para hoy");
    expect(mail.text).toContain("Cotizaciones sin respuesta (1):");
    expect(mail.text).toContain("https://app.example.com/crm/pipeline/");
    expect(mail.html).not.toContain("Cliente B");
  });

  it("deletes are OWNER_ADMIN only and cannot reach another tenant", async () => {
    const a = callerFor(tenantA.id);
    const engineer = callerFor(tenantA.id, "ENGINEER");
    const b = callerFor(tenantB.id);
    const rowsA = await a.opportunities.list({ today });
    const target = rowsA.find((r) => r.title === "Fría A")!;
    const clientA = target.client.id;
    const project = await a.projects.create({
      code: `PD-${run}`,
      name: "Proyecto de prueba",
      clientId: clientA,
    });

    for (const call of [
      () => engineer.opportunities.delete({ id: target.id }),
      () => engineer.clients.delete({ id: clientA }),
      () => engineer.projects.delete({ id: project.id }),
    ]) {
      await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    // Tenant B's admin cannot delete tenant A's rows.
    for (const call of [
      () => b.opportunities.delete({ id: target.id }),
      () => b.clients.delete({ id: clientA }),
      () => b.projects.delete({ id: project.id }),
    ]) {
      await expect(call()).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    expect(await a.opportunities.list({ today })).toHaveLength(4);

    await a.opportunities.delete({ id: target.id });
    expect(await a.opportunities.list({ today })).toHaveLength(3);

    await a.projects.delete({ id: project.id });
    await expect(a.projects.get({ id: project.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    // Deleting the client removes its commercial records; tenant B keeps
    // its own identical-looking ones.
    const deleted = await a.clients.delete({ id: clientA });
    expect(deleted).toMatchObject({ opportunities: 3, proposals: 1 });
    expect(await a.opportunities.list({ today })).toHaveLength(0);
    expect(await a.proposals.list()).toHaveLength(0);
    expect(await b.opportunities.list({ today })).toHaveLength(4);
    expect(await b.proposals.list()).toHaveLength(1);
  });

  it("deleting a client keeps its projects, detached", async () => {
    const a = callerFor(tenantA.id);
    const client = await a.clients.create({ name: `Con proyecto ${run}` });
    const project = await a.projects.create({
      code: `PK-${run}`,
      name: "Se conserva",
      clientId: client.id,
    });
    await a.clients.delete({ id: client.id });
    const kept = await a.projects.get({ id: project.id });
    expect(kept.client).toBeNull();
  });
});
