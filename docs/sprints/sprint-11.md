# Sprint 11 — Norms Reference

**Status:** Closed — 2026-07-19
**Ratified:** 2026-07-13 (as proposed, including the domain model's five decisions)
**Drafted:** 2026-07-13
**Objective (proposed):** Norms Reference MVP — the firm's licensed standards (NSR-10, ACI 318-25) searchable inside the platform, with section-cited passages.

---

## Context

On 2026-07-13 the CTO built a local norms searcher with Claude (markitdown conversion + two-step search in `docs_Tec/`, gitignored) and directed that it be **integrated into the platform**. This sprint productizes it: same validated mechanics (chunking, section locators, accent-insensitive search), moved onto the ratified stack — text in PostgreSQL, search via native full-text search, UI at `/normas` for every member. It also delivers, deterministically and without AI cost, the "Specification search" capability the vision assigned to the Copilot — which will later reuse this exact search as a read-only tool when Sprint 9 activates. Domain detail and the **five decisions to ratify** (including the first platform-scoped tables and the copyright boundary) are in [sprint-11-domain-model.md](../architecture/sprint-11-domain-model.md). The Administración proposal moves to [Sprint 12](sprint-12.md), already drafted.

## Proposed Scope

1. **Domain & data layer** (`packages/db`): `NormDocument` + `NormChunk` per the domain model — hand-written migration with the generated tsvector column (per-document language + `unaccent`), GIN index, **SELECT-only grants for `andes_app`** (writes structurally impossible from the app); **`ingest-norms` operator script** reading `docs_Tec/md/` with the validated chunking scheme (24/8) and section-locator detection, replacing a document's chunks atomically on re-ingest. Chunker + locator logic unit-tested (ported from the validated `buscar.py`).
2. **API** (`packages/api`, `routers/norms/`): `norms` router — `listDocuments`, `search` (query + optional document filter → ranked passages with section, line range, highlighted snippet), `getRange` (the "--ver" equivalent: one exact line range). `tenantProcedure` (any authenticated member; results are platform content). Integration tests: relevance on a seeded fixture, accent-insensitivity, range retrieval, **write-denial as `andes_app`** (the inverted enforcement), unauthenticated denial.
3. **UI** (`apps/core`): **`/normas`** — search box with document filter, results as cards (document badge, `sección≈…`, snippet with highlights), "ver pasaje completo" expanding the range in place; sidebar entry **Normas** (Andes Core); navigation.md amended.

## Out of Scope

- Embeddings / semantic search / RAG — deferred to the AI-corpus decision RFC-003 anticipates.
- Copilot tool wiring — belongs to Sprint 9's closure when the key arrives (the router is designed to be wrapped as tool #15 in minutes).
- Upload/administration UI for documents — ingestion is operator CLI by ratified recommendation.
- PDF page rendering; second-tenant licensing (flagged to commercialization items, not solved here).

## Testing Commitments

Unit: chunker, locator regex, schemas (the ported logic keeps `buscar.py`'s validated behavior). Integration: seeded-fixture search relevance incl. accents, range bounds, and the **grants test** — `andes_app` must be unable to write reference content. No tenant-isolation suite for these tables (nothing tenant-scoped — the exception under ratification), but the write-denial test is strict-tier.

## Rollout Notes

Zero new services or cost. One operator step from this machine (the only one holding the licensed PDFs): `pnpm --filter @andes/db ingest-norms` against Neon (unpooled URL, the migrations precedent). Estimated size well within Neon's free tier (~30 MB text + index).

## Open Decisions for the CTO

1. **Ratify the domain model's five decisions** — platform-scoped tables (RFC-001 exception, SELECT-only grants), copyright boundary (DB-only, second-tenant licensing flagged), Postgres FTS, `/normas` in Andes Core, operator-CLI ingestion.
2. **Ratify this scope** — trim candidates: document filter second, in-place range expansion first.

## Retrospective (closure, 2026-07-19)

**Objective met — the firm's licensed standards are searchable inside the platform, across three CI-gated PRs**, productizing the local `docs_Tec` searcher as the CTO directed:

- **PR #57 — data:** the platform's first tables without `tenantId`, with the ratified **inverted enforcement**: `norms_grants` REVOKEs writes from `andes_app` and RLS carries an authenticated-read policy. Verified in production — `has_table_privilege` reports SELECT true, INSERT/UPDATE false on both tables. `unaccent` + GIN index; the chunker ported from the validated Python (24/8 windows, stable coordinates, section locators) with unit tests as its contract.
- **PR #58 — API:** `norms.search` (websearch_to_tsquery with per-document language config + unaccent, ts_rank ordering) and `getRange` (exact lines reassembled from overlapping chunks, 200-line cap as the copyright guard). The integration suite caught a real defect before merge: the locator anchored from the chunk **start**, so a heading inside a chunk was ignored and the previous section got cited — now anchored from the end, so every passage cites itself correctly.
- **PR #59 — UI:** `/normas` — search with document filter, cards carrying document badge, `sección ≈`, line range and highlighted terms, with in-place passage expansion. Sidebar entry live (Andes Core).

**Ingestion (production):** 21,796 chunks with search vectors — NSR-10 12,647 · ACI 318-25 4,345 · ACI SI 4,321 · Appendix E 483. Search verified against the real database in Spanish (accent-insensitive) and English.

**Verification:** unit + integration suites in CI (including the write-denial test); Neon migrations + real ingestion; production deploy Ready and smoke green. **CTO functional pass on `/normas` closes the sprint (2026-07-19).**

**Deviations:** none against scope. Operational notes: two defects caught and fixed during the run (locator anchoring, and the catalog's `file` field being spread into a Prisma create); Neon's free tier suspends the endpoint — the first connection after idle fails and simply needs a retry.

**Carry-over:**

1. **Standards licensing before a second tenant onboards** — flagged at ratification, still open; belongs with the commercialization items alongside RFC-001's billing ADR.
2. Semantic/embedding search over the corpus — deferred to the AI-corpus decision RFC-003 anticipates.
3. Wiring `norms.search` as a read-only Copilot tool — belongs to Sprint 9's closure when the Anthropic key arrives.
4. Table-fidelity: converted text flattens tables; exact tabulated values still warrant checking the source PDF.

## References

- [sprint-11-domain-model.md](../architecture/sprint-11-domain-model.md) — the domain and decisions this sprint implements.
- `docs_Tec/README.md` (local, gitignored) — the validated searcher this productizes.
- [sprint-12.md](sprint-12.md) — Administración, drafted and queued next.
