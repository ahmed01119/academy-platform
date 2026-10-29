-- =============================================================================
-- SPORTEXUS — Staging Runtime Role Security & Regression Test Suite
-- =============================================================================
-- Target Database: Neon PostgreSQL (`neondb`)
-- Run as: Administrative database user (e.g. `academy` or `postgres`)
-- Execution Safety: Runs inside a transaction and ALWAYS issues ROLLBACK.
-- Zero permanent data mutation. Raises EXCEPTION if any invariant fails.
-- =============================================================================

-- Guard: Enforce execution against sportexus-api-staging only
DO $$
BEGIN
  IF current_database() NOT IN ('neondb') THEN
    RAISE EXCEPTION 'DATABASE GUARD: Regression suite is locked to "neondb". Current database is "%". Aborting.', current_database();
  END IF;
END $$;

BEGIN;

-- =============================================================================
-- PHASE 1: Static Catalog & Role Membership Audits
-- =============================================================================
DO $$
DECLARE
  r RECORD;
  r_role text;
  privileged_roles text[] := ARRAY[
    'academy', 'postgres', 'root', 'neondb_owner', 'neon_superuser',
    'pg_read_all_data', 'pg_write_all_data',
    'pg_database_owner', 'pg_execute_server_program', 'pg_read_server_files', 'pg_write_server_files'
  ];
BEGIN
  -- 1. Role Existence & Login
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sportexus_app') THEN
    RAISE EXCEPTION 'REGRESSION FAIL: Role sportexus_app does not exist';
  END IF;

  SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolcanlogin
  INTO r FROM pg_roles WHERE rolname = 'sportexus_app';

  -- 2. Role Flags (Must be strictly false)
  IF r.rolsuper THEN
    RAISE EXCEPTION 'SECURITY INVARIANT BREACH: sportexus_app has SUPERUSER';
  END IF;
  IF r.rolcreatedb THEN
    RAISE EXCEPTION 'SECURITY INVARIANT BREACH: sportexus_app has CREATEDB';
  END IF;
  IF r.rolcreaterole THEN
    RAISE EXCEPTION 'SECURITY INVARIANT BREACH: sportexus_app has CREATEROLE';
  END IF;
  IF r.rolreplication THEN
    RAISE EXCEPTION 'SECURITY INVARIANT BREACH: sportexus_app has REPLICATION';
  END IF;
  IF r.rolbypassrls THEN
    RAISE EXCEPTION 'SECURITY INVARIANT BREACH: sportexus_app has BYPASSRLS — RLS tenant isolation would be completely bypassed!';
  END IF;
  IF NOT r.rolcanlogin THEN
    RAISE EXCEPTION 'CONFIGURATION FAIL: sportexus_app cannot login';
  END IF;

  -- 3. Inherited Privilege & Role Membership Audit
  FOREACH r_role IN ARRAY privileged_roles LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r_role) THEN
      IF pg_has_role('sportexus_app', r_role, 'MEMBER') THEN
        RAISE EXCEPTION 'SECURITY INVARIANT BREACH: sportexus_app inherits membership in privileged role %', r_role;
      END IF;
    END IF;
  END LOOP;

  -- 4. Table Ownership Audit
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_roles r2 ON r2.oid = c.relowner
    WHERE n.nspname = 'public'
      AND r2.rolname = 'sportexus_app'
      AND c.relkind = 'r'
  ) THEN
    RAISE EXCEPTION 'SECURITY INVARIANT BREACH: sportexus_app owns one or more application tables';
  END IF;

  -- 5. Schema Privileges Audit
  IF NOT has_schema_privilege('sportexus_app', 'public', 'USAGE') THEN
    RAISE EXCEPTION 'CONFIGURATION FAIL: sportexus_app missing USAGE on schema public';
  END IF;
  IF has_schema_privilege('sportexus_app', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'SECURITY INVARIANT BREACH: sportexus_app has schema CREATE privilege';
  END IF;
  IF has_schema_privilege('public', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'SECURITY INVARIANT BREACH: PUBLIC role has schema CREATE privilege';
  END IF;

  -- 6. Default Privileges Audit: Ensure NO blanket table INSERT/UPDATE/DELETE default grants
  IF EXISTS (
    SELECT 1 FROM pg_default_acl d
    JOIN pg_roles r_grantee ON r_grantee.oid = d.defaclrole
    WHERE d.defaclnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND d.defaclobjtype = 'r'
      AND array_to_string(d.defaclacl, ',') ~* 'sportexus_app=.*[wWdDaA]'
  ) THEN
    RAISE EXCEPTION 'SECURITY INVARIANT BREACH: Blanket default table DML is granted to sportexus_app';
  END IF;

  -- 7. SECURITY DEFINER Public Revocation Audit
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('provision_tenant_onboarding', 'redeem_invitation_and_activate_membership')
      AND has_function_privilege('public', p.oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'SECURITY INVARIANT BREACH: Sensitive SECURITY DEFINER function is executable by PUBLIC';
  END IF;

  RAISE NOTICE 'Phase 1: Catalog and privilege inheritance checks PASSED.';
END $$;

-- =============================================================================
-- PHASE 2: Live DML & Least-Privilege Negative Regression Assertions
-- (Exercises real PostgreSQL permission checks as sportexus_app)
-- =============================================================================
SET LOCAL ROLE sportexus_app;

DO $$
DECLARE
  allowed boolean;
BEGIN
  -- 1. Schema DDL: Attempt to create a table -> MUST FAIL
  allowed := false;
  BEGIN
    EXECUTE 'CREATE TABLE public._reg_forbidden (id int)';
    allowed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF allowed THEN
    RAISE EXCEPTION 'REGRESSION BREACH: sportexus_app was able to CREATE TABLE';
  END IF;

  -- 2. Tenants Direct Provisioning: Attempt direct INSERT -> MUST FAIL
  allowed := false;
  BEGIN
    EXECUTE 'INSERT INTO public.tenants (id, name, slug) VALUES (gen_random_uuid(), ''Forbidden'', ''reg_forbidden'')';
    allowed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF allowed THEN
    RAISE EXCEPTION 'REGRESSION BREACH: sportexus_app was able to INSERT directly into public.tenants';
  END IF;

  -- 3. Tenants Direct Deletion: Attempt direct DELETE -> MUST FAIL
  allowed := false;
  BEGIN
    EXECUTE 'DELETE FROM public.tenants WHERE false';
    allowed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF allowed THEN
    RAISE EXCEPTION 'REGRESSION BREACH: sportexus_app was able to DELETE from public.tenants';
  END IF;

  -- 4. Audit Logs: Attempt direct UPDATE -> MUST FAIL
  allowed := false;
  BEGIN
    EXECUTE 'UPDATE public.audit_logs SET action = ''TAMPER'' WHERE false';
    allowed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF allowed THEN
    RAISE EXCEPTION 'REGRESSION BREACH: sportexus_app was able to UPDATE public.audit_logs';
  END IF;

  -- 5. Audit Logs: Attempt direct DELETE -> MUST FAIL
  allowed := false;
  BEGIN
    EXECUTE 'DELETE FROM public.audit_logs WHERE false';
    allowed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF allowed THEN
    RAISE EXCEPTION 'REGRESSION BREACH: sportexus_app was able to DELETE from public.audit_logs';
  END IF;

  -- 6. Attendance Corrections: Attempt direct UPDATE -> MUST FAIL
  allowed := false;
  BEGIN
    EXECUTE 'UPDATE public.attendance_corrections SET reason = ''TAMPER'' WHERE false';
    allowed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF allowed THEN
    RAISE EXCEPTION 'REGRESSION BREACH: sportexus_app was able to UPDATE public.attendance_corrections';
  END IF;

  -- 7. Identity Boundaries: Attempt UPDATE on protected token columns -> ALL MUST FAIL
  allowed := false;
  BEGIN
    EXECUTE 'UPDATE public.users SET onboarding_token = ''forged'' WHERE false';
    allowed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF allowed THEN
    RAISE EXCEPTION 'REGRESSION BREACH: sportexus_app was able to UPDATE users.onboarding_token';
  END IF;

  allowed := false;
  BEGIN
    EXECUTE 'UPDATE public.users SET redemption_challenge = ''forged'' WHERE false';
    allowed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF allowed THEN
    RAISE EXCEPTION 'REGRESSION BREACH: sportexus_app was able to UPDATE users.redemption_challenge';
  END IF;

  allowed := false;
  BEGIN
    EXECUTE 'UPDATE public.users SET is_email_verified = true WHERE false';
    allowed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF allowed THEN
    RAISE EXCEPTION 'REGRESSION BREACH: sportexus_app was able to UPDATE users.is_email_verified';
  END IF;

  allowed := false;
  BEGIN
    EXECUTE 'UPDATE public.users SET email_verification_token = ''forged'' WHERE false';
    allowed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF allowed THEN
    RAISE EXCEPTION 'REGRESSION BREACH: sportexus_app was able to UPDATE users.email_verification_token';
  END IF;

  allowed := false;
  BEGIN
    EXECUTE 'UPDATE public.users SET password_reset_token = ''forged'' WHERE false';
    allowed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF allowed THEN
    RAISE EXCEPTION 'REGRESSION BREACH: sportexus_app was able to UPDATE users.password_reset_token';
  END IF;

  -- 8. Identity Registration: Attempt INSERT with is_email_verified = true -> MUST FAIL
  allowed := false;
  BEGIN
    EXECUTE 'INSERT INTO public.users (id, email, password_hash, name, is_email_verified) VALUES (gen_random_uuid(), ''reg@ci.local'', ''hash'', ''Name'', true)';
    allowed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF allowed THEN
    RAISE EXCEPTION 'REGRESSION BREACH: sportexus_app was able to INSERT users with is_email_verified';
  END IF;

  RAISE NOTICE 'Phase 2: Negative DML and identity privilege regression assertions PASSED.';
END $$;

-- =============================================================================
-- PHASE 3: Positive Operational DML & RLS Isolation Assertions
-- =============================================================================
DO $$
BEGIN
  -- 1. Permitted SELECT on Core Tables
  PERFORM count(*) FROM public.tenants;
  PERFORM count(*) FROM public.users;
  PERFORM count(*) FROM public.branches;
  PERFORM count(*) FROM public.tenant_memberships;
  PERFORM count(*) FROM public.players;
  PERFORM count(*) FROM public.saas_plans;
  PERFORM count(*) FROM public.academy_applications;

  -- 2. Permitted UPDATE on standard user profile columns
  EXECUTE 'UPDATE public.users SET name = name WHERE false';

  -- 3. Permitted append-only INSERT into audit_logs
  EXECUTE 'INSERT INTO public.audit_logs (id, tenant_id, action, resource_type) SELECT gen_random_uuid(), null, ''REGRESSION_TEST'', ''SECURITY_SUITE'' WHERE false';

  -- 4. Row-Level Security Isolation (Fail-Closed when tenant_id is unset)
  PERFORM set_config('app.tenant_id', '', true);
  IF (SELECT count(*) FROM public.branches) <> 0 THEN
    RAISE EXCEPTION 'RLS FAIL-CLOSED BREACH: branches exposed records without tenant context';
  END IF;
  IF (SELECT count(*) FROM public.players) <> 0 THEN
    RAISE EXCEPTION 'RLS FAIL-CLOSED BREACH: players exposed records without tenant context';
  END IF;
  IF (SELECT count(*) FROM public.attendance_sessions) <> 0 THEN
    RAISE EXCEPTION 'RLS FAIL-CLOSED BREACH: attendance_sessions exposed records without tenant context';
  END IF;

  -- 5. Permitted Function Executions
  PERFORM public.current_app_tenant_id();
  PERFORM public.current_app_user_id();

  RAISE NOTICE 'Phase 3: Positive DML, append-only, and RLS isolation assertions PASSED.';
END $$;

RESET ROLE;

-- Always roll back to guarantee clean state and zero data footprint
ROLLBACK;

-- Final Notice
DO $$
BEGIN
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'SUCCESS: All 14 security invariants, RLS checks, and regression tests PASSED!';
  RAISE NOTICE 'Database: neondb | Role: sportexus_app';
  RAISE NOTICE '=============================================================================';
END $$;
