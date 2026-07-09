"use client";

// In-module Projects navigation — second case of the pattern ratified
// with Sprint 4 (navigation.md): functional modules live under their
// product's segment with tabs; the sidebar stays one-entry-per-product.
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@andes/ui";

const tabs = [
  { label: "Projects", href: "/projects" },
  { label: "Inspections", href: "/projects/inspections" },
];

export function ProjectsNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Projects sections"
      className="flex gap-1 border-b border-border print:hidden"
    >
      {tabs.map((tab) => {
        const active =
          tab.href === "/projects"
            ? pathname === "/projects" ||
              /^\/projects\/(?!inspections)/.test(pathname)
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
