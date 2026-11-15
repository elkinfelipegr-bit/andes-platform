// Daily follow-up digest (ADR-012). Called by Vercel Cron (see
// vercel.json), which sends `Authorization: Bearer $CRON_SECRET`. Sends
// through Resend's HTTP API — no SDK dependency. Unconfigured, it does
// nothing and says so.
import {
  buildFirmReport,
  buildFollowUpDigests,
  isValidCronSecret,
  mailConfigFromEnv,
  renderDigest,
  renderFirmReport,
  reportHasContent,
  reportRecipients,
  sendMail,
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
  const config = mailConfigFromEnv(process.env);
  if (tenantIds.length === 0 || !config) {
    return Response.json({ status: "unconfigured", sent: 0 });
  }

  // With recipients configured, the firm gets ONE report (sprint-16);
  // otherwise each member gets their own digest (ADR-012).
  const recipients = reportRecipients(process.env.DIGEST_TO_EMAIL);
  const today = todayIn(process.env.DIGEST_TIME_ZONE ?? "America/Bogota");
  let sent = 0;
  let failed = 0;
  const count = (ok: boolean) => (ok ? (sent += 1) : (failed += 1));
  for (const tenantId of tenantIds) {
    if (recipients.length > 0) {
      const report = await buildFirmReport(prisma, tenantId, today, new Date());
      // Nothing pending → no email: a daily "all clear" trains people to
      // stop opening it.
      if (!reportHasContent(report)) continue;
      count(
        await sendMail(config, {
          to: recipients,
          ...renderFirmReport(report, config.baseUrl),
        }),
      );
      continue;
    }
    const digests = await buildFollowUpDigests(prisma, tenantId, today);
    for (const digest of digests) {
      count(
        await sendMail(config, {
          to: [digest.email],
          ...renderDigest(digest, config.baseUrl),
        }),
      );
    }
  }
  return Response.json({ status: "ok", today, sent, failed });
}
