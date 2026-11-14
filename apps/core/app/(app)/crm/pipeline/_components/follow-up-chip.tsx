import { CalendarClock, CalendarX2 } from "lucide-react";

import { cn } from "@andes/ui";

import { relativeDay, toDay } from "@/lib/format";

import type { FollowUp } from "./pipeline-meta";

const tone: Record<FollowUp, string> = {
  OVERDUE: "bg-destructive/10 text-destructive",
  TODAY: "bg-primary/10 text-primary",
  UPCOMING: "bg-muted text-muted-foreground",
  LATER: "bg-muted text-muted-foreground",
  NONE: "bg-warning/20 text-warning-foreground",
};

// The dated next step, coloured by urgency. Text always carries the
// meaning — colour is reinforcement only.
export function FollowUpChip({
  state,
  nextActionAt,
  today,
  className,
}: {
  state: FollowUp;
  nextActionAt: Date | string | null;
  today: string;
  className?: string;
}) {
  const Icon = state === "NONE" ? CalendarX2 : CalendarClock;
  const label =
    state === "NONE" || !nextActionAt
      ? "No next step"
      : state === "OVERDUE"
        ? `Overdue · ${relativeDay(toDay(nextActionAt), today).toLowerCase()}`
        : relativeDay(toDay(nextActionAt), today);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        tone[state],
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3" />
      {label}
    </span>
  );
}
