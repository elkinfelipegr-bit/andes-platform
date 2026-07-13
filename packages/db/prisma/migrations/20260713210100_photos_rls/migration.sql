-- RLS for the Sprint 10 photo table (sprint-10-domain-model.md) — the
-- established pattern verbatim: strictly tenant-scoped via app.tenant_id
-- on every command, no bootstrap branch. inspection_photo keys off its
-- own tenantId, never a join through inspection/finding (RFC-001).

ALTER TABLE "inspection_photo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inspection_photo" FORCE ROW LEVEL SECURITY;

CREATE POLICY inspection_photo_select ON "inspection_photo" FOR SELECT
  USING ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY inspection_photo_insert ON "inspection_photo" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY inspection_photo_update ON "inspection_photo" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY inspection_photo_delete ON "inspection_photo" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));
