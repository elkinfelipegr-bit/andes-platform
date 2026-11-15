import { Badge } from "@andes/ui";

export type BimDiscipline =
  "ARCHITECTURE" | "STRUCTURAL" | "MEP" | "SITE" | "OTHER";

const disciplineLabel: Record<BimDiscipline, string> = {
  ARCHITECTURE: "Arquitectura",
  STRUCTURAL: "Estructural",
  MEP: "MEP",
  SITE: "Urbanismo",
  OTHER: "Otra",
};

export function DisciplineBadge({ discipline }: { discipline: BimDiscipline }) {
  return <Badge variant="outline">{disciplineLabel[discipline]}</Badge>;
}

export const DISCIPLINE_OPTIONS: Array<[BimDiscipline, string]> = [
  ["ARCHITECTURE", "Arquitectura"],
  ["STRUCTURAL", "Estructural"],
  ["MEP", "MEP"],
  ["SITE", "Urbanismo"],
  ["OTHER", "Otra"],
];
