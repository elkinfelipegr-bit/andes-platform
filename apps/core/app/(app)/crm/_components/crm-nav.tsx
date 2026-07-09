"use client";

// In-module CRM navigation (sprint-4.md scope item 3): proposals are a
// functional module of Andes CRM, so they live under /crm alongside
// clients — navigation.md amendment ships with this sprint.
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@andes/ui";

const tabs = [
  { label: "Clients", href: "/crm" },
  { label: "Proposals", href: "/crm/proposals" },
];

export function CrmNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="CRM sections"
      className="flex gap-1 border-b border-border print:hidden"
    >
      {tabs.map((tab) => {
        const active =
          tab.href === "/crm"
            ? pathname === "/crm" || /^\/crm\/(?!proposals)/.test(pathname)
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
