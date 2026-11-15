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
  { key: "month", label: "Este mes" },
  { key: "3m", label: "Últimos 3 meses" },
  { key: "6m", label: "Últimos 6 meses" },
  { key: "12m", label: "Últimos 12 meses" },
  { key: "custom", label: "Personalizado" },
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
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("es-CO", {
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
          <p className="text-sm text-muted-foreground">Cargando…</p>
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
          <h1 className="text-2xl font-semibold">Analítica</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Los indicadores de la firma en un periodo, leídos de lo que cada
            módulo ya registra.
          </p>
          <p className="mt-2 hidden text-sm print:block">
            Periodo {range.from} a {range.to}
            {clientName ? ` · Cliente: ${clientName}` : ""}
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
          Imprimir informe
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4 print:hidden">
        <div className="space-y-1.5">
          <Label htmlFor="an-period">Periodo</Label>
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
          <Label htmlFor="an-from">Desde</Label>
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
          <Label htmlFor="an-to">Hasta</Label>
          <Input
            id="an-to"
            type="date"
            value={range.to}
            disabled={preset !== "custom"}
            onChange={(ev) => setCustom((r) => ({ ...r, to: ev.target.value }))}
          />
        </div>
        <div className="min-w-48 flex-1 space-y-1.5">
          <Label htmlFor="an-client">Cliente</Label>
          <Select
            id="an-client"
            value={clientId}
            onChange={(ev) => setClientId(ev.target.value)}
          >
            <option value="">Todos los clientes</option>
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
          El periodo debe empezar antes de terminar.
        </p>
      ) : (
        <>
          <Area
            title="Comercial"
            definition="Propuestas creadas en el periodo. Tasa de éxito = aceptadas ÷ (aceptadas + rechazadas + vencidas). El valor cotizado excluye borradores; nunca se suman montos de monedas distintas."
            href="/crm/proposals"
            hrefLabel="Propuestas"
            loading={commercial.isLoading}
            error={commercial.error?.message}
            onExport={
              c &&
              (() =>
                downloadCsv(
                  `commercial_${suffix}.csv`,
                  ["Mes", "Propuestas creadas", "Aceptada"],
                  c.monthly.map((m) => [m.month, m.created, m.accepted]),
                ))
            }
          >
            {c && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
                  <Figure
                    label="Propuestas creadas"
                    value={String(c.created)}
                    hint={`${c.byStatus.SENT} esperando respuesta`}
                  />
                  <Figure
                    label="Tasa de éxito"
                    value={percent(c.winRate)}
                    hint={
                      c.decided > 0
                        ? `${c.byStatus.ACCEPTED} de ${c.decided} decididas`
                        : "Aún no hay decisiones"
                    }
                  />
                  <Figure
                    label="Días hasta la decisión"
                    value={
                      c.avgDaysToDecision === null
                        ? "—"
                        : String(c.avgDaysToDecision)
                    }
                    hint={
                      c.decisionSample > 0
                        ? `Promedio de ${c.decisionSample} con fechas`
                        : "No hay fechas de envío y decisión registradas"
                    }
                  />
                  {c.money === null ? (
                    <Figure
                      label="Valor cotizado / ganado"
                      value="—"
                      hint="Visible para Propietario / Admin"
                    />
                  ) : c.money.length === 0 ? (
                    <Figure
                      label="Valor cotizado / ganado"
                      value="—"
                      hint="No hay propuestas enviadas"
                    />
                  ) : (
                    <div className="space-y-2">
                      {c.money.map((m) => (
                        <Figure
                          key={m.currency}
                          label={`Valor ganado (${m.currency})`}
                          value={formatMoney(m.won, m.currency)}
                          hint={`de ${formatMoney(m.quoted, m.currency)} cotizado`}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <Breakdown
                  parts={[
                    {
                      label: "Borrador",
                      value: c.byStatus.DRAFT,
                      tone: "bg-muted-foreground/40",
                    },
                    {
                      label: "Enviada",
                      value: c.byStatus.SENT,
                      tone: "bg-primary",
                    },
                    {
                      label: "Aceptada",
                      value: c.byStatus.ACCEPTED,
                      tone: "bg-success",
                    },
                    {
                      label: "Rechazada",
                      value: c.byStatus.REJECTED,
                      tone: "bg-destructive",
                    },
                    {
                      label: "Vencida",
                      value: c.byStatus.EXPIRED,
                      tone: "bg-warning",
                    },
                  ]}
                />
                <BarChart
                  className="max-w-3xl"
                  title="Propuestas creadas y aceptadas por mes"
                  categories={c.monthly.map((m) => monthLabel(m.month))}
                  series={[
                    { key: "created", label: "Creadas", tone: "primary" },
                    { key: "accepted", label: "Aceptada", tone: "success" },
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
            title="Proyectos"
            definition="El estado y los proyectos activos por cliente son la foto de hoy. Iniciados y terminados se cuentan por la fecha de inicio y de fin de cada proyecto dentro del periodo."
            href="/projects"
            hrefLabel="Proyectos"
            loading={projects.isLoading}
            error={projects.error?.message}
            onExport={
              p &&
              (() =>
                downloadCsv(
                  `projects_${suffix}.csv`,
                  ["Mes", "Iniciados", "Completado"],
                  p.monthly.map((m) => [m.month, m.started, m.completed]),
                ))
            }
          >
            {p && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
                  <Figure
                    label="Proyectos"
                    value={String(p.total)}
                    hint="Todos, hoy"
                  />
                  <Figure
                    label="Activo"
                    value={String(p.byStatus.ACTIVE)}
                    hint="Hoy"
                  />
                  <Figure
                    label="Iniciados"
                    value={String(p.started)}
                    hint="En el periodo"
                  />
                  <Figure
                    label="Completado"
                    value={String(p.completed)}
                    hint="En el periodo"
                  />
                </div>
                <Breakdown
                  parts={[
                    {
                      label: "Borrador",
                      value: p.byStatus.DRAFT,
                      tone: "bg-muted-foreground/40",
                    },
                    {
                      label: "Activo",
                      value: p.byStatus.ACTIVE,
                      tone: "bg-primary",
                    },
                    {
                      label: "En pausa",
                      value: p.byStatus.ON_HOLD,
                      tone: "bg-warning",
                    },
                    {
                      label: "Completado",
                      value: p.byStatus.COMPLETED,
                      tone: "bg-success",
                    },
                    {
                      label: "Archivado",
                      value: p.byStatus.ARCHIVED,
                      tone: "bg-border",
                    },
                  ]}
                />
                <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <BarChart
                    title="Proyectos iniciados y terminados por mes"
                    categories={p.monthly.map((m) => monthLabel(m.month))}
                    series={[
                      { key: "started", label: "Iniciados", tone: "primary" },
                      {
                        key: "completed",
                        label: "Completado",
                        tone: "success",
                      },
                    ]}
                    values={{
                      started: p.monthly.map((m) => m.started),
                      completed: p.monthly.map((m) => m.completed),
                    }}
                  />
                  <div>
                    <h3 className="text-sm font-semibold">
                      Proyectos activos por cliente
                    </h3>
                    {p.activeByClient.length === 0 &&
                    p.activeWithoutClient === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        No hay proyectos activos.
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
                            <span>Sin cliente (interno)</span>
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
            title="Inspecciones"
            definition="Las visitas se cuentan por su fecha programada dentro del periodo; los hallazgos, por la fecha en que se realizó la visita. Vencidas es la foto de hoy: siguen programadas con fecha pasada."
            href="/projects/inspections"
            hrefLabel="Inspecciones"
            loading={inspections.isLoading}
            error={inspections.error?.message}
            onExport={
              i &&
              (() =>
                downloadCsv(
                  `inspections_${suffix}.csv`,
                  ["Mes", "Programada", "Completado", "Cancelada"],
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
                    label="Visitas"
                    value={String(i.total)}
                    hint="Programadas en el periodo"
                  />
                  <Figure
                    label="Completado"
                    value={String(i.byStatus.COMPLETED)}
                  />
                  <Figure
                    label="Vencidas"
                    value={String(i.overdue)}
                    tone={i.overdue > 0 ? "alert" : undefined}
                    hint="Hoy, cualquier periodo"
                  />
                  <Figure
                    label="Hallazgos"
                    value={String(i.findings)}
                    hint="De visitas realizadas"
                  />
                </div>
                <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <BarChart
                    title="Inspecciones por mes y estado"
                    stacked
                    categories={i.monthly.map((m) => monthLabel(m.month))}
                    series={[
                      {
                        key: "COMPLETED",
                        label: "Completado",
                        tone: "success",
                      },
                      {
                        key: "SCHEDULED",
                        label: "Programada",
                        tone: "primary",
                      },
                      { key: "CANCELLED", label: "Cancelada", tone: "muted" },
                    ]}
                    values={{
                      COMPLETED: i.monthly.map((m) => m.COMPLETED),
                      SCHEDULED: i.monthly.map((m) => m.SCHEDULED),
                      CANCELLED: i.monthly.map((m) => m.CANCELLED),
                    }}
                  />
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">
                      Hallazgos por severidad
                    </h3>
                    <Breakdown
                      parts={[
                        {
                          label: "Crítica",
                          value: i.findingsBySeverity.CRITICAL,
                          tone: "bg-destructive",
                        },
                        {
                          label: "Alta",
                          value: i.findingsBySeverity.HIGH,
                          tone: "bg-warning",
                        },
                        {
                          label: "Media",
                          value: i.findingsBySeverity.MEDIUM,
                          tone: "bg-primary",
                        },
                        {
                          label: "Baja",
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
            title="Registros de ingeniería"
            definition="Memorias de cálculo y registros geotécnicos creados en el periodo, borrador frente a emitidos."
            href="/structures"
            hrefLabel="Estructuras"
            loading={engineering.isLoading}
            error={engineering.error?.message}
            onExport={
              e &&
              (() =>
                downloadCsv(
                  `engineering_${suffix}.csv`,
                  ["Tipo de registro", "Borrador", "Emitido", "Total"],
                  [
                    [
                      "Cálculo",
                      e.calc.byStatus.DRAFT,
                      e.calc.byStatus.ISSUED,
                      e.calc.total,
                    ],
                    [
                      "Geotecnia",
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
                    ["Memorias de cálculo", e.calc],
                    ["Registros geotécnicos", e.geo],
                  ] as const
                ).map(([label, r]) => (
                  <div key={label} className="space-y-3">
                    <Figure label={label} value={String(r.total)} />
                    <Breakdown
                      parts={[
                        {
                          label: "Borrador",
                          value: r.byStatus.DRAFT,
                          tone: "bg-muted-foreground/40",
                        },
                        {
                          label: "Emitido",
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
