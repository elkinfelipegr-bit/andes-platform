# Sprint 11 Domain Model — Norms Reference (Consulta de Normas)

**Version:** 1.0
**Status:** Accepted — ratified by the CTO on 2026-07-13 together with [sprint-11.md](../sprints/sprint-11.md), including this model's five decisions.
**Part of:** `docs/architecture/`, following the DDD workflow in [architecture-principles.md](../foundation/architecture-principles.md)

---

## Purpose

Walks the DDD sequence for bringing the firm's licensed technical standards (NSR-10, ACI 318-25) into the platform as searchable reference content — the productization of the local `docs_Tec/` searcher the CTO requested on 2026-07-13. This is the platform's first **reference-content domain**, and it introduces one deliberate, ratifiable exception to a standing rule (see Decisions below).

## Business

Engineers consult the norms constantly — "¿cuál es la deriva máxima permisible?", "¿longitud de desarrollo a tracción?" — and today the answer lives in PDFs on one laptop. The platform must let **any member of the firm** search the firm's licensed standards and read the exact passage, cited by section (e.g. `A.6.4.1.4`, `C.19.4.11`), from any browser. The vision already names this capability ("Specification search / Technical knowledge retrieval", [ai-principles.md](../foundation/ai-principles.md)) — this sprint ships its deterministic, non-AI core, which the Copilot can later reuse as a read-only tool when Sprint 9 activates.

## Processes

1. **Ingestion (operator, one-time per document/edition):** the PDFs are converted locally with the established markitdown pipeline (`docs_Tec/convertir.py` — copyrighted files never enter the repo) and an operator script loads the text into the platform database, chunked with stable line coordinates and section locators. The `link-member` precedent: operator CLI, not UI.
2. **Search (any member):** a member types a query in Spanish or English; the platform returns ranked passages with document, section locator, and highlighted snippet. Accent-insensitive ("traccion" finds "tracción").
3. **Read (any member):** expanding a result shows the full passage (a precise line range) — never the whole document.
4. **(Later, Sprint 9 closure):** the same search becomes a read-only Copilot tool under RFC-003's frame — grounded norm citations in chat.

## Domain Concepts

- **NormDocument** — one licensed standard edition: key (`nsr10`, `aci`, `aci-si`, `apendice-e`), title, language (drives the text-search configuration), unit system.
- **NormChunk** — an overlapping window of the converted text (~24 lines, 8 overlap — the validated `buscar.py` scheme) carrying `startLine`/`endLine` and its nearest **section locator**, so every result is citable and stable.
- **Reference content is platform-scoped, not tenant-scoped** — the decisive modeling call, below.

## Entities (draft sketch)

| Entity         | Key Fields                                                                                                                                   | Notes                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `NormDocument` | `id`, `key` (unique), `title`, `language` (`spanish`/`english`), `units`, `lineCount`, timestamps                                            | **No `tenantId`** — see Decision 1.                                                     |
| `NormChunk`    | `id`, `documentId`, `startLine`, `endLine`, `section?`, `content` + a generated tsvector column (GIN-indexed, language-specific, unaccented) | **No `tenantId`.** Append-only; re-ingesting a document replaces its chunks atomically. |

## Relationships

```
NormDocument 1 ──── N NormChunk
```

No links to tenant data in either direction.

## Decisions to Ratify

1. **Platform-scoped reference content — the first tables without `tenantId`.** RFC-001 mandates `tenantId` on every _tenant-scoped_ table; norm text is not tenant data — it is identical licensed reference content, like the `Tenant` table is identical infrastructure. Enforcement inverts accordingly: `andes_app` receives **SELECT-only grants** (no INSERT/UPDATE/DELETE — writes are impossible from the app, not merely unlikely), with RLS enabled and a read-for-authenticated policy. Ingestion runs as the operator role, like migrations. Recommendation: **yes, as an explicit, documented exception** — not a precedent for any tenant-owned data.
2. **Copyright boundary.** The norm text lives **only in the private database** (and the CTO's local `docs_Tec/`, gitignored) — never in the repo, bundle, or object storage with shareable URLs. Serving passages to authenticated members of the licensed firm (Andes, Tenant #1 dogfooding) is internal use of licensed copies. **Before any second tenant onboards, standards licensing must be resolved** — added to the commercialization open items alongside RFC-001's billing ADR. Recommendation: **yes** — flagging, not silently resolving, per PROJECT_RULES rule 6.
3. **PostgreSQL full-text search** (per-document language configuration + `unaccent`), ranked with `ts_rank`, snippets with `ts_headline`. Native to ADR-001's stack, zero new services. Embeddings/semantic RAG stay deferred to the AI-corpus decision RFC-003 already anticipates. Recommendation: **yes**.
4. **Route: `/normas` as an Andes Core top-level sidebar entry** (like Dashboard — cross-discipline utility serving Structures, Geo, and inspections alike), navigation.md amended. Recommendation: **yes**.
5. **Ingestion stays operator CLI** (`pnpm --filter @andes/db ingest-norms`), reading `docs_Tec/md/`. No upload UI — editions change once a decade. Recommendation: **yes**.

## Roles & Permissions

All members (`OWNER_ADMIN`, `ENGINEER`) search and read — knowledge access is not role-gated. Nobody writes through the app (grants make it structural).

## What This Document Does Not Cover

Prisma/SQL syntax (generated tsvector column, GIN index, `unaccent`), tRPC signatures, screen layout, the chunker port details — implementation after ratification. The local `docs_Tec/buscar.py` remains as the CTO's offline tool; this module is its productization, not its replacement.

## References

- [ADR-001](../adr/0001-technology-stack.md) — PostgreSQL, the search engine's home.
- [RFC-001](../rfc/0001-multi-tenant-architecture.md) — the tenant-scoping rule Decision 1 explicitly excepts.
- [ai-principles.md](../foundation/ai-principles.md) — the "Specification search" capability this ships deterministically; [RFC-003](../rfc/0003-ai-agent.md) — the Copilot frame that will reuse it.
- [sprint-11.md](../sprints/sprint-11.md) — the sprint plan this model belongs to.
