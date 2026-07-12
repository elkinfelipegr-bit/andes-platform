// Zod input schemas for the BIM Module (sprint-8-domain-model.md).
// IFC only (RFC-002) and the ratified 300 MB cap — both enforced here at
// the boundary, before any storage interaction.
import { z } from "zod";

export const BIM_DISCIPLINES = [
  "ARCHITECTURE",
  "STRUCTURAL",
  "MEP",
  "SITE",
  "OTHER",
] as const;
export const BIM_VERSION_STATUSES = ["PENDING", "READY"] as const;

export const bimDisciplineSchema = z.enum(BIM_DISCIPLINES);
export const bimVersionStatusSchema = z.enum(BIM_VERSION_STATUSES);

// Ratified cap (domain model recommendation 5): explicit client-side
// parsing bound, config change to raise — never a schema change.
export const MAX_UPLOAD_BYTES = 300 * 1024 * 1024;

// IFC files are STEP physical files (ISO 10303-21).
export const IFC_CONTENT_TYPE = "application/x-step";

export const bimModelCreateSchema = z.object({
  projectId: z.string().min(1),
  code: z.string().trim().min(1).max(32),
  title: z.string().trim().min(1).max(200),
  discipline: bimDisciplineSchema,
});

export const bimModelUpdateSchema = z.object({
  id: z.string().min(1),
  code: z.string().trim().min(1).max(32).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  discipline: bimDisciplineSchema.optional(),
});

export const bimModelListSchema = z
  .object({
    projectId: z.string().min(1).optional(),
    discipline: bimDisciplineSchema.optional(),
  })
  .optional();

export const bimModelIdSchema = z.object({ id: z.string().min(1) });

export const uploadRequestSchema = z.object({
  bimModelId: z.string().min(1),
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/\.ifc$/i, "Only .ifc files are accepted (RFC-002)"),
  fileSize: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

export const versionIdSchema = z.object({ id: z.string().min(1) });
