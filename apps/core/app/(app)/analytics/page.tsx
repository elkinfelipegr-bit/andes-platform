"use client";

// Andes Analytics — sprint-14.md scope item 4. A reading of what the
// other modules recorded, for one period and an optional client. Every
// figure follows a written definition (sprint-14-domain-model.md); the
// page prints as the period report.
import { Download, Printer } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { BarChart, Button, Input, Label, Select, cn } from "@andes/ui";

import { formatMoney, localDay } from "@/lib/format";
import { trpc } from "@/lib/trpc";

const PRESETS = [
  { key: "month", label: "This month" },
  { key: "3m", label: "Last 3 months" },
  { key: "6m", label: "Last 6 months" },
  { key: "12m", label: "Last 12 months" },
  { key: "custom", label: "Custom" },
] as const;
type PresetKey = (typeof PRESETS)[number]["key"];

function presetRange(key: Exclude<PresetKey, "custom">) {
  const to = localDay();
  const start = new Date(`${to.slice(0, 7)}-01T00:00:00Z`);
  const back = { month: 0, "3m": 2, "6m": 5, "12m": 11 }[key];
  start.setUTCMonth(start.getUTCMonth() - back);
  return { from: start.toISOString().slice(0, 10), to };
}

function monthLabel(month: string) {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

function percent(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function downloadCsv(
  name: string,
  header: string[],
  rows: (string | number)[][],
) {
  const cell = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
  const csv = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  // BOM so spreadsheet apps read accents correctly.
  const url = URL.createObjectURL(
    new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function Area({
  title,
  definition,
  href,
  hrefLabel,
  onExport,
  loading,
  error,
  children,
}: {
  title: string;
  definition: string;
  href: string;
  hrefLabel: string;
  onExport?: () => void;
  loading: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <section className="break-inside-avoid rounded-xl border border-border bg-card p-5 print:border-0 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
            {definition}
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download aria-hidden="true" />
              CSV
            </Button>
          )}
          <Link
            href={href}
            className="text-sm text-primary underline-offset-2 hover:underline"
          >
            {hrefLabel}
          </Link>
        </div>
      </header>
      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function Figure({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "alert";
}) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-2xl font-semibold tabular-nums",
          tone === "alert" && "text-destructive",
        )}
      >
        {value}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// A labelled horizontal breakdown: every part shows its count as text.
function Breakdown({
  parts,
}: {
  parts: { label: string; value: number; tone: string }[];
}) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div className="space-y-2">
      <div
        aria-hidden="true"
        className="flex h-2.5 overflow-hidden rounded-full bg-muted"
      >
        {total > 0 &&
          parts.map((p) => (
            <span
              key={p.label}
              className={p.tone}
              style={{ width: `${(p.value / total) * 100}%` }}
            />
          ))}
      </div>
      <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {parts.map((p) => (
          <div key={p.label} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn("size-2.5 rounded-sm", p.tone)}
            />
            <dt className="text-muted-foreground">{p.label}</dt>
            <dd className="font-medium tabular-nums">{p.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function AnalyticsPage() {
  const [preset, setPreset] = useState<PresetKey>("6m");
  const [custom, setCustom] = useState(() => presetRange("6m"));
  const [clientId, setClientId] = useState("");
  const range = preset === "custom" ? custom : presetRange(preset);
  const valid = !!range.from && !!range.to && range.from <= range.to;
  const input = { ...range, ...(clientId ? { clientId } : {}) };
  const options = { enabled: valid, retry: false };

  const me = trpc.core.me.useQuery();
  const clients = trpc.clients.list.useQuery({ includeArchived: true });
  const commercial = trpc.analytics.commercial.useQuery(input, options);
  const projects = trpc.analytics.projects.useQuery(input, options);
  const inspections = trpc.analytics.inspections.useQuery(input, options);
  const engineering = trpc.analytics.engineering.useQuery(input, options);

  const clientName = clients.data?.find((c) => c.id === clientId)?.name;
  const suffix = `${range.from}_${range.to}`;
  const c = commercial.data;
  const p = projects.data;
  const i = inspections.data;
  const e = engineering.data;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The firm&apos;s indicators for a period, read from what every module
            already records.
          </p>
          <p className="mt-2 hidden text-sm print:block">
            Period {range.from} to {range.to}
            {clientName ? ` · Client: ${clientName}` : ""}
            {me.data?.activeMembership
              ? ` · ${me.data.activeMembership.tenantSlug}`
              : ""}
          </p>
        </div>
        <Button
          variant="outline"
          className="print:hidden"
          onClick={() => window.print()}
        >
          <Printer aria-hidden="true" />
          Print report
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4 print:hidden">
        <div className="space-y-1.5">
          <Label htmlFor="an-period">Period</Label>
          <Select
            id="an-period"
            value={preset}
            onChange={(ev) => {
              const next = ev.target.value as PresetKey;
              if (next === "custom") setCustom(range);
              setPreset(next);
            }}
            className="w-44"
          >
            {PRESETS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="an-from">From</Label>
          <Input
            id="an-from"
            type="date"
            value={range.from}
            disabled={preset !== "custom"}
            onChange={(ev) =>
              setCustom((r) => ({ ...r, from: ev.target.value }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="an-to">To</Label>
          <Input
            id="an-to"
            type="date"
            value={range.to}
            disabled={preset !== "custom"}
            onChange={(ev) => setCustom((r) => ({ ...r, to: ev.target.value }))}
          />
        </div>
        <div className="min-w-48 flex-1 space-y-1.5">
          <Label htmlFor="an-client">Client</Label>
          <Select
            id="an-client"
            value={clientId}
            onChange={(ev) => setClientId(ev.target.value)}
          >
            <option value="">All clients</option>
            {clients.data?.map((cl) => (
              <option key={cl.id} value={cl.id}>
                {cl.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {!valid ? (
        <p role="alert" className="text-sm text-destructive">
          The period must start before it ends.
        </p>
      ) : (
        <>
          <Area
            title="Commercial"
            definition="Proposals created in the period. Win rate = accepted ÷ (accepted + rejected + expired). Value quoted excludes drafts; amounts are never added across currencies."
            href="/crm/proposals"
            hrefLabel="Proposals"
            loading={commercial.isLoading}
            error={commercial.error?.message}
            onExport={
              c &&
              (() =>
                downloadCsv(
                  `commercial_${suffix}.csv`,
                  ["Month", "Proposals created", "Accepted"],
                  c.monthly.map((m) => [m.month, m.created, m.accepted]),
                ))
            }
          >
            {c && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
                  <Figure
                    label="Proposals created"
                    value={String(c.created)}
                    hint={`${c.byStatus.SENT} awaiting answer`}
                  />
                  <Figure
                    label="Win rate"
                    value={percent(c.winRate)}
                    hint={
                      c.decided > 0
                        ? `${c.byStatus.ACCEPTED} of ${c.decided} decided`
                        : "Nothing decided yet"
                    }
                  />
                  <Figure
                    label="Days to decision"
                    value={
                      c.avgDaysToDecision === null
                        ? "—"
                        : String(c.avgDaysToDecision)
                    }
                    hint={
                      c.decisionSample > 0
                        ? `Average over ${c.decisionSample} with dates`
                        : "No sent and decided dates recorded"
                    }
                  />
                  {c.money === null ? (
                    <Figure
                      label="Value quoted / won"
                      value="—"
                      hint="Visible to Owner / Admin"
                    />
                  ) : c.money.length === 0 ? (
                    <Figure
                      label="Value quoted / won"
                      value="—"
                      hint="No proposals sent"
                    />
                  ) : (
                    <div className="space-y-2">
                      {c.money.map((m) => (
                        <Figure
                          key={m.currency}
                          label={`Value won (${m.currency})`}
                          value={formatMoney(m.won, m.currency)}
                          hint={`of ${formatMoney(m.quoted, m.currency)} quoted`}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <Breakdown
                  parts={[
                    {
                      label: "Draft",
                      value: c.byStatus.DRAFT,
                      tone: "bg-muted-foreground/40",
                    },
                    {
                      label: "Sent",
                      value: c.byStatus.SENT,
                      tone: "bg-primary",
                    },
                    {
                      label: "Accepted",
                      value: c.byStatus.ACCEPTED,
                      tone: "bg-success",
                    },
                    {
                      label: "Rejected",
                      value: c.byStatus.REJECTED,
                      tone: "bg-destructive",
                    },
                    {
                      label: "Expired",
                      value: c.byStatus.EXPIRED,
                      tone: "bg-warning",
                    },
                  ]}
                />
                <BarChart
                  className="max-w-3xl"
                  title="Proposals created and accepted per month"
                  categories={c.monthly.map((m) => monthLabel(m.month))}
                  series={[
                    { key: "created", label: "Created", tone: "primary" },
                    { key: "accepted", label: "Accepted", tone: "success" },
                  ]}
                  values={{
                    created: c.monthly.map((m) => m.created),
                    accepted: c.monthly.map((m) => m.accepted),
                  }}
                />
              </div>
            )}
          </Area>

          <Area
            title="Projects"
            definition="Status and active projects per client are today's snapshot. Started and completed are counted by each project's start and end date within the period."
            href="/projects"
            hrefLabel="Projects"
            loading={projects.isLoading}
            error={projects.error?.message}
            onExport={
              p &&
              (() =>
                downloadCsv(
                  `projects_${suffix}.csv`,
                  ["Month", "Started", "Completed"],
                  p.monthly.map((m) => [m.month, m.started, m.completed]),
                ))
            }
          >
            {p && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
                  <Figure
                    label="Projects"
                    value={String(p.total)}
                    hint="All, today"
                  />
                  <Figure
                    label="Active"
                    value={String(p.byStatus.ACTIVE)}
                    hint="Today"
                  />
                  <Figure
                    label="Started"
                    value={String(p.started)}
                    hint="In the period"
                  />
                  <Figure
                    label="Completed"
                    value={String(p.completed)}
                    hint="In the period"
                  />
                </div>
                <Breakdown
                  parts={[
                    {
                      label: "Draft",
                      value: p.byStatus.DRAFT,
                      tone: "bg-muted-foreground/40",
                    },
                    {
                      label: "Active",
                      value: p.byStatus.ACTIVE,
                      tone: "bg-primary",
                    },
                    {
                      label: "On hold",
                      value: p.byStatus.ON_HOLD,
                      tone: "bg-warning",
                    },
                    {
                      label: "Completed",
                      value: p.byStatus.COMPLETED,
                      tone: "bg-success",
                    },
                    {
                      label: "Archived",
                      value: p.byStatus.ARCHIVED,
                      tone: "bg-border",
                    },
                  ]}
                />
                <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <BarChart
                    title="Projects started and completed per month"
                    categories={p.monthly.map((m) => monthLabel(m.month))}
                    series={[
                      { key: "started", label: "Started", tone: "primary" },
                      { key: "completed", label: "Completed", tone: "success" },
                    ]}
                    values={{
                      started: p.monthly.map((m) => m.started),
                      completed: p.monthly.map((m) => m.completed),
                    }}
                  />
                  <div>
                    <h3 className="text-sm font-semibold">
                      Active projects per client
                    </h3>
                    {p.activeByClient.length === 0 &&
                    p.activeWithoutClient === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        No active projects.
                      </p>
                    ) : (
                      <ul className="mt-2 divide-y divide-border text-sm">
                        {p.activeByClient.slice(0, 8).map((cl) => (
                          <li
                            key={cl.id}
                            className="flex justify-between gap-3 py-1.5"
                          >
                            <Link
                              href={`/crm/${cl.id}`}
                              className="truncate text-primary underline-offset-2 hover:underline"
                            >
                              {cl.name}
                            </Link>
                            <span className="font-medium tabular-nums">
                              {cl.active}
                            </span>
                          </li>
                        ))}
                        {p.activeWithoutClient > 0 && (
                          <li className="flex justify-between gap-3 py-1.5 text-muted-foreground">
                            <span>No client (internal)</span>
                            <span className="tabular-nums">
                              {p.activeWithoutClient}
                            </span>
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Area>

          <Area
            title="Inspections"
            definition="Visits are counted by their scheduled date within the period; findings by the date the visit was performed. Overdue is today's snapshot: still scheduled, with a date in the past."
            href="/projects/inspections"
            hrefLabel="Inspections"
            loading={inspections.isLoading}
            error={inspections.error?.message}
            onExport={
              i &&
              (() =>
                downloadCsv(
                  `inspections_${suffix}.csv`,
                  ["Month", "Scheduled", "Completed", "Cancelled"],
                  i.monthly.map((m) => [
                    m.month,
                    m.SCHEDULED,
                    m.COMPLETED,
                    m.CANCELLED,
                  ]),
                ))
            }
          >
            {i && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
                  <Figure
                    label="Visits"
                    value={String(i.total)}
                    hint="Scheduled in the period"
                  />
                  <Figure
                    label="Completed"
                    value={String(i.byStatus.COMPLETED)}
                  />
                  <Figure
                    label="Overdue"
                    value={String(i.overdue)}
                    tone={i.overdue > 0 ? "alert" : undefined}
                    hint="Today, any period"
                  />
                  <Figure
                    label="Findings"
                    value={String(i.findings)}
                    hint="From visits performed"
                  />
                </div>
                <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <BarChart
                    title="Inspections per month by status"
                    stacked
                    categories={i.monthly.map((m) => monthLabel(m.month))}
                    series={[
                      { key: "COMPLETED", label: "Completed", tone: "success" },
                      { key: "SCHEDULED", label: "Scheduled", tone: "primary" },
                      { key: "CANCELLED", label: "Cancelled", tone: "muted" },
                    ]}
                    values={{
                      COMPLETED: i.monthly.map((m) => m.COMPLETED),
                      SCHEDULED: i.monthly.map((m) => m.SCHEDULED),
                      CANCELLED: i.monthly.map((m) => m.CANCELLED),
                    }}
                  />
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">
                      Findings by severity
                    </h3>
                    <Breakdown
                      parts={[
                        {
                          label: "Critical",
                          value: i.findingsBySeverity.CRITICAL,
                          tone: "bg-destructive",
                        },
                        {
                          label: "High",
                          value: i.findingsBySeverity.HIGH,
                          tone: "bg-warning",
                        },
                        {
                          label: "Medium",
                          value: i.findingsBySeverity.MEDIUM,
                          tone: "bg-primary",
                        },
                        {
                          label: "Low",
                          value: i.findingsBySeverity.LOW,
                          tone: "bg-muted-foreground/40",
                        },
                      ]}
                    />
                  </div>
                </div>
              </div>
            )}
          </Area>

          <Area
            title="Engineering records"
            definition="Calculation and geotechnical records created in the period, draft versus issued."
            href="/structures"
            hrefLabel="Structures"
            loading={engineering.isLoading}
            error={engineering.error?.message}
            onExport={
              e &&
              (() =>
                downloadCsv(
                  `engineering_${suffix}.csv`,
                  ["Record type", "Draft", "Issued", "Total"],
                  [
                    [
                      "Calculation",
                      e.calc.byStatus.DRAFT,
                      e.calc.byStatus.ISSUED,
                      e.calc.total,
                    ],
                    [
                      "Geotechnical",
                      e.geo.byStatus.DRAFT,
                      e.geo.byStatus.ISSUED,
                      e.geo.total,
                    ],
                  ],
                ))
            }
          >
            {e && (
              <div className="grid gap-6 md:grid-cols-2">
                {(
                  [
                    ["Calculation records", e.calc],
                    ["Geotechnical records", e.geo],
                  ] as const
                ).map(([label, r]) => (
                  <div key={label} className="space-y-3">
                    <Figure label={label} value={String(r.total)} />
                    <Breakdown
                      parts={[
                        {
                          label: "Draft",
                          value: r.byStatus.DRAFT,
                          tone: "bg-muted-foreground/40",
                        },
                        {
                          label: "Issued",
                          value: r.byStatus.ISSUED,
                          tone: "bg-success",
                        },
                      ]}
                    />
                  </div>
                ))}
              </div>
            )}
          </Area>
        </>
      )}
    </div>
  );
}
