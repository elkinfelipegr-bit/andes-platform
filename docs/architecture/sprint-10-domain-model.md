# Sprint 10 Domain Model — Inspection Photos

**Version:** 1.0
**Status:** Draft — awaiting CTO ratification together with [sprint-10.md](../sprints/sprint-10.md)
**Part of:** `docs/architecture/`, following the DDD workflow in [architecture-principles.md](../foundation/architecture-principles.md)

---

## Purpose

Walks the DDD sequence for photographic evidence on inspections — the Sprint 5 carry-over unblocked by [ADR-008](../adr/0008-object-storage.md). Deliberately small: it composes two ratified patterns (the Sprint 5 inspection lifecycle and the Sprint 8 file-upload lifecycle) without inventing anything new.

## Business

An inspection report without photos is half a report: the finding says "grieta en viga eje 3, severidad alta" but the client and the engineer reviewing later cannot see it. Inspectors photograph everything in the field today — the photos then die in WhatsApp threads, detached from the record. The platform must attach them to the inspection as evidence: visible while preparing the report, frozen with it, printed in it.

## Processes

1. While an inspection is **SCHEDULED**, the inspector uploads photos — attached to a specific finding ("the crack") or to the inspection in general ("site overview"). Same direct-to-storage flow as BIM: presigned PUT, server confirms what storage holds.
2. Photos can be captioned, reordered, and removed **while SCHEDULED** — they are draft evidence, exactly like findings (which are replaced atomically on every edit).
3. On **COMPLETED**, photos freeze with the report: no additions, edits, or deletions — the report shows what the inspector submitted, forever (the Sprint 6 evidence rule).
4. The printed report renders each finding's photos under it and general photos in their own section.

## Domain Concepts

- **InspectionPhoto** — one uploaded image: storage key (ADR-008 tenant prefix), original filename, size stamped at confirmation, optional caption, optional finding link, position. Born `PENDING` (URL issued), visible only once `READY` (object confirmed) — the Sprint 8 lifecycle verbatim.
- **Finding link is optional**: a photo documents either one finding or the visit in general. Finding-only was rejected — site-overview photos are standard practice.

## Entities (draft sketch)

| Entity            | Key Fields                                                                                                                                                                             | Notes                                                                                                                                                                                                                                                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `InspectionPhoto` | `id`, `tenantId`, `inspectionId`, `findingId?`, `status` (`PENDING`/`READY`), `storageKey`, `fileName`, `fileSize?`, `contentType`, `caption?`, `position`, `uploadedById`, timestamps | Own `tenantId` (RLS never joins). `findingId` SetNull — deleting a finding (findings are replaced atomically while SCHEDULED) demotes its photos to general rather than losing them. Cascade with the inspection. Reuses `BimVersionStatus`? No — own `photo_status` enum, same values: enums stay per-domain so they can diverge. |

Accepted content types: `image/jpeg`, `image/png`, `image/webp`; 15 MB cap per photo (any phone camera fits). Key: `tenants/{tenantId}/inspections/{inspectionId}/{photoId}.{ext}` — built only by `@andes/storage`.

## Relationships

```
Inspection 1 ──── N InspectionPhoto N ──── 0..1 Finding
```

Same-tenant enforcement + RLS as everywhere. Editability follows the inspection's status (SCHEDULED = editable, terminal = frozen), enforced in the API exactly as finding edits are today.

## Roles & Permissions (role-level only, consistent with Sprints 0–9)

`OWNER_ADMIN` and `ENGINEER`: upload, caption, remove while SCHEDULED; everyone views. **Hard delete while SCHEDULED is deliberate** — draft evidence mirrors findings semantics; the no-delete rule protects the _completed_ report, which freezes photos with everything else. Photo URLs are short-lived presigned GETs issued per request, never stored, never public (ADR-008).

## Open Questions for Ratification

1. **Optional finding link** (vs. finding-only). Recommendation: **optional** — general site photos are normal deliverable content.
2. **JPEG/PNG/WebP, 15 MB cap.** Recommendation: **yes** — config change to extend, never a schema change.
3. **Hard delete while SCHEDULED, frozen after.** Recommendation: **yes** — consistent with findings.
4. **Print embedding**: photos render via fresh presigned GETs at report-render time (URLs expire by design). Recommendation: **yes** — no public URLs ever exist.

## What This Document Does Not Cover

Prisma/RLS syntax, tRPC signatures, gallery layout, print CSS — implementation after ratification. No thumbnails/EXIF/compression — a resize pipeline is future work (and if server-side, an ADR-001 trigger conversation).

## References

- [ADR-008](../adr/0008-object-storage.md) — the storage decision this reuses (which named this feature explicitly).
- [sprint-5-domain-model.md](sprint-5-domain-model.md) — the inspection lifecycle this composes with; [sprint-8-domain-model.md](sprint-8-domain-model.md) — the upload lifecycle precedent.
- [sprint-10.md](../sprints/sprint-10.md) — the sprint plan this model belongs to.
