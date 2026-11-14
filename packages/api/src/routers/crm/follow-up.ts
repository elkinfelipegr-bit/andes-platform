// Follow-up classification (sprint-15-domain-model.md, process 3): where
// an open opportunity's next step stands relative to "today". Pure and
// timezone-free — both sides are calendar days (YYYY-MM-DD).
export const FOLLOW_UP_STATES = [
  "OVERDUE",
  "TODAY",
  "UPCOMING",
  "LATER",
  "NONE",
] as const;

export type FollowUpState = (typeof FOLLOW_UP_STATES)[number];

// "Upcoming" is the next seven days; anything beyond is "later".
export const UPCOMING_DAYS = 7;

export function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function dayToDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

export function daysBetween(fromDay: string, toDayValue: string): number {
  return Math.round(
    (dayToDate(toDayValue).getTime() - dayToDate(fromDay).getTime()) /
      86_400_000,
  );
}

// Closed opportunities have nothing pending → null. An open one with no
// dated next step is "NONE": itself a warning on the agenda.
export function followUpState(
  opportunity: { isOpen: boolean; nextActionAt: Date | null },
  today: string,
): FollowUpState | null {
  if (!opportunity.isOpen) return null;
  if (!opportunity.nextActionAt) return "NONE";
  const delta = daysBetween(today, toDay(opportunity.nextActionAt));
  if (delta < 0) return "OVERDUE";
  if (delta === 0) return "TODAY";
  return delta <= UPCOMING_DAYS ? "UPCOMING" : "LATER";
}
