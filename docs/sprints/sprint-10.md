# Sprint 10 — Inspection Photos

**Status:** Closed — 2026-07-13
**Ratified:** 2026-07-13 (as proposed, including the domain model's four recommendations)
**Drafted:** 2026-07-13
**Objective (proposed):** Inspection Photos — photographic evidence attached to inspections and findings, printed in the report.

---

## Context

The original PRODUCT_STRATEGY sequence (Sprint 0–9) is implementation-complete — Sprint 9's closure waits only on the Anthropic key, deferred by the CTO on 2026-07-13. Per [PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md), the order "should be revisited at the start of each sprint": this is the first backlog-driven sprint, and the pick is the **oldest high-value carry-over that costs nothing new**: photos on inspections, deferred since Sprint 5 waiting for the storage decision that [ADR-008](../adr/0008-object-storage.md) resolved in Sprint 8 — which explicitly anticipated this feature ("inspection photos … reuse this decision, only its own key prefix"). **No new ADR or RFC is required**; the domain detail is in [sprint-10-domain-model.md](../architecture/sprint-10-domain-model.md), ratified together with this plan.

## Proposed Scope

1. **Storage key helper** (`@andes/storage`): `inspectionPhotoKey` under the ADR-008 tenant prefix — strict-tier tests extended (same bar as `bimVersionKey`).
2. **Domain & data layer** (`packages/db`): `InspectionPhoto` per the domain model — inspection-owned, optional finding link, the proven `PENDING→READY` upload lifecycle, hand-written migration + strict RLS, isolation suite extended.
3. **API** (`packages/api`, inspections): photo lifecycle procedures mirroring BIM's — `requestPhotoUpload` (JPEG/PNG/WebP only, 15 MB cap, presigned PUT), `confirmPhotoUpload` (size from storage), `getPhotoUrl` (presigned GET), `removePhoto` and caption edits **while SCHEDULED only** — a completed inspection's photos are frozen evidence, exactly like its findings. Integration tests: lifecycle, frozen denials, cross-tenant sweep.
4. **UI** (`apps/core`): photo upload + gallery on the inspection detail (per finding and general), captions, and **photos printed in the frozen report** — the report finally shows what the inspector saw.

## Out of Scope

- Photos on other records (proposals, geo, structures) — same pattern, own scopes.
- Image processing (thumbnails, EXIF, compression) — the browser uploads as-is; a resize pipeline would be a dedicated-service conversation.
- Mobile capture flow / offline — the field UX beyond a file picker is its own future objective.

## Testing Commitments

Strict tier: key scoping in `@andes/storage` and tenant isolation for the new table. Integration: full photo lifecycle with the S3 boundary faked (the Sprint 8 harness), frozen-state denials after completion, cross-tenant sweeps. Print view verified manually (the acceptance gate, as always).

## Rollout Notes

**Zero new infrastructure and zero new cost:** same R2 bucket, same credentials, same CORS policy already in production. Only migrations to Neon.

## Open Decisions for the CTO

1. **Ratify the domain model** — photos belong to the inspection with an optional finding link (recommended over finding-only: general site photos are normal practice).
2. **Formats JPEG/PNG/WebP, 15 MB per photo** (recommended — covers any phone camera).
3. **Hard delete while SCHEDULED** (recommended — draft evidence, mirrors findings replacement semantics; frozen after completion).
4. **Ratify this scope** — trim candidate: captions second, gallery-per-finding grouping first.

## Retrospective (closure, 2026-07-13)

**Objective met — photographic evidence shipped to production the same day it was ratified, across three CI-gated PRs**, composing two ratified patterns without a single new decision:

- **PR #52 — keys + data:** `inspectionPhotoKey` with the extension from a closed whitelist derived from the validated content type — never the file name; `InspectionPhoto` with the Sprint 8 upload lifecycle and `findingId` SetNull; strict RLS; suites extended.
- **PR #53 — API:** the photo lifecycle on the inspections router, SCHEDULED-only edits, frozen (but viewable/printable) with the completed report. Two notable pieces: `deleteObject` added to `@andes/storage` so draft-evidence deletes leave no orphan objects (ADR-008: the database is the index), and **photos re-link by finding position across the Sprint 5 atomic findings replacement** — editing a finding's text no longer orphans its photos; a removed finding demotes them to general.
- **PR #54 — UI:** PhotoManager (direct-to-R2 upload with progress, attach-to selector, inline captions, delete) and ReportPhotos (grouped per finding + general, in the print view). All images serve through fresh short-lived presigned GETs — nothing public, ever.

**Verification:** unit + integration suites in CI (lifecycle, re-link, frozen denials, delete cleanup, cross-tenant sweep); Neon migrations applied with grants verified; zero new infrastructure or cost. **CTO functional pass in production — upload, captions, freeze, printed evidence — closes the sprint (2026-07-13).**

**Deviations:** none against scope.

**Carry-over:**

1. Thumbnails/EXIF/compression pipeline — future work; if server-side, an ADR-001 trigger conversation.
2. Mobile field-capture UX beyond the file picker.
3. Photos on other records (proposals, geo) — same pattern, own scopes.
4. Standing items from Sprints 1–9 (incl. Sprint 9's activation, deferred with the Anthropic key).

## References

- [sprint-10-domain-model.md](../architecture/sprint-10-domain-model.md) — the domain this sprint implements.
- [ADR-008](../adr/0008-object-storage.md) — the storage decision this reuses; [sprint-5.md](sprint-5.md) — where the carry-over was born.
- [sprint-9.md](sprint-9.md) — Accepted/open: closure pending the Anthropic key (CTO deferral, 2026-07-13).
