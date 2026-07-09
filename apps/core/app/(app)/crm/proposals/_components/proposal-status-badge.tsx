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
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
};

export function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  return (
    <Badge variant={variantByStatus[status]}>{labelByStatus[status]}</Badge>
  );
}
