-- =============================================================================
-- SPORTEXUS — Staging & Production Runtime Role Security Verification
-- =============================================================================
-- Run as: Database administrator (e.g. `academy` or `postgres`)
-- Purpose: Rigorously verifies all security boundaries and invariants for `sportexus_app`.
-- Result: Raises EXCEPTION on any failure; outputs NOTICE on complete success.
-- =============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  -- 1. Role Existence Check
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sportexus_app') THEN
    RAISE EXCEPTION 'SECURITY FAIL: Role sportexus_app does not exist in pg_roles';
  END IF;

  SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolcanlogin
  INTO r FROM pg_roles WHERE rolname = 'sportexus_app';

  -- 2. Elevated Role Flags Check (Must all be FALSE)
  IF r.rolsuper THEN
    RAISE EXCEPTION 'SECURITY FAIL: sportexus_app has SUPERUSER privilege';
  END IF;
  IF r.rolcreatedb THEN
    RAISE EXCEPTION 'SECURITY FAIL: sportexus_app has CREATEDB privilege';
  END IF;
  IF r.rolcreaterole THEN
    RAISE EXCEPTION 'SECURITY FAIL: sportexus_app has CREATEROLE privilege';
  END IF;
  IF r.rolreplication THEN
    RAISE EXCEPTION 'SECURITY FAIL: sportexus_app has REPLICATION privilege';
  END IF;
  IF r.rolbypassrls THEN
    RAISE EXCEPTION 'SECURITY FAIL: sportexus_app has BYPASSRLS privilege — RLS policies would be bypassed!';
  END IF;

  -- 3. Login Capability
  IF NOT r.rolcanlogin THEN
    RAISE EXCEPTION 'SECURITY FAIL: sportexus_app cannot login (rolcanlogin is false)';
  END IF;

  -- 4. Database CONNECT & Schema USAGE
  IF NOT has_database_privilege('sportexus_app', current_database(), 'CONNECT') THEN
    RAISE EXCEPTION 'SECURITY FAIL: sportexus_app cannot CONNECT to database %', current_database();
  END IF;

  IF NOT has_schema_privilege('sportexus_app', 'public', 'USAGE') THEN
    RAISE EXCEPTION 'SECURITY FAIL: sportexus_app lacks USAGE on public schema';
  END IF;

  -- 5. No Schema Mutation Privilege
  IF has_schema_privilege('sportexus_app', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'SECURITY FAIL: sportexus_app has CREATE on public schema (DDL tampering risk)';
  END IF;

  -- 6. No Table Ownership
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_roles r2 ON r2.oid = c.relowner
    WHERE n.nspname = 'public'
      AND r2.rolname = 'sportexus_app'
      AND c.relkind = 'r'
  ) THEN
    RAISE EXCEPTION 'SECURITY FAIL: sportexus_app owns one or more application tables';
  END IF;

  -- 7. Platform Tenant Provisioning Isolation
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenants') THEN
    IF has_table_privilege('sportexus_app', 'public.tenants', 'INSERT') THEN
      RAISE EXCEPTION 'SECURITY FAIL: sportexus_app has direct INSERT on public.tenants (must use provision_tenant_onboarding)';
    END IF;
    IF has_table_privilege('sportexus_app', 'public.tenants', 'DELETE') THEN
      RAISE EXCEPTION 'SECURITY FAIL: sportexus_app has DELETE on public.tenants';
    END IF;
    IF has_table_privilege('sportexus_app', 'public.tenants', 'TRUNCATE') THEN
      RAISE EXCEPTION 'SECURITY FAIL: sportexus_app has TRUNCATE on public.tenants';
    END IF;
  END IF;

  -- 8. Append-Only Tables Isolation
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs') THEN
    IF has_table_privilege('sportexus_app', 'public.audit_logs', 'UPDATE')
      OR has_table_privilege('sportexus_app', 'public.audit_logs', 'DELETE')
      OR has_table_privilege('sportexus_app', 'public.audit_logs', 'TRUNCATE') THEN
      RAISE EXCEPTION 'SECURITY FAIL: sportexus_app can mutate audit_logs (append-only violation)';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'attendance_corrections') THEN
    IF has_table_privilege('sportexus_app', 'public.attendance_corrections', 'UPDATE')
      OR has_table_privilege('sportexus_app', 'public.attendance_corrections', 'DELETE')
      OR has_table_privilege('sportexus_app', 'public.attendance_corrections', 'TRUNCATE') THEN
      RAISE EXCEPTION 'SECURITY FAIL: sportexus_app can mutate attendance_corrections (append-only violation)';
    END IF;
  END IF;

  -- 9. Anti-Impersonation Column Boundaries on public.users
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
    IF has_column_privilege('sportexus_app', 'public.users', 'onboarding_token', 'UPDATE') THEN
      RAISE EXCEPTION 'SECURITY FAIL: sportexus_app can UPDATE users.onboarding_token (anti-impersonation breach)';
    END IF;
    IF has_column_privilege('sportexus_app', 'public.users', 'redemption_challenge', 'UPDATE') THEN
      RAISE EXCEPTION 'SECURITY FAIL: sportexus_app can UPDATE users.redemption_challenge (anti-impersonation breach)';
    END IF;
    IF has_column_privilege('sportexus_app', 'public.users', 'is_email_verified', 'UPDATE') THEN
      RAISE EXCEPTION 'SECURITY FAIL: sportexus_app can directly UPDATE users.is_email_verified (verification bypass risk)';
    END IF;
  END IF;

  -- 10. Operational Privileges Check
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenants') THEN
    IF NOT has_table_privilege('sportexus_app', 'public.tenants', 'SELECT')
      OR NOT has_table_privilege('sportexus_app', 'public.users', 'SELECT')
      OR NOT has_table_privilege('sportexus_app', 'public.tenant_memberships', 'SELECT')
      OR NOT has_table_privilege('sportexus_app', 'public.branches', 'SELECT') THEN
      RAISE EXCEPTION 'SECURITY FAIL: sportexus_app missing core table SELECT privileges';
    END IF;
  END IF;

  RAISE NOTICE 'SUCCESS: All security verification assertions PASSED for sportexus_app on %.', current_database();
END $$;
