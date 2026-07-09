// Zod input schemas for the Proposal Generator (sprint-4-domain-model.md).
// Unit-tested per PROJECT_RULES.md testing strategy.
import { z } from "zod";

// Mirrors the ProposalStatus Prisma enum (ratified: enum, not data).
export const PROPOSAL_STATUSES = [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
] as const;

export const proposalStatusSchema = z.enum(PROPOSAL_STATUSES);

// Money travels as JSON numbers, stored as Decimal(14,2). Bounds keep
// values inside the column; two-decimal rounding happens at the column.
const money = z.number().min(0).max(999_999_999_999);
const quantity = z.number().positive().max(999_999_999);

export const proposalItemInputSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity,
  unit: z.string().trim().min(1).max(50),
  unitPrice: money,
});

export const proposalCreateSchema = z.object({
  clientId: z.string().min(1),
  contactId: z.string().min(1).optional(),
  code: z.string().trim().min(1).max(32),
  title: z.string().trim().min(1).max(200),
  scope: z.string().trim().max(5000).optional(),
  currency: z.string().trim().length(3).optional(),
  validUntil: z.coerce.date().optional(),
  items: z.array(proposalItemInputSchema).max(100).default([]),
});

// Content edits are DRAFT-only (enforced by the router, ratified decision
// 3). clientId is immutable — a proposal addresses one client; items, when
// present, replace the full set.
export const proposalUpdateSchema = z.object({
  id: z.string().min(1),
  contactId: z.string().min(1).nullable().optional(),
  code: z.string().trim().min(1).max(32).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  scope: z.string().trim().max(5000).nullable().optional(),
  currency: z.string().trim().length(3).optional(),
  validUntil: z.coerce.date().nullable().optional(),
  items: z.array(proposalItemInputSchema).max(100).optional(),
});

export const proposalListSchema = z
  .object({ status: proposalStatusSchema.optional() })
  .optional();

export const proposalIdSchema = z.object({ id: z.string().min(1) });

export const proposalDecideSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(["ACCEPTED", "REJECTED"]),
});

export const proposalConvertSchema = z.object({
  id: z.string().min(1),
  // Project codes are human-assigned at conversion (ratified decision 4).
  projectCode: z.string().trim().min(1).max(32),
  projectName: z.string().trim().min(1).max(200).optional(),
});
