# Sprint 14 — Proposal

**Status:** Proposed — awaiting CTO ratification. Independent of [ADR-010](../adr/0010-numerical-service.md) and of Sprint 13: it needs no new technology and can run before or after.
**Drafted:** 2026-11-13
**Objective (proposed):** Analytics MVP — the firm's indicators over a period, read from what the platform already records.

---

## Context

**Andes Analytics is the last of the eight products still shown as a "Soon" stub.** Every other module of the original map is live, and each one writes records that nobody can yet read together: the dashboard has eight counters and no time axis. This sprint gives the owner the reading — what is being quoted and won, what is in progress, what is overdue — with **zero new infrastructure, vendor or cost**, and no new tables. Domain detail and the **six decisions to ratify** are in [sprint-14-domain-model.md](../architecture/sprint-14-domain-model.md).

The numbering leaves Sprint 13 to the calculation engine proposed with ADR-010; the order between the two is the CTO's call.

## Proposed Scope

1. **Indicator library** (`packages/api`, `routers/analytics/`): one pure, typed function per indicator in the domain model's table, taking the tenant-scoped client, a period and an optional client filter. Period parsing and validation as Zod schemas. Unit tests against fixtures for every definition, including the edges that definitions exist to settle (a proposal created in one month and accepted in another; a project with no `endDate`; mixed currencies).
2. **API**: `analytics` router — `commercial`, `projects`, `inspections`, `engineering` — all `tenantProcedure`; the money fields of `commercial` returned only to `OWNER_ADMIN` (domain model question 2). Integration tests with **cross-tenant sweeps on every aggregate** (strict tier: an aggregate that counts another tenant's rows is a leak).
3. **Charts** (`packages/ui`): bar, stacked bar and line as small SVG components with accessible tables behind them — no charting dependency (domain model question 3).
4. **UI** (`apps/core`): **Analytics** live in the sidebar — period selector, the four areas, each figure linking to its filtered list, CSV export per table, and a print view as the period report. The dashboard's counters stay as they are.

## Out of Scope

- New tables, snapshots or scheduled jobs.
- Proposal `sentAt` / `decidedAt` and the sales-cycle indicators that need them (domain model question 4) — a separate, small CRM proposal.
- Product-usage telemetry (PostHog), saved or emailed reports, per-person productivity, financial accounting.
- The Copilot reading indicators as a tool — natural follow-up once Sprint 9 activates, since the tool layer already wraps module services.

## Testing Commitments

Unit: every indicator definition against fixtures. Integration: each router procedure, with a second tenant's data present and asserted absent from every count and sum; role check on the money fields. UI verified by the CTO reading a real period against the lists — the acceptance gate is that every figure can be reproduced by counting the list it links to.

## Rollout Notes

No migrations, secrets or infrastructure. Performance is expected to be a non-issue at one firm's data volume; the domain model records the trigger for revisiting it.

## Open Decisions for the CTO

1. **Ratify the domain model** — including its six recommendations (computed on read, money for `OWNER_ADMIN`, SVG charts without a library, no cycle time yet, UTC periods, no saved reports).
2. **Ratify this scope** — trim candidates: engineering-records area first, CSV export second.
3. **Order** — before or after Sprint 13 (calculation engine, pending ADR-010).

## References

- [sprint-14-domain-model.md](../architecture/sprint-14-domain-model.md) — the domain this sprint implements.
- [PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md) — Reports and Analytics in the functional scope.
- [sprint-12.md](sprint-12.md) — Administration (UI in review); [sprint-13.md](sprint-13.md) — calculation engine (proposed with ADR-010).
