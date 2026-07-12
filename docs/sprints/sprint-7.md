# Sprint 7 — Proposal

**Status:** Proposed — awaiting CTO ratification. No implementation until accepted, per the Golden Rule in [PROJECT_RULES.md](../foundation/PROJECT_RULES.md).
**Drafted:** 2026-07-11
**Objective (proposed):** Geotechnical Module MVP — geotechnical records with deterministic bearing-capacity checks and a printable memoria.

---

## Context

[PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md) sequences Sprint 7 as the **Geotechnical Module**. Sprint 6 established the calculation-domain pattern (pure library with known-answer contracts → evidence-storing data layer → server-side computation → frozen printable memoria); this sprint repeats it for Andes Geo, proving the pattern generalizes. The domain model — including the re-run ADR-001 numerical evaluation (conclusion unchanged: closed-form stays in TypeScript) — is drafted in [sprint-7-domain-model.md](../architecture/sprint-7-domain-model.md) and is ratified together with this plan.

## Proposed Scope

1. **`@andes/geo` package:** `bearingCapacity()` as a pure function — general bearing capacity equation with Vesic factors (Nq = e^(π·tanφ)·tan²(45+φ/2); Nc = (Nq−1)·cotφ with the φ=0 → 5.14 closed form; Nγ = 2(Nq+1)·tanφ) and De Beer shape factors for `STRIP`/`SQUARE`; q_adm = q_ult/FS. **Known-answer tests against published factor tables** (φ=30° → Nq=18.40, Nc=30.14, Nγ=22.40; the φ=0 undrained case; input validation) as the contract.
2. **Domain & data layer** (`packages/db`): `GeoRecord` + `BearingCheck` + `GeoRecordStatus`/`FootingShape` enums — Decimal columns, stored outputs, migration + strict RLS, isolation tests extended.
3. **API** (`packages/api`, `routers/geo/`): `geoRecords` router mirroring `calcRecords` — `list`/`get`/`create`/`update` (DRAFT-only)/`issue` (≥1 check) + `addCheck`/`updateCheck`/`removeCheck` computing server-side via `@andes/geo` (no record-level materials → no recompute cascade this time). Schemas unit-tested; integration tests incl. stored-outputs-vs-library verification and cross-tenant sweeps.
4. **UI** (`apps/core`): **Geo** live in the sidebar — records list + detail mirroring `/structures`: notes editor, checks table (geometry + soil parameters in, factors and capacities out), Issue, frozen **memoria with Print** carrying the responsible-engineer line and the stated water-table assumption. Project detail gains a geo-records section; dashboard adds the draft count card.

## Out of Scope

- Borehole/stratigraphy data entry (sondeos, SPT logs) — its own future objective.
- Water-table correction (assumption printed instead), settlement checks, deep foundations, rectangular/circular footings.
- Numerical analysis (seepage, consolidation, slope stability) — **blocked on the dedicated-service ADR**.

## Testing Commitments

Same bar as Sprint 6: known-answer unit tests against published values for `bearingCapacity()`; strict-tier tenant isolation for both tables; integration coverage of the lifecycle with stored outputs verified against a direct library call, frozen-state denials, and cross-tenant sweeps.

## Open Decisions for the CTO

1. **Ratify the domain model** — including its five recommendations (bearing-capacity first check; no numerical ADR; boreholes deferred; water-table as printed assumption; `@andes/geo` package).
2. **Ratify this scope** — trim candidates: dashboard card first, project-detail section second.

## References

- [sprint-7-domain-model.md](../architecture/sprint-7-domain-model.md) — the domain and re-run evaluation this sprint implements.
- [sprint-6.md](sprint-6.md) — closed; the calculation-domain pattern this repeats.
- [engineering-principles.md](../foundation/engineering-principles.md) — workflow and sprint philosophy.
