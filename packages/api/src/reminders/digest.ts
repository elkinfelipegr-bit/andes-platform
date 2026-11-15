// Daily follow-up digest (ADR-012): one email per member listing what
// the pipeline says is theirs to do today. Read-only over the Sprint 15
// records. Like lead intake it has no user session — a scheduler calls it
// — so the tenant comes from server configuration and every read goes
// through forTenant (RFC-001, both layers).
import { timingSafeEqual } from "node:crypto";
import { forTenant, type PrismaClient } from "@andes/db";

import { followUpState } from "../routers/crm/follow-up.js";
import { OPEN_STAGES } from "../routers/crm/opportunity-schemas.js";

export interface DigestItem {
  opportunityId: string;
  title: string;
  client: string;
  nextAction: string | null;
  // Days overdue (0 = due today).
  daysLate: number;
}

export interface DigestQuote {
  proposalId: string;
  code: string;
  title: string;
  client: string;
  // Null when the proposal was sent before sentAt existed.
  daysWaiting: number | null;
}

export interface MemberDigest {
  userId: string;
  name: string;
  email: string;
  due: DigestItem[];
  // Open opportunities of this member with no dated next step.
  unplanned: { opportunityId: string; title: string; client: string }[];
  // Sent proposals awaiting an answer, on opportunities this member owns.
  quotes: DigestQuote[];
}

const DAY = 86_400_000;

// Builds the digests for one tenant. Members with nothing pending get no
// digest: an empty email every morning teaches people to ignore it.
export async function buildFollowUpDigests(
  db: PrismaClient,
  tenantId: string,
  today: string,
): Promise<MemberDigest[]> {
  const tenantDb = forTenant(db, tenantId);
  const todayDate = new Date(`${today}T00:00:00.000Z`);

  const [members, opportunities, quotes] = await Promise.all([
    tenantDb.membership.findMany({
      where: { tenantId },
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
    tenantDb.opportunity.findMany({
      where: { tenantId, stage: { in: [...OPEN_STAGES] } },
      select: {
        id: true,
        title: true,
        ownerId: true,
        nextAction: true,
        nextActionAt: true,
        client: { select: { name: true } },
      },
      orderBy: { nextActionAt: "asc" },
    }),
    tenantDb.proposal.findMany({
      where: {
        tenantId,
        status: "SENT",
        opportunity: { stage: { in: [...OPEN_STAGES] } },
      },
      select: {
        id: true,
        code: true,
        title: true,
        sentAt: true,
        client: { select: { name: true } },
        opportunity: { select: { ownerId: true } },
      },
      orderBy: { sentAt: "asc" },
    }),
  ]);

  const digests: MemberDigest[] = [];
  for (const { user } of members) {
    const mine = opportunities.filter((o) => o.ownerId === user.id);
    const digest: MemberDigest = {
      userId: user.id,
      name: user.name,
      email: user.email,
      due: [],
      unplanned: [],
      quotes: quotes
        .filter((q) => q.opportunity?.ownerId === user.id)
        .map((q) => ({
          proposalId: q.id,
          code: q.code,
          title: q.title,
          client: q.client.name,
          daysWaiting: q.sentAt
            ? Math.max(
                0,
                Math.floor((todayDate.getTime() - q.sentAt.getTime()) / DAY) +
                  1,
              )
            : null,
        })),
    };
    for (const o of mine) {
      const state = followUpState(
        { isOpen: true, nextActionAt: o.nextActionAt },
        today,
      );
      if (state === "OVERDUE" || state === "TODAY") {
        digest.due.push({
          opportunityId: o.id,
          title: o.title,
          client: o.client.name,
          nextAction: o.nextAction,
          daysLate: Math.round(
            (todayDate.getTime() - o.nextActionAt!.getTime()) / DAY,
          ),
        });
      } else if (state === "NONE") {
        digest.unplanned.push({
          opportunityId: o.id,
          title: o.title,
          client: o.client.name,
        });
      }
    }
    if (
      digest.due.length + digest.unplanned.length + digest.quotes.length >
      0
    ) {
      digests.push(digest);
    }
  }
  return digests;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Renders one digest. Pure: the same structure produces the plain-text
// and the HTML body, and every user-entered string is escaped.
export function renderDigest(digest: MemberDigest, baseUrl: string) {
  const link = (path: string) => `${baseUrl.replace(/\/$/, "")}${path}`;
  const late = (d: number) =>
    d === 0 ? "today" : d === 1 ? "1 day late" : `${d} days late`;
  const count = digest.due.length;
  const subject =
    count > 0
      ? `${count} follow-up${count === 1 ? "" : "s"} due today`
      : "Your pipeline needs a next step";

  const sections: {
    heading: string;
    rows: { text: string; href: string }[];
  }[] = [];
  if (digest.due.length > 0) {
    sections.push({
      heading: "Due",
      rows: digest.due.map((i) => ({
        text: `${i.nextAction ?? "Follow up"} — ${i.client} · ${i.title} (${late(i.daysLate)})`,
        href: link(`/crm/pipeline/${i.opportunityId}`),
      })),
    });
  }
  if (digest.quotes.length > 0) {
    sections.push({
      heading: "Quotes awaiting an answer",
      rows: digest.quotes.map((q) => ({
        text: `${q.code} ${q.title} — ${q.client}${
          q.daysWaiting === null ? "" : ` (sent ${q.daysWaiting} d ago)`
        }`,
        href: link(`/crm/proposals/${q.proposalId}`),
      })),
    });
  }
  if (digest.unplanned.length > 0) {
    sections.push({
      heading: "Without a next step",
      rows: digest.unplanned.map((u) => ({
        text: `${u.client} · ${u.title}`,
        href: link(`/crm/pipeline/${u.opportunityId}`),
      })),
    });
  }

  const text = [
    `Hello ${digest.name},`,
    "",
    ...sections.flatMap((s) => [
      `${s.heading}:`,
      ...s.rows.map((r) => `- ${r.text}\n  ${r.href}`),
      "",
    ]),
    `Pipeline: ${link("/crm/pipeline")}`,
  ].join("\n");

  const html = [
    `<p>Hello ${escapeHtml(digest.name)},</p>`,
    ...sections.map(
      (s) =>
        `<h3 style="margin:16px 0 4px">${escapeHtml(s.heading)}</h3><ul style="margin:0;padding-left:18px">${s.rows
          .map(
            (r) =>
              `<li><a href="${escapeHtml(r.href)}">${escapeHtml(r.text)}</a></li>`,
          )
          .join("")}</ul>`,
    ),
    `<p><a href="${escapeHtml(link("/crm/pipeline"))}">Open the pipeline</a></p>`,
  ].join("");

  return { subject, text, html };
}

// Constant-time check of the scheduler's bearer secret; closed when the
// secret is unset or short.
export function isValidCronSecret(
  authorization: string | null,
  expected: string | undefined,
): boolean {
  if (!expected || expected.length < 16 || !authorization) return false;
  const match = /^Bearer (.+)$/.exec(authorization);
  if (!match) return false;
  const a = Buffer.from(match[1]!);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
