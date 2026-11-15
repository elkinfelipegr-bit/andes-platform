// Display metadata for the pipeline (sprint-15-domain-model.md). Order
// and keys mirror the OpportunityStage / ActivityType enums.
import {
  Building2,
  Inbox,
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
  LEAD: "Nuevo prospecto",
  CONTACTED: "Contactado",
  QUOTED: "Cotizado",
  NEGOTIATION: "Negociación",
  WON: "Ganada",
  LOST: "Perdida",
};

export const STAGE_HINT: Record<Stage, string> = {
  LEAD: "Acaba de llegar; nadie ha respondido",
  CONTACTED: "En conversación, sin cotización enviada",
  QUOTED: "Cotización enviada, esperando respuesta",
  NEGOTIATION: "Ajustando alcance o precio",
  WON: "El cliente dijo que sí",
  LOST: "No siguió adelante",
};

export function isOpen(stage: Stage) {
  return stage !== "WON" && stage !== "LOST";
}

export const ACTIVITY_TYPES: {
  key: Exclude<ActivityType, "REQUEST">;
  label: string;
  icon: LucideIcon;
}[] = [
  { key: "CALL", label: "Llamada", icon: Phone },
  { key: "WHATSAPP", label: "WhatsApp", icon: MessageCircle },
  { key: "EMAIL", label: "Correo", icon: Mail },
  { key: "MEETING", label: "Reunión", icon: Users },
  { key: "VISIT", label: "Visita a obra", icon: Building2 },
  { key: "NOTE", label: "Nota", icon: StickyNote },
];

// Activity types a member can log. REQUEST is written by the website
// intake only (sprint-16-domain-model.md) and is shown, never chosen.
export type LoggableActivityType = Exclude<ActivityType, "REQUEST">;
const REQUEST_META = {
  key: "REQUEST",
  label: "Solicitud",
  icon: Inbox,
} as const;

export function activityMeta(type: ActivityType) {
  if (type === "REQUEST") return REQUEST_META;
  return ACTIVITY_TYPES.find((t) => t.key === type) ?? ACTIVITY_TYPES[5]!;
}

export const SOURCE_SUGGESTIONS = [
  "Sitio web",
  "Referido",
  "WhatsApp",
  "Llamada telefónica",
  "Cliente recurrente",
  "Licitación",
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
