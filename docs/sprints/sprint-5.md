# Sprint 5 — Inspection Module

**Status:** Closed — 2026-07-10
**Ratified:** 2026-07-09 (as proposed, including the domain model's four recommendations)
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

## Retrospective (closure, 2026-07-10)

**Objective met — all four scope items shipped to production across three CI-gated PRs** (domain → data → API → UI):

- **PR #25 — data layer:** `Inspection` + `Finding` with the strict RLS pattern; migrations hand-written to Prisma conventions (Docker stays off on this machine); isolation suite extended.
- **PR #26 — API:** full forward-only lifecycle (SCHEDULED-only edits with atomic findings replacement, `complete` stamping `performedAt`, `cancel` terminal), **inspector verified against `Membership`** — the platform's first User-reference validation beyond the session, re-verified on swap — archived projects rejecting new inspections, `core.members` as the reusable staff-picker query, and `projects.get` joining its inspections. Integration suite: lifecycle, frozen-state denials, non-member/archived/duplicate rejections, cross-tenant sweep, members scoping.
- **PR #27 — UI:** Projects in-module tabs (second case of the navigation.md pattern), `/projects/inspections` list + schedule dialog, detail with findings editor (severity-graded rows) and the frozen **report view with Print**, project-detail section, dashboard scheduled card.

**Verification:** unit tier locally; integration in CI (merge-gated); production rollout with Neon migrations, `andes_app` grants on both tables verified, smoke test green. **CTO functional pass on production (2026-07-10) closes the sprint.**

**Deviations:** none against scope. Operational note: the production build outgrew a 3 GB heap — local builds now need `NODE_OPTIONS=--max-old-space-size=4096` (recorded).

**Carry-over:**

1. Photos/attachments on findings — blocked on the object-storage ADR (shared with proposal PDFs).
2. Finding resolution/follow-up workflow; inspection checklists/templates.
3. Standing items from Sprints 1–4.

## References

- [sprint-5-domain-model.md](../architecture/sprint-5-domain-model.md) — the domain this sprint implements.
- [sprint-4.md](sprint-4.md) — closed; the lifecycle/print/navigation patterns this reuses.
- [sprint-2.md](sprint-2.md) — closed; the project container this attaches to.
- [engineering-principles.md](../foundation/engineering-principles.md) — workflow and sprint philosophy.
