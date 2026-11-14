// Shared display formatting. Money uses the proposal's own currency code;
// es-CO locale matches the firm's context (Tenant #1).
export function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: Date | string | null) {
  if (!value) return "—";
  // Date-only values live at UTC midnight; format in UTC so the day
  // doesn't shift in western timezones.
  return new Date(value).toLocaleDateString(undefined, { timeZone: "UTC" });
}

// The user's own calendar day as YYYY-MM-DD — what "today" means on the
// follow-up agenda (sprint-15-domain-model.md, process 3).
export function localDay(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Date-only values are stored at UTC midnight: read the day back in UTC.
export function toDay(value: Date | string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

export function daysBetween(fromDay: string, toDayValue: string) {
  return Math.round(
    (Date.parse(`${toDayValue}T00:00:00Z`) -
      Date.parse(`${fromDay}T00:00:00Z`)) /
      86_400_000,
  );
}

// "Today", "Tomorrow", "3 days ago", "in 5 days" — for due dates.
export function relativeDay(day: string, today: string) {
  const delta = daysBetween(today, day);
  if (delta === 0) return "Today";
  if (delta === 1) return "Tomorrow";
  if (delta === -1) return "Yesterday";
  return delta < 0 ? `${-delta} days ago` : `In ${delta} days`;
}

export function formatDateTime(value: Date | string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// Compact money for board columns and tiles: $ 18,5 M.
export function formatMoneyCompact(value: number, currency: string) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
