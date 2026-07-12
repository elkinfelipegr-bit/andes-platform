# Sprint 7 Domain Model — Geotechnical Module

**Version:** 1.0
**Status:** Accepted — ratified by the CTO on 2026-07-11 as proposed, including the domain model's five recommendations.
**Part of:** `docs/architecture/`, following the DDD workflow in [architecture-principles.md](../foundation/architecture-principles.md)

---

## Purpose

Walks the DDD sequence for the first slice of Andes Geo ([PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md), Sprint 7: Geotechnical Module). It is the second calculation domain and deliberately **repeats the Sprint 6 pattern wholesale** — record + typed checks + frozen memoria — proving that pattern generalizes across engineering disciplines. The ADR-001 numerical evaluation is re-run for this scope below.

## Business

A geotechnical firm's deliverable behind every foundation design is the **estudio geotécnico**: soil characterization and the foundation recommendations it supports — above all, the **allowable bearing capacity** each footing can be designed against. Today the capacity calculations live in spreadsheets detached from the study document. The platform must make the geotechnical record a first-class project record with deterministic, evidenced bearing-capacity checks and a printable memoria — under the same principle: **the platform computes; the engineer reviews, decides, and signs.**

## Numerical Computation Evaluation (ADR-001 exception check, second pass)

The Sprint 7 calculations are the **general bearing capacity equation** with closed-form factors (exponentials and trigonometry — no matrices, no solvers, no seepage/consolidation numerics). Same conclusion as Sprint 6: **TypeScript with hand-worked known-answer tests; no dedicated-service ADR triggered.** The trigger remains for numerical seepage/consolidation/slope-stability analysis, which must not start without that ADR.

## Processes

1. An engineer creates a geotechnical record for a project: code, title, notes on exploration and criteria.
2. The engineer adds **bearing capacity checks** — one per footing/soil situation: geometry (B, Df, footing shape), soil parameters (γ, c, φ), and safety factor → the platform computes the Vesic bearing factors, ultimate capacity q_ult, and allowable capacity q_adm. Inputs **and outputs** stored together (the Sprint 6 evidence rule).
3. The engineer reviews and **issues**: `DRAFT → ISSUED`, frozen, printable as the memoria with the responsible-engineer line and the stated assumptions.
4. A correction is a new record. No un-issue.
5. (Later sprints) borehole/stratigraphy data (sondeos, SPT logs), settlement checks, water-table corrections, slope stability — the last behind the numerical-service ADR.

## Domain Concepts

- **GeoRecord** — the estudio's calculation record: tenant-scoped, project-owned, `DRAFT → ISSUED`, editable only in DRAFT. Unlike `CalcRecord`, it carries **no record-level material properties**: soil parameters vary per footing/stratum, so they live on each check.
- **BearingCheck** — one footing situation: label, geometry, soil parameters, FS → stored factors and capacities, with a verdict-free result (capacity design has no pass/fail at this stage — the structural engineer compares demand later; flagging is a future refinement).
- **Check library** — `bearingCapacity()` in a new `@andes/geo` package: pure, exhaustively unit-tested against published Vesic factor tables (φ=30° → Nq=18.40, Nc=30.14, Nγ=22.40) and the φ=0 undrained-clay closed form (Nc=5.14).

## Entities (draft sketch)

| Entity         | Key Fields                                                                                                                                                                                  | Notes                                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GeoRecord`    | `id`, `tenantId`, `projectId`, `code`, `title`, `notes?`, `status`, `issuedAt?`, `createdById`, timestamps                                                                                  | Project-required; per-tenant human code; `DRAFT → ISSUED` (Sprint 6 precedent verbatim).                                                                                      |
| `BearingCheck` | `id`, `tenantId`, `geoRecordId`, `position`, `label`, inputs: `b` (m), `df` (m), `gamma` (kN/m³), `c` (kPa), `phi` (°), `fs`, `shape` — outputs: `nc`, `nq`, `ngamma`, `qUlt`, `qAdm` (kPa) | All Decimal; outputs stored at compute time. `shape` is a Prisma enum (`STRIP`, `SQUARE`) — rectangular B/L and circular come later. Own `tenantId`; cascade with its record. |

## Relationships

```
Project 1 ──── N GeoRecord 1 ──── N BearingCheck
```

Same-tenant enforcement + RLS as everywhere; archived projects accept no new records. Future check types (settlement, deep foundations) are sibling typed tables.

## Roles & Permissions (role-level only, consistent with Sprints 0–6)

`OWNER_ADMIN` and `ENGINEER`: full draft workflow and issue. No hard delete; no un-issue. The printed memoria carries the responsible-engineer line **plus the stated assumption**: _"Nivel freático supuesto por debajo de la zona de influencia — verificar en sitio"_ (water table below the influence zone — see open question 4).

## Open Questions for Ratification

1. **First check type: shallow-foundation bearing capacity** (general equation, Vesic factors, De Beer shape factors for strip/square). Recommendation: **yes** — the geotechnical counterpart of Sprint 6's beam check, and the number every structural design consumes.
2. **Dedicated numerical service ADR now?** Recommendation: **no** — per the evaluation above; unchanged trigger.
3. **Borehole/stratigraphy data (sondeos, SPT logs) now vs. later.** Recommendation: **defer** — field-exploration data entry is its own objective (and pairs naturally with the photos/storage ADR); the capacity checks don't require it to be valuable.
4. **Water-table correction.** Recommendation: **defer, stated as an assumption** printed on every memoria — the correction is a bounded future enhancement to the same function; hiding the assumption would be the real risk.
5. **Calculation code location: new `@andes/geo` package.** Recommendation: **yes** — one package per product (ADR-004), same conventions as `@andes/structures`.

## What This Document Does Not Cover

Prisma/RLS syntax, tRPC signatures, screen design, exact equations (they live, cited, in `@andes/geo` and its tests) — implementation after ratification. UI: `/geo` goes live in the sidebar, mirroring `/structures`.

## References

- [sprint-6-domain-model.md](sprint-6-domain-model.md) — the calculation-domain pattern this repeats; the ADR-001 evaluation precedent.
- [ADR-001](../adr/0001-technology-stack.md) — the Exceptions clause re-evaluated here.
- [sprint-7.md](../sprints/sprint-7.md) — the sprint plan this model belongs to.
