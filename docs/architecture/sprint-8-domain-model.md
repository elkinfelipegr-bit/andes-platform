# Sprint 8 Domain Model — BIM Module

**Version:** 1.0
**Status:** Accepted — ratified by the CTO on 2026-07-12 together with [sprint-8.md](../sprints/sprint-8.md), [RFC-002](../rfc/0002-bim-viewer.md), and [ADR-008](../adr/0008-object-storage.md), including this model's five recommendations.
**Part of:** `docs/architecture/`, following the DDD workflow in [architecture-principles.md](../foundation/architecture-principles.md)

---

## Purpose

Walks the DDD sequence for the first slice of Andes BIM ([PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md), Sprint 8: BIM Module). Unlike Sprints 6–7 this is **not a calculation domain** — there is no library of equations. It is the platform's first **file domain**: the pattern being established is record + immutable file versions + in-browser viewer, governed by [RFC-002](../rfc/0002-bim-viewer.md) and [ADR-008](../adr/0008-object-storage.md).

## Business

Engineering consultancies receive, review, and coordinate against BIM models on every significant project — the architect's model, the structural model, the MEP model. Today those files live in email threads and shared drives, detached from the project record, with no answer to "which version did we review when we made that decision?" The platform must make the BIM model a first-class project record: uploaded versions are immutable evidence, and any engineer can open a version in the browser — no Revit license, no desktop viewer — under the standing principle that the platform serves the engineer's review; it does not replace their judgment.

## Processes

1. An engineer creates a BIM model record on a project: code, title, discipline.
2. The engineer **uploads an IFC file** as version 1: the server issues a scoped presigned upload (ADR-008), the browser sends the file directly to storage, and the server confirms the object before the version becomes visible.
3. Any member opens a version in the **viewer** (RFC-002): orbit/pan/zoom, select an element, read its IFC properties.
4. A revised model from the authoring tool is uploaded as **version N+1**. Prior versions remain retrievable forever — no overwrite, no hard delete (the Sprint 6 evidence rule, extended to files).
5. (Later sprints) clash detection, BCF issue exchange, federated multi-model views, 4D — all behind future proposals; server-side processing behind the ADR-001 dedicated-service trigger.

## Domain Concepts

- **BimModel** — the record: tenant-scoped, project-owned, one per model/discipline stream (e.g. "Structural model — Tower A"). Carries identity and metadata, never file bytes.
- **BimModelVersion** — one immutable uploaded file: storage key, original filename, size, upload lifecycle state, uploader, timestamp. The version list is the model's history.
- **Upload lifecycle** — a version is born `PENDING` (presigned URL issued), becomes `READY` only after the server confirms the object exists in storage (size recorded at confirmation). A `PENDING` version whose upload never completes is superseded harmlessly — it holds no object and is never shown as content.

## Entities (draft sketch)

| Entity            | Key Fields                                                                                                                                                      | Notes                                                                                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BimModel`        | `id`, `tenantId`, `projectId`, `code`, `title`, `discipline`, `createdById`, timestamps                                                                         | Project-required; per-tenant human code (`@@unique([tenantId, code])`); `discipline` as a Prisma enum (`ARCHITECTURE`, `STRUCTURAL`, `MEP`, `SITE`, `OTHER`).           |
| `BimModelVersion` | `id`, `tenantId`, `bimModelId`, `versionNumber`, `status` (`PENDING`/`READY`), `storageKey`, `fileName`, `fileSize?`, `contentType`, `uploadedById`, timestamps | Own `tenantId` (RLS never joins); `@@unique([bimModelId, versionNumber])`; `storageKey` built only by `@andes/storage` under ADR-008's tenant-prefix rule; append-only. |

No status lifecycle on `BimModel` itself: unlike proposals or memorias, a model record is not "issued" — its versions are the immutable artifacts. Archiving follows the project (archived projects accept no new models or versions), consistent with Sprints 2–7.

## Relationships

```
Project 1 ──── N BimModel 1 ──── N BimModelVersion
```

Same-tenant enforcement + RLS as everywhere. Future capabilities (clash results, BCF issues) attach as sibling tables to `BimModel`/`BimModelVersion` — the same extension pattern as check types in Sprints 6–7.

## Roles & Permissions (role-level only, consistent with Sprints 0–7)

`OWNER_ADMIN` and `ENGINEER`: create models, upload versions, view everything. No hard delete of models or versions (evidence rule). Download/view URLs are short-lived presigned GETs issued per request — never stored, never public.

## Open Questions for Ratification

1. **Ratify RFC-002's three choices** — IFC canonical, client-side viewer, models-as-versioned-records. Recommendation: **yes** (rationale in the RFC).
2. **Ratify ADR-008** — Cloudflare R2 with presigned-only access and tenant-prefixed keys. Recommendation: **yes** — it honors ADR-001's "S3-compatible" row literally and its zero-egress pricing fits the viewer workload.
3. **`@andes/storage` package** for the S3 client + key helper. Recommendation: **yes** — one package per concern (ADR-004), and key scoping gets the strict test tier in one place.
4. **Discipline as an enum** vs. free text. Recommendation: **enum** — it is a closed, stable vocabulary and enables filtering; `OTHER` absorbs edge cases.
5. **Upload cap 300 MB per version.** Recommendation: **yes** — makes RFC-002's client-side bound explicit; raising it later is a config change, not a schema change.

## What This Document Does Not Cover

Prisma/RLS syntax, tRPC signatures, presigned-URL parameters, viewer implementation details — implementation after ratification. UI: `/bim` goes live in the sidebar, following the established module layout (list → detail → viewer).

## References

- [RFC-002](../rfc/0002-bim-viewer.md) — the cross-cutting decisions this model implements.
- [ADR-008](../adr/0008-object-storage.md) — storage provider and key discipline.
- [sprint-7-domain-model.md](sprint-7-domain-model.md) — the record-pattern precedent; [sprint-8.md](../sprints/sprint-8.md) — the sprint plan this model belongs to.
