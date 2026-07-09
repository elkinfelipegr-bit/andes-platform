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
