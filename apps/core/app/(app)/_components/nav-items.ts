// Module → route map from docs/design/navigation.md. The eight products
// stay visible as disabled stubs until their sprint ships them.
import {
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
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    enabled: true,
  },
  { label: "Projects", href: "/projects", icon: FolderKanban, enabled: true },
  { label: "CRM", href: "/crm", icon: Handshake, enabled: true },
  { label: "Structures", href: "/structures", icon: Building2, enabled: true },
  { label: "Geo", href: "/geo", icon: Mountain, enabled: true },
  { label: "BIM", href: "/bim", icon: Boxes, enabled: false },
  { label: "AI", href: "/ai", icon: Sparkles, enabled: false },
  { label: "Analytics", href: "/analytics", icon: ChartColumn, enabled: false },
];

export const adminNav: NavItem = {
  label: "Administration",
  href: "/admin",
  icon: Settings,
  enabled: false,
};
