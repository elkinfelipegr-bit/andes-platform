// Integration tests for the analytics router — sprint-14.md testing
// commitments at the strict tier: a second tenant's data is present and
// asserted ABSENT from every count and sum (an aggregate that includes a
// foreign row is a leak even though no row is returned), plus the role
// check on money. Same harness as the other router suites.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@andes/db";

import type { Context, SessionInfo } from "../../context.js";
import { createCallerFactory } from "../../trpc.js";
import { appRouter } from "../core.js";

const APP_URL = process.env.APP_DATABASE_URL;

describe.skipIf(!APP_URL)("analytics router (integration)", () => {
  const admin = new PrismaClient();
  const app = new PrismaClient({ datasourceUrl: APP_URL });
  const createCaller = createCallerFactory(appRouter);

  const run = randomUUID().slice(0, 8);
  // A fixed historical window keeps the fixtures away from "today".
  const period = { from: "2024-03-01", to: "2024-05-31" };
  const at = (day: string) => new Date(`${day}T12:00:00Z`);
  let tenantA!: { id: string };
  let tenantB!: { id: string };
  let user!: { id: string };
  let clientA!: { id: string };
  let clientA2!: { id: string };
  let clientB!: { id: string };

  function callerFor(tenantId: string, roleKey: string) {
    const session: SessionInfo = {
      userId: user.id,
      email: `an-${run}@test.local`,
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

  // The same shape of data in both tenants, with different amounts: if
  // isolation failed, every figure for A would double or shift.
  async function seed(
    tenantId: string,
    tag: string,
    price: number,
    extraClient: boolean,
  ) {
    const client = await admin.client.create({
      data: { tenantId, name: `Cliente ${tag} ${run}` },
    });
    const other = extraClient
      ? await admin.client.create({
          data: { tenantId, name: `Otro ${tag} ${run}` },
        })
      : client;
    const proposal = (
      code: string,
      status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED",
      day: string,
      clientId: string,
    ) =>
      admin.proposal.create({
        data: {
          tenantId,
          clientId,
          code: `${code}-${tag}-${run}`,
          title: code,
          status,
          createdAt: at(day),
          createdById: user.id,
          items: {
            create: [
              {
                tenantId,
                position: 0,
                description: "Diseño",
                quantity: 2,
                unit: "un",
                unitPrice: price,
              },
            ],
          },
        },
      });
    await proposal("P1", "ACCEPTED", "2024-03-10", client.id);
    await proposal("P2", "REJECTED", "2024-04-10", client.id);
    await proposal("P3", "SENT", "2024-04-12", other.id);
    await proposal("P4", "DRAFT", "2024-05-01", client.id);
    await proposal("P5", "ACCEPTED", "2023-01-01", client.id); // outside

    const project = await admin.project.create({
      data: {
        tenantId,
        clientId: client.id,
        code: `PJ-${tag}-${run}`,
        name: "Obra",
        status: "ACTIVE",
        startDate: at("2024-03-15"),
        createdById: user.id,
      },
    });
    await admin.project.create({
      data: {
        tenantId,
        clientId: other.id,
        code: `PK-${tag}-${run}`,
        name: "Obra 2",
        status: "COMPLETED",
        startDate: at("2023-06-01"),
        endDate: at("2024-05-20"),
        createdById: user.id,
      },
    });
    await admin.inspection.create({
      data: {
        tenantId,
        projectId: project.id,
        inspectorId: user.id,
        code: `IN-${tag}-${run}`,
        title: "Visita",
        status: "COMPLETED",
        scheduledFor: at("2024-04-02"),
        performedAt: at("2024-04-03"),
        createdById: user.id,
        findings: {
          create: [
            { tenantId, position: 0, description: "Fisura", severity: "HIGH" },
            { tenantId, position: 1, description: "Menor", severity: "LOW" },
          ],
        },
      },
    });
    await admin.inspection.create({
      data: {
        tenantId,
        projectId: project.id,
        inspectorId: user.id,
        code: `IO-${tag}-${run}`,
        title: "Vencida",
        status: "SCHEDULED",
        scheduledFor: at("2024-01-05"),
        createdById: user.id,
      },
    });
    await admin.calcRecord.create({
      data: {
        tenantId,
        projectId: project.id,
        code: `CR-${tag}-${run}`,
        title: "Memoria",
        fc: 28,
        fy: 420,
        status: "ISSUED",
        createdAt: at("2024-03-20"),
        createdById: user.id,
      },
    });
    await admin.geoRecord.create({
      data: {
        tenantId,
        projectId: project.id,
        code: `GR-${tag}-${run}`,
        title: "Suelos",
        createdAt: at("2024-03-21"),
        createdById: user.id,
      },
    });
    return { client, other };
  }

  beforeAll(async () => {
    tenantA = await admin.tenant.create({
      data: { name: `An Test A ${run}`, slug: `an-a-${run}` },
    });
    tenantB = await admin.tenant.create({
      data: { name: `An Test B ${run}`, slug: `an-b-${run}` },
    });
    user = await admin.user.create({
      data: { email: `an-${run}@test.local`, name: "Analytics Test User" },
    });
    const a = await seed(tenantA.id, "A", 1_000_000, true);
    clientA = a.client;
    clientA2 = a.other;
    // Tenant B: same shape, 7× the price, plus one extra of everything
    // countable so no figure can coincide by accident.
    const b = await seed(tenantB.id, "B", 7_000_000, false);
    clientB = b.client;
    await admin.proposal.create({
      data: {
        tenantId: tenantB.id,
        clientId: clientB.id,
        code: `PX-B-${run}`,
        title: "Extra",
        status: "ACCEPTED",
        createdAt: at("2024-03-11"),
        createdById: user.id,
      },
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

  it("commercial: counts and sums cover tenant A only", async () => {
    const r = await callerFor(tenantA.id, "OWNER_ADMIN").analytics.commercial(
      period,
    );
    expect(r.created).toBe(4);
    expect(r.byStatus).toEqual({
      DRAFT: 1,
      SENT: 1,
      ACCEPTED: 1,
      REJECTED: 1,
      EXPIRED: 0,
    });
    expect(r.winRate).toBe(0.5);
    // 3 non-draft × (2 × 1,000,000); 1 accepted. B's 7,000,000s absent.
    expect(r.money).toEqual([
      { currency: "COP", quoted: 6_000_000, won: 2_000_000 },
    ]);
    expect(r.monthly.map((m) => m.created)).toEqual([1, 2, 1]);
  });

  it("commercial: tenant B sees its own, different figures", async () => {
    const r = await callerFor(tenantB.id, "OWNER_ADMIN").analytics.commercial(
      period,
    );
    expect(r.created).toBe(5);
    expect(r.byStatus.ACCEPTED).toBe(2);
    expect(r.money).toEqual([
      { currency: "COP", quoted: 42_000_000, won: 14_000_000 },
    ]);
  });

  it("commercial: money is withheld from ENGINEER, counts are not", async () => {
    const r = await callerFor(tenantA.id, "ENGINEER").analytics.commercial(
      period,
    );
    expect(r.money).toBeNull();
    expect(r.created).toBe(4);
  });

  it("projects, inspections, engineering: tenant A only", async () => {
    const a = callerFor(tenantA.id, "ENGINEER");
    const projects = await a.analytics.projects(period);
    expect(projects.total).toBe(2);
    expect(projects.byStatus).toMatchObject({ ACTIVE: 1, COMPLETED: 1 });
    expect(projects.started).toBe(1);
    expect(projects.completed).toBe(1);
    expect(projects.activeByClient).toEqual([
      { id: clientA.id, name: `Cliente A ${run}`, active: 1 },
    ]);

    const inspections = await a.analytics.inspections(period);
    expect(inspections.total).toBe(1);
    expect(inspections.byStatus).toEqual({
      SCHEDULED: 0,
      COMPLETED: 1,
      CANCELLED: 0,
    });
    expect(inspections.overdue).toBe(1);
    expect(inspections.findings).toBe(2);
    expect(inspections.findingsBySeverity).toMatchObject({ HIGH: 1, LOW: 1 });

    const engineering = await a.analytics.engineering(period);
    expect(engineering.calc).toEqual({
      total: 1,
      byStatus: { DRAFT: 0, ISSUED: 1 },
    });
    expect(engineering.geo).toEqual({
      total: 1,
      byStatus: { DRAFT: 1, ISSUED: 0 },
    });
  });

  it("client filter narrows inside the tenant and refuses a foreign client", async () => {
    const a = callerFor(tenantA.id, "OWNER_ADMIN");
    const narrowed = await a.analytics.commercial({
      ...period,
      clientId: clientA2.id,
    });
    expect(narrowed.created).toBe(1);
    expect(narrowed.money).toEqual([
      { currency: "COP", quoted: 2_000_000, won: 0 },
    ]);
    expect(
      (await a.analytics.projects({ ...period, clientId: clientA2.id })).total,
    ).toBe(1);

    // Tenant B's client id as a filter: an error on every procedure,
    // never B's figures and never a silent empty report.
    const foreign = { ...period, clientId: clientB.id };
    for (const call of [
      () => a.analytics.commercial(foreign),
      () => a.analytics.projects(foreign),
      () => a.analytics.inspections(foreign),
      () => a.analytics.engineering(foreign),
    ]) {
      await expect(call()).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
  });
});
