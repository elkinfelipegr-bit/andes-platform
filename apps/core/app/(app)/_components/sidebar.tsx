"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge, Separator, cn } from "@andes/ui";

import { adminNav, moduleNav, type NavItem } from "./nav-items";

function NavEntry({
  item,
  active,
  disabled,
}: {
  item: NavItem;
  active: boolean;
  disabled: boolean;
}) {
  // Not-yet-built modules and no-membership sessions render inert entries
  // (docs/design/navigation.md: stubs visible, no dead links).
  if (disabled || !item.enabled) {
    return (
      <div
        aria-disabled="true"
        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/60"
      >
        <item.icon className="size-5" aria-hidden="true" />
        <span className="flex-1">{item.label}</span>
        {!item.enabled && <Badge variant="muted">Soon</Badge>}
      </div>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      <item.icon className="size-5" aria-hidden="true" />
      {item.label}
    </Link>
  );
}

export function Sidebar({ navDisabled = false }: { navDisabled?: boolean }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card print:hidden">
      <div className="flex h-14 items-center gap-2 px-5">
        <span className="text-lg font-semibold tracking-tight">Andes</span>
        <span className="text-lg font-light text-muted-foreground">
          Platform
        </span>
      </div>
      <Separator />
      <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Modules">
        {moduleNav.map((item) => (
          <NavEntry
            key={item.href}
            item={item}
            active={pathname.startsWith(item.href)}
            disabled={navDisabled}
          />
        ))}
        <div className="mt-auto">
          <Separator className="my-2" />
          <NavEntry
            item={adminNav}
            active={pathname.startsWith(adminNav.href)}
            disabled={navDisabled}
          />
        </div>
      </nav>
    </aside>
  );
}
