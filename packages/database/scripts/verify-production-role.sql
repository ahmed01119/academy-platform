-- =============================================================================
-- SPORTEXUS — Production Runtime Role Security Verification
-- =============================================================================
-- Run as: Database administrator (e.g. postgres) after executing provision-runtime-role.sql
-- Throws EXCEPTION if any invariant fails.
-- =============================================================================

DO $$
DECLARE
  r RECORD;
  allowed boolean := false;
BEGIN
  -- 1. Role exists
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sportexus_app') THEN
    RAISE EXCEPTION 'SECURITY FAIL: Role sportexus_app does not exist';
  END IF;

  SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolcanlogin
  INTO r FROM pg_roles WHERE rolname = 'sportexus_app';

  -- 2. Must NOT have elevated flags
  IF r.rolsuper THEN
    RAISE EXCEPTION 'SECURITY FAIL: sportexus_app has SUPERUSER';
  END IF;
  IF r.rolcreatedb THEN
    RAISE EXCEPTION 'SECURITY FAIL: sportexus_app has CREATEDB';
  END IF;
  IF r.rolcreaterole THEN
    RAISE EXCEPTION 'SECURITY FAIL: sportexus_app has CREATEROLE';
  END IF;
  IF r.rolreplication THEN
    RAISE EXCEPTION 'SECURITY FAIL: sportexus_app has REPLICATION';
  END IF;
  IF r.rolbypassrls THEN
    RAISE EXCEPTION 'SECURITY FAIL: sportexus_app has BYPASSRLS';
  END IF;

  -- 3. Must be able to login
  IF NOT r.rolcanlogin THEN
    RAISE EXCEPTION 'SECURITY FAIL: sportexus_app cannot login';
  END IF;

  -- 4. Must have CONNECT on current database
  IF NOT has_database_privilege('sportexus_app', current_database(), 'CONNECT') THEN
    RAISE EXCEPTION 'SECURITY FAIL: sportexus_app cannot CONNECT to database';
  END IF;

  -- 5. Must have USAGE on public schema
  IF NOT has_schema_privilege('sportexus_app', 'public', 'USAGE') THEN
    RAISE EXCEPTION 'SECURITY FAIL: sportexus_app cannot USAGE public schema';
  END IF;

  -- 6. Must NOT have CREATE on public schema
  IF has_schema_privilege('sportexus_app', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'SECURITY FAIL: sportexus_app has CREATE on public schema';
  END IF;

  -- 7. Must NOT own application tables
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_roles r2 ON r2.oid = c.relowner
    WHERE n.nspname = 'public'
      AND r2.rolname = 'sportexus_app'
      AND c.relkind = 'r'
  ) THEN
    RAISE EXCEPTION 'SECURITY FAIL: sportexus_app owns application tables';
  END IF;

  -- 8. Forbidden table mutations: tenants INSERT/DELETE/TRUNCATE
  IF has_table_privilege('sportexus_app', 'public.tenants', 'INSERT')
    OR has_table_privilege('sportexus_app', 'public.tenants', 'DELETE')
    OR has_table_privilege('sportexus_app', 'public.tenants', 'TRUNCATE') THEN
    RAISE EXCEPTION 'SECURITY FAIL: sportexus_app has forbidden privileges on public.tenants';
  END IF;

  -- 9. Append-only tables: audit_logs, attendance_corrections, attendance_events
  IF has_table_privilege('sportexus_app', 'public.audit_logs', 'UPDATE')
    OR has_table_privilege('sportexus_app', 'public.audit_logs', 'DELETE')
    OR has_table_privilege('sportexus_app', 'public.audit_logs', 'TRUNCATE') THEN
    RAISE EXCEPTION 'SECURITY FAIL: sportexus_app can mutate audit_logs';
  END IF;

  IF has_table_privilege('sportexus_app', 'public.attendance_corrections', 'UPDATE')
    OR has_table_privilege('sportexus_app', 'public.attendance_corrections', 'DELETE')
    OR has_table_privilege('sportexus_app', 'public.attendance_corrections', 'TRUNCATE') THEN
    RAISE EXCEPTION 'SECURITY FAIL: sportexus_app can mutate attendance_corrections';
  END IF;

  IF has_table_privilege('sportexus_app', 'public.attendance_events', 'UPDATE')
    OR has_table_privilege('sportexus_app', 'public.attendance_events', 'DELETE')
    OR has_table_privilege('sportexus_app', 'public.attendance_events', 'TRUNCATE') THEN
    RAISE EXCEPTION 'SECURITY FAIL: sportexus_app can mutate attendance_events';
  END IF;

  -- 10. Required SELECT permissions
  IF NOT has_table_privilege('sportexus_app', 'public.tenants', 'SELECT')
    OR NOT has_table_privilege('sportexus_app', 'public.users', 'SELECT')
    OR NOT has_table_privilege('sportexus_app', 'public.tenant_memberships', 'SELECT')
    OR NOT has_table_privilege('sportexus_app', 'public.branches', 'SELECT')
    OR NOT has_table_privilege('sportexus_app', 'public.audit_logs', 'INSERT') THEN
    RAISE EXCEPTION 'SECURITY FAIL: sportexus_app missing fundamental operational table privileges';
  END IF;

  RAISE NOTICE 'SUCCESS: All security verification checks passed for sportexus_app.';
END $$;
