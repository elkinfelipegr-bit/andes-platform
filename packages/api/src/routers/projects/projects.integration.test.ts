// Integration tests for the Projects routers — the core CRUD path plus the
// cross-tenant denials PROJECT_RULES.md mandates at the strict tier. Runs
// the real middleware chain against real Postgres as `andes_app` (RLS
// active), with superuser fixtures — same setup as @andes/db's RLS suite.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@andes/db";

import type { Context, SessionInfo } from "../../context.js";
import { createCallerFactory } from "../../trpc.js";
import { appRouter } from "../core.js";

const APP_URL = process.env.APP_DATABASE_URL;

describe.skipIf(!APP_URL)("projects/clients routers (integration)", () => {
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
      email: `api-${run}@test.local`,
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
      data: { name: `API Test A ${run}`, slug: `api-a-${run}` },
    });
    tenantB = await admin.tenant.create({
      data: { name: `API Test B ${run}`, slug: `api-b-${run}` },
    });
    user = await admin.user.create({
      data: { email: `api-${run}@test.local`, name: "API Test User" },
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

  it("create → list → get → update → archive, tenant-scoped end to end", async () => {
    const engineer = callerFor(tenantA.id, "ENGINEER");
    const owner = callerFor(tenantA.id, "OWNER_ADMIN");

    const client = await engineer.clients.create({ name: `ACME ${run}` });
    expect(client.tenantId).toBe(tenantA.id);

    const created = await engineer.projects.create({
      code: `P-${run}`,
      name: "Puente La Vega",
      clientId: client.id,
      status: "ACTIVE",
    });
    expect(created.tenantId).toBe(tenantA.id);
    expect(created.createdById).toBe(user.id);
    expect(created.client?.name).toBe(`ACME ${run}`);

    const listed = await engineer.projects.list({ status: "ACTIVE" });
    expect(listed.map((p) => p.id)).toContain(created.id);

    const got = await engineer.projects.get({ id: created.id });
    expect(got.code).toBe(`P-${run}`);

    const updated = await engineer.projects.update({
      id: created.id,
      name: "Puente La Vega II",
      status: "ON_HOLD",
    });
    expect(updated?.name).toBe("Puente La Vega II");
    expect(updated?.status).toBe("ON_HOLD");

    // Role gate: ENGINEER cannot archive…
    await expect(
      engineer.projects.archive({ id: created.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    // …OWNER_ADMIN can.
    await expect(owner.projects.archive({ id: created.id })).resolves.toEqual({
      id: created.id,
      status: "ARCHIVED",
    });
    const archived = await engineer.projects.get({ id: created.id });
    expect(archived.status).toBe("ARCHIVED");
  });

  it("rejects duplicate project codes within a tenant with CONFLICT", async () => {
    const engineer = callerFor(tenantA.id, "ENGINEER");
    await engineer.projects.create({ code: `DUP-${run}`, name: "First" });
    await expect(
      engineer.projects.create({ code: `DUP-${run}`, name: "Second" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("allows the same code in a different tenant (uniqueness is per tenant)", async () => {
    const engineerB = callerFor(tenantB.id, "ENGINEER");
    await expect(
      engineerB.projects.create({ code: `DUP-${run}`, name: "Other tenant" }),
    ).resolves.toMatchObject({ tenantId: tenantB.id });
  });

  it("denies cross-tenant reads: tenant B cannot get or list tenant A's projects", async () => {
    const engineerA = callerFor(tenantA.id, "ENGINEER");
    const engineerB = callerFor(tenantB.id, "ENGINEER");
    const inA = await engineerA.projects.create({
      code: `XT-${run}`,
      name: "Tenant A only",
    });

    await expect(engineerB.projects.get({ id: inA.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const listedInB = await engineerB.projects.list();
    expect(listedInB.map((p) => p.id)).not.toContain(inA.id);
  });

  it("denies cross-tenant writes: update/archive of a foreign project is NOT_FOUND", async () => {
    const engineerA = callerFor(tenantA.id, "ENGINEER");
    const ownerB = callerFor(tenantB.id, "OWNER_ADMIN");
    const inA = await engineerA.projects.create({
      code: `XW-${run}`,
      name: "Write target",
    });

    await expect(
      ownerB.projects.update({ id: inA.id, name: "Hijacked" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(ownerB.projects.archive({ id: inA.id })).rejects.toMatchObject(
      { code: "NOT_FOUND" },
    );
  });

  it("rejects wiring a project to another tenant's client with BAD_REQUEST", async () => {
    const engineerA = callerFor(tenantA.id, "ENGINEER");
    const engineerB = callerFor(tenantB.id, "ENGINEER");
    const clientB = await engineerB.clients.create({ name: `B-Corp ${run}` });

    await expect(
      engineerA.projects.create({
        code: `XC-${run}`,
        name: "Wrong client",
        clientId: clientB.id,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("clients.list is tenant-scoped", async () => {
    const engineerA = callerFor(tenantA.id, "ENGINEER");
    const engineerB = callerFor(tenantB.id, "ENGINEER");
    const clientsA = await engineerA.clients.list();
    const clientsB = await engineerB.clients.list();
    expect(clientsA.every((c) => c.tenantId === tenantA.id)).toBe(true);
    expect(clientsB.every((c) => c.tenantId === tenantB.id)).toBe(true);
  });
});
