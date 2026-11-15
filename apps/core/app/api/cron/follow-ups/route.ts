// Daily follow-up digest (ADR-012). Called by Vercel Cron (see
// vercel.json), which sends `Authorization: Bearer $CRON_SECRET`. Sends
// through Resend's HTTP API — no SDK dependency. Unconfigured, it does
// nothing and says so.
import {
  buildFollowUpDigests,
  isValidCronSecret,
  renderDigest,
} from "@andes/api";
import { prisma } from "@andes/db";

export const maxDuration = 60;

// "Today" for the firm: reminders are about the working day, so the
// calendar day is taken in the configured time zone, not in UTC.
function todayIn(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(req: Request) {
  if (
    !isValidCronSecret(
      req.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  ) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const tenantIds = (process.env.DIGEST_TENANT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.DIGEST_FROM_EMAIL;
  const baseUrl = process.env.BETTER_AUTH_URL;
  if (tenantIds.length === 0 || !apiKey || !from || !baseUrl) {
    return Response.json({ status: "unconfigured", sent: 0 });
  }

  const override = process.env.DIGEST_TO_EMAIL || undefined;
  const today = todayIn(process.env.DIGEST_TIME_ZONE ?? "America/Bogota");
  let sent = 0;
  let failed = 0;
  for (const tenantId of tenantIds) {
    const digests = await buildFollowUpDigests(prisma, tenantId, today);
    for (const digest of digests) {
      const { subject, text, html } = renderDigest(digest, baseUrl);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          // DIGEST_TO_EMAIL routes every digest to one shared inbox (ADR-012,
          // Exceptions) — the member's name then goes in the subject.
          to: [override ?? digest.email],
          subject: override ? `${digest.name}: ${subject}` : subject,
          text,
          html,
        }),
      });
      if (res.ok) sent += 1;
      else {
        failed += 1;
        console.error(`[follow-up-digest] Resend answered ${res.status}`);
      }
    }
  }
  return Response.json({ status: "ok", today, sent, failed });
}
