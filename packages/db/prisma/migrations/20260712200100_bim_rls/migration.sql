-- RLS for the Sprint 8 BIM tables (sprint-8-domain-model.md) — the
-- established pattern verbatim: strictly tenant-scoped via app.tenant_id
-- on every command, no bootstrap branch. bim_model_version keys off its
-- own tenantId, never a join through bim_model (RFC-001).

-- ── bim_model ───────────────────────────────────────────────────────────
ALTER TABLE "bim_model" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bim_model" FORCE ROW LEVEL SECURITY;

CREATE POLICY bim_model_select ON "bim_model" FOR SELECT
  USING ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY bim_model_insert ON "bim_model" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY bim_model_update ON "bim_model" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY bim_model_delete ON "bim_model" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- ── bim_model_version ───────────────────────────────────────────────────
ALTER TABLE "bim_model_version" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bim_model_version" FORCE ROW LEVEL SECURITY;

CREATE POLICY bim_model_version_select ON "bim_model_version" FOR SELECT
  USING ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY bim_model_version_insert ON "bim_model_version" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY bim_model_version_update ON "bim_model_version" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY bim_model_version_delete ON "bim_model_version" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));
