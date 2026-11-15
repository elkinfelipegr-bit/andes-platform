// Opportunity health (sprint-16-domain-model.md): forecasting defaults
// and the aging rules that decide what the firm must look at. Pure and
// unit-tested; thresholds live here, in one place.
import type { FollowUpState } from "./follow-up.js";
import type { OpportunityStage } from "./opportunity-schemas.js";

// Default chance of winning by stage — a starting point the owner can
// override per opportunity. WON/LOST are facts, never overridden.
export const STAGE_PROBABILITY: Record<OpportunityStage, number> = {
  LEAD: 10,
  CONTACTED: 25,
  QUOTED: 50,
  NEGOTIATION: 75,
  WON: 100,
  LOST: 0,
};

export function effectiveProbability(
  stage: OpportunityStage,
  override: number | null,
): number {
  if (stage === "WON" || stage === "LOST") return STAGE_PROBABILITY[stage];
  return override ?? STAGE_PROBABILITY[stage];
}

// Weighted value: what the forecast counts for this opportunity.
export function weightedValue(
  value: number | null,
  stage: OpportunityStage,
  override: number | null,
): number | null {
  if (value === null) return null;
  return Math.round((value * effectiveProbability(stage, override)) / 100);
}

// An open opportunity nobody has touched for this long has gone cold.
export const COLD_AFTER_DAYS = 14;
// A sent quote with no answer for this long needs chasing.
export const QUOTE_CHASE_AFTER_DAYS = 7;
// A website request nobody answered within this long is late.
export const REQUEST_LATE_AFTER_DAYS = 1;

export const RISKS = [
  "OVERDUE",
  "QUOTE_WAITING",
  "COLD",
  "NO_NEXT_STEP",
  "UNANSWERED_REQUEST",
] as const;
export type Risk = (typeof RISKS)[number];

const DAY = 86_400_000;

export function daysSince(date: Date | null, now: Date): number | null {
  if (!date) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY));
}

export interface HealthInput {
  stage: OpportunityStage;
  followUp: FollowUpState | null;
  createdAt: Date;
  // Most recent logged activity, if any.
  lastActivityAt: Date | null;
  // Number of logged activities by people (the intake note excluded).
  humanActivities: number;
  // Oldest sent proposal still awaiting an answer, if any.
  oldestSentAt: Date | null;
}

// Every reason an open opportunity needs attention, most urgent first.
// Closed opportunities have none.
export function opportunityRisks(input: HealthInput, now: Date): Risk[] {
  if (input.stage === "WON" || input.stage === "LOST") return [];
  const risks: Risk[] = [];
  if (input.followUp === "OVERDUE") risks.push("OVERDUE");
  const waiting = daysSince(input.oldestSentAt, now);
  if (waiting !== null && waiting >= QUOTE_CHASE_AFTER_DAYS) {
    risks.push("QUOTE_WAITING");
  }
  if (
    input.stage === "LEAD" &&
    input.humanActivities === 0 &&
    (daysSince(input.createdAt, now) ?? 0) >= REQUEST_LATE_AFTER_DAYS
  ) {
    risks.push("UNANSWERED_REQUEST");
  }
  const quiet = daysSince(input.lastActivityAt ?? input.createdAt, now) ?? 0;
  if (quiet >= COLD_AFTER_DAYS) risks.push("COLD");
  if (input.followUp === "NONE") risks.push("NO_NEXT_STEP");
  return risks;
}
