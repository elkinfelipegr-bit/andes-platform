import { Badge } from "@andes/ui";

import type { RouterOutputs } from "@/lib/trpc";

type ProjectStatus = RouterOutputs["projects"]["list"][number]["status"];

const variantByStatus = {
  DRAFT: "muted",
  ACTIVE: "success",
  ON_HOLD: "warning",
  COMPLETED: "secondary",
  ARCHIVED: "outline",
} as const;

const labelByStatus: Record<ProjectStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge variant={variantByStatus[status]}>{labelByStatus[status]}</Badge>
  );
}
