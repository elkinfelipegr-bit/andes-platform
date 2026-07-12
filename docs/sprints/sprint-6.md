# Sprint 6 — Structural Module

**Status:** Closed — 2026-07-11
**Ratified:** 2026-07-10 (as proposed, including the domain model's four recommendations)
**Drafted:** 2026-07-10
**Objective (proposed):** Structural Module MVP — calculation records (memorias de cálculo) with the first deterministic design check (RC beam flexure per NSR-10) and a printable memoria.

---

## Context

[PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md) sequences Sprint 6 as the **Structural Module** — the platform's first calculation domain and the reason the AI module waits until the engineering domains are well-modeled ([ai-principles.md](../foundation/ai-principles.md)). The domain model is drafted in [sprint-6-domain-model.md](../architecture/sprint-6-domain-model.md), including the ADR-001 numerical-computation evaluation (conclusion: closed-form checks stay in TypeScript; the dedicated-service ADR trigger waits for FEM/analysis). Ratified together with this plan.

## Proposed Scope

1. **`@andes/structures` package** — the first product-specific workspace package (ADR-004 boundaries): `beamFlexure()` as a pure function implementing NSR-10 C.10 flexural design (φ=0.90, ρmin, tension-controlled ρmax via β1), plus **exhaustive known-answer unit tests** hand-worked from the code equations — the mandatory tier for calculation logic, treated as the function's contract.
2. **Domain & data layer** (`packages/db`): `CalcRecord` + `BeamFlexureCheck` + `CalcRecordStatus`/`CheckVerdict` enums per the domain model — Decimal columns throughout, migration + RLS (strict pattern), isolation tests extended.
3. **API** (`packages/api`, `routers/structures/`): `calcRecords` router — `list` (project/status filters), `get`, `create` (project non-archived), `update` (DRAFT-only; record fields), `issue` (stamps `issuedAt`, freezes); check procedures `addCheck`/`updateCheck`/`removeCheck` (DRAFT-only) that **compute server-side via `@andes/structures`** and store inputs + outputs together. Schemas unit-tested; integration tests for the lifecycle, computed-output correctness end to end, frozen-state denials, and cross-tenant sweeps.
4. **UI** (`apps/core`): **Structures** goes live in the sidebar — records list (code, project, title, checks count, status) + detail: criteria form and checks table with an add/edit dialog showing computed results (required As, ρ bounds, verdict badge) while DRAFT; Issue action; frozen **memoria view with Print** (the ratified pattern) carrying the responsible-engineer line. Project detail gains a calc-records section; dashboard adds a draft-records card.

## Out of Scope

- Structural **analysis**: FEM, load combinations, ETABS/SAFE import — each waits for the dedicated-service ADR the domain model documents.
- Additional check types (columns, slabs, footings, shear) — they repeat this sprint's pattern in later sprints.
- Record revision linking (supersedes); PDF files (storage ADR); rebar bar-selection suggestions.

## Testing Commitments

The strictest sprint yet: `beamFlexure()` gets exhaustive known-answer unit tests (normal case, minimum-steel governs, over-reinforced, β1 breakpoint at f'c = 28 MPa, input validation); tenant isolation at the strict tier for both tables; integration coverage of create → add checks (outputs verified against the library) → issue → frozen denials → cross-tenant sweep.

## Open Decisions for the CTO

1. **Ratify the domain model** — including its four recommendations (include the beam check; no numerical-service ADR yet; `@andes/structures` package; stored outputs as immutable evidence).
2. **Ratify this scope** — trim candidates if long: dashboard card first, project-detail section second (the check + memoria are the core).

## Retrospective (closure, 2026-07-11)

**Objective met — the platform's first calculation domain shipped to production across four CI-gated PRs** (library → data → API → UI):

- **PR #30 — `@andes/structures`:** the first product-specific package. `beamFlexure()` as a pure function (NSR-10 C.10: φ=0.90 tension-controlled, ρmin both branches, ρmax at εt=0.005 via β1 with the 0.65 floor; infeasible and over-reinforced both **reject** rather than silently switching assumptions), with **12 hand-worked known-answer tests as the contract**.
- **PR #31 — data layer:** `CalcRecord` + `BeamFlexureCheck` with inputs **and outputs stored together** (nullable outputs for the infeasible path); strict RLS; suite extended.
- **PR #32 — API:** the server as the library's only caller; material changes recompute every check; issue requires ≥1 check, stamps `issuedAt`, freezes. Integration suite verifies stored outputs against a direct library call.
- **PR #33 — UI:** `/structures` live — criteria editor, checks with verdict badges (the UI never computes), Issue, and the frozen memoria print view carrying the responsible-engineer line.

**ADR-001 evaluation held:** closed-form checks stayed in TypeScript; the dedicated-numerical-service ADR trigger remains documented and mandatory before FEM/analysis/ETABS work.

**Verification:** known-answer + integration suites in CI (merge-gated); production rollout with Neon migrations, `andes_app` grants verified, smoke test green. **CTO approval on production (2026-07-11) closes the sprint.**

**Deviations:** none against scope. Operational note: `f'c` in JSX needs `&apos;` (react/no-unescaped-entities) — caught by lint before merge.

**Carry-over:**

1. More check types (columns, slabs, footings, shear) — each repeats this sprint's pattern.
2. Load combinations; record revision linking; rebar selection suggestions.
3. FEM/analysis + ETABS/SAFE integration — **blocked on the dedicated-numerical-service ADR** by ratified decision.
4. Standing items from Sprints 1–5.

## References

- [sprint-6-domain-model.md](../architecture/sprint-6-domain-model.md) — the domain and the ADR-001 evaluation this sprint implements.
- [sprint-5.md](sprint-5.md) — closed; the lifecycle/print/project-record precedents.
- [engineering-principles.md](../foundation/engineering-principles.md) — workflow and sprint philosophy.
