// Zod input schemas for the Geotechnical Module (sprint-7-domain-model.md).
// Bounds mirror @andes/geo's validation so the user gets form-level
// feedback before the library throws.
import { z } from "zod";

export const GEO_RECORD_STATUSES = ["DRAFT", "ISSUED"] as const;
export const FOOTING_SHAPES = ["STRIP", "SQUARE"] as const;

export const geoRecordStatusSchema = z.enum(GEO_RECORD_STATUSES);
export const footingShapeSchema = z.enum(FOOTING_SHAPES);

export const geoRecordCreateSchema = z.object({
  projectId: z.string().min(1),
  code: z.string().trim().min(1).max(32),
  title: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(5000).optional(),
});

// Content edits are DRAFT-only (router-enforced). projectId immutable.
export const geoRecordUpdateSchema = z.object({
  id: z.string().min(1),
  code: z.string().trim().min(1).max(32).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
});

export const geoRecordListSchema = z
  .object({
    projectId: z.string().min(1).optional(),
    status: geoRecordStatusSchema.optional(),
  })
  .optional();

export const geoRecordIdSchema = z.object({ id: z.string().min(1) });

const checkGeometry = {
  label: z.string().trim().min(1).max(200),
  b: z.number().positive().max(100), // m
  df: z.number().min(0).max(100), // m
  gamma: z.number().min(5).max(30), // kN/m³
  c: z.number().min(0).max(1000), // kPa
  phi: z.number().min(0).max(50), // degrees
  fs: z.number().min(1).max(10),
  shape: footingShapeSchema,
};

export const bearingCheckAddSchema = z.object({
  geoRecordId: z.string().min(1),
  ...checkGeometry,
});

export const bearingCheckUpdateSchema = z.object({
  id: z.string().min(1),
  label: checkGeometry.label.optional(),
  b: checkGeometry.b.optional(),
  df: checkGeometry.df.optional(),
  gamma: checkGeometry.gamma.optional(),
  c: checkGeometry.c.optional(),
  phi: checkGeometry.phi.optional(),
  fs: checkGeometry.fs.optional(),
  shape: footingShapeSchema.optional(),
});

export const bearingCheckIdSchema = z.object({ id: z.string().min(1) });
