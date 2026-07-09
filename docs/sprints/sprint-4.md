# Sprint 4 — Proposal Generator

**Status:** Closed — 2026-07-09
**Ratified:** 2026-07-08 (as proposed, including the domain model's four recommendations)
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

## Retrospective (closure, 2026-07-09)

**Objective met — all four scope items shipped to production across three CI-gated PRs** (domain → data → API → UI):

- **PR #20 — data layer:** `Proposal` + `ProposalItem` with `Decimal(14,2)` money, unique conversion FK, and the strict RLS pattern; isolation suite extended. Migration SQL hand-written to Prisma conventions (Docker stays off on this machine per the Sprint 3 constraint) — CI validated.
- **PR #21 — API:** full forward-only lifecycle (`create`/`update` DRAFT-only with atomic item replacement, `send`, `decide`, `markExpired`) and `convertToProject` — atomic nested create linking an accepted proposal to a new DRAFT project with a user-chosen code. Totals computed with Decimal math, never stored. Integration suite: lifecycle path, every transition denial, double-conversion, cross-tenant sweep.
- **PR #22 — UI:** CRM in-module tabs (navigation.md amendment — the pattern's first case), `/crm/proposals` list + draft editor with live totals, per-status action bar, and the frozen **print view** as the MVP generated document (shell `print:hidden`). Client detail and dashboard integration.

**Verification:** unit tier locally (Decimal totals incl. float-drift case, schemas); integration in CI (merge-gated); production rollout with Neon migrations, `andes_app` grants verified, smoke test green. **CTO functional pass on production (2026-07-09) closes the sprint.**

**Deviations:** none against scope. Two operational notes recorded for the future: a commit accidentally landed on local `main` and was relocated to its branch before pushing (branch protection would have rejected the push regardless), and `z.coerce.number()` breaks React Hook Form resolver typing under Zod 4 — numeric form fields stay strings client-side.

**Carry-over:**

1. PDF file generation + object storage — needs its own ADR (S3 per ADR-001) when prioritized; print view covers the need meanwhile.
2. Proposal revisions/copy-from-existing; taxes/IVA breakdown and discounts.
3. Standing items from Sprints 1–3.

## References

- [sprint-4-domain-model.md](../architecture/sprint-4-domain-model.md) — the domain this sprint implements.
- [sprint-3.md](sprint-3.md) — closed; clients/contacts this builds on.
- [sprint-2.md](sprint-2.md) — closed; the Project conversion target.
- [engineering-principles.md](../foundation/engineering-principles.md) — workflow and sprint philosophy.
