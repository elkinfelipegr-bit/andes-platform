// Zod input schemas for the Structural Module (sprint-6-domain-model.md).
// Material and geometry bounds mirror @andes/structures' validation so the
// user gets form-level feedback before the library throws.
import { z } from "zod";

export const CALC_RECORD_STATUSES = ["DRAFT", "ISSUED"] as const;
export const calcRecordStatusSchema = z.enum(CALC_RECORD_STATUSES);

const fc = z.number().min(17).max(100); // MPa
const fy = z.number().min(240).max(700); // MPa

export const calcRecordCreateSchema = z.object({
  projectId: z.string().min(1),
  code: z.string().trim().min(1).max(32),
  title: z.string().trim().min(1).max(200),
  designCode: z.string().trim().min(1).max(50).optional(),
  fc,
  fy,
  notes: z.string().trim().max(5000).optional(),
});

// Content edits are DRAFT-only (router-enforced). projectId immutable.
// Changing fc/fy recomputes every check in the record.
export const calcRecordUpdateSchema = z.object({
  id: z.string().min(1),
  code: z.string().trim().min(1).max(32).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  designCode: z.string().trim().min(1).max(50).optional(),
  fc: fc.optional(),
  fy: fy.optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
});

export const calcRecordListSchema = z
  .object({
    projectId: z.string().min(1).optional(),
    status: calcRecordStatusSchema.optional(),
  })
  .optional();

export const calcRecordIdSchema = z.object({ id: z.string().min(1) });

const checkGeometry = {
  label: z.string().trim().min(1).max(200),
  b: z.number().positive().max(10_000), // mm
  h: z.number().positive().max(10_000), // mm
  cover: z.number().positive().max(1_000), // mm
  mu: z.number().positive().max(100_000_000), // kN·m
};

export const checkAddSchema = z.object({
  calcRecordId: z.string().min(1),
  ...checkGeometry,
});

export const checkUpdateSchema = z.object({
  id: z.string().min(1),
  label: checkGeometry.label.optional(),
  b: checkGeometry.b.optional(),
  h: checkGeometry.h.optional(),
  cover: checkGeometry.cover.optional(),
  mu: checkGeometry.mu.optional(),
});

export const checkIdSchema = z.object({ id: z.string().min(1) });
