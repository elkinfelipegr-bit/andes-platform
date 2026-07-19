-- Sprint 11: inverted enforcement for platform-scoped reference content
-- (sprint-11-domain-model.md, Decision 1). The app role reads; it can
-- NEVER write — no policy gymnastics, simply no privileges. Ingestion
-- runs as the table owner (operator), which bypasses RLS (no FORCE).

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "norm_document" FROM andes_app;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "norm_chunk" FROM andes_app;

-- RLS on with an authenticated-read policy: any session may read the
-- reference content; the owner (ingest, migrations) is unaffected.
ALTER TABLE "norm_document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "norm_chunk" ENABLE ROW LEVEL SECURITY;

CREATE POLICY norm_document_read ON "norm_document" FOR SELECT USING (true);
CREATE POLICY norm_chunk_read ON "norm_chunk" FOR SELECT USING (true);
