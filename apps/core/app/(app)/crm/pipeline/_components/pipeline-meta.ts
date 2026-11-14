// Display metadata for the pipeline (sprint-15-domain-model.md). Order
// and keys mirror the OpportunityStage / ActivityType enums.
import {
  Building2,
  Mail,
  MessageCircle,
  Phone,
  StickyNote,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { RouterOutputs } from "@/lib/trpc";

export type Opportunity = RouterOutputs["opportunities"]["list"][number];
export type Stage = Opportunity["stage"];
export type FollowUp = NonNullable<Opportunity["followUp"]>;
export type ActivityType =
  RouterOutputs["opportunities"]["get"]["activities"][number]["type"];

export const OPEN_STAGES = [
  "LEAD",
  "CONTACTED",
  "QUOTED",
  "NEGOTIATION",
] as const satisfies readonly Stage[];

export const STAGE_LABEL: Record<Stage, string> = {
  LEAD: "New lead",
  CONTACTED: "Contacted",
  QUOTED: "Quoted",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};

export const STAGE_HINT: Record<Stage, string> = {
  LEAD: "Just arrived — nobody has answered yet",
  CONTACTED: "In conversation, no quote sent",
  QUOTED: "Quote sent, waiting for an answer",
  NEGOTIATION: "Adjusting scope or price",
  WON: "The client said yes",
  LOST: "Did not go ahead",
};

export function isOpen(stage: Stage) {
  return stage !== "WON" && stage !== "LOST";
}

export const ACTIVITY_TYPES: {
  key: ActivityType;
  label: string;
  icon: LucideIcon;
}[] = [
  { key: "CALL", label: "Call", icon: Phone },
  { key: "WHATSAPP", label: "WhatsApp", icon: MessageCircle },
  { key: "EMAIL", label: "Email", icon: Mail },
  { key: "MEETING", label: "Meeting", icon: Users },
  { key: "VISIT", label: "Site visit", icon: Building2 },
  { key: "NOTE", label: "Note", icon: StickyNote },
];

export function activityMeta(type: ActivityType) {
  return ACTIVITY_TYPES.find((t) => t.key === type) ?? ACTIVITY_TYPES[5]!;
}

export const SOURCE_SUGGESTIONS = [
  "Website",
  "Referral",
  "WhatsApp",
  "Phone call",
  "Returning client",
  "Tender",
];

// Sum estimated values per currency — amounts in different currencies
// are never added together.
export function sumByCurrency(
  rows: { estimatedValue: number | null; currency: string }[],
) {
  const totals = new Map<string, number>();
  for (const r of rows) {
    if (r.estimatedValue === null) continue;
    totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.estimatedValue);
  }
  return [...totals.entries()].map(([currency, value]) => ({
    currency,
    value,
  }));
}
