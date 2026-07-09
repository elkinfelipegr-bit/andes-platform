# Sprint 4 — Proposal

**Status:** Proposed — awaiting CTO ratification. No implementation until accepted, per the Golden Rule in [PROJECT_RULES.md](../foundation/PROJECT_RULES.md).
**Drafted:** 2026-07-08
**Objective (proposed):** Proposal Generator MVP — itemized commercial proposals with lifecycle tracking and conversion to projects.

---

## Context

[PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md) sequences Sprint 4 as **Proposal Generator**. Its two dependencies are live: clients/contacts (Sprint 3) to address proposals to, and projects (Sprint 2) for accepted proposals to convert into. The domain model is drafted in [sprint-4-domain-model.md](../architecture/sprint-4-domain-model.md) and is ratified together with this plan.

## Proposed Scope

1. **Domain & data layer** (`packages/db`): `Proposal` + `ProposalItem` + `ProposalStatus` enum per the domain model — migration, RLS policies (strict pattern), Decimal money columns, strict-tier isolation tests extended.
2. **API** (`packages/api`, `routers/crm/`): `proposals` router — `list` (status filter), `get` (with items + computed total), `create`, `update` (DRAFT only, items replaced transactionally), `send`, `decide` (accept/reject), `markExpired`, `convertToProject` (creates linked DRAFT project, once). Same-tenant client/contact verification; forward-only transitions enforced. Schemas unit-tested; integration tests for the lifecycle path, transition denials, conversion, and cross-tenant sweeps.
3. **UI** (`apps/core`): `/crm/proposals` list (code, client, title, total, status, validity) + detail page — item editor while DRAFT, read-only once SENT, action bar per status (send / accept / reject / expire / convert), **print-optimized view** as the MVP "generated document". CRM client detail gains a proposals section; in-module CRM navigation (Clients | Proposals) per the navigation.md amendment. Dashboard: proposals-awaiting-decision count card.
4. **`@andes/ui` growth as needed** — anticipated: none beyond what exists; a table-footer/total row style at most.

## Out of Scope

- PDF file generation, storage, templates, branding of the printed document — deferred pending an object-storage ADR (domain model, open question 2).
- Emailing/sending the proposal from the platform; e-signatures.
- Proposal revisions/versioning (a revision is a new proposal for now) and copy-from-existing.
- Pricing catalogs, taxes/IVA breakdown, discounts — itemized subtotal only this sprint.

## Testing Commitments

Same bar as Sprints 2–3: tenant-isolation logic at the strict tier (RLS on both new tables, cross-tenant denial sweep); Zod schemas and the total-computation logic unit-tested; the draft → send → accept → convert path integration-tested, including transition denials (edit after SENT, decide from DRAFT, double conversion).

## Open Decisions for the CTO

1. **Ratify the domain model** — including its four recommendations (line items with computed totals; PDF deferred in favor of a print view; forward-only transitions; conversion creating a linked DRAFT project).
2. **Ratify this scope** — trim candidates if it runs long: the dashboard card first, the in-module CRM navigation second (list can hang off `/crm` links).

## References

- [sprint-4-domain-model.md](../architecture/sprint-4-domain-model.md) — the domain this sprint implements.
- [sprint-3.md](sprint-3.md) — closed; clients/contacts this builds on.
- [sprint-2.md](sprint-2.md) — closed; the Project conversion target.
- [engineering-principles.md](../foundation/engineering-principles.md) — workflow and sprint philosophy.
