import type { ComponentProps } from "react";

import { cn } from "../lib/cn.js";

// Styled native select — deliberate for Sprint 2 (design-system.md: reuse
// before creation): full keyboard/mobile behavior for free. Swap for a
// Radix-based Select only when a design need demands it.
export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
