-- RLS for the Sprint 5 inspection tables (sprint-5-domain-model.md) — the
-- established pattern verbatim: strictly tenant-scoped via app.tenant_id
-- on every command, no bootstrap branch. finding keys off its own
-- tenantId, never a join through inspection (RFC-001).

-- ── inspection ──────────────────────────────────────────────────────────
ALTER TABLE "inspection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inspection" FORCE ROW LEVEL SECURITY;

CREATE POLICY inspection_select ON "inspection" FOR SELECT
  USING ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY inspection_insert ON "inspection" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY inspection_update ON "inspection" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY inspection_delete ON "inspection" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- ── finding ─────────────────────────────────────────────────────────────
ALTER TABLE "finding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finding" FORCE ROW LEVEL SECURITY;

CREATE POLICY finding_select ON "finding" FOR SELECT
  USING ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY finding_insert ON "finding" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY finding_update ON "finding" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY finding_delete ON "finding" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));
