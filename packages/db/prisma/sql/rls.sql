-- RLS policies — RFC-001 layer 2 (defense-in-depth backstop behind the
-- tRPC tenant-scoping middleware). Apply as a raw-SQL migration step after
-- the initial `prisma migrate dev`, e.g.:
--   pnpm --filter @andes/db exec prisma migrate dev --create-only
--   (paste this file into the generated migration, then migrate dev)
--
-- Convention: the app sets `app.tenant_id` per connection/transaction
-- (SET LOCAL app.tenant_id = '<tenantId from session>') before querying.
-- Note: Prisma connects as the table owner by default, and owners bypass
-- RLS unless FORCE is used — hence FORCE ROW LEVEL SECURITY below.

-- role: tenant-scoped
ALTER TABLE "role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_role ON "role"
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- membership: tenant-scoped
ALTER TABLE "membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "membership" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_membership ON "membership"
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- "tenant" and "user" are intentionally NOT under these policies:
-- tenant IS the scope, and user is global identity (see schema.prisma).
-- Access to both is gated at the application layer (auth + membership).
