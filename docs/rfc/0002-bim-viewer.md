# RFC-002: BIM Viewer

**Status:** Proposed — awaiting CTO ratification
**Date:** 2026-07-12
**Deciders:** CTO / Lead Software Architect (Andes Engineering)

---

## Context

[PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md) sequences Sprint 8 as the **BIM Module**, and [engineering-principles.md](../foundation/engineering-principles.md) has listed "RFC-002 — BIM Viewer — not yet drafted" since Sprint 0 — the handbook itself decided this module needs an RFC, not just a sprint plan, before implementation. The reason: BIM is the first module whose deliverable is neither a database record nor a printable document but a **large binary file rendered interactively in 3D**, which cuts across storage ([ADR-008](../adr/0008-object-storage.md), proposed alongside this RFC), the serverless deployment model ([ADR-005](../adr/0005-deployment-target.md)), and the frontend stack ([ADR-001](../adr/0001-technology-stack.md)) at once.

## Problem

Three cross-cutting choices must be made together before any BIM code is written: (1) which file format the platform treats as canonical for BIM models, (2) where model parsing and rendering happen given serverless constraints, and (3) how model files relate to the project/record domain the platform already has. Each choice constrains the others — hence one RFC rather than three isolated decisions.

## Proposal

**1. IFC is the canonical BIM exchange format.** The platform accepts `.ifc` files (ISO 16739 — the open, vendor-neutral Industry Foundation Classes standard). This aligns with the platform's long-horizon posture ([architecture-principles.md](../foundation/architecture-principles.md)): IFC is what Revit, Tekla, Archicad, and ETABS-adjacent tools all export, and committing to the open standard avoids coupling the module to any authoring vendor. Proprietary formats (`.rvt`, `.nwd`) are explicitly not accepted — conversion happens in the authoring tool, where it belongs.

**2. Parsing and rendering are 100% client-side.** The browser loads the IFC file directly from storage (presigned GET per ADR-008) and parses/renders it with **web-ifc (WASM) + Three.js via the `@thatopen/components` toolkit** — the actively maintained successor of IFC.js. No server-side geometry processing exists in this design: Vercel functions (ADR-005) are the wrong place for minutes-long, memory-heavy parsing, and ADR-001's exception clause already reserves heavy computation for a future dedicated service. If server-side model processing (tiling, geometry extraction, property indexing at scale) is ever needed, **that is the ADR-001 dedicated-service trigger firing** — it must not be built inside the Next.js app.

**3. Models are project records with immutable versions.** A `BimModel` is a tenant-scoped, project-owned record (same shape as every engineering record since Sprint 2); each uploaded file is an immutable `BimModelVersion` — re-uploading creates version N+1, nothing is overwritten or hard-deleted. This extends the ratified evidence rule (stored outputs are immutable, Sprint 6) to files: the model a decision was reviewed against remains retrievable forever. The domain detail lives in [sprint-8-domain-model.md](../architecture/sprint-8-domain-model.md).

## Alternatives

- **Server-side conversion to glTF/tiles** (the Autodesk Forge / Speckle architecture): faster first paint on huge models and lower client memory, but requires exactly the long-running compute ADR-005 rules out and ADR-001 reserves for a dedicated service. Rejected for the MVP; it is the documented escalation path.
- **Third-party viewer service (Autodesk Platform Services, Speckle Cloud):** fastest to ship, but per-model costs, vendor coupling on the module's core capability, and tenant model files leaving our storage boundary — a hard sell for the SaaS posture ([RFC-001](0001-multi-tenant-architecture.md)).
- **glTF as the accepted format:** trivially renderable, but glTF is not a BIM format — no IFC property sets, no element semantics. Engineers would lose exactly the data that distinguishes BIM from 3D.

## Trade-offs

Client-side parsing bounds the practical model size by browser memory — hundreds of MB of IFC is workable on desktop hardware; multi-GB federated models are not. Accepted: the MVP targets per-discipline models (the normal deliverable an engineering consultancy reviews), an upload size cap makes the bound explicit, and the escalation path (dedicated processing service) is pre-documented rather than improvised. In exchange, the platform ships a real viewer with zero server compute, zero per-view cost, and no new infrastructure.

## Consequences

- The frontend gains its first WASM + WebGL dependency; the viewer is dynamically imported so the 3D stack never enters the shell bundle (relevant to build memory limits on the development machine and to every non-BIM page's performance).
- Storage (ADR-008) becomes a hard prerequisite — this RFC cannot be implemented without it; they ratify together.
- The viewer is manually verified (a WebGL canvas has no meaningful CI assertion); everything below it — key scoping, upload lifecycle, tenant isolation — carries the standard automated test tiers.
- Future BIM capabilities (clash detection, BCF issue exchange, 4D) build on the `BimModel`/`BimModelVersion` domain without revisiting these three choices.

## Rollout

Implemented as Sprint 8 ([sprint-8.md](../sprints/sprint-8.md)): storage package → data layer → API → UI with viewer, each a CI-gated PR per [PROJECT_RULES.md](../foundation/PROJECT_RULES.md). No migration path needed — there is no pre-existing file storage.

## Open Questions

- **Upload size cap for the MVP** — proposed 300 MB per version (generous for per-discipline IFC, explicit about the client-side bound). Resolve at ratification.
- **Element property panel depth** (flat property dump vs. grouped IFC property sets) — resolve during UI implementation; not architectural.
- Streaming/tiled loading for very large models — deliberately unresolved until the dedicated-service ADR fires.

## References

- [ADR-008](../adr/0008-object-storage.md) — storage decision this RFC depends on
- [ADR-001](../adr/0001-technology-stack.md), [ADR-005](../adr/0005-deployment-target.md) — the constraints shaping choice 2
- [sprint-8-domain-model.md](../architecture/sprint-8-domain-model.md) — the domain model implementing choice 3
- buildingSMART IFC (ISO 16739); That Open Company `@thatopen/components` (web-ifc successor to IFC.js)
