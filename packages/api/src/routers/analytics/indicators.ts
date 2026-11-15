// Indicator definitions (sprint-14-domain-model.md, "Indicator
// Definitions"). One pure function per area over rows the router has
// already read through the tenant-scoped client — so every definition is
// unit-testable against fixtures, and no aggregate ever runs outside RLS.
// Nothing here is stored: an indicator is a reading.
import { proposalTotal, type PricedItem } from "../crm/proposal-total.js";

// ── Period helpers ──────────────────────────────────────────────────────
export function periodBounds(period: { from: string; to: string }) {
  const gte = new Date(`${period.from}T00:00:00.000Z`);
  const lt = new Date(`${period.to}T00:00:00.000Z`);
  lt.setUTCDate(lt.getUTCDate() + 1); // `to` is inclusive
  return { gte, lt };
}

export function inPeriod(
  date: Date | null,
  period: { from: string; to: string },
): boolean {
  if (!date) return false;
  const { gte, lt } = periodBounds(period);
  return date >= gte && date < lt;
}

export function monthOf(date: Date): string {
  return date.toISOString().slice(0, 7);
}

// Every calendar month the period touches, in order — so a month with no
// records still shows as an explicit zero.
export function monthsInPeriod(period: { from: string; to: string }): string[] {
  const months: string[] = [];
  const cursor = new Date(`${period.from.slice(0, 7)}-01T00:00:00.000Z`);
  const last = period.to.slice(0, 7);
  while (monthOf(cursor) <= last) {
    months.push(monthOf(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function countBy<T, K extends string>(
  rows: T[],
  keys: readonly K[],
  keyOf: (row: T) => K,
): Record<K, number> {
  const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  for (const row of rows) out[keyOf(row)] += 1;
  return out;
}

// ── Commercial ──────────────────────────────────────────────────────────
export const PROPOSAL_STATUS_KEYS = [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
] as const;
type ProposalStatusKey = (typeof PROPOSAL_STATUS_KEYS)[number];

export interface ProposalRow {
  status: ProposalStatusKey;
  currency: string;
  createdAt: Date;
  sentAt: Date | null;
  decidedAt: Date | null;
  items: PricedItem[];
}

export interface MoneyByCurrency {
  currency: string;
  quoted: number;
  won: number;
}

// Rows are the proposals CREATED in the period (the attribution date for
// every commercial indicator). Money is never summed across currencies.
export function commercialIndicators(
  rows: ProposalRow[],
  period: { from: string; to: string },
  options: { includeMoney: boolean },
) {
  const byStatus = countBy(rows, PROPOSAL_STATUS_KEYS, (r) => r.status);
  const decided = byStatus.ACCEPTED + byStatus.REJECTED + byStatus.EXPIRED;

  const monthly = monthsInPeriod(period).map((month) => {
    const ofMonth = rows.filter((r) => monthOf(r.createdAt) === month);
    return {
      month,
      created: ofMonth.length,
      accepted: ofMonth.filter((r) => r.status === "ACCEPTED").length,
    };
  });

  // Days from sent to decided — only where both were recorded (Sprint 15
  // timestamps; earlier proposals have neither and are left out rather
  // than approximated).
  const cycles = rows
    .filter((r) => r.sentAt && r.decidedAt)
    .map((r) => (r.decidedAt!.getTime() - r.sentAt!.getTime()) / 86_400_000);
  const avgDaysToDecision =
    cycles.length > 0
      ? Math.round((cycles.reduce((a, b) => a + b, 0) / cycles.length) * 10) /
        10
      : null;

  let money: MoneyByCurrency[] | null = null;
  if (options.includeMoney) {
    const totals = new Map<string, MoneyByCurrency>();
    for (const r of rows) {
      if (r.status === "DRAFT") continue; // a draft was never quoted
      const entry = totals.get(r.currency) ?? {
        currency: r.currency,
        quoted: 0,
        won: 0,
      };
      const total = proposalTotal(r.items);
      entry.quoted += total;
      if (r.status === "ACCEPTED") entry.won += total;
      totals.set(r.currency, entry);
    }
    money = [...totals.values()].sort((a, b) =>
      a.currency.localeCompare(b.currency),
    );
  }

  return {
    created: rows.length,
    byStatus,
    decided,
    // Undefined (null) until something has been decided — never 0%.
    winRate: decided > 0 ? byStatus.ACCEPTED / decided : null,
    avgDaysToDecision,
    decisionSample: cycles.length,
    monthly,
    money,
  };
}

// ── Projects ────────────────────────────────────────────────────────────
export const PROJECT_STATUS_KEYS = [
  "DRAFT",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "ARCHIVED",
] as const;
type ProjectStatusKey = (typeof PROJECT_STATUS_KEYS)[number];

export interface ProjectRow {
  status: ProjectStatusKey;
  startDate: Date | null;
  endDate: Date | null;
  client: { id: string; name: string } | null;
}

// Rows are ALL the tenant's projects: status and active-per-client are
// snapshots (now); started/completed are attributed by their own dates.
export function projectIndicators(
  rows: ProjectRow[],
  period: { from: string; to: string },
) {
  const started = rows.filter((r) => inPeriod(r.startDate, period));
  // A project with no endDate has not completed, whatever its status.
  const completed = rows.filter((r) => inPeriod(r.endDate, period));

  const perClient = new Map<
    string,
    { id: string; name: string; active: number }
  >();
  for (const r of rows) {
    if (r.status !== "ACTIVE" || !r.client) continue;
    const entry = perClient.get(r.client.id) ?? { ...r.client, active: 0 };
    entry.active += 1;
    perClient.set(r.client.id, entry);
  }

  return {
    total: rows.length,
    byStatus: countBy(rows, PROJECT_STATUS_KEYS, (r) => r.status),
    started: started.length,
    completed: completed.length,
    monthly: monthsInPeriod(period).map((month) => ({
      month,
      started: started.filter((r) => monthOf(r.startDate!) === month).length,
      completed: completed.filter((r) => monthOf(r.endDate!) === month).length,
    })),
    activeByClient: [...perClient.values()].sort(
      (a, b) => b.active - a.active || a.name.localeCompare(b.name),
    ),
    activeWithoutClient: rows.filter((r) => r.status === "ACTIVE" && !r.client)
      .length,
  };
}

// ── Inspections ─────────────────────────────────────────────────────────
export const INSPECTION_STATUS_KEYS = [
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
] as const;
type InspectionStatusKey = (typeof INSPECTION_STATUS_KEYS)[number];
export const SEVERITY_KEYS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
type SeverityKey = (typeof SEVERITY_KEYS)[number];

export interface InspectionRow {
  status: InspectionStatusKey;
  scheduledFor: Date;
  performedAt: Date | null;
  findings: { severity: SeverityKey }[];
}

// Rows are all inspections that could matter: scheduled in the period,
// performed in the period, or still SCHEDULED in the past (overdue).
export function inspectionIndicators(
  rows: InspectionRow[],
  period: { from: string; to: string },
  today: string,
) {
  const scheduled = rows.filter((r) => inPeriod(r.scheduledFor, period));
  const startOfToday = new Date(`${today}T00:00:00.000Z`);
  const findings = rows
    .filter((r) => inPeriod(r.performedAt, period))
    .flatMap((r) => r.findings);

  return {
    total: scheduled.length,
    byStatus: countBy(scheduled, INSPECTION_STATUS_KEYS, (r) => r.status),
    monthly: monthsInPeriod(period).map((month) => {
      const ofMonth = scheduled.filter(
        (r) => monthOf(r.scheduledFor) === month,
      );
      return {
        month,
        ...countBy(ofMonth, INSPECTION_STATUS_KEYS, (r) => r.status),
      };
    }),
    // Snapshot: still SCHEDULED with a date before today, in any period.
    overdue: rows.filter(
      (r) => r.status === "SCHEDULED" && r.scheduledFor < startOfToday,
    ).length,
    findings: findings.length,
    findingsBySeverity: countBy(findings, SEVERITY_KEYS, (f) => f.severity),
  };
}

// ── Engineering records ─────────────────────────────────────────────────
export const RECORD_STATUS_KEYS = ["DRAFT", "ISSUED"] as const;
type RecordStatusKey = (typeof RECORD_STATUS_KEYS)[number];

// Rows are the records CREATED in the period.
export function engineeringIndicators(
  calc: { status: RecordStatusKey }[],
  geo: { status: RecordStatusKey }[],
) {
  return {
    calc: {
      total: calc.length,
      byStatus: countBy(calc, RECORD_STATUS_KEYS, (r) => r.status),
    },
    geo: {
      total: geo.length,
      byStatus: countBy(geo, RECORD_STATUS_KEYS, (r) => r.status),
    },
  };
}
