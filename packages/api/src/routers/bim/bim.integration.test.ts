// Integration tests for the bimModels router — the full upload lifecycle
// with the S3 boundary mocked (sprint-8.md testing commitments: CI has no
// R2 credentials and must never need them), PENDING-version invisibility,
// archived-project denials, and the cross-tenant sweep PROJECT_RULES.md
// mandates at the strict tier. Same harness as the other suites.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@andes/db";
import type { HeadResult, StorageClient } from "@andes/storage";

import type { Context, SessionInfo } from "../../context.js";
import { createCallerFactory } from "../../trpc.js";
import { appRouter } from "../core.js";
import { setStorageForTesting } from "./storage.js";

const APP_URL = process.env.APP_DATABASE_URL;

// Fake storage: records signed keys, serves configurable head results —
// the router's behavior around it is what's under test, not R2.
function fakeStorage() {
  const objects = new Map<string, HeadResult>();
  const signed: string[] = [];
  const client: StorageClient = {
    async presignedPutUrl(key) {
      signed.push(key);
      return `https://fake.r2/put/${encodeURIComponent(key)}`;
    },
    async presignedGetUrl(key) {
      return `https://fake.r2/get/${encodeURIComponent(key)}`;
    },
    async headObject(key) {
      return objects.get(key) ?? null;
    },
  };
  return { client, objects, signed };
}

describe.skipIf(!APP_URL)("bimModels router (integration)", () => {
  const admin = new PrismaClient();
  const app = new PrismaClient({ datasourceUrl: APP_URL });
  const createCaller = createCallerFactory(appRouter);
  const storage = fakeStorage();

  const run = randomUUID().slice(0, 8);
  let tenantA!: { id: string };
  let tenantB!: { id: string };
  let user!: { id: string };

  function callerFor(tenantId: string, roleKey = "ENGINEER") {
    const session: SessionInfo = {
      userId: user.id,
      email: `bim-${run}@test.local`,
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
    setStorageForTesting(storage.client);
    tenantA = await admin.tenant.create({
      data: { name: `BIM Test A ${run}`, slug: `bim-a-${run}` },
    });
    tenantB = await admin.tenant.create({
      data: { name: `BIM Test B ${run}`, slug: `bim-b-${run}` },
    });
    user = await admin.user.create({
      data: { email: `bim-${run}@test.local`, name: "BIM Test User" },
    });
  });

  afterAll(async () => {
    setStorageForTesting(null);
    await admin.tenant.deleteMany({
      where: { id: { in: [tenantA.id, tenantB.id] } },
    });
    await admin.user.delete({ where: { id: user.id } });
    await admin.$disconnect();
    await app.$disconnect();
  });

  it("upload lifecycle: request (tenant-prefixed key) → confirm (size from storage) → download URL; pending stays invisible", async () => {
    const caller = callerFor(tenantA.id);
    const project = await caller.projects.create({
      code: `PB-${run}`,
      name: "Torre con BIM",
      status: "ACTIVE",
    });
    const model = await caller.bimModels.create({
      projectId: project.id,
      code: `BIM-${run}`,
      title: "Modelo estructural",
      discipline: "STRUCTURAL",
    });

    const request = await caller.bimModels.requestUpload({
      bimModelId: model.id,
      fileName: "torre-a.ifc",
      fileSize: 1024 * 1024,
    });
    expect(request.versionNumber).toBe(1);
    expect(request.uploadUrl).toContain("fake.r2/put");
    // The signed key lives under this tenant's prefix (ADR-008).
    expect(storage.signed.at(-1)).toMatch(
      new RegExp(`^tenants/${tenantA.id}/bim/${model.id}/`),
    );

    // Not confirmed yet → invisible as content, no download.
    let detail = await caller.bimModels.get({ id: model.id });
    expect(detail.versions).toHaveLength(0);
    await expect(
      caller.bimModels.getDownloadUrl({ id: request.versionId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    // Confirm before the object exists → BAD_REQUEST.
    await expect(
      caller.bimModels.confirmUpload({ id: request.versionId }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // "Upload" the object; the recorded size comes from storage, not the
    // client's declared size.
    const signedKey = storage.signed.at(-1)!;
    storage.objects.set(signedKey, {
      size: 2048 * 1024,
      contentType: "application/x-step",
    });
    const confirmed = await caller.bimModels.confirmUpload({
      id: request.versionId,
    });
    expect(confirmed.status).toBe("READY");
    expect(confirmed.fileSize).toBe(2048 * 1024);

    // Re-confirm is a conflict (append-only lifecycle).
    await expect(
      caller.bimModels.confirmUpload({ id: request.versionId }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    detail = await caller.bimModels.get({ id: model.id });
    expect(detail.versions).toHaveLength(1);
    expect(detail.versions[0]!.fileSize).toBe(2048 * 1024);

    const download = await caller.bimModels.getDownloadUrl({
      id: request.versionId,
    });
    expect(download.url).toContain("fake.r2/get");
    expect(download.fileName).toBe("torre-a.ifc");

    // Second upload becomes version 2; version 1 stays retrievable.
    const second = await caller.bimModels.requestUpload({
      bimModelId: model.id,
      fileName: "torre-a-rev2.ifc",
      fileSize: 1024,
    });
    expect(second.versionNumber).toBe(2);

    // Project detail lists the model with its READY count.
    const projectDetail = await caller.projects.get({ id: project.id });
    const listed = projectDetail.bimModels.find((m) => m.id === model.id);
    expect(listed?._count.versions).toBe(1);
  });

  it("rejects non-IFC uploads, oversize declarations, duplicate codes, and archived projects", async () => {
    const caller = callerFor(tenantA.id);
    const project = await caller.projects.create({
      code: `PBD-${run}`,
      name: "Obra denials",
    });
    const model = await caller.bimModels.create({
      projectId: project.id,
      code: `BIMD-${run}`,
      title: "Modelo",
      discipline: "ARCHITECTURE",
    });

    await expect(
      caller.bimModels.requestUpload({
        bimModelId: model.id,
        fileName: "modelo.rvt",
        fileSize: 1024,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.bimModels.requestUpload({
        bimModelId: model.id,
        fileName: "modelo.ifc",
        fileSize: 301 * 1024 * 1024,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.bimModels.create({
        projectId: project.id,
        code: `BIMD-${run}`,
        title: "Duplicado",
        discipline: "OTHER",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    // Archived project: no new models, no new versions, no metadata edits
    // (assertActiveProject → BAD_REQUEST, the shared precedent).
    await callerFor(tenantA.id, "OWNER_ADMIN").projects.archive({
      id: project.id,
    });
    await expect(
      caller.bimModels.create({
        projectId: project.id,
        code: `BIMD2-${run}`,
        title: "Tarde",
        discipline: "OTHER",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.bimModels.requestUpload({
        bimModelId: model.id,
        fileName: "tarde.ifc",
        fileSize: 1024,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.bimModels.update({ id: model.id, title: "Tarde" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("cross-tenant sweep: records, versions, uploads, and downloads are invisible to tenant B", async () => {
    const callerA = callerFor(tenantA.id);
    const callerB = callerFor(tenantB.id);

    const project = await callerA.projects.create({
      code: `PBX-${run}`,
      name: "Obra sweep",
    });
    const model = await callerA.bimModels.create({
      projectId: project.id,
      code: `BIMX-${run}`,
      title: "Modelo",
      discipline: "SITE",
    });
    const request = await callerA.bimModels.requestUpload({
      bimModelId: model.id,
      fileName: "sweep.ifc",
      fileSize: 1024,
    });
    storage.objects.set(storage.signed.at(-1)!, {
      size: 1024,
      contentType: "application/x-step",
    });
    await callerA.bimModels.confirmUpload({ id: request.versionId });

    await expect(callerB.bimModels.get({ id: model.id })).rejects.toMatchObject(
      { code: "NOT_FOUND" },
    );
    await expect(
      callerB.bimModels.update({ id: model.id, title: "Hijacked" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      callerB.bimModels.requestUpload({
        bimModelId: model.id,
        fileName: "spy.ifc",
        fileSize: 1024,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      callerB.bimModels.confirmUpload({ id: request.versionId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      callerB.bimModels.getDownloadUrl({ id: request.versionId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const listedInB = await callerB.bimModels.list();
    expect(listedInB.map((m) => m.id)).not.toContain(model.id);
  });
});
