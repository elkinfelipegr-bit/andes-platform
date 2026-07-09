# Sprint 3 — CRM Module

**Status:** Closed — 2026-07-08
**Drafted:** 2026-07-08 · **Ratified:** 2026-07-08 (as proposed, including the domain model's three recommendations)
**Objective:** CRM module MVP — client and contact management on the Andes Core shell.

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

## Retrospective (closure, 2026-07-08)

**Objective met — all four scope items shipped to production across three CI-gated PRs** (domain → data → API → UI):

- **PR #15 — data layer:** additive `Client` enrichment + new `contact` table under the strict RLS pattern; isolation suite extended to 14 cases. The migration SQL was hand-written to Prisma's generated conventions because local Docker refused to start (see Deviations) — CI's `migrate deploy` + full suite validated it.
- **PR #16 — API:** `clients` router relocated to `routers/crm/` (CRM owns `Client`; appRouter key unchanged so Sprint 2 UI kept working) and grown with `get`/`update`/`archive`/`list(includeArchived)`; new `contacts` router (create/update/hard-delete). Integration suite covers enrichment CRUD, contact lifecycle, the archive role gate with project non-cascade, and a cross-tenant denial sweep.
- **PR #17 — UI:** `/crm` live — clients list with show-archived toggle, detail page (data form, contacts add/edit/delete, client's projects), cross-links from Projects, dashboard clients-count card, `Textarea` in `@andes/ui`.

**Verification:** unit tier locally; integration tier in CI (merge-gated — same guarantee); production rollout with Neon migrations applied (unpooled URL), `andes_app` grants on `contact` verified, smoke test green. **CTO functional verification on production ("quedó funcionando", 2026-07-08) closes the sprint.**

**Deviations:** browser E2E could not run locally — Docker Desktop hung on startup and its memory pressure OOM-killed Next builds on this 8 GB machine (remedy recorded: don't run Docker and builds concurrently; `wsl --shutdown` clears the hang). Verification shifted to CI integration + CTO's production pass. No scope deviations.

**Carry-over:**

1. NIT check-digit validation (UX nicety, no migration needed).
2. Client list search/pagination — with real data volume.
3. Contact soft-delete revisit — flagged for when proposals reference contacts (Sprint 4).
4. Standing items from Sprints 1–2 (invite flow, mobile nav, dark tokens, project search).

## References

- [sprint-3-domain-model.md](../architecture/sprint-3-domain-model.md) — the domain this sprint implements.
- [sprint-2.md](sprint-2.md) — closed; the registry and patterns this builds on.
- [engineering-principles.md](../foundation/engineering-principles.md) — workflow and sprint philosophy.
