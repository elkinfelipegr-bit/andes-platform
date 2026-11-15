# ADR-012: Email Delivery & the Daily Follow-up Digest

**Status:** Proposed — implemented ahead of ratification under the CTO's explicit delegation of 2026-11-13 ("proceed, I validate everything at the end") and the go-ahead of 2026-11-15 for this item. Not binding until the CTO accepts it.
**Date:** 2026-11-15
**Deciders:** CTO / Lead Software Architect (Andes Engineering)

---

## Context

Sprint 15 gave every open opportunity a dated next step and an agenda that shows what is due — but only to someone who opens the platform. A follow-up tool that has to be remembered does not solve forgetting. Email delivery has been deferred twice as "a future ADR" (Sprint 12 invitations, Sprint 14 reports); the platform has no way to send anything.

## Problem

How does the platform tell a member, unprompted, what they have to follow up today — and through which email provider and scheduler — without new infrastructure to operate?

## Decision

1. **Provider: Resend, called over its HTTP API** with `fetch`. No SDK dependency. The firm's public website already sends through Resend, so there is one vendor and one account, not two.
2. **Scheduler: Vercel Cron** ([ADR-005](0005-deployment-target.md) — the deployment target's own scheduler), declared in `apps/core/vercel.json`, calling `GET /api/cron/follow-ups` once a day, Monday to Saturday, at 12:00 UTC (07:00 in Bogotá). Vercel authenticates the call with `Authorization: Bearer $CRON_SECRET`; the route checks it in constant time and is closed when the secret is unset.
3. **Content: one digest per member, only when there is something in it** — their opportunities due today or overdue, their open opportunities with no next step, and sent proposals awaiting an answer on opportunities they own. Each line links to the record. A member with nothing pending receives nothing.
4. **Tenants come from configuration** (`DIGEST_TENANT_IDS`), read through `forTenant` one at a time — the same position as [ADR-011](0011-lead-intake.md): no session, so no tenant is ever inferred, and both [RFC-001](../rfc/0001-multi-tenant-architecture.md) layers apply.
5. **"Today" is the firm's calendar day** in `DIGEST_TIME_ZONE` (default `America/Bogota`). Next-step dates are calendar days, so this is a comparison of days, not instants.
6. **Scope of this ADR's email use: the digest only.** Invitation emails and emailed reports can now be built on the same provider, but each is its own change.

## Alternatives

- **Push or in-app notifications.** In-app repeats the problem (you must open the app); push needs a service worker and per-device subscriptions. Email reaches people where they already look in the morning.
- **A reminder per item at its due time.** More mail, more scheduling state, and the platform stores no time of day for a next step. A single morning digest matches how the agenda is used.
- **WhatsApp.** Where the firm actually talks, but the Business API needs an approved provider, templates and per-message cost — a decision of its own.
- **A queue/worker service.** Operating cost and a new moving part for one daily job.
- **Listing all tenants from the database.** Would need a read that crosses the tenant boundary; configuration avoids creating that path for one consumer.

## Trade-offs

Vercel Cron on the free plan runs at most daily and with loose timing (within the hour) — fine for a morning digest. Tenants are opted in by configuration, so a new tenant gets no digest until added; acceptable with one tenant. There are no per-member preferences yet: a member who does not want the email cannot turn it off without an operator.

## Consequences

- New configuration on the platform's Vercel project: `CRON_SECRET`, `RESEND_API_KEY`, `DIGEST_FROM_EMAIL` (a sender on a domain verified in Resend), `DIGEST_TENANT_IDS`, optionally `DIGEST_TIME_ZONE`. Until they are set the job runs and reports `unconfigured` without sending.
- Resend's sandbox sender only delivers to the account owner's address: sending to the whole team requires verifying the firm's domain in Resend.
- Email bodies contain client names and opportunity titles, and leave the platform through Resend — the same class of data the website already sends through it.
- The digest logic is in `packages/api/src/reminders/`, covered at the strict tier (no cross-tenant content).

## Examples

Monday 07:00: Ana receives "2 seguimientos para hoy" (the email is written in Spanish, the interface language) — one three days late, one for today — each linking to its opportunity. Luis receives the proposal he sent four days ago and an opportunity with no next step. A member with nothing pending receives nothing.

## Exceptions

**One shared inbox.** When `DIGEST_TO_EMAIL` is set, every member's digest is sent to that single address instead of the member's own, with the member's name in the subject. This is how Tenant #1 runs today (CTO instruction of 2026-11-15: everything goes to the firm's inbox), and it is also what makes the digest deliverable before a sending domain is verified in Resend — the sandbox sender only delivers to the Resend account's own address. Unset it to send to each member once the domain is verified.

Per-member opt-out, other schedules and other email types are follow-ups, not exceptions.

## References

- [ADR-005](0005-deployment-target.md) — Vercel, whose scheduler this uses.
- [ADR-011](0011-lead-intake.md) — the other session-less path and the same tenant-from-configuration position.
- [sprint-15-domain-model.md](../architecture/sprint-15-domain-model.md) — reminders listed there as out of scope pending this decision.
