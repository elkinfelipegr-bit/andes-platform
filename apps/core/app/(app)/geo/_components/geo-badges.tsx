import { Badge } from "@andes/ui";

import type { RouterOutputs } from "@/lib/trpc";

type GeoRecordStatus = RouterOutputs["geoRecords"]["list"][number]["status"];

const statusVariant = {
  DRAFT: "muted",
  ISSUED: "success",
} as const;

const statusLabel: Record<GeoRecordStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
};

export function GeoRecordStatusBadge({ status }: { status: GeoRecordStatus }) {
  return <Badge variant={statusVariant[status]}>{statusLabel[status]}</Badge>;
}

export function ShapeBadge({ shape }: { shape: "STRIP" | "SQUARE" }) {
  return (
    <Badge variant="outline">{shape === "STRIP" ? "Strip" : "Square"}</Badge>
  );
}
