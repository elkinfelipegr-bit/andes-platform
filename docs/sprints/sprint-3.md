# Sprint 3 — Proposal

**Status:** Proposed — awaiting CTO ratification. No implementation until accepted, per the Golden Rule in [PROJECT_RULES.md](../foundation/PROJECT_RULES.md).
**Drafted:** 2026-07-08
**Objective (proposed):** CRM module MVP — client and contact management on the Andes Core shell.

---

## Context

[PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md) sequences Sprint 3 as **CRM**. Sprint 2 left `Client` deliberately minimal so CRM could enrich it without a breaking migration; the domain model for that enrichment plus the new `Contact` entity is drafted in [sprint-3-domain-model.md](../architecture/sprint-3-domain-model.md) and is ratified together with this plan.

## Proposed Scope

1. **Domain & data layer** (`packages/db`): additive `Client` enrichment (taxId, industry, address, city, phone, email, notes, archivedAt, updatedAt) and new `Contact` entity — migration + RLS policies for `contact` (same strict pattern as Sprint 2), strict-tier isolation tests extended.
2. **API** (`packages/api`): `clients` router grows — `get` (with contacts + projects), `update`, `archive` (`roleProcedure(OWNER_ADMIN)`); `list` gains an include-archived flag and keeps active-only as the default (the project form's picker stays clean). New `contacts` sub-procedures: `create`, `update`, `delete` (both roles). Zod schemas unit-tested; integration tests for the enriched CRUD paths and cross-tenant denials, including contact-under-foreign-client rejection.
3. **UI** (`apps/core`): enable **CRM** in the sidebar — clients list (name, taxId, city, projects count, archived state), client detail page with three sections: data (edit form), contacts (inline add/edit/delete), and the client's projects (linking back to `/projects/[id]`). Project pages link client names to the CRM detail. Dashboard: CRM placeholder card becomes a live clients count.
4. **`@andes/ui` growth as needed** — expected: `Textarea` (notes fields); everything else reuses the Sprint 2 set.

## Out of Scope

- Opportunities/pipeline and proposal generation — Sprint 4 (Proposal Generator) per the sequence.
- Contact ↔ platform-User linkage / client portal — waits for the deferred `CLIENT_VIEWER` role design.
- NIT check-digit validation; client import; deduplication tooling.
- Any change to `Project` beyond linking to CRM detail in the UI.

## Testing Commitments

Same bar as Sprint 2: tenant-isolation logic (RLS on `contact`, enriched `clients` procedures, cross-tenant denials) at the strict tier; Zod schemas unit-tested; the client-enrich → contact-add → detail-view path integration-tested.

## Open Decisions for the CTO

1. **Ratify the domain model** — including its three recommendations (archival doesn't cascade to projects; contact hard-delete; taxId as free text). See [sprint-3-domain-model.md](../architecture/sprint-3-domain-model.md).
2. **Ratify this scope** — or trim: the projects-section on client detail is the first candidate to defer if the sprint runs long (data + contacts are the core).

## References

- [sprint-3-domain-model.md](../architecture/sprint-3-domain-model.md) — the domain this sprint implements.
- [sprint-2.md](sprint-2.md) — closed; the registry and patterns this builds on.
- [engineering-principles.md](../foundation/engineering-principles.md) — workflow and sprint philosophy.
