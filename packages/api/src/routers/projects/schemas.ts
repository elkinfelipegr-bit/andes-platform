// Zod input schemas for the Projects domain (sprint-2-domain-model.md).
// Unit-tested per PROJECT_RULES.md testing strategy.
import { z } from "zod";

// Mirrors the ProjectStatus Prisma enum (ratified: enum, not a data table).
export const PROJECT_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "ARCHIVED",
] as const;

export const projectStatusSchema = z.enum(PROJECT_STATUSES);
export type ProjectStatusInput = z.infer<typeof projectStatusSchema>;

// ARCHIVED is not settable through create/update — it is the role-gated
// `archive` procedure's job (sprint-2-domain-model.md, Roles & Permissions).
const settableStatusSchema = z.enum(
  PROJECT_STATUSES.filter((s) => s !== "ARCHIVED") as [
    "DRAFT",
    "ACTIVE",
    "ON_HOLD",
    "COMPLETED",
  ],
);

export const projectCreateSchema = z
  .object({
    // Human-assigned, unique per tenant (ratified decision 3).
    code: z.string().trim().min(1).max(32),
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
    clientId: z.string().min(1).optional(),
    status: settableStatusSchema.optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .refine((p) => !p.startDate || !p.endDate || p.startDate <= p.endDate, {
    message: "endDate must not precede startDate",
    path: ["endDate"],
  });

export const projectUpdateSchema = z
  .object({
    id: z.string().min(1),
    code: z.string().trim().min(1).max(32).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    clientId: z.string().min(1).nullable().optional(),
    status: settableStatusSchema.optional(),
    startDate: z.coerce.date().nullable().optional(),
    endDate: z.coerce.date().nullable().optional(),
  })
  .refine((p) => !p.startDate || !p.endDate || p.startDate <= p.endDate, {
    message: "endDate must not precede startDate",
    path: ["endDate"],
  });

export const projectListSchema = z
  .object({ status: projectStatusSchema.optional() })
  .optional();

export const projectIdSchema = z.object({ id: z.string().min(1) });

export const clientCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
});
