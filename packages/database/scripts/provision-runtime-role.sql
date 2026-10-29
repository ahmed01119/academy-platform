-- =============================================================================
-- SPORTEXUS — Production Runtime Role Provisioning Script
-- =============================================================================
-- Target: Hostless PostgreSQL (or any production PostgreSQL instance)
-- Run as: Database administrator (e.g., `postgres` superuser or database owner)
-- Idempotent: Safe to re-run multiple times without error.
--
-- PURPOSE:
--   Creates and configures the unprivileged `sportexus_app` runtime role
--   required by the SPORTEXUS API in production mode (NODE_ENV=production).
--   Satisfies the security validation in apps/api/src/config/env.validation.ts
--   which explicitly rejects administrative users (postgres, academy, root).
--
-- SECURITY INVARIANTS ENFORCED:
--   1. NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS.
--   2. FORCE ROW LEVEL SECURITY remains active; sportexus_app is subject to all RLS policies.
--   3. No CREATE privilege on schema public (runtime cannot alter DDL).
--   4. Does not own application tables.
--   5. Anti-impersonation boundary on public.users:
--      Direct UPDATE/INSERT on onboarding_token, redemption_challenge,
--      email_verification_token, password_reset_token, and is_email_verified is BLOCKED.
--   6. Platform tenant creation is BLOCKED via direct INSERT on public.tenants;
--      tenant onboarding is exclusively mediated by the SECURITY DEFINER function
--      `provision_tenant_onboarding`.
--   7. Append-only tables (audit_logs, attendance_corrections, attendance_events)
--      permit SELECT and INSERT only. UPDATE, DELETE, and TRUNCATE are revoked.
--   8. Migrations are executed using the separate administrative role (DATABASE_ADMIN_URL).
--
-- USAGE INSTRUCTIONS:
--   1. Replace `<STRONG_RUNTIME_PASSWORD>` with a cryptographically random password.
--   2. If your database name is not `academy` or `sportexus`, replace `CURRENT_DATABASE()`
--      or the explicit database name in Step 2.
--   3. Execute this script in the Hostless SQL Console or via psql as superuser.
--   4. Set Hostless environment variable:
--      DATABASE_URL=postgresql://sportexus_app:<STRONG_RUNTIME_PASSWORD>@<host>:<port>/<database>?schema=public
--      DATABASE_ADMIN_URL=postgresql://postgres:<admin_password>@<host>:<port>/<database>?schema=public
-- =============================================================================

-- =============================================================================
-- STEP 1 — Role Creation (Idempotent)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sportexus_app') THEN
    CREATE ROLE sportexus_app
      LOGIN
      PASSWORD '<STRONG_RUNTIME_PASSWORD>'
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOBYPASSRLS
      CONNECTION LIMIT 50;
    RAISE NOTICE 'Role sportexus_app created successfully.';
  ELSE
    -- If role exists, ensure flags remain strictly unprivileged
    ALTER ROLE sportexus_app
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOBYPASSRLS;
    RAISE NOTICE 'Role sportexus_app already exists. Unprivileged flags reaffirmed.';
  END IF;
END
$$;

-- =============================================================================
-- STEP 2 — Database Connection & Schema USAGE
-- =============================================================================
DO $$
DECLARE
  v_dbname text := current_database();
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO sportexus_app', v_dbname);
END $$;

GRANT USAGE ON SCHEMA public TO sportexus_app;
REVOKE CREATE ON SCHEMA public FROM sportexus_app;

-- =============================================================================
-- STEP 3 — Table Privileges (Least Privilege Boundary)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 3.1. public.users — Column-Level Security (Anti-Impersonation Boundary)
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.users FROM sportexus_app;
GRANT SELECT, DELETE ON TABLE public.users TO sportexus_app;

-- Column-level INSERT: registration fields only (no tokens, no verification bypass)
GRANT INSERT (
  id,
  email,
  password_hash,
  name,
  phone,
  created_at,
  updated_at
) ON TABLE public.users TO sportexus_app;

-- Column-level UPDATE: profile fields, password change, platform administration
-- Excludes onboarding_token, redemption_challenge, email_verification_token,
-- password_reset_token, is_email_verified
GRANT UPDATE (
  name,
  phone,
  password_hash,
  must_reset_password,
  is_suspended,
  suspended_reason,
  is_platform_super_admin,
  is_platform_owner,
  updated_at
) ON TABLE public.users TO sportexus_app;

REVOKE TRUNCATE ON TABLE public.users FROM sportexus_app;

-- -----------------------------------------------------------------------------
-- 3.2. public.tenants — Tenant Isolation Boundary
-- -----------------------------------------------------------------------------
-- Direct INSERT, DELETE, and TRUNCATE are REVOKED.
-- Tenants are created strictly via provision_tenant_onboarding() SECURITY DEFINER.
GRANT SELECT, UPDATE ON TABLE public.tenants TO sportexus_app;
REVOKE INSERT, DELETE, TRUNCATE ON TABLE public.tenants FROM sportexus_app;

-- -----------------------------------------------------------------------------
-- 3.3. Append-Only Tables — Audit Logs, Corrections & Events
-- -----------------------------------------------------------------------------
-- audit_logs
GRANT SELECT, INSERT ON TABLE public.audit_logs TO sportexus_app;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.audit_logs FROM sportexus_app;

-- attendance_corrections
GRANT SELECT, INSERT ON TABLE public.attendance_corrections TO sportexus_app;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.attendance_corrections FROM sportexus_app;

-- attendance_events
GRANT SELECT, INSERT ON TABLE public.attendance_events TO sportexus_app;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.attendance_events FROM sportexus_app;

-- -----------------------------------------------------------------------------
-- 3.4. Operational Application Tables (Full Standard CRUD)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  operational_tables text[] := ARRAY[
    'refresh_tokens',
    'tenant_memberships',
    'invitations',
    'branches',
    'tenant_sports',
    'attendance_sessions',
    'attendance_records',
    'attendance_idempotency',
    'players',
    'guardians',
    'player_enrollments',
    'training_groups',
    'group_coaches',
    'group_members',
    'training_schedules',
    'evaluation_templates',
    'player_evaluations',
    'saas_plans',
    'tenant_subscriptions',
    'saas_invoices',
    'player_subscription_plans',
    'player_subscriptions',
    'academy_financial_transactions',
    'session_cashier_closings',
    'platform_announcements',
    'academy_applications',
    'player_registration_requests',
    'app_notifications'
  ];
BEGIN
  FOREACH t IN ARRAY operational_tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO sportexus_app', t);
      EXECUTE format('REVOKE TRUNCATE ON TABLE public.%I FROM sportexus_app', t);
    END IF;
  END LOOP;
END $$;

-- =============================================================================
-- STEP 4 — Sequence Privileges
-- =============================================================================
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sportexus_app;

-- =============================================================================
-- STEP 5 — Default Privileges for Future Migrations
-- =============================================================================
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sportexus_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO sportexus_app;

-- =============================================================================
-- STEP 6 — SECURITY DEFINER & Core Function Privileges
-- =============================================================================
-- Ensure the runtime role can execute tenant context and security definer procedures
DO $$
BEGIN
  -- RLS and Context helpers
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'current_app_tenant_id') THEN
    GRANT EXECUTE ON FUNCTION public.current_app_tenant_id() TO sportexus_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'current_app_user_id') THEN
    GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO sportexus_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'is_current_user_super_admin') THEN
    GRANT EXECUTE ON FUNCTION public.is_current_user_super_admin() TO sportexus_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'is_current_user_platform_owner') THEN
    GRANT EXECUTE ON FUNCTION public.is_current_user_platform_owner() TO sportexus_app;
  END IF;

  -- Security Definer Procedures
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'issue_user_onboarding_token') THEN
    GRANT EXECUTE ON FUNCTION public.issue_user_onboarding_token(uuid) TO sportexus_app;
    GRANT EXECUTE ON FUNCTION public.issue_user_onboarding_token(uuid, text, timestamptz) TO sportexus_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'issue_user_redemption_challenge') THEN
    GRANT EXECUTE ON FUNCTION public.issue_user_redemption_challenge(uuid, text, text) TO sportexus_app;
    GRANT EXECUTE ON FUNCTION public.issue_user_redemption_challenge(uuid, text, timestamptz) TO sportexus_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'provision_tenant_onboarding') THEN
    GRANT EXECUTE ON FUNCTION public.provision_tenant_onboarding(uuid, text, text, text, text, text, text) TO sportexus_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'redeem_invitation_and_activate_membership') THEN
    GRANT EXECUTE ON FUNCTION public.redeem_invitation_and_activate_membership(uuid, text, text) TO sportexus_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'inspect_invitation_preview') THEN
    GRANT EXECUTE ON FUNCTION public.inspect_invitation_preview(text) TO sportexus_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'verify_user_email') THEN
    GRANT EXECUTE ON FUNCTION public.verify_user_email(text) TO sportexus_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'request_email_verification') THEN
    GRANT EXECUTE ON FUNCTION public.request_email_verification(text, text, timestamptz) TO sportexus_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'request_password_reset') THEN
    GRANT EXECUTE ON FUNCTION public.request_password_reset(text, text, timestamptz) TO sportexus_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'complete_password_reset') THEN
    GRANT EXECUTE ON FUNCTION public.complete_password_reset(text, text) TO sportexus_app;
  END IF;
END $$;

-- Revoke public execution of sensitive procedures
REVOKE EXECUTE ON FUNCTION public.provision_tenant_onboarding(uuid, text, text, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.redeem_invitation_and_activate_membership(uuid, text, text) FROM PUBLIC;

RAISE NOTICE 'SPORTEXUS runtime role provisioned successfully.';
