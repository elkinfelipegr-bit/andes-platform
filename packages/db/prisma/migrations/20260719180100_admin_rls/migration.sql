-- RLS for the Sprint 12 invitation table (sprint-12-domain-model.md).
-- Tenant-scoped like everything else, PLUS one narrow bootstrap branch
-- mirroring the ratified app.user_id pattern: an invitee holds a session
-- but no tenant yet, so they must read exactly the one invitation whose
-- token they present (set transaction-locally by forInviteToken).
--
-- Writes stay STRICTLY tenant-scoped — deliberately no token branch:
-- acceptance validates the token, then writes under the invitation's own
-- tenant scope (forTenant), so no new write path exists.

ALTER TABLE "invitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invitation" FORCE ROW LEVEL SECURITY;

CREATE POLICY invitation_select ON "invitation" FOR SELECT
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR "token" = current_setting('app.invite_token', true)
  );

CREATE POLICY invitation_insert ON "invitation" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY invitation_update ON "invitation" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY invitation_delete ON "invitation" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- The invitee must also read the tenant name and the role label being
-- offered, before any membership exists. Both are narrowly keyed to the
-- token's own invitation row — nothing else becomes visible.
CREATE POLICY tenant_select_invite ON "tenant" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "invitation" i
      WHERE i."tenantId" = "tenant"."id"
        AND i."token" = current_setting('app.invite_token', true)
    )
  );

CREATE POLICY role_select_invite ON "role" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "invitation" i
      WHERE i."roleId" = "role"."id"
        AND i."token" = current_setting('app.invite_token', true)
    )
  );
