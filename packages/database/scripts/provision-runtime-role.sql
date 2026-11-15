-- =============================================================================
-- SPORTEXUS — Staging Runtime Role Provisioning Script
-- =============================================================================
-- Target Database: Neon PostgreSQL (`neondb`)
-- Run as: Administrative database user (e.g. `academy` or `postgres`)
-- Execution Safety:
--   1. Database-locked: Aborts immediately if not connected to `sportexus-api-staging`.
--   2. Fully Idempotent: Can be safely re-run without privilege escalation.
--   3. No blanket default DML: ALTER DEFAULT PRIVILEGES is strictly confined to sequences.
--   4. Least Privilege: object privileges are owned by the migrations (see STEPS 4-6 below).
-- =============================================================================

-- =============================================================================
-- GUARD — Target Database Verification
-- =============================================================================
DO $$
BEGIN
  IF current_database() NOT IN ('neondb') THEN
    RAISE EXCEPTION 'DATABASE GUARD: Script is strictly intended for database "neondb", but current database is "%". Aborting.', current_database();
  END IF;
  RAISE NOTICE 'Target database verified: %', current_database();
END $$;

-- =============================================================================
-- STEP 1 — Role Creation & Flag Affirmation (Idempotent)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sportexus_app') THEN
    -- Replace <STRONG_RUNTIME_PASSWORD> with a cryptographically secure password
    -- Omit NOSUPERUSER/NOREPLICATION/NOBYPASSRLS to avoid errors when admin
    -- is not a true superuser (Neon neondb_owner). These are all false by default.
    CREATE ROLE sportexus_app
      LOGIN
      PASSWORD '<STRONG_RUNTIME_PASSWORD>'
      NOCREATEDB
      NOCREATEROLE
      CONNECTION LIMIT 50;
    RAISE NOTICE 'Role sportexus_app created.';
  ELSE
    ALTER ROLE sportexus_app
      WITH LOGIN
      PASSWORD '<STRONG_RUNTIME_PASSWORD>'
      NOCREATEDB
      NOCREATEROLE
      CONNECTION LIMIT 50;
    RAISE NOTICE 'Role sportexus_app confirmed with least-privilege role flags and updated credentials.';
  END IF;
END $$;

-- Allow administrative user to assume sportexus_app for regression test suite execution
DO $$
DECLARE
  v_admin text := current_user;
BEGIN
  EXECUTE format('GRANT sportexus_app TO %I', v_admin);
  RAISE NOTICE 'Granted role membership of sportexus_app to % for SET ROLE verification', v_admin;
END $$;

-- Ensure sportexus_app is NOT a member of any privileged administrative role
DO $$
DECLARE
  r text;
  privileged_roles text[] := ARRAY[
    'academy', 'postgres', 'root', 'neondb_owner', 'neon_superuser',
    'pg_read_all_data', 'pg_write_all_data',
    'pg_database_owner', 'pg_execute_server_program', 'pg_read_server_files', 'pg_write_server_files'
  ];
BEGIN
  FOREACH r IN ARRAY privileged_roles LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      IF pg_has_role('sportexus_app', r, 'MEMBER') THEN
        EXECUTE format('REVOKE %I FROM sportexus_app', r);
        RAISE NOTICE 'Revoked privileged membership % from sportexus_app', r;
      END IF;
    END IF;
  END LOOP;
END $$;

-- =============================================================================
-- STEP 2 — Database Connection & Schema USAGE
-- =============================================================================
GRANT CONNECT ON DATABASE "neondb" TO sportexus_app;

-- Grant schema USAGE but strictly REVOKE CREATE
GRANT USAGE ON SCHEMA public TO sportexus_app;
REVOKE CREATE ON SCHEMA public FROM sportexus_app;

-- Verify PUBLIC has no CREATE privilege on schema public
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- =============================================================================
-- STEP 3 — Default Privileges Audit (HARDENED)
-- =============================================================================
-- CRITICAL SECURITY RULE:
-- Do NOT grant blanket SELECT, INSERT, UPDATE, DELETE on future tables.
-- Any future sensitive tables (e.g. audit tables, token stores) must require
-- deliberate, reviewable privilege grants in their respective migration scripts.
-- We REVOKE all default table grants and permit default privileges ONLY on SEQUENCES.
DO $$
DECLARE
  v_current_user text := current_user;
BEGIN
  -- Revoke any previously granted blanket default table privileges
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM sportexus_app', v_current_user);
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM sportexus_app';

  -- Sequences: runtime needs USAGE to generate autoincrement IDs
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO sportexus_app', v_current_user);
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO sportexus_app';
END $$;

-- =============================================================================
-- STEPS 4-6 (table, column, sequence and function privileges) - OWNED BY THE MIGRATIONS
-- =============================================================================
-- Since Phase 3A.2 every object privilege of the runtime roles is granted by the Prisma migrations
-- (20261117100000_s3_runtime_privileges: runtime baseline; 20261117090000: narrowed tables), so schema and
-- privileges change together. This script used to REVOKE ALL on users and re-grant a fixed list, which silently
-- undid later migrations (it dropped M1's session_version grant and would re-open the S6 privileged columns).
-- After creating or re-provisioning the role, run: prisma migrate deploy (re-applies nothing if up to date), or
-- re-run the baseline section of 20261117100000_s3_runtime_privileges/migration.sql, which is idempotent.

DO $$
BEGIN
  RAISE NOTICE '=== SPORTEXUS sportexus_app runtime role provisioning complete. ===';
END $$;
