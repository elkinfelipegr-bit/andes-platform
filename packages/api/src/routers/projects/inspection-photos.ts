// Photo lifecycle procedures (sprint-10.md scope item 3), spread into
// the inspections router. The Sprint 8 upload pattern composed with the
// Sprint 5 lifecycle: bytes never transit the API; edits and deletions
// only while the inspection is SCHEDULED — a completed report's photos
// are frozen evidence.
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { assertKeyInTenant, inspectionPhotoKey } from "@andes/storage";

import { tenantProcedure } from "../../trpc.js";
import { getStorage } from "../../storage.js";
import {
  EXTENSION_BY_CONTENT_TYPE,
  MAX_PHOTO_BYTES,
  photoIdSchema,
  photoUpdateSchema,
  photoUploadRequestSchema,
} from "./inspection-photo-schemas.js";

interface InspectionRow {
  id: string;
  status: string;
}

// Photo content follows the inspection's lifecycle exactly as finding
// edits do: SCHEDULED = draft evidence, terminal = frozen.
async function getScheduledInspection(
  tenantDb: { inspection: { findFirst(args: object): Promise<unknown> } },
  tenantId: string,
  id: string,
): Promise<InspectionRow> {
  const inspection = (await tenantDb.inspection.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true },
  })) as InspectionRow | null;
  if (!inspection) throw new TRPCError({ code: "NOT_FOUND" });
  if (inspection.status !== "SCHEDULED") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Photos can only change while the inspection is scheduled.",
    });
  }
  return inspection;
}

async function assertFindingInInspection(
  tenantDb: { finding: { findFirst(args: object): Promise<unknown> } },
  tenantId: string,
  inspectionId: string,
  findingId: string,
) {
  const finding = await tenantDb.finding.findFirst({
    where: { id: findingId, inspectionId, tenantId },
    select: { id: true },
  });
  if (!finding) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Finding does not belong to this inspection.",
    });
  }
}

export const inspectionPhotoProcedures = {
  // Step 1: PENDING row + presigned PUT. Extension comes from the
  // validated content type, never the file name (whitelist posture).
  requestPhotoUpload: tenantProcedure
    .input(photoUploadRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const inspection = await getScheduledInspection(
        ctx.tenantDb,
        ctx.tenantId,
        input.inspectionId,
      );
      if (input.findingId) {
        await assertFindingInInspection(
          ctx.tenantDb,
          ctx.tenantId,
          inspection.id,
          input.findingId,
        );
      }

      const position = await ctx.tenantDb.inspectionPhoto.count({
        where: { inspectionId: inspection.id, tenantId: ctx.tenantId },
      });
      const photoId = randomUUID().replace(/-/g, "");
      const storageKey = inspectionPhotoKey({
        tenantId: ctx.tenantId,
        inspectionId: inspection.id,
        photoId,
        extension: EXTENSION_BY_CONTENT_TYPE[input.contentType],
      });

      await ctx.tenantDb.inspectionPhoto.create({
        data: {
          id: photoId,
          tenantId: ctx.tenantId,
          inspectionId: inspection.id,
          findingId: input.findingId ?? null,
          storageKey,
          fileName: input.fileName,
          contentType: input.contentType,
          position,
          uploadedById: ctx.session.userId,
        },
      });

      const uploadUrl = await getStorage().presignedPutUrl(storageKey, {
        contentType: input.contentType,
        contentLength: input.fileSize,
      });
      return { photoId, uploadUrl, contentType: input.contentType };
    }),

  // Step 2: trust storage, not the client.
  confirmPhotoUpload: tenantProcedure
    .input(photoIdSchema)
    .mutation(async ({ ctx, input }) => {
      const photo = await ctx.tenantDb.inspectionPhoto.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
      });
      if (!photo) throw new TRPCError({ code: "NOT_FOUND" });
      if (photo.status !== "PENDING") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This photo was already confirmed.",
        });
      }
      assertKeyInTenant(photo.storageKey, ctx.tenantId);

      const head = await getStorage().headObject(photo.storageKey);
      if (!head) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The photo has not arrived in storage — upload it first.",
        });
      }
      if (head.size <= 0 || head.size > MAX_PHOTO_BYTES) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The stored photo size is outside the accepted range.",
        });
      }

      await ctx.tenantDb.inspectionPhoto.updateMany({
        where: { id: input.id, tenantId: ctx.tenantId },
        data: { status: "READY", fileSize: head.size },
      });
      return { id: photo.id, status: "READY" as const, fileSize: head.size };
    }),

  // Short-lived presigned GET — the only way a photo is ever viewed
  // (gallery and printed report alike). Never stored, never public.
  getPhotoUrl: tenantProcedure
    .input(photoIdSchema)
    .query(async ({ ctx, input }) => {
      const photo = await ctx.tenantDb.inspectionPhoto.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: { storageKey: true, fileName: true, status: true },
      });
      if (!photo || photo.status !== "READY") {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      assertKeyInTenant(photo.storageKey, ctx.tenantId);
      const url = await getStorage().presignedGetUrl(photo.storageKey);
      return { url, fileName: photo.fileName };
    }),

  // Caption and finding link edits — draft evidence only.
  updatePhoto: tenantProcedure
    .input(photoUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const photo = await ctx.tenantDb.inspectionPhoto.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: { id: true, inspectionId: true },
      });
      if (!photo) throw new TRPCError({ code: "NOT_FOUND" });
      await getScheduledInspection(
        ctx.tenantDb,
        ctx.tenantId,
        photo.inspectionId,
      );
      if (input.findingId) {
        await assertFindingInInspection(
          ctx.tenantDb,
          ctx.tenantId,
          photo.inspectionId,
          input.findingId,
        );
      }
      await ctx.tenantDb.inspectionPhoto.updateMany({
        where: { id: input.id, tenantId: ctx.tenantId },
        data: {
          ...(input.caption !== undefined ? { caption: input.caption } : {}),
          ...(input.findingId !== undefined
            ? { findingId: input.findingId }
            : {}),
        },
      });
      return { id: input.id };
    }),

  // Hard delete while SCHEDULED (ratified: draft evidence, mirrors
  // findings semantics). The object is removed after the row so the
  // database stays the index (ADR-008: no orphans) — best-effort: a
  // storage hiccup must not resurrect the row.
  removePhoto: tenantProcedure
    .input(photoIdSchema)
    .mutation(async ({ ctx, input }) => {
      const photo = await ctx.tenantDb.inspectionPhoto.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: { id: true, inspectionId: true, storageKey: true },
      });
      if (!photo) throw new TRPCError({ code: "NOT_FOUND" });
      await getScheduledInspection(
        ctx.tenantDb,
        ctx.tenantId,
        photo.inspectionId,
      );
      assertKeyInTenant(photo.storageKey, ctx.tenantId);
      await ctx.tenantDb.inspectionPhoto.deleteMany({
        where: { id: input.id, tenantId: ctx.tenantId },
      });
      try {
        await getStorage().deleteObject(photo.storageKey);
      } catch {
        // Row is gone; a stranded object is invisible and harmless.
      }
      return { id: input.id };
    }),
};
