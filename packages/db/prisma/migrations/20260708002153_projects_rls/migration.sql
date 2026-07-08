-- RLS for the Sprint 2 Projects domain (sprint-2-domain-model.md) —
-- RFC-001 layer 2 behind the tRPC tenant-scoping middleware (layer 1).
--
-- Simpler than role/membership: client and project have no pre-tenant
-- bootstrap path, so every command is strictly tenant-scoped via
-- app.tenant_id (set by forTenant in packages/db/src/tenant-client.ts).
-- No app.user_id branch — by design.

-- ── client ──────────────────────────────────────────────────────────────
ALTER TABLE "client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "client" FORCE ROW LEVEL SECURITY;

CREATE POLICY client_select ON "client" FOR SELECT
  USING ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY client_insert ON "client" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY client_update ON "client" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY client_delete ON "client" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- ── project ─────────────────────────────────────────────────────────────
ALTER TABLE "project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project" FORCE ROW LEVEL SECURITY;

CREATE POLICY project_select ON "project" FOR SELECT
  USING ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY project_insert ON "project" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY project_update ON "project" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY project_delete ON "project" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));
