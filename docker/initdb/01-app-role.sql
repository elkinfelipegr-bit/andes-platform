-- Runs once on first container start, connected to the `andes` database as
-- the postgres superuser.
--
-- andes_app is the runtime identity: RLS policies (RFC-001 layer 2) only
-- bite for non-superusers, so connecting the app as postgres would silently
-- disable the backstop. Migrations and seed keep using postgres.
CREATE ROLE andes_app LOGIN PASSWORD 'andes_app' NOSUPERUSER NOCREATEDB NOCREATEROLE;

GRANT CONNECT ON DATABASE andes TO andes_app;
GRANT USAGE ON SCHEMA public TO andes_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO andes_app;

-- Tables are created later by `prisma migrate` as postgres; make sure the
-- grants extend to them automatically.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO andes_app;
