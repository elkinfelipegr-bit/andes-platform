# Sprint 13 — Proposal

**Status:** Proposed — awaiting CTO ratification. Depends on [ADR-010](../adr/0010-numerical-service.md); nothing here starts until that ADR is accepted.
**Drafted:** 2026-11-13
**Objective (proposed):** Calculation Engine MVP — the Python numerical service in production behind tRPC, proven end to end with one capability: section properties for arbitrary and built-up sections in Andes Structures.

---

## Context

On 2026-11-13 the CTO asked for the platform to be complemented with the open-source engineering libraries the firm uses, to make it more robust. They are all Python, which fires the trigger [ADR-001](../adr/0001-technology-stack.md) and [sprint-6-domain-model.md](../architecture/sprint-6-domain-model.md) reserved. [ADR-010](../adr/0010-numerical-service.md) proposes how; this sprint proposes the smallest slice that makes the decision real.

The slice is chosen to exercise **every** rule in ADR-010 once — contract, tenant-blind engine, versioned evidence, known-answer tests, CI, deployment — with the least engineering-judgment risk. Section properties qualify: pure mechanics with no design-code factors, results checkable against published shape tables, and an MIT-licensed library.

## Proposed Scope

1. **Engine** (`services/calc`): FastAPI service, pinned dependencies, `/v1/section-properties` (plate/rectangle composition → area, centroid, Ix/Iy, section moduli, radii of gyration, mesh SVG), version endpoint, shared-key auth. `pytest` known-answer suite against published values for standard shapes (strict tier — calculation logic).
2. **Contract & CI**: OpenAPI schema committed; TypeScript client + Zod schemas verified against it in CI; new Python CI job (lint, types, tests).
3. **Domain & data layer** (`packages/db`): a `SectionCheck` on `CalcRecord`, mirroring `BeamFlexureCheck` — inputs, outputs, **engine and library versions**, own `tenantId`, RLS, isolation suite extended. Detail in a `sprint-13-domain-model.md` to be drafted on ratification of this scope.
4. **API** (`packages/api`): `sectionChecks` procedures under the existing calc-record rules (DRAFT-only edits, frozen on issue); engine boundary mocked in integration tests; tenant sweeps.
5. **UI** (`apps/core`): section check on the calculation record page — plate table input, result panel with the mesh figure; printed memoria cites engine/library versions.
6. **Deployment**: per ADR-010 Open Decision 1.

## Out of Scope

- Frame/FEM analysis, OpenSees, RC interaction diagrams, DXF/despiece, cutting optimisation, IFC audit — each is a later sprint with its own domain model. Proposed order after this one: **(14)** rebar schedule + DXF export + bar-cutting optimisation (`ezdxf`, `ortools`); **(15)** linear frame analysis (`PyNiteFEA`); **(16)** IFC quantities and audit (`ifcopenshell`).
- Porting `@andes/structures` / `@andes/geo` checks to Python (ADR-010 rule 8).
- Any library under GPL or the OpenSeesPy licence (ADR-010 Open Decisions 2–3).

## Testing Commitments

Strict tier: engine known-answer tests (published section properties within stated tolerance); `SectionCheck` tenant isolation. Integration: check CRUD with the engine mocked, engine-unavailable handling (the record stays editable, nothing half-stored), frozen-after-issue. Contract test: TypeScript schemas vs. the engine's OpenAPI. Acceptance gate: the CTO computes a real built-up section and compares against an independent calculation.

## Rollout Notes

First sprint since Sprint 9 with a new secret (engine URL + shared key) and possibly a new vendor and monthly cost — both decided in ADR-010, not here.

## Open Decisions for the CTO

1. **Ratify [ADR-010](../adr/0010-numerical-service.md)** and its four open decisions (hosting, OpenSeesPy, GPL libraries, first capability).
2. **Ratify this scope** — or swap the first capability: the alternative with the most day-to-day value is rebar schedule + DXF export (proposed Sprint 14), at the cost of a larger first slice.
3. **Close Sprint 12 first?** Its acceptance gate (inviting a real second account) is still open.

## References

- [ADR-010](../adr/0010-numerical-service.md) — the decision this sprint implements
- [sprint-6-domain-model.md](../architecture/sprint-6-domain-model.md) — `CalcRecord`, evidence storage, the deferred numerical evaluation
- [sprint-12.md](sprint-12.md) — Administration (UI in review)
