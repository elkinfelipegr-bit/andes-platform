-- RLS for the Sprint 9 AI tables (sprint-9-domain-model.md) — the
-- established pattern verbatim: strictly tenant-scoped via app.tenant_id
-- on every command, no bootstrap branch. Owner privacy (userId) is an
-- application-layer filter on top of this, tested in the API suite —
-- RLS stays single-purpose: tenant isolation. ai_message keys off its
-- own tenantId, never a join through ai_conversation (RFC-001).

-- ── ai_conversation ─────────────────────────────────────────────────────
ALTER TABLE "ai_conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_conversation" FORCE ROW LEVEL SECURITY;

CREATE POLICY ai_conversation_select ON "ai_conversation" FOR SELECT
  USING ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY ai_conversation_insert ON "ai_conversation" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY ai_conversation_update ON "ai_conversation" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY ai_conversation_delete ON "ai_conversation" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- ── ai_message ──────────────────────────────────────────────────────────
ALTER TABLE "ai_message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_message" FORCE ROW LEVEL SECURITY;

CREATE POLICY ai_message_select ON "ai_message" FOR SELECT
  USING ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY ai_message_insert ON "ai_message" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY ai_message_update ON "ai_message" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY ai_message_delete ON "ai_message" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));
