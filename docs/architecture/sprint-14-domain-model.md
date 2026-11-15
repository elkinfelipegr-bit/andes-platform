# Sprint 14 Domain Model — Analytics: Firm Indicators

**Version:** 1.0
**Status:** Proposed — drafted for CTO ratification together with [sprint-14.md](../sprints/sprint-14.md). Nothing here is implemented or binding until accepted.
**Part of:** `docs/architecture/`, following the DDD workflow in [architecture-principles.md](../foundation/architecture-principles.md)

---

## Purpose

Walks the DDD sequence for the first slice of **Andes Analytics**, the last of the eight products in [PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md) still shown as a disabled stub. It maps the two functional modules assigned to it — _Reports_ and _Analytics_ — onto what the platform already records, and stops before database and API design.

## Business

The firm's owner needs to answer, without opening five screens and a spreadsheet: _how much are we quoting and winning, what is in progress, and what is falling behind?_ Every fact needed already lives in the platform — proposals, projects, inspections, calculation and geotechnical records — but only as lists. Today the dashboard shows eight counters and nothing over time.

This module turns those records into **indicators over a period**. It records nothing new: it is a reading of what the other modules wrote.

**Not in this module:** product-usage telemetry (which screens people open, funnels). That is what [ADR-001](../adr/0001-technology-stack.md) reserves PostHog for; it answers questions about the _platform_, not about the _firm_, and is a separate decision.

## Processes

1. A member opens **Analytics** and picks a period (this month, last 3, 6 or 12 months, or a custom range) and optionally a client.
2. The platform shows the firm's indicators for that period, grouped by area:
   - **Commercial** — proposals created, sent and decided; win rate; value quoted and value won.
   - **Projects** — projects by status; started and completed per month; active projects per client.
   - **Inspections** — scheduled, completed and cancelled per month; findings by severity; overdue visits.
   - **Engineering records** — calculation and geotechnical records, draft vs issued.
3. The member drills from any figure into the list it summarises (the existing list screens, with the filter applied).
4. The member exports a table as CSV, or prints the page as the period report (the ratified print-view pattern).

## Domain Concepts

- **Indicator** — a named figure computed from existing records for a tenant, a period and an optional client. It has a definition (what is counted, by which date) that is written down once and tested; it is never stored.
- **Period** — a closed date range. The date an indicator is attributed to is part of its definition (see the table below), because the same proposal is "created" in one month and "decided" in another.
- **Report** — a rendering of a set of indicators for one period. In this slice a report is a view, not a saved document.

## Indicator Definitions (draft)

Every indicator derives from fields that exist today. Where an honest definition needs a field that does not exist, the indicator is listed under Open Questions instead of being approximated.

| Area        | Indicator                    | Counted                                                                         | Attributed by            |
| ----------- | ---------------------------- | ------------------------------------------------------------------------------- | ------------------------ |
| Commercial  | Proposals created            | `Proposal`                                                                      | `createdAt`              |
| Commercial  | Proposals by status          | `Proposal` grouped by `status`                                                  | `createdAt`              |
| Commercial  | Value quoted                 | Σ `ProposalItem.quantity × unitPrice` of proposals not in `DRAFT`, per currency | proposal `createdAt`     |
| Commercial  | Value won                    | Same sum, proposals in `ACCEPTED`, per currency                                 | proposal `createdAt`     |
| Commercial  | Win rate                     | `ACCEPTED ÷ (ACCEPTED + REJECTED + EXPIRED)`                                    | proposal `createdAt`     |
| Projects    | Projects by status           | `Project` grouped by `status`                                                   | snapshot (now)           |
| Projects    | Started / completed          | `Project` with `startDate` / `endDate` in the period                            | `startDate` / `endDate`  |
| Projects    | Active projects per client   | `Project` in `ACTIVE`, grouped by `clientId`                                    | snapshot (now)           |
| Inspections | Scheduled / completed        | `Inspection` grouped by `status`                                                | `scheduledFor`           |
| Inspections | Overdue visits               | `Inspection` in `SCHEDULED` with `scheduledFor` before today                    | snapshot (now)           |
| Inspections | Findings by severity         | `Finding` grouped by `severity`                                                 | inspection `performedAt` |
| Engineering | Calc / geo records by status | `CalcRecord`, `GeoRecord` grouped by `status`                                   | `createdAt`              |

Money is never summed across currencies: `Proposal.currency` is part of the grouping.

## Relationships

```
Tenant 1 ──── N Proposal ── N ProposalItem
       1 ──── N Project  ── N Inspection ── N Finding
                         ── N CalcRecord · N GeoRecord
                (read only — Analytics owns no entity)
```

## Roles & Permissions

Operational indicators (projects, inspections, engineering records) are visible to every member. **Money** — value quoted, value won — is proposed as `OWNER_ADMIN`-only: it is the firm's commercial position, and `ENGINEER` already reaches individual proposals only through the CRM. See Open Question 2.

## Tenant Isolation

Aggregates are a leak surface of their own: a count or a sum that includes another tenant's rows discloses data even though no row is returned. Every indicator is computed through the tenant-scoped client ([RFC-001](../rfc/0001-multi-tenant-architecture.md)), so PostgreSQL RLS applies to the aggregate exactly as to a list — including any raw SQL needed for `quantity × unitPrice`. This is strict-tier test territory per `PROJECT_RULES.md`.

## Open Questions for Ratification

1. **No new tables — indicators computed on read.** Recommendation: **yes.** The data volume of one firm does not justify snapshots or materialised views, and stored aggregates are a second source of truth. Revisit only if a query becomes slow.
2. **Money visible to `OWNER_ADMIN` only.** Recommendation: **yes**, with operational indicators open to all members.
3. **Charts without a new dependency.** [ADR-001](../adr/0001-technology-stack.md) lists no charting library. Recommendation: **small SVG chart components in `@andes/ui`** (bar, stacked bar, line) rather than adopting a library — the module needs three chart forms, and a library is a dependency decision of its own. If richer charts are wanted, that is an ADR.
4. **Decision dates on proposals.** A proposal has no `sentAt` or `decidedAt`: the lifecycle is stored only as the current `status`. Sales-cycle time (days from sent to decided) and "won this month" therefore **cannot be computed honestly** — `updatedAt` changes for other reasons. Recommendation: **leave cycle time out of this sprint** and attribute commercial indicators by `createdAt`; adding the two timestamps is a small CRM change to propose separately.
5. **Period boundaries.** Date-only fields live at UTC midnight (the Sprint 2 convention) and tenants have no time zone. Recommendation: **periods are UTC calendar dates**, consistent with every other date in the platform; a tenant time zone is a Core decision, not an Analytics one.
6. **Saved reports and scheduled delivery.** Recommendation: **out of scope** — the print view and CSV cover the need until someone asks for a report by email, which depends on the email-delivery ADR that Sprint 12 also deferred.

## What This Document Does Not Cover

Query shapes, tRPC signatures, chart layout and colours — implementation after ratification. Product-usage telemetry (PostHog), financial accounting (invoicing, cash, margins — the platform records no costs), per-person productivity indicators, and benchmarks across tenants are out of scope.

## References

- [PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md) — _Reports_ and _Analytics_ assigned to Andes Analytics.
- [RFC-001](../rfc/0001-multi-tenant-architecture.md) — tenant isolation, which aggregates must respect.
- `sprint-2-domain-model.md` … `sprint-7-domain-model.md` — the entities these indicators read.
- [sprint-14.md](../sprints/sprint-14.md) — the sprint plan this model belongs to.
