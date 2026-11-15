# ADR-011: Inbound Lead Intake from the Public Website

**Status:** Proposed — implemented ahead of ratification under the CTO's explicit delegation of 2026-11-13 ("proceed, I validate everything at the end") and the go-ahead of 2026-11-15 for this item. Not binding until the CTO accepts it.
**Date:** 2026-11-15
**Deciders:** CTO / Lead Software Architect (Andes Engineering)

---

## Context

The firm's public website (a separate repository and Vercel project) captures contact requests from its contact form and its free tools. Today each request is an email. Sprint 15 gave the platform a pipeline whose whole point is that no prospect is forgotten — but a request that arrives by email only enters it if someone retypes it.

[ADR-003](0003-api-layer.md) makes tRPC the internal API and states that anything consumed by a non-monorepo client needs its own ADR. The website is such a client.

## Problem

How does a request captured on the public website become an opportunity in the pipeline, without a user session, without weakening tenant isolation, and without building the public integration API that ADR-003 deliberately deferred?

## Decision

**One narrow, server-to-server HTTP endpoint in Andes Core: `POST /api/intake/lead`.**

1. **Single purpose, write-only.** It accepts one lead (name, optional company/email/phone, a one-line subject, the message, a source label) and returns the id of the opportunity it created. It reads nothing back. It is not the start of a general public API.
2. **Authenticated by a shared secret,** `LEAD_INTAKE_KEY`, sent as a bearer token and compared in constant time. The website's _server action_ holds it; it never reaches a browser.
3. **The tenant comes from server configuration,** `LEAD_INTAKE_TENANT_ID` — never from the request. Every read and write goes through `forTenant`, so both [RFC-001](../rfc/0001-multi-tenant-architecture.md) layers apply as for a signed-in member. Unknown request fields are dropped by the schema.
4. **Closed by default.** With either variable unset the endpoint answers 503 and records nothing; a key shorter than 24 characters is treated as unset.
5. **What a lead becomes:** a `Client` (reused when an active client of the same tenant has the same email), an `Opportunity` in `LEAD` owned by the tenant's first `OWNER_ADMIN`, with next step "Reply to the website request" due today, and the message as its first activity.
6. **The email stays.** The website keeps sending its notification email; the platform call is additional and its failure must never fail the visitor's request.

## Alternatives

- **The website writes to the platform database directly.** Rejected: a second writer outside the tenant-scoped client, with database credentials in another project.
- **Per-tenant intake keys in a table** (hashed, revocable, with an RLS bootstrap like `forInviteToken`). The right design once a second firm has its own website to connect; today it would add a new tenant-boundary code path for a single consumer. Deferred, and this endpoint's contract does not change when it arrives — only how the key resolves to a tenant.
- **Parsing the notification emails.** Fragile, and needs a mailbox integration the platform does not have.
- **A general REST gateway** (ADR-003's anticipated exception). Far more than one write needs.

## Trade-offs

One key maps to one tenant, so this serves Tenant #1 only — accepted, since only Tenant #1 has a website. A shared secret has no per-request identity and no built-in rotation; rotation is changing two environment variables. There is no rate limiting in the platform: the key keeps the public out, and the website remains responsible for the abuse controls on its own forms.

## Consequences

- Two new secrets on the platform's Vercel project (`LEAD_INTAKE_KEY`, `LEAD_INTAKE_TENANT_ID`) and two on the website's (`ANDES_PLATFORM_INTAKE_URL`, `ANDES_PLATFORM_INTAKE_KEY`). Until all four are set nothing changes anywhere.
- Personal data of people who wrote to the firm (name, email, phone, message) is now stored in the platform. The website already obtains consent for data treatment on those forms; the firm's privacy notice should name the platform as where requests are kept.
- The intake logic lives in `packages/api/src/intake/` — outside the tRPC routers because it has no session — and is covered at the strict tier: configured-tenant-only writes and no cross-tenant client matching.

## Examples

The lot-planner form's server action sends its email, then posts `{ name, email, phone, subject: "Planificador de lote — …", message, source: "Website · Lot planner" }` with the bearer key. A minute later the request is at the top of "Follow up now" in `/crm/pipeline`.

## Exceptions

Nothing else may be added to this endpoint or this authentication scheme. Reading data, other record types, or other consumers require the gateway ADR that ADR-003 anticipates.

## References

- [ADR-003](0003-api-layer.md) — external consumers need their own ADR.
- [RFC-001](../rfc/0001-multi-tenant-architecture.md) — isolation the endpoint must preserve.
- [sprint-15-domain-model.md](../architecture/sprint-15-domain-model.md) — the Opportunity it creates; listed there as out of scope pending this decision.
