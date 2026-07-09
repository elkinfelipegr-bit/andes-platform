"use client";

import { ChevronDown, LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@andes/ui";

import { authClient } from "@/lib/auth-client";

import { adminNav, moduleNav } from "./nav-items";

export interface TopbarProps {
  user: { name: string; email: string };
  // Tenant context stays on screen at all times (RFC-001 via
  // docs/design/navigation.md).
  membership: { tenantSlug: string; roleLabel: string } | null;
}

export function Topbar({ user, membership }: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const current = [...moduleNav, adminNav].find((item) =>
    pathname.startsWith(item.href),
  );

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6 print:hidden">
      <h1 className="text-sm font-medium">{current?.label ?? "Andes Core"}</h1>
      <div className="flex items-center gap-3">
        {membership ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {membership.tenantSlug}
            </span>
            <Badge variant="secondary">{membership.roleLabel}</Badge>
          </div>
        ) : (
          <Badge variant="warning">No tenant</Badge>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              {user.name}
              <ChevronDown aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="font-mono">
              {user.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={async () => {
                await authClient.signOut();
                router.push("/login");
                router.refresh();
              }}
            >
              <LogOut aria-hidden="true" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
