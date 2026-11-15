"use client";

// Sprint 16 additions to the pipeline (sprint-16-domain-model.md): risk
// badges, the list view with export, the requests inbox, the at-risk
// panel and the on-demand report. All read the same rows as the board.
import { Download, Inbox, Mail, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@andes/ui";

import { formatDate, formatMoney, formatMoneyCompact } from "@/lib/format";
import { trpc } from "@/lib/trpc";

import { FollowUpChip } from "./follow-up-chip";
import { STAGE_LABEL, type Opportunity } from "./pipeline-meta";

export type Risk = Opportunity["risks"][number];

export const RISK_LABEL: Record<Risk, string> = {
  OVERDUE: "Seguimiento atrasado",
  QUOTE_WAITING: "Cotización sin respuesta",
  COLD: "Sin actividad",
  NO_NEXT_STEP: "Sin próximo paso",
  UNANSWERED_REQUEST: "Solicitud sin atender",
};

const riskTone: Record<Risk, string> = {
  OVERDUE: "bg-destructive/10 text-destructive",
  UNANSWERED_REQUEST: "bg-destructive/10 text-destructive",
  QUOTE_WAITING: "bg-warning/20 text-warning-foreground",
  COLD: "bg-warning/20 text-warning-foreground",
  NO_NEXT_STEP: "bg-muted text-muted-foreground",
};

const days = (n: number) => (n === 1 ? "1 día" : `${n} días`);

// What exactly is wrong, in words — the badge never relies on colour.
export function riskDetail(o: Opportunity, risk: Risk) {
  switch (risk) {
    case "QUOTE_WAITING":
      return `Cotización sin respuesta hace ${days(o.daysQuoteWaiting ?? 0)}`;
    case "COLD":
      return `Sin actividad hace ${days(o.daysSinceActivity)}`;
    case "UNANSWERED_REQUEST":
      return `Solicitud sin atender hace ${days(o.daysSinceActivity)}`;
    default:
      return RISK_LABEL[risk];
  }
}

export function RiskBadges({
  opportunity,
  // The follow-up chip already says "overdue" / "no next step".
  skip = ["OVERDUE", "NO_NEXT_STEP"],
}: {
  opportunity: Opportunity;
  skip?: Risk[];
}) {
  const risks = opportunity.risks.filter((r) => !skip.includes(r));
  if (risks.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1">
      {risks.map((risk) => (
        <li
          key={risk}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
            riskTone[risk],
          )}
        >
          <TriangleAlert aria-hidden="true" className="size-3" />
          {riskDetail(opportunity, risk)}
        </li>
      ))}
    </ul>
  );
}

// ── Requests inbox ─────────────────────────────────────────────────────
// What arrived from outside (the website) and nobody has answered yet.
export function RequestsPanel({ rows }: { rows: Opportunity[] }) {
  const requests = rows.filter(
    (o) => o.stage === "LEAD" && o._count.activities === 0,
  );
  return (
    <div className="rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Inbox aria-hidden="true" className="size-4 text-muted-foreground" />
          Solicitudes nuevas
        </h2>
        <span className="text-xs text-muted-foreground">
          {requests.length > 0 ? `${requests.length} sin atender` : ""}
        </span>
      </header>
      {requests.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          No hay solicitudes sin atender. Las que llegan por el sitio web
          aparecen aquí hasta que alguien registra el primer contacto.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {requests.map((o) => (
            <li key={o.id}>
              <Link
                href={`/crm/pipeline/${o.id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{o.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {o.client.name}
                    {o.source ? ` · ${o.source}` : ""} · llegó{" "}
                    {o.daysSinceActivity === 0
                      ? "hoy"
                      : `hace ${days(o.daysSinceActivity)}`}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
                    o.risks.includes("UNANSWERED_REQUEST")
                      ? "bg-destructive/10 text-destructive"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  {o.risks.includes("UNANSWERED_REQUEST")
                    ? "Sin atender"
                    : "Nueva"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── At risk ────────────────────────────────────────────────────────────
export function RiskPanel({ rows }: { rows: Opportunity[] }) {
  const atRisk = rows
    .filter((o) => o.risks.some((r) => r === "QUOTE_WAITING" || r === "COLD"))
    .sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);
  return (
    <div className="rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <TriangleAlert
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          En riesgo
        </h2>
        <span className="text-xs text-muted-foreground">
          Cotizaciones viejas y oportunidades frías
        </span>
      </header>
      {atRisk.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          Nada en riesgo: ninguna cotización lleva más de 7 días sin respuesta
          ni hay oportunidades con más de 14 días sin actividad.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {atRisk.map((o) => (
            <li key={o.id}>
              <Link
                href={`/crm/pipeline/${o.id}`}
                className="block px-4 py-2.5 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium">{o.title}</p>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {o.estimatedValue !== null
                      ? formatMoneyCompact(o.estimatedValue, o.currency)
                      : ""}
                  </span>
                </div>
                <p className="mb-1 truncate text-xs text-muted-foreground">
                  {o.client.name} · {STAGE_LABEL[o.stage]} · {o.owner.name}
                </p>
                <RiskBadges opportunity={o} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── List view ──────────────────────────────────────────────────────────
type SortKey = "next" | "value" | "weighted" | "stage" | "quiet" | "client";

const STAGE_ORDER = [
  "LEAD",
  "CONTACTED",
  "QUOTED",
  "NEGOTIATION",
  "WON",
  "LOST",
];

function sortRows(rows: Opportunity[], key: SortKey, desc: boolean) {
  const value = (o: Opportunity): number | string => {
    switch (key) {
      case "value":
        return o.estimatedValue ?? -1;
      case "weighted":
        return o.weightedValue ?? -1;
      case "stage":
        return STAGE_ORDER.indexOf(o.stage);
      case "quiet":
        return o.daysSinceActivity;
      case "client":
        return o.client.name.toLowerCase();
      default:
        // No date sorts last.
        return o.nextActionAt ? String(o.nextActionAt) : "9999";
    }
  };
  return [...rows].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    const cmp = x < y ? -1 : x > y ? 1 : 0;
    return desc ? -cmp : cmp;
  });
}

function csvDownload(rows: Opportunity[]) {
  const header = [
    "Oportunidad",
    "Cliente",
    "Etapa",
    "Valor estimado",
    "Moneda",
    "Probabilidad %",
    "Valor ponderado",
    "Próximo paso",
    "Fecha próximo paso",
    "Cierre esperado",
    "Días en la etapa",
    "Días sin actividad",
    "Alertas",
    "Origen",
    "Responsable",
  ];
  const day = (v: Date | string | null) =>
    v ? new Date(v).toISOString().slice(0, 10) : "";
  const lines = rows.map((o) => [
    o.title,
    o.client.name,
    STAGE_LABEL[o.stage],
    o.estimatedValue ?? "",
    o.currency,
    o.probability,
    o.weightedValue ?? "",
    o.nextAction ?? "",
    day(o.nextActionAt),
    day(o.expectedCloseAt),
    o.daysInStage,
    o.daysSinceActivity,
    o.risks.map((r) => RISK_LABEL[r]).join("; "),
    o.source ?? "",
    o.owner.name,
  ]);
  const cell = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
  const csv = [header, ...lines].map((r) => r.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `seguimiento_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function PipelineList({
  rows,
  today,
}: {
  rows: Opportunity[];
  today: string;
}) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "next",
    desc: false,
  });
  const sorted = sortRows(rows, sort.key, sort.desc);
  const head = (key: SortKey, label: string, numeric = false) => (
    <TableHead
      className={numeric ? "text-right" : undefined}
      aria-sort={
        sort.key === key ? (sort.desc ? "descending" : "ascending") : "none"
      }
    >
      <button
        type="button"
        onClick={() =>
          setSort((s) => ({ key, desc: s.key === key ? !s.desc : numeric }))
        }
        className="inline-flex items-center gap-1 font-medium hover:text-foreground focus-visible:underline focus-visible:outline-none"
      >
        {label}
        <span aria-hidden="true" className="text-xs">
          {sort.key === key ? (sort.desc ? "↓" : "↑") : ""}
        </span>
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => csvDownload(sorted)}>
          <Download aria-hidden="true" />
          Exportar CSV
        </Button>
      </div>
      {sorted.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Ninguna oportunidad coincide con los filtros.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                {head("client", "Oportunidad")}
                {head("stage", "Etapa")}
                {head("value", "Valor", true)}
                {head("weighted", "Ponderado", true)}
                {head("next", "Próximo paso")}
                {head("quiet", "Sin actividad", true)}
                <TableHead>Responsable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="max-w-72">
                    <Link
                      href={`/crm/pipeline/${o.id}`}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {o.title}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {o.client.name}
                    </p>
                    <div className="mt-1">
                      <RiskBadges opportunity={o} />
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {STAGE_LABEL[o.stage]}
                    <p className="text-xs text-muted-foreground">
                      {days(o.daysInStage)} · {o.probability}%
                    </p>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {o.estimatedValue !== null
                      ? formatMoney(o.estimatedValue, o.currency)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap text-muted-foreground tabular-nums">
                    {o.weightedValue !== null
                      ? formatMoney(o.weightedValue, o.currency)
                      : "—"}
                  </TableCell>
                  <TableCell className="max-w-64">
                    <p className="truncate text-sm">{o.nextAction ?? "—"}</p>
                    {o.followUp ? (
                      <FollowUpChip
                        state={o.followUp}
                        nextActionAt={o.nextActionAt}
                        today={today}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Cerrada {formatDate(o.closedAt)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {days(o.daysSinceActivity)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {o.owner.name}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Report on demand ───────────────────────────────────────────────────
export function SendReportButton({ today }: { today: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const send = trpc.opportunities.sendReport.useMutation({
    onSuccess: (r) => setMessage(`Informe enviado a ${r.sentTo.join(", ")}`),
    onError: (e) => setMessage(e.message),
  });
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        disabled={send.isPending}
        onClick={() => {
          setMessage(null);
          send.mutate({ today });
        }}
      >
        <Mail aria-hidden="true" />
        {send.isPending ? "Enviando…" : "Enviar informe por correo"}
      </Button>
      {message && (
        <p
          role="status"
          className={cn(
            "text-xs",
            send.isError ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
}
