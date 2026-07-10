-- RLS for the Sprint 6 structural tables (sprint-6-domain-model.md) — the
-- established pattern verbatim: strictly tenant-scoped via app.tenant_id
-- on every command, no bootstrap branch. beam_flexure_check keys off its
-- own tenantId, never a join through calc_record (RFC-001).

-- ── calc_record ─────────────────────────────────────────────────────────
ALTER TABLE "calc_record" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "calc_record" FORCE ROW LEVEL SECURITY;

CREATE POLICY calc_record_select ON "calc_record" FOR SELECT
  USING ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY calc_record_insert ON "calc_record" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY calc_record_update ON "calc_record" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY calc_record_delete ON "calc_record" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- ── beam_flexure_check ──────────────────────────────────────────────────
ALTER TABLE "beam_flexure_check" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "beam_flexure_check" FORCE ROW LEVEL SECURITY;

CREATE POLICY beam_flexure_check_select ON "beam_flexure_check" FOR SELECT
  USING ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY beam_flexure_check_insert ON "beam_flexure_check" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY beam_flexure_check_update ON "beam_flexure_check" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY beam_flexure_check_delete ON "beam_flexure_check" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));
