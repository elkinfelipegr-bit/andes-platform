-- RLS for the Sprint 15 pipeline tables (sprint-15-domain-model.md) — the
-- established pattern verbatim: strictly tenant-scoped via app.tenant_id
-- on every command, no bootstrap branch. opportunity_activity keys off its
-- own tenantId, never a join through opportunity (RFC-001).

ALTER TABLE "opportunity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "opportunity" FORCE ROW LEVEL SECURITY;

CREATE POLICY opportunity_select ON "opportunity" FOR SELECT
  USING ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY opportunity_insert ON "opportunity" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY opportunity_update ON "opportunity" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY opportunity_delete ON "opportunity" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "opportunity_activity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "opportunity_activity" FORCE ROW LEVEL SECURITY;

CREATE POLICY opportunity_activity_select ON "opportunity_activity" FOR SELECT
  USING ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY opportunity_activity_insert ON "opportunity_activity" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY opportunity_activity_update ON "opportunity_activity" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY opportunity_activity_delete ON "opportunity_activity" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));
