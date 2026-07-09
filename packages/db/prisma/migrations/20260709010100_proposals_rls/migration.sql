-- RLS for the Sprint 4 proposal tables (sprint-4-domain-model.md) — the
-- established pattern verbatim: strictly tenant-scoped via app.tenant_id
-- on every command, no bootstrap branch. proposal_item keys off its own
-- tenantId, never a join through proposal (RFC-001).

-- ── proposal ────────────────────────────────────────────────────────────
ALTER TABLE "proposal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "proposal" FORCE ROW LEVEL SECURITY;

CREATE POLICY proposal_select ON "proposal" FOR SELECT
  USING ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY proposal_insert ON "proposal" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY proposal_update ON "proposal" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY proposal_delete ON "proposal" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- ── proposal_item ───────────────────────────────────────────────────────
ALTER TABLE "proposal_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "proposal_item" FORCE ROW LEVEL SECURITY;

CREATE POLICY proposal_item_select ON "proposal_item" FOR SELECT
  USING ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY proposal_item_insert ON "proposal_item" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY proposal_item_update ON "proposal_item" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY proposal_item_delete ON "proposal_item" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));
