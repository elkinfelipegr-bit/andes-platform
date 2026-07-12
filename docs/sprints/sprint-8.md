# Sprint 8 — Proposal

**Status:** Accepted — ratified by the CTO on 2026-07-12 as proposed, together with RFC-002, ADR-008, and the domain model's five recommendations.
**Drafted:** 2026-07-12
**Objective (proposed):** BIM Module MVP — BIM models as project records with immutable file versions and an in-browser IFC viewer.

---

## Context

[PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md) sequences Sprint 8 as the **BIM Module**. The handbook has anticipated since Sprint 0 that this module requires an RFC before implementation ([engineering-principles.md](../foundation/engineering-principles.md): "RFC-002 — BIM Viewer — not yet drafted"), and it also forces the platform's longest-standing open item — object storage — to finally be decided. This sprint therefore ratifies **two decisions and a domain model together**: [RFC-002 (BIM Viewer)](../rfc/0002-bim-viewer.md), [ADR-008 (Object Storage — Cloudflare R2)](../adr/0008-object-storage.md), and [sprint-8-domain-model.md](../architecture/sprint-8-domain-model.md). Nothing below is implemented until all three are ratified.

## Proposed Scope

1. **`@andes/storage` package** ([ADR-008](../adr/0008-object-storage.md)): S3 client for R2, presigned `PUT`/`GET` issuance, and the tenant-prefixed key helper (`tenants/{tenantId}/...`). Key construction/validation gets **exhaustive unit tests at the strict tier** — a mis-scoped key is a cross-customer leak ([RFC-001](../rfc/0001-multi-tenant-architecture.md)).
2. **Domain & data layer** (`packages/db`): `BimModel` + `BimModelVersion` + `BimDiscipline`/`BimVersionStatus` enums per the domain model — append-only versions, hand-written migration + strict RLS, isolation suite extended.
3. **API** (`packages/api`, `routers/bim/`): `bimModels` router — `list`/`get`/`create`/`update` (metadata only) plus the upload lifecycle: `requestUpload` (creates `PENDING` version, returns presigned PUT), `confirmUpload` (verifies the object, records size, flips `READY`), `getDownloadUrl` (short-lived presigned GET for `READY` versions). Schemas unit-tested; integration tests for the lifecycle with the S3 boundary mocked, cross-tenant sweeps, archived-project denials.
4. **UI** (`apps/core`): **BIM** live in the sidebar — models list (code, title, discipline, project, versions count) + detail (metadata editor, version history, upload flow with progress) + **viewer page**: `@thatopen/components` (web-ifc WASM + Three.js, dynamically imported) loading a version via presigned GET — orbit/pan/zoom, element selection, IFC properties panel. Project detail gains a BIM-models section; dashboard adds a models card.

## Out of Scope

- Server-side IFC processing of any kind (conversion, tiling, property indexing) — **that is the ADR-001 dedicated-service trigger**, per RFC-002.
- Clash detection, BCF issue exchange, federated multi-model views, 4D/5D.
- Proprietary formats (`.rvt`, `.nwd`) — IFC only, per RFC-002.
- Other file-bearing features on the new storage (inspection photos, proposal PDFs) — they reuse ADR-008 in their own future scope, not bundled here (one PR, one objective).

## Testing Commitments

Strict tier twice: tenant isolation for both tables (RLS suite) **and** storage-key scoping in `@andes/storage` (unit-exhaustive). Integration coverage of the full upload lifecycle (request → confirm → download URL) with the S3 SDK mocked at its boundary, cross-tenant sweeps, and `PENDING`-version invisibility. The viewer itself is verified manually in preview/production (a WebGL canvas has no meaningful CI assertion) — the CTO's production pass is the acceptance gate, as every sprint.

## Rollout Notes

Four new secrets per environment (R2 endpoint, access key ID, secret, bucket) added to Vercel per ADR-005's model — via bash `printf` (the ratified BOM lesson), documented in `.env.example`. Bucket created once in Cloudflare with public access disabled.

## Open Decisions for the CTO

1. **Ratify RFC-002** — IFC canonical, client-side viewer, models as versioned records.
2. **Ratify ADR-008** — Cloudflare R2, presigned-only, tenant-prefixed keys, `@andes/storage`.
3. **Ratify the domain model** — including its five recommendations (enum discipline, 300 MB cap, no model-level lifecycle).
4. **Ratify this scope** — trim candidates: dashboard card first, properties panel second (upload + versions + basic viewing are the core).

## References

- [RFC-002](../rfc/0002-bim-viewer.md), [ADR-008](../adr/0008-object-storage.md), [sprint-8-domain-model.md](../architecture/sprint-8-domain-model.md) — the decisions this sprint implements.
- [sprint-7.md](sprint-7.md) — closed; the record-pattern precedent.
- [engineering-principles.md](../foundation/engineering-principles.md) — workflow and sprint philosophy.
