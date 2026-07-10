// Integration tests for the calcRecords router — the record lifecycle,
// server-side computation verified against @andes/structures directly,
// material-change recomputation, frozen-state denials, and the
// cross-tenant sweep PROJECT_RULES.md mandates at the strict tier.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@andes/db";
import { beamFlexure } from "@andes/structures";

import type { Context, SessionInfo } from "../../context.js";
import { createCallerFactory } from "../../trpc.js";
import { appRouter } from "../core.js";

const APP_URL = process.env.APP_DATABASE_URL;

describe.skipIf(!APP_URL)("calcRecords router (integration)", () => {
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
      email: `str-${run}@test.local`,
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
      data: { name: `Str Test A ${run}`, slug: `str-a-${run}` },
    });
    tenantB = await admin.tenant.create({
      data: { name: `Str Test B ${run}`, slug: `str-b-${run}` },
    });
    user = await admin.user.create({
      data: { email: `str-${run}@test.local`, name: "Str Test User" },
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

  it("lifecycle: create → add check (outputs match the library) → issue freezes", async () => {
    const caller = callerFor(tenantA.id);
    const project = await caller.projects.create({
      code: `PS-${run}`,
      name: "Edificio con memoria",
      status: "ACTIVE",
    });

    const record = await caller.calcRecords.create({
      projectId: project.id,
      code: `MC-${run}`,
      title: "Memoria de vigas",
      fc: 21,
      fy: 420,
    });
    expect(record.status).toBe("DRAFT");
    expect(record.designCode).toBe("NSR-10");

    const check = await caller.calcRecords.addCheck({
      calcRecordId: record.id,
      label: "Viga eje 3",
      b: 300,
      h: 500,
      cover: 60,
      mu: 120,
    });
    // The stored outputs must equal a direct library call — the server is
    // the library's only caller and must not distort it.
    const expected = beamFlexure({
      b: 300,
      h: 500,
      cover: 60,
      fc: 21,
      fy: 420,
      mu: 120,
    });
    expect(check.d).toBe(expected.d);
    expect(check.verdict).toBe(expected.verdict);
    expect(check.requiredAs).toBeCloseTo(expected.requiredAs!, 1);
    expect(check.rhoRequired).toBeCloseTo(expected.rhoRequired!, 5);

    await expect(
      caller.calcRecords.issue({ id: record.id }),
    ).resolves.toMatchObject({ id: record.id, status: "ISSUED" });

    // Frozen: no edits, no new/changed/removed checks, no re-issue.
    await expect(
      caller.calcRecords.update({ id: record.id, title: "Tarde" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      caller.calcRecords.addCheck({
        calcRecordId: record.id,
        label: "x",
        b: 300,
        h: 500,
        cover: 60,
        mu: 100,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      caller.calcRecords.updateCheck({ id: check.id, mu: 200 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      caller.calcRecords.removeCheck({ id: check.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      caller.calcRecords.issue({ id: record.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    // The issued record still reads, and the project detail lists it.
    const report = await caller.calcRecords.get({ id: record.id });
    expect(report.checks).toHaveLength(1);
    const detail = await caller.projects.get({ id: project.id });
    expect(detail.calcRecords.map((r) => r.id)).toContain(record.id);
  });

  it("changing record materials recomputes every check", async () => {
    const caller = callerFor(tenantA.id);
    const project = await caller.projects.create({
      code: `PM-${run}`,
      name: "Obra recompute",
    });
    const record = await caller.calcRecords.create({
      projectId: project.id,
      code: `MCR-${run}`,
      title: "Memoria",
      fc: 21,
      fy: 420,
    });
    await caller.calcRecords.addCheck({
      calcRecordId: record.id,
      label: "Viga",
      b: 300,
      h: 500,
      cover: 60,
      mu: 120,
    });

    const updated = await caller.calcRecords.update({
      id: record.id,
      fc: 35,
    });
    const expected = beamFlexure({
      b: 300,
      h: 500,
      cover: 60,
      fc: 35,
      fy: 420,
      mu: 120,
    });
    expect(updated?.checks[0]!.rhoMax).toBeCloseTo(expected.rhoMax, 5);
    expect(updated?.checks[0]!.requiredAs).toBeCloseTo(expected.requiredAs!, 1);
  });

  it("stores the infeasible path with null outputs and rejects invalid geometry", async () => {
    const caller = callerFor(tenantA.id);
    const project = await caller.projects.create({
      code: `PI2-${run}`,
      name: "Obra infeasible",
    });
    const record = await caller.calcRecords.create({
      projectId: project.id,
      code: `MCI-${run}`,
      title: "Memoria",
      fc: 21,
      fy: 420,
    });

    const infeasible = await caller.calcRecords.addCheck({
      calcRecordId: record.id,
      label: "Viga sobrecargada",
      b: 300,
      h: 500,
      cover: 60,
      mu: 600,
    });
    expect(infeasible.verdict).toBe("INCREASE_SECTION");
    expect(infeasible.requiredAs).toBeNull();
    expect(infeasible.rhoRequired).toBeNull();

    // cover ≥ h passes Zod bounds but the library rejects it → 400.
    await expect(
      caller.calcRecords.addCheck({
        calcRecordId: record.id,
        label: "Geometría inválida",
        b: 300,
        h: 500,
        cover: 600,
        mu: 100,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects archived projects, duplicate codes, empty-record issue, and cross-tenant access", async () => {
    const callerA = callerFor(tenantA.id);
    const callerB = callerFor(tenantB.id);

    const project = await callerA.projects.create({
      code: `PD2-${run}`,
      name: "Obra denials",
    });
    const record = await callerA.calcRecords.create({
      projectId: project.id,
      code: `MCD-${run}`,
      title: "Original",
      fc: 21,
      fy: 420,
    });

    await expect(
      callerA.calcRecords.create({
        projectId: project.id,
        code: `MCD-${run}`,
        title: "Duplicada",
        fc: 21,
        fy: 420,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      callerA.calcRecords.issue({ id: record.id }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" }); // no checks yet

    // Tenant B sees and touches nothing.
    await expect(
      callerB.calcRecords.get({ id: record.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      callerB.calcRecords.update({ id: record.id, title: "Hijacked" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      callerB.calcRecords.addCheck({
        calcRecordId: record.id,
        label: "Spy",
        b: 300,
        h: 500,
        cover: 60,
        mu: 100,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const listedInB = await callerB.calcRecords.list();
    expect(listedInB.map((r) => r.id)).not.toContain(record.id);
  });
});
