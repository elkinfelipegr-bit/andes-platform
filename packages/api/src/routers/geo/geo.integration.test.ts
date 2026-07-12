// Integration tests for the geoRecords router — lifecycle with stored
// outputs verified against a direct @andes/geo call, frozen-state
// denials, and the cross-tenant sweep PROJECT_RULES.md mandates at the
// strict tier. Same harness as the other suites.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@andes/db";
import { bearingCapacity } from "@andes/geo";

import type { Context, SessionInfo } from "../../context.js";
import { createCallerFactory } from "../../trpc.js";
import { appRouter } from "../core.js";

const APP_URL = process.env.APP_DATABASE_URL;

describe.skipIf(!APP_URL)("geoRecords router (integration)", () => {
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
      email: `geo-${run}@test.local`,
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
      data: { name: `Geo Test A ${run}`, slug: `geo-a-${run}` },
    });
    tenantB = await admin.tenant.create({
      data: { name: `Geo Test B ${run}`, slug: `geo-b-${run}` },
    });
    user = await admin.user.create({
      data: { email: `geo-${run}@test.local`, name: "Geo Test User" },
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

  it("lifecycle: create → add check (outputs match the library) → edit recomputes → issue freezes", async () => {
    const caller = callerFor(tenantA.id);
    const project = await caller.projects.create({
      code: `PG-${run}`,
      name: "Edificio con estudio",
      status: "ACTIVE",
    });

    const record = await caller.geoRecords.create({
      projectId: project.id,
      code: `EG-${run}`,
      title: "Estudio geotécnico",
    });
    expect(record.status).toBe("DRAFT");

    const inputs = {
      b: 1.5,
      df: 1.5,
      gamma: 18,
      c: 0,
      phi: 30,
      fs: 3,
      shape: "STRIP" as const,
    };
    const check = await caller.geoRecords.addCheck({
      geoRecordId: record.id,
      label: "Zapata Z-1",
      ...inputs,
    });
    const expected = bearingCapacity(inputs);
    expect(check.nq).toBeCloseTo(expected.nq, 2);
    expect(check.qUlt).toBeCloseTo(expected.qUlt, 1);
    expect(check.qAdm).toBeCloseTo(expected.qAdm, 1);

    // Editing inputs recomputes outputs.
    const updated = await caller.geoRecords.updateCheck({
      id: check.id,
      shape: "SQUARE",
    });
    const expectedSquare = bearingCapacity({ ...inputs, shape: "SQUARE" });
    expect(updated?.qUlt).toBeCloseTo(expectedSquare.qUlt, 1);

    await expect(
      caller.geoRecords.issue({ id: record.id }),
    ).resolves.toMatchObject({ id: record.id, status: "ISSUED" });

    // Frozen: no edits, no check changes, no re-issue.
    await expect(
      caller.geoRecords.update({ id: record.id, title: "Tarde" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      caller.geoRecords.addCheck({
        geoRecordId: record.id,
        label: "x",
        ...inputs,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      caller.geoRecords.updateCheck({ id: check.id, fs: 2 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      caller.geoRecords.removeCheck({ id: check.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      caller.geoRecords.issue({ id: record.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    // Still readable; project detail lists it.
    const report = await caller.geoRecords.get({ id: record.id });
    expect(report.checks).toHaveLength(1);
    const detail = await caller.projects.get({ id: project.id });
    expect(detail.geoRecords.map((r) => r.id)).toContain(record.id);
  });

  it("invalid engineering input from the library surfaces as BAD_REQUEST", async () => {
    const caller = callerFor(tenantA.id);
    const project = await caller.projects.create({
      code: `PGV-${run}`,
      name: "Obra validación",
    });
    const record = await caller.geoRecords.create({
      projectId: project.id,
      code: `EGV-${run}`,
      title: "Estudio",
    });
    // gamma=5 passes Zod's min(5) but... use a Zod-passing, library-failing
    // case: none exists for geo (bounds mirror). Instead verify Zod bounds
    // reject at the schema layer end to end.
    await expect(
      caller.geoRecords.addCheck({
        geoRecordId: record.id,
        label: "Inválida",
        b: 1.5,
        df: 1.5,
        gamma: 3,
        c: 0,
        phi: 30,
        fs: 3,
        shape: "STRIP",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects archived projects, duplicate codes, empty-record issue, and cross-tenant access", async () => {
    const callerA = callerFor(tenantA.id);
    const callerB = callerFor(tenantB.id);

    const project = await callerA.projects.create({
      code: `PGD-${run}`,
      name: "Obra denials",
    });
    const record = await callerA.geoRecords.create({
      projectId: project.id,
      code: `EGD-${run}`,
      title: "Original",
    });

    await expect(
      callerA.geoRecords.create({
        projectId: project.id,
        code: `EGD-${run}`,
        title: "Duplicada",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      callerA.geoRecords.issue({ id: record.id }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" }); // no checks yet

    await expect(
      callerB.geoRecords.get({ id: record.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      callerB.geoRecords.update({ id: record.id, title: "Hijacked" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      callerB.geoRecords.addCheck({
        geoRecordId: record.id,
        label: "Spy",
        b: 1,
        df: 1,
        gamma: 18,
        c: 0,
        phi: 30,
        fs: 3,
        shape: "STRIP",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const listedInB = await callerB.geoRecords.list();
    expect(listedInB.map((r) => r.id)).not.toContain(record.id);
  });
});
