# Sprint 1 — Andes Core UI Shell

**Status:** Closed — 2026-07-07
**Drafted:** 2026-07-07
**Objective:** Andes Core UI shell — design system foundation, navigation, and the dashboard frame.

**Ratification record (2026-07-07):** the CTO accepted the proposed objective as-is and resolved the open decisions as follows: (1) objective ratified — design system + navigation fold into Sprint 1; (2) brand direction delegated to the recommended starting point, now recorded as the governing doc in [docs/design/design-system.md](../design/design-system.md) — amendable by the CTO at any time; (3) the invite flow stays deferred to a future sprint.

---

## Context

[PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md) sequences Sprint 1 as **Dashboard**. However, its phase table also lists _Design System_ and _Navigation_ under Sprint 0 — and the Sprint 0 that was actually executed and closed ([sprint-0.md](sprint-0.md)) covered foundation, architecture, authentication, CI, and deployment, **not** the design system or navigation. That scope difference was never formally re-planned; it simply fell out of Sprint 0's single objective (per the Sprint Philosophy in [engineering-principles.md](../foundation/engineering-principles.md)).

A dashboard cannot be built without the shell it lives in. This proposal therefore folds the un-executed Sprint 0 UI items into Sprint 1 as one coherent objective.

## Proposed Scope

1. **Design system foundation** (`packages/ui`, planned in [ADR-004](../adr/0004-repository-structure.md)): shadcn/ui + Tailwind tokens per [ADR-001](../adr/0001-technology-stack.md), themed for the Andes brand identity. Governing docs live in `docs/design/` (to be started as part of this sprint).
2. **Navigation shell** (`apps/core`): authenticated layout — sidebar/topbar, tenant + role context surfaced from the session, module navigation stubs for the eight products, sign-out.
3. **Dashboard frame**: the `/dashboard` route rebuilt on the shell. Content limited to what the domain already supports (session identity, tenant, role, membership state) — real dashboard widgets (projects, tasks, analytics) depend on domains that do not exist yet and are explicitly out of scope.

## Out of Scope

- Any feature-module data (Projects, CRM, …) — later sprints per the ratified sequence.
- The invite flow (carry-over noted in [sprint-0.md](sprint-0.md)) — still deferred unless the CTO pulls it in.
- New domain entities. If dashboard design surfaces the need for one, that triggers the DDD → ADR chain first.

## Prerequisites Before Implementation

Per the Development Workflow (Idea → PRD → DDD → ADR → RFC → Sprint Planning → Implementation):

- **Design documentation** — `docs/design/` is 🕓 planned and empty. At minimum: design tokens/brand direction and navigation structure, written before screens are coded ("screens are never designed first" — the navigation shell must be traceable to the module map in PRODUCT_STRATEGY).
- **No new ADRs anticipated** — stack, auth, API, and repo structure already cover this scope. If component-library or theming decisions turn out to be architectural, they get an ADR before implementation.

## Open Decisions for the CTO

Resolved at ratification — see the record at the top of this document.

1. ~~Ratify or amend this objective~~ — ratified as proposed.
2. ~~Brand direction~~ — delegated; recorded in [docs/design/design-system.md](../design/design-system.md).
3. ~~Whether the invite flow joins this sprint~~ — stays deferred.

## Retrospective (closure, 2026-07-07)

**Objective met — proposed, ratified, and shipped to production within a single day.** All three scope items delivered across three PRs, each CI-gated:

- **PR #5 — governing docs first:** [design-system.md](../design/design-system.md) (brand direction, token table, `packages/ui` conventions) and [navigation.md](../design/navigation.md) (shell anatomy, module→route map, access states), honoring "documentation before coding."
- **PR #6 — `@andes/ui`:** Andes tokens (`theme.css` via Tailwind v4 `@theme inline`) and the Sprint 1 component set (Button, Card, Badge, Separator, DropdownMenu, `cn`), matching sibling-package conventions; unit-tested where logic exists.
- **PR #7 — the shell:** `(app)` route group layout with session check; sidebar with the eight-product map (stubs disabled, "Soon" badges); topbar with always-visible tenant + role (RFC-001) and user menu; dashboard frame scoped to session/tenant/role; login restyled; Inter + JetBrains Mono via `next/font`.

**Verification:** local production build + typecheck/lint/tests; token pipeline confirmed in a real browser (Andes Blue + Inter resolving on `@andes/ui` components across the package boundary); production deploy verified live; **visual approval by the CTO on the deployed shell ("quedó perfecto") closes the sprint.**

**Deviations:** none against the ratified scope. The mobile slide-over navigation was exercised as the deferral navigation.md explicitly allows — the desktop-first layout shipped.

**Carry-over:**

1. Invite flow — still deferred (decision at ratification).
2. Mobile slide-over/collapsible sidebar — when a sprint's scope touches the shell again.
3. Dark mode `.dark` token block — token-only change, whenever prioritized.

## References

- [PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md) — sprint sequence and module map.
- [sprint-0.md](sprint-0.md) — closed scope and carry-over.
- [architecture-principles.md](../foundation/architecture-principles.md) — DDD workflow this plan follows.
