-- =============================================================================
-- SPORTEXUS — Staging & Production Runtime Role Provisioning Script
-- =============================================================================
-- Target Database: Hostless PostgreSQL (`sportexus-api-staging`) or Production
-- Run as: Administrative database user (e.g. `academy` or `postgres`)
-- Safety: Completely idempotent; safe to execute before or after migrations.
--
-- PURPOSE:
--   Creates the dedicated, unprivileged `sportexus_app` runtime user and grants
--   the minimum necessary permissions across all tables, columns, sequences,
--   and SECURITY DEFINER procedures.
--
-- PREREQUISITE RECOMMENDATION:
--   For complete table-level grants, ensure Prisma migrations have been executed
--   (`prisma migrate deploy`) prior to or immediately following this script.
--
-- SECURITY INVARIANTS:
--   - Role attributes: NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
--   - No CREATE privilege on schema public.
--   - Never owns application tables or schemas.
--   - Column-level boundaries on public.users prevent tampering with identity
--     tokens (onboarding_token, redemption_challenge, email_verification_token).
--   - Platform tenant creation via direct INSERT is revoked.
--   - Audit logs, attendance corrections, and events are append-only.
-- =============================================================================

-- =============================================================================
-- STEP 1 — Role Creation (Idempotent)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sportexus_app') THEN
    -- REPLACE <STRONG_RUNTIME_PASSWORD> with a cryptographically secure random password
    CREATE ROLE sportexus_app
      LOGIN
      PASSWORD '<STRONG_RUNTIME_PASSWORD>'
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOBYPASSRLS
      CONNECTION LIMIT 50;
    RAISE NOTICE 'Role sportexus_app created.';
  ELSE
    ALTER ROLE sportexus_app
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOBYPASSRLS;
    RAISE NOTICE 'Role sportexus_app exists. Reaffirmed least-privilege role flags.';
  END IF;
END $$;

-- =============================================================================
-- STEP 2 — Database Connection & Schema Privileges
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
-- STEP 3 — Default Privileges for Tables & Sequences
-- Ensures that future migrations run by the current admin role (e.g. `academy`)
-- automatically grant appropriate permissions to `sportexus_app`.
-- =============================================================================
DO $$
DECLARE
  v_current_user text := current_user;
BEGIN
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sportexus_app', v_current_user);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO sportexus_app', v_current_user);
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sportexus_app';
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO sportexus_app';
END $$;

-- =============================================================================
-- STEP 4 — Existing Table & Column Privileges (Wrapped in Existence Guards)
-- =============================================================================

-- 4.1. public.users — Column-Level Security Boundary
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
    REVOKE ALL ON TABLE public.users FROM sportexus_app;
    GRANT SELECT, DELETE ON TABLE public.users TO sportexus_app;

    -- Permitted INSERT columns for standard self-registration
    GRANT INSERT (
      id,
      email,
      password_hash,
      name,
      phone,
      created_at,
      updated_at
    ) ON TABLE public.users TO sportexus_app;

    -- Permitted UPDATE columns (excludes onboarding_token, redemption_challenge,
    -- email_verification_token, password_reset_token, is_email_verified)
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
  END IF;
END $$;

-- 4.2. public.tenants — Tenant Provisioning Boundary
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenants') THEN
    GRANT SELECT, UPDATE ON TABLE public.tenants TO sportexus_app;
    REVOKE INSERT, DELETE, TRUNCATE ON TABLE public.tenants FROM sportexus_app;
  END IF;
END $$;

-- 4.3. Append-Only Tables (SELECT and INSERT only)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs') THEN
    GRANT SELECT, INSERT ON TABLE public.audit_logs TO sportexus_app;
    REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.audit_logs FROM sportexus_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'attendance_corrections') THEN
    GRANT SELECT, INSERT ON TABLE public.attendance_corrections TO sportexus_app;
    REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.attendance_corrections FROM sportexus_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'attendance_events') THEN
    GRANT SELECT, INSERT ON TABLE public.attendance_events TO sportexus_app;
    REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.attendance_events FROM sportexus_app;
  END IF;
END $$;

-- 4.4. Operational Application Tables (Full Standard CRUD)
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
-- STEP 5 — Sequence Privileges
-- =============================================================================
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sportexus_app;

-- =============================================================================
-- STEP 6 — SECURITY DEFINER & Business Procedure Execution Privileges
-- =============================================================================
DO $$
BEGIN
  -- RLS & Identity Context Helpers
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

  -- Token Generation & Identity Lifecycle
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'issue_user_onboarding_token') THEN
    GRANT EXECUTE ON FUNCTION public.issue_user_onboarding_token(uuid) TO sportexus_app;
    GRANT EXECUTE ON FUNCTION public.issue_user_onboarding_token(uuid, text, timestamptz) TO sportexus_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'issue_user_redemption_challenge') THEN
    GRANT EXECUTE ON FUNCTION public.issue_user_redemption_challenge(uuid, text, text) TO sportexus_app;
    GRANT EXECUTE ON FUNCTION public.issue_user_redemption_challenge(uuid, text, timestamptz) TO sportexus_app;
  END IF;

  -- Provisioning & Redemption
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'provision_tenant_onboarding') THEN
    REVOKE EXECUTE ON FUNCTION public.provision_tenant_onboarding(uuid, text, text, text, text, text, text) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.provision_tenant_onboarding(uuid, text, text, text, text, text, text) TO sportexus_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'redeem_invitation_and_activate_membership') THEN
    REVOKE EXECUTE ON FUNCTION public.redeem_invitation_and_activate_membership(uuid, text, text) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.redeem_invitation_and_activate_membership(uuid, text, text) TO sportexus_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'inspect_invitation_preview') THEN
    GRANT EXECUTE ON FUNCTION public.inspect_invitation_preview(text) TO sportexus_app;
  END IF;

  -- Email Verification & Password Recovery
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

RAISE NOTICE '=== SPORTEXUS sportexus_app role provisioning completed successfully. ===';
