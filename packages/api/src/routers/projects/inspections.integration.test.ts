// Integration tests for the inspections router — lifecycle, frozen-state
// denials, inspector-membership verification, and the cross-tenant sweep
// PROJECT_RULES.md mandates at the strict tier. Same harness as the
// other suites; note the real Membership fixtures the inspector check
// requires.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@andes/db";

import type { Context, SessionInfo } from "../../context.js";
import { createCallerFactory } from "../../trpc.js";
import { appRouter } from "../core.js";

const APP_URL = process.env.APP_DATABASE_URL;

describe.skipIf(!APP_URL)("inspections router (integration)", () => {
  const admin = new PrismaClient();
  const app = new PrismaClient({ datasourceUrl: APP_URL });
  const createCaller = createCallerFactory(appRouter);

  const run = randomUUID().slice(0, 8);
  let tenantA!: { id: string };
  let tenantB!: { id: string };
  let member!: { id: string };
  let outsider!: { id: string };

  function callerFor(tenantId: string, roleKey: "OWNER_ADMIN" | "ENGINEER") {
    const session: SessionInfo = {
      userId: member.id,
      email: `ins-${run}@test.local`,
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
      data: { name: `Ins Test A ${run}`, slug: `ins-a-${run}` },
    });
    tenantB = await admin.tenant.create({
      data: { name: `Ins Test B ${run}`, slug: `ins-b-${run}` },
    });
    member = await admin.user.create({
      data: { email: `ins-${run}@test.local`, name: "Inspector Member" },
    });
    // outsider has an account but NO membership in tenant A.
    outsider = await admin.user.create({
      data: { email: `out-${run}@test.local`, name: "Outsider" },
    });
    const role = await admin.role.create({
      data: { tenantId: tenantA.id, key: "ENGINEER", label: "Engineer" },
    });
    await admin.membership.create({
      data: { tenantId: tenantA.id, userId: member.id, roleId: role.id },
    });
  });

  afterAll(async () => {
    await admin.tenant.deleteMany({
      where: { id: { in: [tenantA.id, tenantB.id] } },
    });
    await admin.user.deleteMany({
      where: { id: { in: [member.id, outsider.id] } },
    });
    await admin.$disconnect();
    await app.$disconnect();
  });

  it("full lifecycle: schedule → record findings → complete freezes the report", async () => {
    const caller = callerFor(tenantA.id, "ENGINEER");
    const project = await caller.projects.create({
      code: `PI-${run}`,
      name: "Obra con visitas",
      status: "ACTIVE",
    });

    const created = await caller.inspections.create({
      projectId: project.id,
      inspectorId: member.id,
      code: `INS-${run}`,
      title: "Interventoría estructural",
      scheduledFor: "2026-08-01T09:00:00Z",
    });
    expect(created.status).toBe("SCHEDULED");
    expect(created.inspector.id).toBe(member.id);

    const updated = await caller.inspections.update({
      id: created.id,
      notes: "Visita realizada con el contratista.",
      findings: [
        {
          description: "Fisura en viga eje 3",
          severity: "HIGH",
          location: "Piso 2",
        },
        { description: "Humedad leve", severity: "LOW", location: "Sótano" },
      ],
    });
    expect(updated.findings).toHaveLength(2);
    expect(updated.findings[0]!.position).toBe(0);

    const completed = await caller.inspections.complete({ id: created.id });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.performedAt).toBeInstanceOf(Date);

    // Frozen: no edits, no cancel, no double complete.
    await expect(
      caller.inspections.update({ id: created.id, title: "Tarde" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      caller.inspections.cancel({ id: created.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      caller.inspections.complete({ id: created.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    // The report is still readable, findings intact, and the project
    // detail lists it.
    const report = await caller.inspections.get({ id: created.id });
    expect(report.findings).toHaveLength(2);
    const detail = await caller.projects.get({ id: project.id });
    expect(detail.inspections.map((i) => i.id)).toContain(created.id);
  });

  it("cancel is terminal too", async () => {
    const caller = callerFor(tenantA.id, "ENGINEER");
    const project = await caller.projects.create({
      code: `PC-${run}`,
      name: "Obra cancelada",
    });
    const inspection = await caller.inspections.create({
      projectId: project.id,
      inspectorId: member.id,
      code: `INSC-${run}`,
      title: "No se hará",
      scheduledFor: "2026-08-02T09:00:00Z",
    });
    await expect(
      caller.inspections.cancel({ id: inspection.id }),
    ).resolves.toEqual({ id: inspection.id, status: "CANCELLED" });
    await expect(
      caller.inspections.update({ id: inspection.id, title: "x" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      caller.inspections.complete({ id: inspection.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects non-member inspectors, archived projects, and duplicate codes", async () => {
    const engineer = callerFor(tenantA.id, "ENGINEER");
    const owner = callerFor(tenantA.id, "OWNER_ADMIN");
    const project = await engineer.projects.create({
      code: `PD-${run}`,
      name: "Obra de denegaciones",
    });

    // Outsider has no Membership in tenant A → not assignable.
    await expect(
      engineer.inspections.create({
        projectId: project.id,
        inspectorId: outsider.id,
        code: `INSX-${run}`,
        title: "Inspector ajeno",
        scheduledFor: "2026-08-03T09:00:00Z",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const ok = await engineer.inspections.create({
      projectId: project.id,
      inspectorId: member.id,
      code: `INSD-${run}`,
      title: "Original",
      scheduledFor: "2026-08-03T09:00:00Z",
    });
    await expect(
      engineer.inspections.create({
        projectId: project.id,
        inspectorId: member.id,
        code: `INSD-${run}`,
        title: "Duplicada",
        scheduledFor: "2026-08-04T09:00:00Z",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    // Swapping to a non-member via update is rejected too.
    await expect(
      engineer.inspections.update({ id: ok.id, inspectorId: outsider.id }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // Archived project accepts no new inspections.
    const archived = await engineer.projects.create({
      code: `PA-${run}`,
      name: "Obra archivada",
    });
    await owner.projects.archive({ id: archived.id });
    await expect(
      engineer.inspections.create({
        projectId: archived.id,
        inspectorId: member.id,
        code: `INSA-${run}`,
        title: "Sobre archivado",
        scheduledFor: "2026-08-05T09:00:00Z",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("denies cross-tenant access and scopes core.members", async () => {
    const callerA = callerFor(tenantA.id, "ENGINEER");
    const callerB = callerFor(tenantB.id, "ENGINEER");
    const project = await callerA.projects.create({
      code: `PX-${run}`,
      name: "Solo A",
    });
    const inspection = await callerA.inspections.create({
      projectId: project.id,
      inspectorId: member.id,
      code: `INSB-${run}`,
      title: "Solo A",
      scheduledFor: "2026-08-06T09:00:00Z",
    });

    await expect(
      callerB.inspections.get({ id: inspection.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      callerB.inspections.update({ id: inspection.id, title: "Hijacked" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      callerB.inspections.complete({ id: inspection.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const listedInB = await callerB.inspections.list();
    expect(listedInB.map((i) => i.id)).not.toContain(inspection.id);
    // Scheduling in B against A's project fails (project unreachable).
    await expect(
      callerB.inspections.create({
        projectId: project.id,
        inspectorId: member.id,
        code: `INSF-${run}`,
        title: "Cross",
        scheduledFor: "2026-08-07T09:00:00Z",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // members picker: tenant A sees its member; tenant B sees nothing.
    const membersA = await callerA.core.members();
    expect(membersA.map((m) => m.user.id)).toContain(member.id);
    await expect(callerB.core.members()).resolves.toHaveLength(0);
  });
});
