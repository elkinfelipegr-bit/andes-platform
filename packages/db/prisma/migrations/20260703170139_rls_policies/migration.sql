-- Row-Level Security — RFC-001 layer 2, the defense-in-depth backstop
-- behind the tRPC tenant-scoping middleware (layer 1, @andes/api).
--
-- Two transaction-local settings drive the policies (set via
-- packages/db/src/tenant-client.ts, never manually):
--   app.tenant_id — normal tenant-scoped work (forTenant)
--   app.user_id   — session bootstrap only (forUser): a user must read their
--                   OWN membership (and through it their role) BEFORE any
--                   tenant context exists, or login could never resolve one.
--
-- Superusers bypass RLS entirely; the runtime identity must be a plain role
-- (locally: andes_app from docker/initdb). FORCE also subjects the table
-- owner, in case a future environment runs the app as the schema owner.
--
-- "tenant" and "user" tables are intentionally NOT under RLS: tenant IS the
-- scope, and user is global identity — both gated at the application layer.

-- ── role ────────────────────────────────────────────────────────────────
ALTER TABLE "role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role" FORCE ROW LEVEL SECURITY;

-- Reads: tenant context, or (bootstrap) roles the user holds via their own
-- memberships — the EXISTS subquery is itself filtered by membership's
-- SELECT policy, so it can only ever traverse the user's own rows.
CREATE POLICY role_select ON "role" FOR SELECT
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR EXISTS (
      SELECT 1 FROM "membership" m
      WHERE m."roleId" = "role"."id"
        AND m."userId" = current_setting('app.user_id', true)
    )
  );

-- Writes: strictly tenant-scoped — the bootstrap identity gets no write path.
CREATE POLICY role_insert ON "role" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY role_update ON "role" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY role_delete ON "role" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- ── membership ──────────────────────────────────────────────────────────
ALTER TABLE "membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "membership" FORCE ROW LEVEL SECURITY;

CREATE POLICY membership_select ON "membership" FOR SELECT
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR "userId" = current_setting('app.user_id', true)
  );

-- Writes: strictly tenant-scoped. Deliberately NOT the user_id branch —
-- otherwise the bootstrap identity could self-grant memberships.
CREATE POLICY membership_insert ON "membership" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY membership_update ON "membership" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY membership_delete ON "membership" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));
