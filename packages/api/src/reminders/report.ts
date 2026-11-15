// The firm's pipeline report (ADR-012, sprint-16-domain-model.md): one
// email that answers "how are the quotes going and what must we chase?".
// Built from the same pipeline read the screen uses, so the email and the
// board can never disagree. No session on the scheduled path: the tenant
// comes from configuration and is read through forTenant (RFC-001).
import { forTenant, type PrismaClient } from "@andes/db";

import {
  COLD_AFTER_DAYS,
  QUOTE_CHASE_AFTER_DAYS,
} from "../routers/crm/health.js";
import { isOpenStage } from "../routers/crm/opportunity-schemas.js";
import {
  readPipeline,
  type PipelineRow,
} from "../routers/crm/pipeline-read.js";

export interface ReportLine {
  opportunityId: string;
  title: string;
  client: string;
  owner: string;
  detail: string;
}

export interface FirmReport {
  today: string;
  open: number;
  // Open value and forecast per currency — never added across currencies.
  totals: { currency: string; value: number; weighted: number }[];
  wonLast7Days: number;
  lostLast7Days: number;
  overdue: ReportLine[];
  dueToday: ReportLine[];
  quotesWaiting: ReportLine[];
  newRequests: ReportLine[];
  cold: ReportLine[];
  noNextStep: ReportLine[];
}

const days = (n: number) => (n === 1 ? "1 día" : `${n} días`);

function line(o: PipelineRow, detail: string): ReportLine {
  return {
    opportunityId: o.id,
    title: o.title,
    client: o.client.name,
    owner: o.owner.name,
    detail,
  };
}

export async function buildFirmReport(
  db: PrismaClient,
  tenantId: string,
  today: string,
  now: Date,
): Promise<FirmReport> {
  const rows = await readPipeline(
    forTenant(db, tenantId),
    tenantId,
    today,
    now,
  );
  const open = rows.filter((o) => isOpenStage(o.stage));
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const closedSince = (stage: "WON" | "LOST") =>
    rows.filter((o) => o.stage === stage && o.closedAt && o.closedAt >= weekAgo)
      .length;

  const totals = new Map<
    string,
    { currency: string; value: number; weighted: number }
  >();
  for (const o of open) {
    if (o.estimatedValue === null) continue;
    const t = totals.get(o.currency) ?? {
      currency: o.currency,
      value: 0,
      weighted: 0,
    };
    t.value += o.estimatedValue;
    t.weighted += o.weightedValue ?? 0;
    totals.set(o.currency, t);
  }

  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const late = (o: PipelineRow) =>
    Math.round((todayDate.getTime() - o.nextActionAt!.getTime()) / 86_400_000);

  return {
    today,
    open: open.length,
    totals: [...totals.values()],
    wonLast7Days: closedSince("WON"),
    lostLast7Days: closedSince("LOST"),
    overdue: open
      .filter((o) => o.followUp === "OVERDUE")
      .sort((a, b) => late(b) - late(a))
      .map((o) =>
        line(
          o,
          `${o.nextAction ?? "Hacer seguimiento"} — ${days(late(o))} de atraso`,
        ),
      ),
    dueToday: open
      .filter((o) => o.followUp === "TODAY")
      .map((o) => line(o, o.nextAction ?? "Hacer seguimiento")),
    // Every quote awaiting an answer, oldest first; the old ones are the
    // point of the report.
    quotesWaiting: open
      .filter((o) => o.daysQuoteWaiting !== null)
      .sort((a, b) => b.daysQuoteWaiting! - a.daysQuoteWaiting!)
      .map((o) =>
        line(
          o,
          `Cotización enviada hace ${days(o.daysQuoteWaiting!)}${
            o.daysQuoteWaiting! >= QUOTE_CHASE_AFTER_DAYS
              ? " — ya pasó mucho tiempo"
              : ""
          }`,
        ),
      ),
    newRequests: open
      .filter((o) => o.stage === "LEAD" && o._count.activities === 0)
      .map((o) =>
        line(
          o,
          o.risks.includes("UNANSWERED_REQUEST")
            ? `Sin responder hace ${days(o.daysSinceActivity)}`
            : "Llegó hoy",
        ),
      ),
    cold: open
      .filter((o) => o.risks.includes("COLD"))
      .sort((a, b) => b.daysSinceActivity - a.daysSinceActivity)
      .map((o) => line(o, `Sin actividad hace ${days(o.daysSinceActivity)}`)),
    noNextStep: open
      .filter((o) => o.followUp === "NONE")
      .map((o) => line(o, "Sin próximo paso definido")),
  };
}

export function reportHasContent(r: FirmReport): boolean {
  return (
    r.overdue.length +
      r.dueToday.length +
      r.quotesWaiting.length +
      r.newRequests.length +
      r.cold.length +
      r.noNextStep.length >
    0
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

// Pure: the same sections produce the text and the HTML body, and every
// user-entered string is escaped.
export function renderFirmReport(report: FirmReport, baseUrl: string) {
  const link = (path: string) => `${baseUrl.replace(/\/$/, "")}${path}`;
  const urgent = report.overdue.length + report.dueToday.length;
  const subject =
    urgent > 0
      ? `Seguimiento comercial: ${urgent} pendiente${urgent === 1 ? "" : "s"} para hoy`
      : "Seguimiento comercial: estado de las cotizaciones";

  const sections: { heading: string; lines: ReportLine[] }[] = [
    { heading: "Seguimientos atrasados", lines: report.overdue },
    { heading: "Seguimientos para hoy", lines: report.dueToday },
    { heading: "Solicitudes nuevas sin atender", lines: report.newRequests },
    { heading: "Cotizaciones sin respuesta", lines: report.quotesWaiting },
    {
      heading: `Oportunidades frías (más de ${COLD_AFTER_DAYS} días sin actividad)`,
      lines: report.cold,
    },
    { heading: "Sin próximo paso", lines: report.noNextStep },
  ].filter((s) => s.lines.length > 0);

  const summary = [
    `Oportunidades abiertas: ${report.open}`,
    ...report.totals.map(
      (t) =>
        `Valor abierto: ${money(t.value, t.currency)} · pronóstico ponderado: ${money(t.weighted, t.currency)}`,
    ),
    `Últimos 7 días: ${report.wonLast7Days} ganadas, ${report.lostLast7Days} perdidas`,
  ];
  const row = (l: ReportLine) =>
    `${l.client} · ${l.title} — ${l.detail} (${l.owner})`;

  const text = [
    `Informe de seguimiento comercial — ${report.today}`,
    "",
    ...summary,
    "",
    ...(sections.length === 0
      ? ["No hay nada pendiente: todas las oportunidades están al día.", ""]
      : sections.flatMap((s) => [
          `${s.heading} (${s.lines.length}):`,
          ...s.lines.map(
            (l) => `- ${row(l)}\n  ${link(`/crm/pipeline/${l.opportunityId}`)}`,
          ),
          "",
        ])),
    `Abrir el seguimiento: ${link("/crm/pipeline")}`,
  ].join("\n");

  const html = [
    `<h2 style="margin:0 0 8px">Informe de seguimiento comercial</h2>`,
    `<p style="margin:0 0 12px;color:#555">${escapeHtml(report.today)}</p>`,
    `<ul style="margin:0 0 12px;padding-left:18px">${summary
      .map((s) => `<li>${escapeHtml(s)}</li>`)
      .join("")}</ul>`,
    ...(sections.length === 0
      ? [`<p>No hay nada pendiente: todas las oportunidades están al día.</p>`]
      : sections.map(
          (s) =>
            `<h3 style="margin:16px 0 4px">${escapeHtml(s.heading)} (${s.lines.length})</h3><ul style="margin:0;padding-left:18px">${s.lines
              .map(
                (l) =>
                  `<li><a href="${escapeHtml(link(`/crm/pipeline/${l.opportunityId}`))}">${escapeHtml(`${l.client} · ${l.title}`)}</a> — ${escapeHtml(l.detail)} <span style="color:#777">(${escapeHtml(l.owner)})</span></li>`,
              )
              .join("")}</ul>`,
        )),
    `<p style="margin-top:16px"><a href="${escapeHtml(link("/crm/pipeline"))}">Abrir el seguimiento</a></p>`,
  ].join("");

  return { subject, text, html };
}

// Recipients from configuration: one or more addresses, comma-separated.
export function reportRecipients(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
}

export interface MailConfig {
  apiKey: string;
  from: string;
  baseUrl: string;
}

export function mailConfigFromEnv(env: NodeJS.ProcessEnv): MailConfig | null {
  const apiKey = env.RESEND_API_KEY;
  const from = env.DIGEST_FROM_EMAIL;
  // Links in the email point at the app. Preview deployments have no
  // BETTER_AUTH_URL, so fall back to the host Vercel reports.
  const host = env.VERCEL_PROJECT_PRODUCTION_URL ?? env.VERCEL_URL;
  const baseUrl = env.BETTER_AUTH_URL ?? (host ? `https://${host}` : undefined);
  return apiKey && from && baseUrl ? { apiKey, from, baseUrl } : null;
}

// Resend over HTTP (ADR-012: no SDK). Returns whether Resend accepted it.
export async function sendMail(
  config: MailConfig,
  message: { to: string[]; subject: string; text: string; html: string },
): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: config.from, ...message }),
  });
  if (!res.ok) console.error(`[report] Resend answered ${res.status}`);
  return res.ok;
}
