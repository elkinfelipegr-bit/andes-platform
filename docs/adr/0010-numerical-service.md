# ADR-010: Numerical Service — Python Calculation Engine

**Status:** Proposed — drafted for CTO ratification; nothing below is implemented or binding until accepted.
**Date:** 2026-11-13
**Deciders:** CTO / Lead Software Architect (Andes Engineering)

---

## Context

[ADR-001](0001-technology-stack.md) commits the platform to TypeScript end to end and names one anticipated exception: "specialized, computationally heavy structural or geotechnical analysis … may eventually justify a dedicated numerical service outside this stack (for example, Python with scientific libraries)", requiring its own ADR. [sprint-6-domain-model.md](../architecture/sprint-6-domain-model.md) evaluated that exception and deferred it: closed-form checks (`@andes/structures`, `@andes/geo`) stay in TypeScript, and "the trigger … will fire when structural _analysis_ (FEM, ETABS/SAFE integration) enters scope — that work must not start without that ADR."

On 2026-11-13 the CTO asked for the platform to be complemented with the open-source engineering libraries the firm already relies on, to make it more robust. Every one of them is Python. That request is the trigger.

The candidate libraries were installed together and smoke-tested on Python 3.13 (2026-11-13). What was verified:

| Capability                                   | Library (version tested)                    | License                     | Note                                                                                 |
| -------------------------------------------- | ------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------ |
| Section properties (arbitrary/built-up)      | `sectionproperties` 3.10                    | MIT                         | FE mesh of the cross-section; pulls `shapely`, `scipy`, `matplotlib`                 |
| RC section capacity, interaction diagrams    | `concreteproperties` 0.8                    | MIT                         | Same author; design-code factors are **not** NSR-10 out of the box                   |
| Frame / beam analysis                        | `PyNiteFEA` 1.0, `indeterminatebeam` 2.4    | MIT                         | Linear 3D frames; continuous beams                                                   |
| Nonlinear / seismic analysis                 | `openseespy` 3.8                            | **Custom — see Trade-offs** | 254 MB binary                                                                        |
| Calculation rendering (LaTeX from equations) | `handcalcs` 1.11, `forallpeople` 3.5        | Apache-2.0                  | Renders Python arithmetic step by step                                               |
| DXF generation                               | `ezdxf` 1.4                                 | MIT                         |                                                                                      |
| Cutting optimisation (1D stock, 2D plates)   | `ortools` 9.15, `rectpack` 0.2              | Apache-2.0                  |                                                                                      |
| IFC audit, quantities, clash                 | `ifcopenshell` 0.9, `ifctester`, `ifcclash` | LGPL-3.0-or-later           | 203 MB; the browser viewer stays on `web-ifc` ([RFC-002](../rfc/0002-bim-viewer.md)) |
| AISC shape database                          | `steelpy` 1.1                               | Apache-2.0                  | Shapes only — it does **not** perform member or connection checks                    |
| Geotechnical correlations                    | `groundhog` 0.15                            | **GPL-3.0**                 | See Trade-offs                                                                       |

## Problem

How does the platform gain these numerical capabilities without (a) breaking the single-language guarantee ADR-001 exists to protect, (b) weakening tenant isolation ([RFC-001](../rfc/0001-multi-tenant-architecture.md)), or (c) letting an unversioned third-party solver become the unreviewed author of a signed memoria?

## Decision

Introduce **one** Python workspace, `services/calc`, as a **stateless calculation engine** behind the existing API layer. Proposed rules:

1. **Python is confined to `services/calc`.** Everything else stays on ADR-001. No Python in `apps/` or `packages/`; no second Python service without a new ADR.
2. **tRPC remains the only door** ([ADR-003](0003-api-layer.md)). The browser never calls the engine. A tRPC procedure authorises the caller, scopes the tenant, validates input with Zod, then calls the engine server-to-server with a shared secret.
3. **The engine is stateless and tenant-blind.** No database connection, no object-storage credentials, no session. It receives numbers and geometry and returns numbers, and where requested a rendered artefact (SVG/DXF/LaTeX). A scoping bug in the engine therefore cannot leak tenant data, because it holds none — tenant isolation stays entirely in the already-tested TypeScript layer.
4. **Results are stored as immutable evidence**, extending the Sprint 6 precedent: inputs, outputs, **engine version and library versions** are persisted together at compute time. An issued record is never recomputed.
5. **One contract, declared once.** The engine publishes an OpenAPI schema; the TypeScript client and its Zod schemas are checked against it in CI, so a drift between the two languages fails the build rather than a calculation.
6. **Known-answer tests are the contract** (strict tier for calculation logic, per `PROJECT_RULES.md`): every endpoint ships with hand-worked or published reference cases in `pytest`, run in CI as a second job alongside the existing pipeline ([ADR-006](0006-ci-provider.md)).
7. **Dependencies are pinned exactly** and a library enters `services/calc` only through a sprint's ratified domain model — never as a drive-by.
8. **The closed-form checks stay where they are.** `@andes/structures` and `@andes/geo` are not ported; the engine is for what TypeScript cannot reasonably do (meshing, solvers, optimisation, DXF/IFC).

**Hosting is deliberately left as Open Decision 1 below** — it carries cost and a possible new vendor, which is the CTO's call.

## Alternatives

- **Stay TypeScript-only, port or re-implement.** Keeps ADR-001 pure, but there is no credible TypeScript equivalent for section meshing, OpenSees, or IfcOpenShell; re-implementing them is years of unvalidated numerical code — the opposite of "reuse before creation".
- **Python inside each product module.** Fastest to start, but spreads a second language across the monorepo and puts tenant-scoped data access in two languages — two places a scoping bug can live.
- **WebAssembly (Pyodide) in the browser or Node.** No new deployable, and attractive for small pure-Python libraries; but the heavy ones (OpenSees, IfcOpenShell, OR-Tools) do not ship usable Pyodide builds, and "the UI never computes" (Sprint 6) rules out the browser.
- **A desktop/CLI toolbox outside the platform.** Useful for the firm's day-to-day scripting and can coexist with this ADR, but its results never reach the project record — it does not make the _platform_ more robust.

## Trade-offs

- **A second language and a second deployable.** This is the cost ADR-001 warned about: another runtime to patch, another CI job, and AI assistants working across a language boundary. Rules 1, 5 and 6 are there to contain it, not to eliminate it.
- **Licensing constrains what the SaaS can ship.** These are facts to decide on, not details:
  - **OpenSeesPy** is "free for research, education, and internal use"; its licence states that a commercial "application or cloud-based service that uses `import openseespy`" requires a separate licence. Using it for Andes Engineering's own work as Tenant #1 is internal use; **offering it to other firms on the platform is not** without that licence.
  - **groundhog (GPL-3.0)** and **anaStruct (GPL-3.0)**: running GPL code as a network service does not by itself trigger distribution, but it restricts ever shipping that code to a customer, and it is a diligence flag in a future sale of the product. Recommended: keep GPL libraries out of `services/calc` and use permissively licensed alternatives or own code.
  - **IfcOpenShell (LGPL-3.0)** is usable as an unmodified dependency.
- **Solver output is not NSR-10 compliance.** Libraries compute mechanics; the code factors, load combinations and limits are ours to encode and test. `concreteproperties`, for instance, ships other countries' design codes. The engineer still reviews, decides and signs ([ai-principles.md](../foundation/ai-principles.md)).
- **Latency and cold starts** enter a product that has been purely request/response over PostgreSQL so far.

## Consequences

- The monorepo gains `services/` next to `apps/` and `packages/` — an amendment to the illustrative layout in [ADR-004](0004-repository-structure.md).
- CI gains a Python job (lint, type-check, `pytest`); the tooling choice for Python (proposed: `uv`, `ruff`, `pytest`) extends [ADR-007](0007-dev-tooling.md).
- One new server-side secret (engine URL + shared key), managed per [ADR-005](0005-deployment-target.md)'s environment model; CI mocks the engine boundary in the TypeScript tests, exactly as it mocks S3 and the LLM.
- The Copilot ([RFC-003](../rfc/0003-ai-agent.md)) may later call engine-backed procedures as read-only tools, through tRPC like everything else.
- Each capability still needs its own domain model and sprint. This ADR opens the door; it does not schedule the libraries above.

## Examples

An engineer adds a "built-up steel section" check to a calculation record. `structures.sectionCheck.create` (tRPC) verifies role and tenant, validates the plate geometry with Zod, and POSTs it to `services/calc /v1/section-properties`. The engine meshes the section with `sectionproperties` and returns area, centroid, second moments, section moduli and an SVG of the mesh, plus `{"engine": "1.3.0", "sectionproperties": "3.10.2"}`. The procedure stores inputs, outputs and versions on the check row under the caller's `tenantId`. When the record is issued, that row is frozen; the printed memoria cites the engine and library versions.

## Exceptions

- Closed-form design checks stay in TypeScript (rule 8).
- BIM viewing in the browser stays on `web-ifc` (RFC-002); IfcOpenShell is for server-side audit and quantities only.
- Long-running analyses (nonlinear time-history) do not fit a request/response engine; a job queue would be a further decision, not part of this ADR.

## Open Decisions for the CTO

1. **Hosting.** (a) Vercel Python functions — no new vendor, but the function bundle limit must be checked against the dependency set: the light set (`sectionproperties`, `ezdxf`, `handcalcs`) is plausible, OpenSees (254 MB) and IfcOpenShell (203 MB) are not. (b) A container host (e.g. Cloud Run, Fly.io, Railway) — fits everything, adds a vendor and a small monthly cost. **Recommendation:** decide after a one-day spike that deploys the light set to (a); choose (b) only when a heavy library is actually scheduled.
2. **OpenSeesPy.** Internal-only for Tenant #1 (feature-flagged off for other tenants), obtain a commercial licence, or exclude. **Recommendation:** exclude from the first engine release; `PyNiteFEA` (MIT) covers linear frames.
3. **GPL libraries.** **Recommendation:** exclude (`groundhog`, `anaStruct`).
4. **First capability** — see [sprint-13.md](../sprints/sprint-13.md).

## References

- [ADR-001](0001-technology-stack.md) — the exception clause this ADR exercises
- [sprint-6-domain-model.md](../architecture/sprint-6-domain-model.md) — the deferred evaluation and the evidence-storage precedent
- [RFC-001](../rfc/0001-multi-tenant-architecture.md), [ADR-003](0003-api-layer.md) — why the engine is tenant-blind and behind tRPC
- OpenSeesPy `LICENSE.md` (as distributed in the 3.8.0.0 wheel)

---

_This document follows the Decision Documentation Standard defined in [engineering-principles.md](../foundation/engineering-principles.md)._
