import { Badge } from "@andes/ui";

import type { RouterOutputs } from "@/lib/trpc";

type CalcRecordStatus = RouterOutputs["calcRecords"]["list"][number]["status"];
type CheckVerdict =
  RouterOutputs["calcRecords"]["get"]["checks"][number]["verdict"];

const statusVariant = {
  DRAFT: "muted",
  ISSUED: "success",
} as const;

const statusLabel: Record<CalcRecordStatus, string> = {
  DRAFT: "Borrador",
  ISSUED: "Emitido",
};

export function CalcRecordStatusBadge({
  status,
}: {
  status: CalcRecordStatus;
}) {
  return <Badge variant={statusVariant[status]}>{statusLabel[status]}</Badge>;
}

const verdictVariant = {
  OK: "success",
  USE_MIN: "secondary",
  INCREASE_SECTION: "destructive",
} as const;

const verdictLabel: Record<CheckVerdict, string> = {
  OK: "OK",
  USE_MIN: "Acero mín.",
  INCREASE_SECTION: "Aumentar sección",
};

export function VerdictBadge({ verdict }: { verdict: CheckVerdict }) {
  return (
    <Badge variant={verdictVariant[verdict]}>{verdictLabel[verdict]}</Badge>
  );
}
