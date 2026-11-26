-- Creates the CI runtime role BEFORE "Deploy Prisma migrations" (Phase 3A.2), so that
-- the migrations (M3 baseline) own every object privilege of the CI runtime role, exactly as
-- they do for academy_runtime (self-host) and sportexus_app (Neon). Disposable CI database only.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'academy_runtime_ci') THEN
    CREATE ROLE academy_runtime_ci NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;
GRANT CONNECT ON DATABASE academy TO academy_runtime_ci;
REVOKE CREATE ON SCHEMA public FROM academy_runtime_ci;
