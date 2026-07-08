-- RLS for the Sprint 3 contact table (sprint-3-domain-model.md) — the
-- Sprint 2 client/project pattern verbatim: strictly tenant-scoped via
-- app.tenant_id on every command, no bootstrap branch. RLS keys off the
-- row's own tenantId, never a join through client (RFC-001).

ALTER TABLE "contact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact" FORCE ROW LEVEL SECURITY;

CREATE POLICY contact_select ON "contact" FOR SELECT
  USING ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY contact_insert ON "contact" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY contact_update ON "contact" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY contact_delete ON "contact" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));
