# Sprint 6 Domain Model — Structural Module

**Version:** 1.0
**Status:** Draft — awaiting CTO ratification alongside [sprint-6.md](../sprints/sprint-6.md).
**Part of:** `docs/architecture/`, following the DDD workflow in [architecture-principles.md](../foundation/architecture-principles.md)

---

## Purpose

Walks the DDD sequence for the first slice of Andes Structures ([PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md), Sprint 6: Structural Module). This is the platform's first **calculation** domain, so this document also records the evaluation [ADR-001](../adr/0001-technology-stack.md) demanded before any numerical work: whether a dedicated numerical service (outside the TypeScript stack) is needed. **Conclusion: not for this scope — see "Numerical Computation Evaluation" below.**

## Business

A structural firm's core deliverable behind every project is the **memoria de cálculo** — the documented engineering basis: design code and criteria, materials, and the element design checks that justify the drawings. Today this lives in Excel/Mathcad sheets and Word documents, disconnected from the project record, unversioned, and re-built from scratch per project. The platform must make the calculation record a first-class project record — structured criteria, deterministic design checks with stored evidence, and a printable memoria — with one principle above all ([engineering-philosophy.md](../foundation/engineering-philosophy.md), principle 6): **the platform computes; the engineer reviews, decides, and signs.**

## Numerical Computation Evaluation (ADR-001 exception check)

ADR-001's Exceptions section anticipates that "specialized, computationally heavy structural or geotechnical analysis (e.g. finite element computation) may eventually justify a dedicated numerical service" with its own ADR. Evaluation for this sprint's scope:

- The Sprint 6 calculations are **closed-form algebraic design checks** (NSR-10 flexure equations: quadratic formula, square roots, bounded iteration nowhere). No matrices, no solvers, no FEM.
- TypeScript executes these exactly and fast; correctness is guaranteed by exhaustive unit tests against hand-worked known answers (the mandatory tier for calculation logic per [PROJECT_RULES.md](../foundation/PROJECT_RULES.md)).
- **Therefore: no dedicated-service ADR is triggered.** The trigger remains documented and will fire when structural _analysis_ (FEM, ETABS/SAFE integration) enters scope — that work must not start without that ADR.

## Processes

1. An engineer creates a calculation record for a project: code, title, design code (NSR-10 default), material properties (f'c, fy), criteria notes.
2. The engineer adds **design checks**. First check type: **RC rectangular beam flexural design** — inputs (b, h, cover, Mu; materials from the record) → the platform computes required steel area, reinforcement ratio, and the ρmin/ρmax verdicts per NSR-10 C.10. Inputs **and outputs** are stored together at compute time.
3. The engineer reviews and **issues** the record: `DRAFT → ISSUED`, frozen — it is now evidence — and printable as the memoria (the ratified print-view pattern), carrying the responsible-engineer line.
4. A correction to an issued record is a **new record** (the proposal-revision precedent); no un-issue.
5. (Later sprints) more check types (columns, slabs, footings), load combinations, and — behind its own ADR — analysis/FEM integration.

## Domain Concepts

- **CalcRecord** — the memoria de cálculo: tenant-scoped, project-owned, `DRAFT → ISSUED` forward-only, editable only in DRAFT.
- **BeamFlexureCheck** — one designed element line: label ("Viga eje 3, luz 2"), geometry inputs, and the stored computed outputs with a verdict (`OK`, `USE_MIN` — minimum steel governs, `INCREASE_SECTION` — over-reinforced/section insufficient).
- **Check library** — pure TypeScript functions in a new `@andes/structures` workspace package: no DB, no I/O, exhaustively unit-tested. The API is their only caller; the UI never computes.

## Entities (draft sketch)

| Entity             | Key Fields                                                                                                                                                                  | Notes                                                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CalcRecord`       | `id`, `tenantId`, `projectId`, `code`, `title`, `designCode` (default `NSR-10`), `fc`, `fy` (Decimal, MPa), `notes?`, `status`, `issuedAt?`, `createdById`, timestamps      | Project-required; per-tenant human code (precedent). Materials live on the record — checks inherit them. `issuedAt` stamped by issue.                    |
| `BeamFlexureCheck` | `id`, `tenantId`, `calcRecordId`, `position`, `label`, inputs: `b`, `h`, `cover` (mm), `mu` (kN·m) — outputs: `d`, `requiredAs` (mm²), `rho`, `rhoMin`, `rhoMax`, `verdict` | All Decimal. **Outputs stored at compute time** — an issued record is immutable evidence, not a re-computation. Own `tenantId`; cascade with its record. |

`CalcRecordStatus` (`DRAFT`, `ISSUED`) and `CheckVerdict` (`OK`, `USE_MIN`, `INCREASE_SECTION`) are Prisma enums — the ratified reasoning.

## Relationships

```
Project 1 ──── N CalcRecord 1 ──── N BeamFlexureCheck
```

Same-tenant enforced at the application layer + RLS throughout; archived projects accept no new records (the Sprint 5 precedent). Future check types are sibling tables under the same record — a typed table per check type, not a generic JSON blob, so evidence stays queryable and schema-checked.

## Roles & Permissions (role-level only, consistent with Sprints 0–5)

- `OWNER_ADMIN` and `ENGINEER`: create/edit drafts, add/remove checks, issue. Producing calculations is the engineering staff's core work — no new gate.
- No hard delete; no un-issue. The printed memoria carries: _"Cálculos generados por Andes Platform — revisados y aprobados por el ingeniero responsable."_

## Open Questions for Ratification

1. **Scope shape: records + first check type vs. records only.** Recommendation: **include the beam flexure check** — a memoria without any computation is a document manager; one exhaustively-tested check type establishes the calculation pattern every later type repeats.
2. **Dedicated numerical service ADR now?** Recommendation: **no** — per the evaluation above; the trigger stays documented for analysis/FEM.
3. **Calculation code location.** Recommendation: **new `@andes/structures` workspace package** — the first product-specific package (ADR-004 boundaries): pure functions, zero dependencies, unit tests as the contract.
4. **Stored outputs vs. recompute-on-read.** Recommendation: **stored at compute time** — an issued memoria is legal/professional evidence of what was calculated then; a formula fix in the library must never silently rewrite history (a new record recomputes).

## What This Document Does Not Cover

Prisma/RLS syntax, tRPC signatures, screen design, and the exact NSR-10 equations (they live, cited, in `@andes/structures` source and its tests) — implementation after ratification. UI: `/structures` goes live in the sidebar (its first module needs no in-module tabs yet).

## References

- [ADR-001](../adr/0001-technology-stack.md) — the Exceptions clause this document evaluates.
- [engineering-philosophy.md](../foundation/engineering-philosophy.md) — principle 6: the engineer decides.
- [sprint-5-domain-model.md](sprint-5-domain-model.md) / [sprint-4-domain-model.md](sprint-4-domain-model.md) — the lifecycle, print-view, and line-record precedents.
- [sprint-6.md](../sprints/sprint-6.md) — the sprint plan this model belongs to.
