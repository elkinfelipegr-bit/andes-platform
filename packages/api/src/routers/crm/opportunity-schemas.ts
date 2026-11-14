// Zod input schemas for the CRM pipeline (sprint-15-domain-model.md).
// Unit-tested per PROJECT_RULES.md testing strategy.
import { z } from "zod";

// Mirrors the OpportunityStage Prisma enum, in board order.
export const OPPORTUNITY_STAGES = [
  "LEAD",
  "CONTACTED",
  "QUOTED",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;

export const OPEN_STAGES = [
  "LEAD",
  "CONTACTED",
  "QUOTED",
  "NEGOTIATION",
] as const;

export const ACTIVITY_TYPES = [
  "NOTE",
  "CALL",
  "EMAIL",
  "MEETING",
  "WHATSAPP",
  "VISIT",
] as const;

export const opportunityStageSchema = z.enum(OPPORTUNITY_STAGES);
export const activityTypeSchema = z.enum(ACTIVITY_TYPES);

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export function isOpenStage(stage: OpportunityStage): boolean {
  return (OPEN_STAGES as readonly string[]).includes(stage);
}

const id = z.string().min(1);
const title = z.string().trim().min(1).max(200);
const shortText = z.string().trim().min(1).max(200);
const nextAction = z.string().trim().min(1).max(300);
// Same bounds as proposal money: stored as Decimal(14,2).
const money = z.number().min(0).max(999_999_999_999);
// A calendar day, as the browser's date input produces it. Stored at UTC
// midnight (the Proposal.validUntil precedent), so "today" never depends
// on the server's timezone.
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date as YYYY-MM-DD")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), "Invalid date");

export const daySchema = day;

export const opportunityCreateSchema = z.object({
  clientId: id,
  contactId: id.optional(),
  title,
  estimatedValue: money.optional(),
  currency: z.string().trim().length(3).optional(),
  source: shortText.optional(),
  // Defaults to the creator; must be a member of the tenant.
  ownerId: id.optional(),
  nextAction: nextAction.optional(),
  nextActionAt: day.optional(),
});

// clientId is immutable (the proposal precedent): an opportunity is one
// client's. Stage changes go through setStage.
export const opportunityUpdateSchema = z.object({
  id,
  contactId: id.nullable().optional(),
  title: title.optional(),
  estimatedValue: money.nullable().optional(),
  currency: z.string().trim().length(3).optional(),
  source: shortText.nullable().optional(),
  ownerId: id.optional(),
  nextAction: nextAction.nullable().optional(),
  nextActionAt: day.nullable().optional(),
});

export const opportunityListSchema = z
  .object({
    // The caller's local calendar day, so overdue/today match what the
    // user sees on their clock. Defaults to the UTC day.
    today: day.optional(),
  })
  .optional();

export const opportunityIdSchema = z.object({ id });

// Losing requires a reason (domain rule): it is the only raw material for
// improving the win rate.
export const opportunitySetStageSchema = z
  .object({
    id,
    stage: opportunityStageSchema,
    lostReason: z.string().trim().min(1).max(500).optional(),
  })
  .refine((v) => v.stage !== "LOST" || !!v.lostReason, {
    message: "A reason is required to mark an opportunity as lost.",
    path: ["lostReason"],
  });

// Logging an interaction and scheduling what comes next is one gesture:
// the optional next step travels with the activity.
export const activityLogSchema = z.object({
  opportunityId: id,
  type: activityTypeSchema.default("NOTE"),
  body: z.string().trim().min(1).max(4000),
  occurredAt: z.coerce.date().optional(),
  nextAction: nextAction.nullable().optional(),
  nextActionAt: day.nullable().optional(),
});
