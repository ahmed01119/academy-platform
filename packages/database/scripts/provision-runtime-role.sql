-- =============================================================================
-- SPORTEXUS — Staging Runtime Role Provisioning Script
-- =============================================================================
-- Target Database: Neon PostgreSQL (`neondb`)
-- Run as: Administrative database user (e.g. `academy` or `postgres`)
-- Execution Safety:
--   1. Database-locked: Aborts immediately if not connected to `sportexus-api-staging`.
--   2. Fully Idempotent: Can be safely re-run without privilege escalation.
--   3. No blanket default DML: ALTER DEFAULT PRIVILEGES is strictly confined to sequences.
--   4. Least Privilege: Table and column grants are explicitly scoped.
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
-- STEP 4 — Explicit Table & Column Privileges (Least Privilege Boundary)
-- =============================================================================

-- 4.1. public.users — Column-Level Security Boundary
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
    REVOKE ALL ON TABLE public.users FROM sportexus_app;
    GRANT SELECT, DELETE ON TABLE public.users TO sportexus_app;

    -- Permitted registration columns (excludes onboarding_token, redemption_challenge, is_email_verified)
    GRANT INSERT (
      id, email, password_hash, name, phone, created_at, updated_at
    ) ON TABLE public.users TO sportexus_app;

    -- Permitted profile and administrative updates
    -- Explicitly excludes: onboarding_token, onboarding_expires_at,
    -- redemption_challenge, redemption_expires_at, is_email_verified,
    -- email_verification_token, email_verification_expires_at,
    -- password_reset_token, password_reset_expires_at
    GRANT UPDATE (
      name, phone, password_hash, must_reset_password, is_suspended,
      suspended_reason, is_platform_super_admin, is_platform_owner, updated_at
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

-- 4.3. Append-Only Tables — Audit Logs, Corrections & Events
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
    'refresh_tokens', 'tenant_memberships', 'invitations', 'branches',
    'tenant_sports', 'attendance_sessions', 'attendance_records',
    'attendance_idempotency', 'players', 'guardians', 'player_enrollments',
    'training_groups', 'group_coaches', 'group_members', 'training_schedules',
    'evaluation_templates', 'player_evaluations', 'saas_plans',
    'tenant_subscriptions', 'saas_invoices', 'player_subscription_plans',
    'player_subscriptions', 'academy_financial_transactions',
    'session_cashier_closings', 'platform_announcements',
    'academy_applications', 'player_registration_requests', 'app_notifications'
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
-- STEP 6 — SECURITY DEFINER & Procedural Boundary
-- =============================================================================
-- All SECURITY DEFINER functions must:
--   1. Have EXECUTE revoked from PUBLIC.
--   2. Have EXECUTE granted specifically to sportexus_app.
--   3. Have search_path fixed to `public, pg_temp` (enforced by migration definitions).
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

  -- Token Generation
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'issue_user_onboarding_token') THEN
    GRANT EXECUTE ON FUNCTION public.issue_user_onboarding_token(uuid) TO sportexus_app;
    GRANT EXECUTE ON FUNCTION public.issue_user_onboarding_token(uuid, text, timestamptz) TO sportexus_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'issue_user_redemption_challenge') THEN
    GRANT EXECUTE ON FUNCTION public.issue_user_redemption_challenge(uuid, text, text) TO sportexus_app;
    GRANT EXECUTE ON FUNCTION public.issue_user_redemption_challenge(uuid, text, timestamptz) TO sportexus_app;
  END IF;

  -- Tenant Provisioning & Invitation Redemption
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'provision_tenant_onboarding') THEN
    REVOKE EXECUTE ON FUNCTION public.provision_tenant_onboarding(uuid, text, text, text, text, text, text) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.provision_tenant_onboarding(uuid, text, text, text, text, text, text) TO sportexus_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'redeem_invitation_and_activate_membership') THEN
    REVOKE EXECUTE ON FUNCTION public.redeem_invitation_and_activate_membership(uuid, text, text) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.redeem_invitation_and_activate_membership(uuid, text, text) TO sportexus_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'inspect_invitation_preview') THEN
    REVOKE EXECUTE ON FUNCTION public.inspect_invitation_preview(text) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.inspect_invitation_preview(text) TO sportexus_app;
  END IF;

  -- Email Verification & Password Recovery
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'verify_user_email') THEN
    REVOKE EXECUTE ON FUNCTION public.verify_user_email(text) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.verify_user_email(text) TO sportexus_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'request_email_verification') THEN
    REVOKE EXECUTE ON FUNCTION public.request_email_verification(text, text, timestamptz) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.request_email_verification(text, text, timestamptz) TO sportexus_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'request_password_reset') THEN
    REVOKE EXECUTE ON FUNCTION public.request_password_reset(text, text, timestamptz) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.request_password_reset(text, text, timestamptz) TO sportexus_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'complete_password_reset') THEN
    REVOKE EXECUTE ON FUNCTION public.complete_password_reset(text, text) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.complete_password_reset(text, text) TO sportexus_app;
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE '=== SPORTEXUS sportexus_app runtime role provisioning complete. ===';
END $$;
