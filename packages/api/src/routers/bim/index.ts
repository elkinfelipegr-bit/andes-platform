// BIM Module procedures (sprint-8.md scope item 3; ADR-003 per-product
// routers, Andes BIM module). The platform's first file domain (RFC-002):
// bytes never transit these procedures — the server only issues scoped,
// short-lived presigned URLs (ADR-008) and records what storage confirms.
// Versions are append-only evidence: no overwrite, no hard delete.
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@andes/db";
import { assertKeyInTenant, bimVersionKey } from "@andes/storage";

import { router, tenantProcedure } from "../../trpc.js";
import { assertActiveProject } from "../projects/inspections.js";
import {
  bimModelCreateSchema,
  bimModelIdSchema,
  bimModelListSchema,
  bimModelUpdateSchema,
  IFC_CONTENT_TYPE,
  MAX_UPLOAD_BYTES,
  uploadRequestSchema,
  versionIdSchema,
} from "./schemas.js";
import { getStorage } from "./storage.js";

const projectSummary = {
  select: { id: true, code: true, name: true },
} as const;

// Only confirmed uploads are content (sprint-8-domain-model.md): a
// PENDING version holds no object and is never listed or served.
const readyVersions = {
  where: { status: "READY" as const },
  orderBy: { versionNumber: "desc" as const },
  select: {
    id: true,
    versionNumber: true,
    fileName: true,
    fileSize: true,
    contentType: true,
    createdAt: true,
    uploadedBy: { select: { id: true, name: true } },
  },
} as const;

function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  );
}

async function getModel(
  tenantDb: { bimModel: { findFirst(args: object): Promise<unknown> } },
  tenantId: string,
  id: string,
) {
  const model = (await tenantDb.bimModel.findFirst({
    where: { id, tenantId },
    select: { id: true, projectId: true },
  })) as { id: string; projectId: string } | null;
  if (!model) throw new TRPCError({ code: "NOT_FOUND" });
  return model;
}

export const bimModelsRouter = router({
  list: tenantProcedure.input(bimModelListSchema).query(({ ctx, input }) =>
    ctx.tenantDb.bimModel.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(input?.projectId ? { projectId: input.projectId } : {}),
        ...(input?.discipline ? { discipline: input.discipline } : {}),
      },
      include: {
        project: projectSummary,
        _count: { select: { versions: { where: { status: "READY" } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ),

  get: tenantProcedure.input(bimModelIdSchema).query(async ({ ctx, input }) => {
    const model = await ctx.tenantDb.bimModel.findFirst({
      where: { id: input.id, tenantId: ctx.tenantId },
      include: { project: projectSummary, versions: readyVersions },
    });
    if (!model) throw new TRPCError({ code: "NOT_FOUND" });
    return model;
  }),

  create: tenantProcedure
    .input(bimModelCreateSchema)
    .mutation(async ({ ctx, input }) => {
      await assertActiveProject(ctx.tenantDb, ctx.tenantId, input.projectId);
      try {
        return await ctx.tenantDb.bimModel.create({
          data: {
            ...input,
            tenantId: ctx.tenantId,
            createdById: ctx.session.userId,
          },
          include: { project: projectSummary },
        });
      } catch (e) {
        if (isUniqueViolation(e)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A BIM model with code "${input.code}" already exists.`,
          });
        }
        throw e;
      }
    }),

  // Metadata only — versions are immutable and never edited.
  update: tenantProcedure
    .input(bimModelUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const model = await getModel(ctx.tenantDb, ctx.tenantId, id);
      await assertActiveProject(ctx.tenantDb, ctx.tenantId, model.projectId);
      try {
        await ctx.tenantDb.bimModel.updateMany({
          where: { id, tenantId: ctx.tenantId },
          data: fields,
        });
      } catch (e) {
        if (isUniqueViolation(e)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A BIM model with code "${fields.code}" already exists.`,
          });
        }
        throw e;
      }
      return ctx.tenantDb.bimModel.findFirst({
        where: { id, tenantId: ctx.tenantId },
        include: { project: projectSummary, versions: readyVersions },
      });
    }),

  // Upload lifecycle step 1: create the PENDING version and hand the
  // browser a presigned PUT. The key is built (never assembled by hand)
  // by @andes/storage under the tenant prefix.
  requestUpload: tenantProcedure
    .input(uploadRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const model = await getModel(
        ctx.tenantDb,
        ctx.tenantId,
        input.bimModelId,
      );
      await assertActiveProject(ctx.tenantDb, ctx.tenantId, model.projectId);

      const last = await ctx.tenantDb.bimModelVersion.findFirst({
        where: { bimModelId: model.id, tenantId: ctx.tenantId },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });
      const versionNumber = (last?.versionNumber ?? 0) + 1;

      // Id generated here so the storage key can embed it before insert.
      const versionId = randomUUID().replace(/-/g, "");
      const storageKey = bimVersionKey({
        tenantId: ctx.tenantId,
        bimModelId: model.id,
        versionId,
      });

      try {
        await ctx.tenantDb.bimModelVersion.create({
          data: {
            id: versionId,
            tenantId: ctx.tenantId,
            bimModelId: model.id,
            versionNumber,
            storageKey,
            fileName: input.fileName,
            contentType: IFC_CONTENT_TYPE,
            uploadedById: ctx.session.userId,
          },
        });
      } catch (e) {
        if (isUniqueViolation(e)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Another upload started at the same time — retry.",
          });
        }
        throw e;
      }

      const uploadUrl = await getStorage().presignedPutUrl(storageKey, {
        contentType: IFC_CONTENT_TYPE,
        contentLength: input.fileSize,
      });
      return {
        versionId,
        versionNumber,
        uploadUrl,
        contentType: IFC_CONTENT_TYPE,
      };
    }),

  // Step 2: trust storage, not the client — the object must exist and
  // its actual size is what gets recorded.
  confirmUpload: tenantProcedure
    .input(versionIdSchema)
    .mutation(async ({ ctx, input }) => {
      const version = await ctx.tenantDb.bimModelVersion.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
      });
      if (!version) throw new TRPCError({ code: "NOT_FOUND" });
      if (version.status !== "PENDING") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This version was already confirmed.",
        });
      }
      assertKeyInTenant(version.storageKey, ctx.tenantId);

      const head = await getStorage().headObject(version.storageKey);
      if (!head) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The file has not arrived in storage — upload it first.",
        });
      }
      if (head.size <= 0 || head.size > MAX_UPLOAD_BYTES) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The stored file size is outside the accepted range.",
        });
      }

      await ctx.tenantDb.bimModelVersion.updateMany({
        where: { id: input.id, tenantId: ctx.tenantId },
        data: { status: "READY", fileSize: head.size },
      });
      return {
        id: version.id,
        versionNumber: version.versionNumber,
        status: "READY" as const,
        fileSize: head.size,
      };
    }),

  // Short-lived presigned GET for viewing/downloading a READY version —
  // issued per request, never stored (sprint-8-domain-model.md).
  getDownloadUrl: tenantProcedure
    .input(versionIdSchema)
    .query(async ({ ctx, input }) => {
      const version = await ctx.tenantDb.bimModelVersion.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: { storageKey: true, fileName: true, status: true },
      });
      if (!version || version.status !== "READY") {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      assertKeyInTenant(version.storageKey, ctx.tenantId);
      const url = await getStorage().presignedGetUrl(version.storageKey);
      return { url, fileName: version.fileName };
    }),
});
