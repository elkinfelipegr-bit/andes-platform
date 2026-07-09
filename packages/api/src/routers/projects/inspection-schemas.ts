// Zod input schemas for the Inspection Module (sprint-5-domain-model.md).
// Unit-tested per PROJECT_RULES.md testing strategy.
import { z } from "zod";

// Mirror the Prisma enums (ratified: enums, not data).
export const INSPECTION_STATUSES = [
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
] as const;
export const FINDING_SEVERITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const;

export const inspectionStatusSchema = z.enum(INSPECTION_STATUSES);
export const findingSeveritySchema = z.enum(FINDING_SEVERITIES);

export const findingInputSchema = z.object({
  description: z.string().trim().min(1).max(1000),
  severity: findingSeveritySchema,
  location: z.string().trim().min(1).max(200).optional(),
});

export const inspectionCreateSchema = z.object({
  projectId: z.string().min(1),
  inspectorId: z.string().min(1),
  code: z.string().trim().min(1).max(32),
  title: z.string().trim().min(1).max(200),
  scheduledFor: z.coerce.date(),
  notes: z.string().trim().max(5000).optional(),
});

// Content edits are SCHEDULED-only (router-enforced). projectId is
// immutable — an inspection belongs to its project. findings, when
// present, replace the full set (the proposal-items precedent).
export const inspectionUpdateSchema = z.object({
  id: z.string().min(1),
  inspectorId: z.string().min(1).optional(),
  code: z.string().trim().min(1).max(32).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  scheduledFor: z.coerce.date().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  findings: z.array(findingInputSchema).max(200).optional(),
});

export const inspectionListSchema = z
  .object({
    projectId: z.string().min(1).optional(),
    status: inspectionStatusSchema.optional(),
  })
  .optional();

export const inspectionIdSchema = z.object({ id: z.string().min(1) });
