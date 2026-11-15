-- Phase 3A.2 draft: replaces packages/database/tests/runtime-role-setup.sql in CI and runs BEFORE
-- "Deploy Prisma migrations", so the migrations (M2/M3) own every object privilege of the CI runtime role, exactly as
-- they do for academy_runtime (self-host) and sportexus_app (Neon). Disposable CI database only.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'academy_runtime_ci') THEN
    CREATE ROLE academy_runtime_ci NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;
GRANT CONNECT ON DATABASE academy TO academy_runtime_ci;
REVOKE CREATE ON SCHEMA public FROM academy_runtime_ci;
