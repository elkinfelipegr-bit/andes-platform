// Unit tests for every indicator definition (sprint-14.md testing
// commitments), including the edges the definitions exist to settle.
import { describe, expect, it } from "vitest";

import {
  commercialIndicators,
  engineeringIndicators,
  inPeriod,
  inspectionIndicators,
  monthsInPeriod,
  periodBounds,
  projectIndicators,
  type InspectionRow,
  type ProjectRow,
  type ProposalRow,
} from "./indicators.js";
import { periodSchema } from "./schemas.js";

const d = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
const period = { from: "2026-09-01", to: "2026-11-30" };

describe("period helpers", () => {
  it("treats `to` as inclusive", () => {
    expect(inPeriod(d("2026-11-30T23:59:59Z"), period)).toBe(true);
    expect(inPeriod(d("2026-12-01"), period)).toBe(false);
    expect(inPeriod(d("2026-08-31T23:59:59Z"), period)).toBe(false);
    expect(inPeriod(null, period)).toBe(false);
    expect(periodBounds(period).lt.toISOString()).toBe(
      "2026-12-01T00:00:00.000Z",
    );
  });

  it("lists every month touched, across a year boundary", () => {
    expect(monthsInPeriod(period)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(monthsInPeriod({ from: "2026-12-15", to: "2027-01-02" })).toEqual([
      "2026-12",
      "2027-01",
    ]);
  });

  it("schema rejects inverted and over-long periods", () => {
    expect(periodSchema.safeParse(period).success).toBe(true);
    expect(
      periodSchema.safeParse({ from: "2026-02-01", to: "2026-01-01" }).success,
    ).toBe(false);
    expect(
      periodSchema.safeParse({ from: "2015-01-01", to: "2026-01-01" }).success,
    ).toBe(false);
    expect(
      periodSchema.safeParse({ from: "01/02/2026", to: "2026-03-01" }).success,
    ).toBe(false);
  });
});

describe("commercialIndicators", () => {
  const item = (unitPrice: number, quantity = 1) => [{ quantity, unitPrice }];
  const row = (over: Partial<ProposalRow>): ProposalRow => ({
    status: "DRAFT",
    currency: "COP",
    createdAt: d("2026-09-10"),
    sentAt: null,
    decidedAt: null,
    items: item(1_000_000),
    ...over,
  });
  const rows: ProposalRow[] = [
    row({ status: "DRAFT", items: item(5_000_000) }),
    row({ status: "SENT", items: item(2_000_000), createdAt: d("2026-10-02") }),
    // Created in September, accepted in November: attributed to September.
    row({
      status: "ACCEPTED",
      items: item(3_000_000, 2),
      sentAt: d("2026-09-12"),
      decidedAt: d("2026-11-11"),
    }),
    row({
      status: "REJECTED",
      items: item(4_000_000),
      createdAt: d("2026-10-20"),
      sentAt: d("2026-10-21"),
      decidedAt: d("2026-10-31"),
    }),
    row({ status: "EXPIRED", items: item(1_500_000) }),
    row({ status: "ACCEPTED", currency: "USD", items: item(900) }),
  ];

  it("counts by status and computes win rate over decided only", () => {
    const r = commercialIndicators(rows, period, { includeMoney: true });
    expect(r.created).toBe(6);
    expect(r.byStatus).toEqual({
      DRAFT: 1,
      SENT: 1,
      ACCEPTED: 2,
      REJECTED: 1,
      EXPIRED: 1,
    });
    expect(r.decided).toBe(4);
    expect(r.winRate).toBe(0.5);
  });

  it("excludes drafts from value quoted and never mixes currencies", () => {
    const r = commercialIndicators(rows, period, { includeMoney: true });
    expect(r.money).toEqual([
      { currency: "COP", quoted: 13_500_000, won: 6_000_000 },
      { currency: "USD", quoted: 900, won: 900 },
    ]);
  });

  it("attributes by createdAt in the monthly series, with explicit zeros", () => {
    const r = commercialIndicators(rows, period, { includeMoney: false });
    expect(r.monthly).toEqual([
      { month: "2026-09", created: 4, accepted: 2 },
      { month: "2026-10", created: 2, accepted: 0 },
      { month: "2026-11", created: 0, accepted: 0 },
    ]);
  });

  it("averages days to decision only where both timestamps exist", () => {
    const r = commercialIndicators(rows, period, { includeMoney: false });
    expect(r.decisionSample).toBe(2);
    expect(r.avgDaysToDecision).toBe(35); // (60 + 10) / 2
  });

  it("withholds money entirely when not allowed", () => {
    const r = commercialIndicators(rows, period, { includeMoney: false });
    expect(r.money).toBeNull();
    expect(JSON.stringify(r)).not.toContain("13500000");
  });

  it("reports no win rate and no cycle time on an empty or undecided set", () => {
    const r = commercialIndicators([row({ status: "SENT" })], period, {
      includeMoney: true,
    });
    expect(r.winRate).toBeNull();
    expect(r.avgDaysToDecision).toBeNull();
    expect(
      commercialIndicators([], period, { includeMoney: true }).money,
    ).toEqual([]);
  });
});

describe("projectIndicators", () => {
  const acme = { id: "c1", name: "Acme" };
  const beta = { id: "c2", name: "Beta" };
  const rows: ProjectRow[] = [
    {
      status: "ACTIVE",
      startDate: d("2026-09-05"),
      endDate: null,
      client: acme,
    },
    {
      status: "ACTIVE",
      startDate: d("2026-01-01"),
      endDate: null,
      client: acme,
    },
    { status: "ACTIVE", startDate: null, endDate: null, client: beta },
    {
      status: "ACTIVE",
      startDate: d("2026-10-01"),
      endDate: null,
      client: null,
    },
    {
      status: "COMPLETED",
      startDate: d("2026-03-01"),
      endDate: d("2026-10-15"),
      client: beta,
    },
    // COMPLETED but no endDate: not counted as completed in any period.
    { status: "COMPLETED", startDate: null, endDate: null, client: beta },
    { status: "DRAFT", startDate: null, endDate: null, client: null },
  ];

  it("snapshots status and attributes started/completed by their dates", () => {
    const r = projectIndicators(rows, period);
    expect(r.total).toBe(7);
    expect(r.byStatus).toMatchObject({ ACTIVE: 4, COMPLETED: 2, DRAFT: 1 });
    expect(r.started).toBe(2);
    expect(r.completed).toBe(1);
    expect(r.monthly).toEqual([
      { month: "2026-09", started: 1, completed: 0 },
      { month: "2026-10", started: 1, completed: 1 },
      { month: "2026-11", started: 0, completed: 0 },
    ]);
  });

  it("ranks active projects per client and counts those without one", () => {
    const r = projectIndicators(rows, period);
    expect(r.activeByClient).toEqual([
      { id: "c1", name: "Acme", active: 2 },
      { id: "c2", name: "Beta", active: 1 },
    ]);
    expect(r.activeWithoutClient).toBe(1);
  });
});

describe("inspectionIndicators", () => {
  const rows: InspectionRow[] = [
    {
      status: "COMPLETED",
      scheduledFor: d("2026-09-10"),
      performedAt: d("2026-09-11"),
      findings: [{ severity: "HIGH" }, { severity: "LOW" }],
    },
    {
      status: "CANCELLED",
      scheduledFor: d("2026-10-01"),
      performedAt: null,
      findings: [],
    },
    // Scheduled before the period, performed inside it: its findings
    // count (attributed by performedAt), the visit itself does not.
    {
      status: "COMPLETED",
      scheduledFor: d("2026-08-28"),
      performedAt: d("2026-09-02"),
      findings: [{ severity: "CRITICAL" }],
    },
    // Overdue: still scheduled, in the past, outside the period.
    {
      status: "SCHEDULED",
      scheduledFor: d("2026-07-01"),
      performedAt: null,
      findings: [],
    },
    {
      status: "SCHEDULED",
      scheduledFor: d("2026-11-20"),
      performedAt: null,
      findings: [],
    },
  ];

  it("attributes visits by scheduledFor and findings by performedAt", () => {
    const r = inspectionIndicators(rows, period, "2026-11-15");
    expect(r.total).toBe(3);
    expect(r.byStatus).toEqual({ SCHEDULED: 1, COMPLETED: 1, CANCELLED: 1 });
    expect(r.findings).toBe(3);
    expect(r.findingsBySeverity).toEqual({
      LOW: 1,
      MEDIUM: 0,
      HIGH: 1,
      CRITICAL: 1,
    });
    expect(r.monthly[0]).toEqual({
      month: "2026-09",
      SCHEDULED: 0,
      COMPLETED: 1,
      CANCELLED: 0,
    });
  });

  it("overdue is a snapshot: past and still scheduled, today excluded", () => {
    expect(inspectionIndicators(rows, period, "2026-11-15").overdue).toBe(1);
    expect(inspectionIndicators(rows, period, "2026-11-20").overdue).toBe(1);
    expect(inspectionIndicators(rows, period, "2026-11-21").overdue).toBe(2);
  });
});

describe("engineeringIndicators", () => {
  it("splits draft vs issued for each record type", () => {
    const r = engineeringIndicators(
      [{ status: "DRAFT" }, { status: "ISSUED" }, { status: "ISSUED" }],
      [],
    );
    expect(r.calc).toEqual({ total: 3, byStatus: { DRAFT: 1, ISSUED: 2 } });
    expect(r.geo).toEqual({ total: 0, byStatus: { DRAFT: 0, ISSUED: 0 } });
  });
});
