import { Badge } from "@andes/ui";

import type { RouterOutputs } from "@/lib/trpc";

type InspectionStatus = RouterOutputs["inspections"]["list"][number]["status"];
type FindingSeverity =
  RouterOutputs["inspections"]["get"]["findings"][number]["severity"];

const statusVariant = {
  SCHEDULED: "default",
  COMPLETED: "success",
  CANCELLED: "outline",
} as const;

const statusLabel: Record<InspectionStatus, string> = {
  SCHEDULED: "Programada",
  COMPLETED: "Completado",
  CANCELLED: "Cancelada",
};

export function InspectionStatusBadge({
  status,
}: {
  status: InspectionStatus;
}) {
  return <Badge variant={statusVariant[status]}>{statusLabel[status]}</Badge>;
}

const severityVariant = {
  LOW: "muted",
  MEDIUM: "secondary",
  HIGH: "warning",
  CRITICAL: "destructive",
} as const;

const severityLabel: Record<FindingSeverity, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

export function SeverityBadge({ severity }: { severity: FindingSeverity }) {
  return (
    <Badge variant={severityVariant[severity]}>{severityLabel[severity]}</Badge>
  );
}
