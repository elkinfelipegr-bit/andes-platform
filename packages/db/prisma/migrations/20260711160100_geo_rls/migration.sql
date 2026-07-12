-- RLS for the Sprint 7 geotechnical tables (sprint-7-domain-model.md) —
-- the established pattern verbatim: strictly tenant-scoped via
-- app.tenant_id on every command, no bootstrap branch. bearing_check keys
-- off its own tenantId, never a join through geo_record (RFC-001).

-- ── geo_record ──────────────────────────────────────────────────────────
ALTER TABLE "geo_record" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "geo_record" FORCE ROW LEVEL SECURITY;

CREATE POLICY geo_record_select ON "geo_record" FOR SELECT
  USING ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY geo_record_insert ON "geo_record" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY geo_record_update ON "geo_record" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY geo_record_delete ON "geo_record" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- ── bearing_check ───────────────────────────────────────────────────────
ALTER TABLE "bearing_check" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bearing_check" FORCE ROW LEVEL SECURITY;

CREATE POLICY bearing_check_select ON "bearing_check" FOR SELECT
  USING ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY bearing_check_insert ON "bearing_check" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY bearing_check_update ON "bearing_check" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY bearing_check_delete ON "bearing_check" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));
