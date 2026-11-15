// Module → route map from docs/design/navigation.md. The eight products
// stay visible as disabled stubs until their sprint ships them.
// Administration is live since Sprint 12 and shown to OWNER_ADMIN only
// (the sidebar decides visibility; the API enforces the role).
import {
  BookOpen,
  Boxes,
  Building2,
  ChartColumn,
  FolderKanban,
  Handshake,
  LayoutDashboard,
  Mountain,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  enabled: boolean;
}

export const moduleNav: NavItem[] = [
  {
    label: "Inicio",
    href: "/dashboard",
    icon: LayoutDashboard,
    enabled: true,
  },
  { label: "Proyectos", href: "/projects", icon: FolderKanban, enabled: true },
  { label: "CRM", href: "/crm", icon: Handshake, enabled: true },
  { label: "Estructuras", href: "/structures", icon: Building2, enabled: true },
  { label: "Geo", href: "/geo", icon: Mountain, enabled: true },
  { label: "BIM", href: "/bim", icon: Boxes, enabled: true },
  { label: "IA", href: "/ai", icon: Sparkles, enabled: true },
  { label: "Normas", href: "/normas", icon: BookOpen, enabled: true },
  { label: "Analítica", href: "/analytics", icon: ChartColumn, enabled: true },
];

export const adminNav: NavItem = {
  label: "Administración",
  href: "/admin",
  icon: Settings,
  enabled: true,
};
