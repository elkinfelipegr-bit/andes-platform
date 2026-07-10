# Sprint 6 — Proposal

**Status:** Accepted — ratified by the CTO on 2026-07-10 as proposed, including the domain model with its four recommendations.
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

## References

- [sprint-6-domain-model.md](../architecture/sprint-6-domain-model.md) — the domain and the ADR-001 evaluation this sprint implements.
- [sprint-5.md](sprint-5.md) — closed; the lifecycle/print/project-record precedents.
- [engineering-principles.md](../foundation/engineering-principles.md) — workflow and sprint philosophy.
