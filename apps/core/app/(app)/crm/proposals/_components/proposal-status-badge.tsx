import { Badge } from "@andes/ui";

import type { RouterOutputs } from "@/lib/trpc";

type ProposalStatus = RouterOutputs["proposals"]["list"][number]["status"];

const variantByStatus = {
  DRAFT: "muted",
  SENT: "default",
  ACCEPTED: "success",
  REJECTED: "destructive",
  EXPIRED: "outline",
} as const;

const labelByStatus: Record<ProposalStatus, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
  EXPIRED: "Vencida",
};

export function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  return (
    <Badge variant={variantByStatus[status]}>{labelByStatus[status]}</Badge>
  );
}
