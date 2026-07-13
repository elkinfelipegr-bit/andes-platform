// Integration tests for the photo lifecycle (sprint-10.md testing
// commitments): request → confirm (size from storage) → view, finding
// re-linking across the atomic findings replacement, frozen denials
// after completion, delete with storage cleanup, cross-tenant sweep.
// S3 boundary faked as in Sprints 8-9.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@andes/db";
import type { HeadResult, StorageClient } from "@andes/storage";

import type { Context, SessionInfo } from "../../context.js";
import { createCallerFactory } from "../../trpc.js";
import { setStorageForTesting } from "../../storage.js";
import { appRouter } from "../core.js";

const APP_URL = process.env.APP_DATABASE_URL;

function fakeStorage() {
  const objects = new Map<string, HeadResult>();
  const signed: string[] = [];
  const deleted: string[] = [];
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
    async deleteObject(key) {
      objects.delete(key);
      deleted.push(key);
    },
  };
  return { client, objects, signed, deleted };
}

describe.skipIf(!APP_URL)("inspection photos (integration)", () => {
  const admin = new PrismaClient();
  const app = new PrismaClient({ datasourceUrl: APP_URL });
  const createCaller = createCallerFactory(appRouter);
  const storage = fakeStorage();

  const run = randomUUID().slice(0, 8);
  let tenantA!: { id: string };
  let tenantB!: { id: string };
  let user!: { id: string };

  function callerFor(tenantId: string) {
    const session: SessionInfo = {
      userId: user.id,
      email: `photo-${run}@test.local`,
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

  async function scheduledInspection(code: string) {
    const caller = callerFor(tenantA.id);
    const project = await caller.projects.create({
      code: `PP-${code}-${run}`,
      name: "Obra con fotos",
    });
    // Membership required for the inspector check.
    return caller.inspections.create({
      projectId: project.id,
      inspectorId: user.id,
      code: `${code}-${run}`,
      title: "Visita",
      scheduledFor: new Date(),
    });
  }

  beforeAll(async () => {
    setStorageForTesting(storage.client);
    tenantA = await admin.tenant.create({
      data: { name: `Photo Test A ${run}`, slug: `photo-a-${run}` },
    });
    tenantB = await admin.tenant.create({
      data: { name: `Photo Test B ${run}`, slug: `photo-b-${run}` },
    });
    user = await admin.user.create({
      data: { email: `photo-${run}@test.local`, name: "Photo Test User" },
    });
    const role = await admin.role.create({
      data: { tenantId: tenantA.id, key: `ENG-${run}`, label: "Engineer" },
    });
    await admin.membership.create({
      data: { tenantId: tenantA.id, userId: user.id, roleId: role.id },
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

  it("lifecycle: request (tenant-prefixed key from content type) → confirm (size from storage) → listed and viewable; pending invisible", async () => {
    const caller = callerFor(tenantA.id);
    const inspection = await scheduledInspection("IL");

    const request = await caller.inspections.requestPhotoUpload({
      inspectionId: inspection.id,
      fileName: "GRIETA con espacios.PNG",
      fileSize: 1024,
      contentType: "image/png",
    });
    // Key is tenant-prefixed and its extension comes from the content
    // type, never the file name.
    expect(storage.signed.at(-1)).toMatch(
      new RegExp(
        `^tenants/${tenantA.id}/inspections/${inspection.id}/.*\\.png$`,
      ),
    );

    let detail = await caller.inspections.get({ id: inspection.id });
    expect(detail.photos).toHaveLength(0); // pending is invisible
    await expect(
      caller.inspections.getPhotoUrl({ id: request.photoId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      caller.inspections.confirmPhotoUpload({ id: request.photoId }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" }); // not in storage yet

    storage.objects.set(storage.signed.at(-1)!, {
      size: 4096,
      contentType: "image/png",
    });
    const confirmed = await caller.inspections.confirmPhotoUpload({
      id: request.photoId,
    });
    expect(confirmed.fileSize).toBe(4096); // from storage, not the client

    detail = await caller.inspections.get({ id: inspection.id });
    expect(detail.photos).toHaveLength(1);
    const url = await caller.inspections.getPhotoUrl({ id: request.photoId });
    expect(url.url).toContain("fake.r2/get");
  });

  it("finding links survive the atomic findings replacement (re-link by position); removed finding demotes to general", async () => {
    const caller = callerFor(tenantA.id);
    const inspection = await scheduledInspection("IF");
    const withFindings = await caller.inspections.update({
      id: inspection.id,
      findings: [
        { description: "Grieta en viga", severity: "HIGH" },
        { description: "Humedad en muro", severity: "LOW" },
      ],
    });
    const [crack, damp] = withFindings.findings;

    async function uploadPhoto(findingId: string | undefined, name: string) {
      const request = await caller.inspections.requestPhotoUpload({
        inspectionId: inspection.id,
        findingId,
        fileName: name,
        fileSize: 1024,
        contentType: "image/jpeg",
      });
      storage.objects.set(storage.signed.at(-1)!, {
        size: 1024,
        contentType: "image/jpeg",
      });
      await caller.inspections.confirmPhotoUpload({ id: request.photoId });
      return request.photoId;
    }
    const crackPhoto = await uploadPhoto(crack!.id, "grieta.jpg");
    const dampPhoto = await uploadPhoto(damp!.id, "humedad.jpg");

    // Edit the first finding's text — both photos must stay linked to
    // the findings at their positions.
    const edited = await caller.inspections.update({
      id: inspection.id,
      findings: [
        { description: "Grieta en viga eje 3 (ampliada)", severity: "HIGH" },
        { description: "Humedad en muro", severity: "LOW" },
      ],
    });
    const photosAfterEdit = edited.photos;
    expect(photosAfterEdit.find((p) => p.id === crackPhoto)?.findingId).toBe(
      edited.findings[0]!.id,
    );
    expect(photosAfterEdit.find((p) => p.id === dampPhoto)?.findingId).toBe(
      edited.findings[1]!.id,
    );

    // Remove the second finding — its photo demotes to general.
    const shrunk = await caller.inspections.update({
      id: inspection.id,
      findings: [
        { description: "Grieta en viga eje 3 (ampliada)", severity: "HIGH" },
      ],
    });
    expect(shrunk.photos.find((p) => p.id === dampPhoto)?.findingId).toBeNull();
    expect(shrunk.photos.find((p) => p.id === crackPhoto)?.findingId).toBe(
      shrunk.findings[0]!.id,
    );
  });

  it("caption edits, finding validation, delete with storage cleanup — SCHEDULED only; frozen after completion", async () => {
    const caller = callerFor(tenantA.id);
    const inspection = await scheduledInspection("IC");
    const other = await scheduledInspection("IO");
    const otherWithFinding = await caller.inspections.update({
      id: other.id,
      findings: [{ description: "Ajena", severity: "LOW" }],
    });

    const request = await caller.inspections.requestPhotoUpload({
      inspectionId: inspection.id,
      fileName: "sitio.webp",
      fileSize: 2048,
      contentType: "image/webp",
    });
    const key = storage.signed.at(-1)!;
    storage.objects.set(key, { size: 2048, contentType: "image/webp" });
    await caller.inspections.confirmPhotoUpload({ id: request.photoId });

    await caller.inspections.updatePhoto({
      id: request.photoId,
      caption: "Vista general del sitio",
    });
    // A finding from ANOTHER inspection is rejected.
    await expect(
      caller.inspections.updatePhoto({
        id: request.photoId,
        findingId: otherWithFinding.findings[0]!.id,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // Second photo, then delete it: row gone AND object removed.
    const second = await caller.inspections.requestPhotoUpload({
      inspectionId: inspection.id,
      fileName: "borrar.jpg",
      fileSize: 1024,
      contentType: "image/jpeg",
    });
    const secondKey = storage.signed.at(-1)!;
    storage.objects.set(secondKey, { size: 1024, contentType: "image/jpeg" });
    await caller.inspections.confirmPhotoUpload({ id: second.photoId });
    await caller.inspections.removePhoto({ id: second.photoId });
    expect(storage.deleted).toContain(secondKey);

    // Complete → everything freezes.
    await caller.inspections.complete({ id: inspection.id });
    await expect(
      caller.inspections.requestPhotoUpload({
        inspectionId: inspection.id,
        fileName: "tarde.jpg",
        fileSize: 1024,
        contentType: "image/jpeg",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      caller.inspections.updatePhoto({ id: request.photoId, caption: "x" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      caller.inspections.removePhoto({ id: request.photoId }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    // Still viewable — the frozen report keeps its evidence.
    await expect(
      caller.inspections.getPhotoUrl({ id: request.photoId }),
    ).resolves.toMatchObject({ fileName: "sitio.webp" });
  });

  it("cross-tenant sweep: requests, confirms, URLs, edits, and deletes are invisible to tenant B", async () => {
    const callerA = callerFor(tenantA.id);
    const callerB = callerFor(tenantB.id);
    const inspection = await scheduledInspection("IX");
    const request = await callerA.inspections.requestPhotoUpload({
      inspectionId: inspection.id,
      fileName: "sweep.jpg",
      fileSize: 1024,
      contentType: "image/jpeg",
    });
    storage.objects.set(storage.signed.at(-1)!, {
      size: 1024,
      contentType: "image/jpeg",
    });
    await callerA.inspections.confirmPhotoUpload({ id: request.photoId });

    await expect(
      callerB.inspections.requestPhotoUpload({
        inspectionId: inspection.id,
        fileName: "spy.jpg",
        fileSize: 1024,
        contentType: "image/jpeg",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      callerB.inspections.confirmPhotoUpload({ id: request.photoId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      callerB.inspections.getPhotoUrl({ id: request.photoId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      callerB.inspections.updatePhoto({ id: request.photoId, caption: "x" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      callerB.inspections.removePhoto({ id: request.photoId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
