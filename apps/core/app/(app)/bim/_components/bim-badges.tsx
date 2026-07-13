import { Badge } from "@andes/ui";

export type BimDiscipline =
  "ARCHITECTURE" | "STRUCTURAL" | "MEP" | "SITE" | "OTHER";

const disciplineLabel: Record<BimDiscipline, string> = {
  ARCHITECTURE: "Architecture",
  STRUCTURAL: "Structural",
  MEP: "MEP",
  SITE: "Site",
  OTHER: "Other",
};

export function DisciplineBadge({ discipline }: { discipline: BimDiscipline }) {
  return <Badge variant="outline">{disciplineLabel[discipline]}</Badge>;
}

export const DISCIPLINE_OPTIONS: Array<[BimDiscipline, string]> = [
  ["ARCHITECTURE", "Architecture"],
  ["STRUCTURAL", "Structural"],
  ["MEP", "MEP"],
  ["SITE", "Site"],
  ["OTHER", "Other"],
];
