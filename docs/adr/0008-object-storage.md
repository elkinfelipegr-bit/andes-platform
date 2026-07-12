# ADR-008: Object Storage Provider — Cloudflare R2

**Status:** Accepted — ratified by CTO 2026-07-12
**Date:** 2026-07-12
**Deciders:** CTO / Lead Software Architect (Andes Engineering)

---

## Context

[ADR-001](0001-technology-stack.md) ratifies "S3-compatible storage" as the storage layer but names no provider and no integration pattern. Every sprint since Sprint 4 has deferred file-bearing features against this gap: proposal PDFs, inspection photos, and now — decisively — Sprint 8's BIM models ([RFC-002](../rfc/0002-bim-viewer.md)), which cannot ship without it. IFC files run tens to hundreds of MB, far beyond Vercel's ~4.5 MB serverless request body limit ([ADR-005](0005-deployment-target.md)), so file bytes can never pass through the application: uploads and downloads must go browser ↔ storage directly, with the server issuing scoped, expiring credentials.

## Problem

Which concrete object-storage provider do we commit to, and what integration and tenant-isolation pattern governs every file the platform ever stores — decided once, before the first file-bearing module is built?

## Decision

**Cloudflare R2**, accessed exclusively through its S3-compatible API via `@aws-sdk/client-s3`, with these binding patterns:

1. **Presigned URLs only.** The server (tRPC procedures) issues short-lived presigned `PUT` URLs for upload and presigned `GET` URLs for download. File bytes never transit Vercel functions. The bucket is private — no public access, ever.
2. **Tenant-prefixed keys.** Every object key begins with `tenants/{tenantId}/` followed by the owning module and record (e.g. `tenants/{tenantId}/bim/{modelId}/{versionId}.ifc`). Key construction lives in one shared helper (`@andes/storage`); no module builds keys by hand.
3. **Key scoping is tenant-isolation logic.** The helper that builds and validates keys is security-critical under [RFC-001](../rfc/0001-multi-tenant-architecture.md)'s strict testing tier — a key built with the wrong `tenantId` is a cross-customer data leak, exactly like a missing `WHERE tenantId`.
4. **The database is the index.** Every stored object has exactly one owning row (e.g. `BimModelVersion`) carrying its key, size, and content type. No listing buckets to discover files; no orphan objects by design — an upload is only acknowledged when its row is confirmed.

## Alternatives

- **Vercel Blob** — the most platform-native option (zero extra vendor, tokens managed by Vercel), but it is **not S3-compatible**, so choosing it would silently deviate from ADR-001's ratified "S3-compatible storage" row and couple every file the platform stores to the deployment vendor ([ADR-005](0005-deployment-target.md) already concentrates risk there).
- **AWS S3 itself** — the reference implementation, maximum ecosystem maturity, but egress fees are a poor fit for a BIM module whose core loop is repeatedly downloading large models into browsers, and it adds an AWS account/IAM surface the team doesn't otherwise carry.
- **Supabase Storage / UploadThing** — simpler DX for small files, but another platform dependency each, weaker fit for multi-hundred-MB engineering files, and not S3-compatible in the way ADR-001 ratified.

## Trade-offs

R2 adds one vendor (Cloudflare) to the operational surface in exchange for honoring ADR-001 literally (any S3-compatible provider can replace it behind the same SDK and key scheme — the migration is a copy job, not a rewrite), zero egress fees (the dominant cost driver for a model-viewing workload), and generous free-tier storage during the platform's internal-dogfooding phase. The S3 API is more ceremony than Vercel Blob's SDK — accepted, because the ceremony is confined to `@andes/storage`.

## Consequences

- A new workspace package `@andes/storage` owns the S3 client, presigned-URL issuance, and the tenant-key helper — the only module allowed to touch R2 credentials.
- Four new secrets per environment (account endpoint, access key ID, secret access key, bucket name), managed per ADR-005's Vercel env model, documented in `.env.example`.
- Every future file-bearing feature (inspection photos, proposal PDFs, geo borehole logs) reuses this decision — none of them needs a new storage decision, only its own key prefix.
- CI cannot exercise R2 itself; unit tests cover key construction/validation exhaustively, and integration tests mock the S3 client at the SDK boundary. A production smoke test covers the real round trip.

## Examples

Uploading a BIM model version: the client calls `bimModels.requestUpload` → the server builds `tenants/{tenantId}/bim/{modelId}/{versionId}.ifc` via `@andes/storage`, creates the `PENDING` version row, and returns a presigned `PUT` (15 min) → the browser PUTs the file directly to R2 → the client calls `confirmUpload` → the server HEADs the object, records size, flips the row to `READY`.

## Exceptions

None identified. If a future enterprise customer requires data residency R2 cannot satisfy, that deployment carries its own storage decision under its own ADR (consistent with ADR-005's exception clause).

## References

- [ADR-001](0001-technology-stack.md) — the "S3-compatible storage" row this ADR makes concrete
- [ADR-005](0005-deployment-target.md) — the serverless body-size constraint forcing presigned URLs
- [RFC-001](../rfc/0001-multi-tenant-architecture.md) — the isolation tier key scoping inherits
- [RFC-002](../rfc/0002-bim-viewer.md) — the first consumer of this decision
