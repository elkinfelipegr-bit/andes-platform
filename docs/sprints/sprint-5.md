# Sprint 5 — Proposal

**Status:** Proposed — awaiting CTO ratification. No implementation until accepted, per the Golden Rule in [PROJECT_RULES.md](../foundation/PROJECT_RULES.md).
**Drafted:** 2026-07-09
**Objective (proposed):** Inspection Module MVP — scheduled site inspections with severity-graded findings and a printable report, inside projects.

---

## Context

[PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md) sequences Sprint 5 as the **Inspection Module**. It is the first engineering record attached to the Sprint 2 project container — the pattern Structures/Geo/BIM will repeat — and it reuses two Sprint 4 precedents wholesale: the forward-only frozen lifecycle and the print-view deliverable. The domain model is drafted in [sprint-5-domain-model.md](../architecture/sprint-5-domain-model.md) and is ratified together with this plan.

## Proposed Scope

1. **Domain & data layer** (`packages/db`): `Inspection` + `Finding` + `InspectionStatus`/`FindingSeverity` enums per the domain model — migration, RLS (strict pattern), isolation tests extended.
2. **API** (`packages/api`, `routers/projects/`): `inspections` router — `list` (project/status filters), `get`, `create` (schedule; inspector membership-verified, project non-archived), `update` (SCHEDULED-only; findings replaced atomically), `complete` (stamps `performedAt`), `cancel`. A `members` helper query (tenant's users for the inspector picker) on `core`. Schemas unit-tested; integration tests for the lifecycle, transition denials, inspector-verification, and cross-tenant sweeps.
3. **UI** (`apps/core`): Projects gains in-module tabs (Projects | Inspections) — second use of the Sprint 4 navigation pattern. `/projects/inspections` list (code, project, inspector, date, findings count, status) + detail: editor while SCHEDULED (fields + findings rows with severity select), frozen **report view with Print** after. Project detail gains an inspections section; dashboard adds a scheduled-inspections card.
4. **`@andes/ui` growth as needed** — anticipated: none; severity renders on the existing Badge variants.

## Out of Scope

- Photos/attachments — pending the object-storage ADR (domain model, open question 2).
- Finding resolution/follow-up workflow; checklist/inspection templates; recurring schedules.
- Client-facing report delivery (email/portal) — the printable view is the deliverable.
- Inspector workload views/calendars.

## Testing Commitments

Same bar as Sprints 2–4: strict-tier tenant isolation for both new tables; schema unit tests; integration coverage of schedule → record findings → complete, the frozen-state denials, cancel, inspector-not-a-member rejection, archived-project rejection, and cross-tenant denials.

## Open Decisions for the CTO

1. **Ratify the domain model** — including its four recommendations (human-assigned codes; photos deferred pending storage ADR; finding follow-up deferred; inspector as membership-verified User).
2. **Ratify this scope** — trim candidates if long: dashboard card first, project-detail section second.

## References

- [sprint-5-domain-model.md](../architecture/sprint-5-domain-model.md) — the domain this sprint implements.
- [sprint-4.md](sprint-4.md) — closed; the lifecycle/print/navigation patterns this reuses.
- [sprint-2.md](sprint-2.md) — closed; the project container this attaches to.
- [engineering-principles.md](../foundation/engineering-principles.md) — workflow and sprint philosophy.
