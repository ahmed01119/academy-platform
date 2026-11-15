-- =====================================================================================================================
-- M3 (Phase 3A.2, S3 + S6). DRAFT FOR REVIEW - not in prisma/migrations, not applied anywhere except the isolated
-- test database. Requires M2.
--
-- Purpose
--   1. S6: users has no RLS, yet Neon's runtime role (sportexus_app) may UPDATE is_platform_super_admin,
--      is_platform_owner, is_suspended, must_reset_password and password_hash on ANY row, and DELETE any row. Any query
--      running as the runtime role could therefore promote an account to platform owner, take over an account or
--      delete one. CI's runtime role is already tested to be denied these (runtime-role-privileges.sql); Neon's was
--      provisioned by hand (packages/database/scripts/provision-runtime-role.sql) with the broader set.
--      These columns become writable only through definer functions that enforce the platform rules in the database.
--   2. S3: the operations that today rely on owner privileges (tenant creation on approval, permanent academy
--      deletion, platform users with privileged flags) get definer functions, so the runtime role never needs
--      INSERT/DELETE on tenants (also asserted by runtime-role-privileges.sql).
--   3. One runtime privilege baseline in a migration, applied to every runtime role that exists, so self-host/VPS
--      (academy_runtime), CI (academy_runtime_ci) and Neon (sportexus_app) converge and later migrations own all
--      object privileges. Re-running provision-runtime-role.sql must no longer re-grant what M2/M3 revoke (that
--      script is reduced to role-level setup in the same change).
--
-- Safety: idempotent; the owner / BYPASSRLS connection used by today's Neon API is unaffected by every REVOKE.
-- Rollback (forward migration): see the end of this file.
-- =====================================================================================================================


-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Own password change (replaces the direct UPDATE of users.password_hash)
-- ---------------------------------------------------------------------------------------------------------------------
-- The application verifies the current password (Argon2id, in Node) and passes the new hash. The database guarantees:
-- only the signed-in user's own row (actor from context, no user id parameter), not suspended, a real Argon2 hash (not
-- a placeholder such as INVITED_PENDING_ACTIVATION). K13b in one place: the user row is updated first (row lock,
-- session_version + 1), then every refresh token is revoked; outstanding reset codes and links are cleared.
-- Returns the new session version for the tokens issued to the caller in the same transaction.
CREATE OR REPLACE FUNCTION public.change_own_password(p_new_password_hash text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := public.current_app_user_id();
  v_version integer;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_new_password_hash IS NULL OR p_new_password_hash !~ '^\$argon2(id|i|d)\$' THEN
    RAISE EXCEPTION 'PASSWORD_HASH_INVALID' USING ERRCODE = '22023';
  END IF;

  UPDATE public.users
  SET password_hash = p_new_password_hash,
      session_version = session_version + 1,
      password_reset_token = NULL,
      password_reset_link_token = NULL,
      password_reset_expires_at = NULL,
      updated_at = now()
  WHERE id = v_actor AND NOT is_suspended
  RETURNING session_version INTO v_version;
  IF v_version IS NULL THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE' USING ERRCODE = '42501';
  END IF;

  UPDATE public.refresh_tokens SET is_revoked = true WHERE user_id = v_actor AND NOT is_revoked;
  RETURN v_version;
END;
$$;


-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Platform user administration (privileged flags only through these functions)
-- ---------------------------------------------------------------------------------------------------------------------
-- Shared rules, mirroring PlatformService today, now also enforced in the database:
--   * caller = current_app_user_id(), must be an active (not suspended) platform administrator;
--   * anything that grants or changes platform-owner status, or acts on a platform owner, requires an active
--     platform owner;
--   * the last active (not suspended) platform owner can never be removed or suspended.
-- The hard-coded "primary owner e-mail" safeguard stays in the application only.

-- New user with platform flags (platform staff invitation) or a plain invited user (academy member invitation).
-- Creating a super admin or owner requires a platform owner (today's rule: only the owner invites platform admins).
CREATE OR REPLACE FUNCTION public.platform_create_user(
  p_email text,
  p_name text,
  p_phone text DEFAULT NULL,
  p_is_platform_super_admin boolean DEFAULT false,
  p_is_platform_owner boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text := trim(coalesce(p_name, ''));
BEGIN
  IF NOT public.is_current_user_super_admin() THEN
    RAISE EXCEPTION 'PLATFORM_ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF (coalesce(p_is_platform_super_admin, false) OR coalesce(p_is_platform_owner, false))
     AND NOT public.is_current_user_platform_owner() THEN
    RAISE EXCEPTION 'PLATFORM_OWNER_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' OR length(v_email) > 254 THEN
    RAISE EXCEPTION 'EMAIL_INVALID' USING ERRCODE = '22023';
  END IF;
  IF v_name = '' OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'NAME_INVALID' USING ERRCODE = '22023';
  END IF;

  -- An owner is always also a super admin (as PlatformService sets it).
  INSERT INTO public.users (
    id, email, name, phone, password_hash, is_platform_super_admin, is_platform_owner, must_reset_password,
    created_at, updated_at
  )
  VALUES (
    v_id, v_email, v_name, nullif(trim(coalesce(p_phone, '')), ''), 'INVITED_PENDING_ACTIVATION',
    coalesce(p_is_platform_super_admin, false) OR coalesce(p_is_platform_owner, false),
    coalesce(p_is_platform_owner, false), true, now(), now()
  );
  RETURN v_id;
END;
$$;

-- Platform role of an existing user: 'PLATFORM_OWNER', 'SUPER_ADMIN' or 'REVOKE'. Platform owner only.
-- A demotion (any flag removed) ends the user's sessions (K13b) in the same statement sequence.
CREATE OR REPLACE FUNCTION public.platform_set_user_platform_role(p_target_user_id uuid, p_role text)
RETURNS TABLE (is_platform_super_admin boolean, is_platform_owner boolean, session_version integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_admin boolean;
  v_owner boolean;
  v_old_admin boolean;
  v_old_owner boolean;
  v_version integer;
BEGIN
  IF NOT public.is_current_user_platform_owner() THEN
    RAISE EXCEPTION 'PLATFORM_OWNER_REQUIRED' USING ERRCODE = '42501';
  END IF;
  CASE p_role
    WHEN 'PLATFORM_OWNER' THEN v_admin := true;  v_owner := true;
    WHEN 'SUPER_ADMIN'    THEN v_admin := true;  v_owner := false;
    WHEN 'REVOKE'         THEN v_admin := false; v_owner := false;
    ELSE RAISE EXCEPTION 'PLATFORM_ROLE_INVALID' USING ERRCODE = '22023';
  END CASE;

  SELECT u.is_platform_super_admin, u.is_platform_owner INTO v_old_admin, v_old_owner
  FROM public.users u WHERE u.id = p_target_user_id FOR UPDATE;
  IF v_old_admin IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_old_owner AND NOT v_owner AND NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.is_platform_owner AND NOT u.is_suspended AND u.id <> p_target_user_id
  ) THEN
    RAISE EXCEPTION 'LAST_PLATFORM_OWNER' USING ERRCODE = '42501';
  END IF;

  UPDATE public.users u
  SET is_platform_super_admin = v_admin,
      is_platform_owner = v_owner,
      session_version = CASE WHEN (v_old_admin AND NOT v_admin) OR (v_old_owner AND NOT v_owner)
                             THEN u.session_version + 1 ELSE u.session_version END,
      updated_at = now()
  WHERE u.id = p_target_user_id
  RETURNING u.session_version INTO v_version;
  IF (v_old_admin AND NOT v_admin) OR (v_old_owner AND NOT v_owner) THEN
    UPDATE public.refresh_tokens SET is_revoked = true WHERE user_id = p_target_user_id AND NOT is_revoked;
  END IF;
  RETURN QUERY SELECT v_admin, v_owner, v_version;
END;
$$;

-- Security policy of a user: force password reset and/or suspend (NULL = leave unchanged). Platform administrators;
-- a platform owner target requires a platform owner caller; the last active owner cannot be suspended. Suspension ends
-- every session (version + 1, refresh tokens revoked); lifting it clears the reason.
CREATE OR REPLACE FUNCTION public.platform_update_user_security(
  p_target_user_id uuid,
  p_must_reset_password boolean DEFAULT NULL,
  p_is_suspended boolean DEFAULT NULL,
  p_suspended_reason text DEFAULT NULL
)
RETURNS TABLE (must_reset_password boolean, is_suspended boolean, session_version integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_target_owner boolean;
  v_was_suspended boolean;
  v_suspending boolean := coalesce(p_is_suspended, false);
  v_must boolean;
  v_susp boolean;
  v_version integer;
BEGIN
  IF NOT public.is_current_user_super_admin() THEN
    RAISE EXCEPTION 'PLATFORM_ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;
  SELECT u.is_platform_owner, u.is_suspended INTO v_target_owner, v_was_suspended
  FROM public.users u WHERE u.id = p_target_user_id FOR UPDATE;
  IF v_target_owner IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_target_owner AND NOT public.is_current_user_platform_owner() THEN
    RAISE EXCEPTION 'PLATFORM_OWNER_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF v_target_owner AND v_suspending AND NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.is_platform_owner AND NOT u.is_suspended AND u.id <> p_target_user_id
  ) THEN
    RAISE EXCEPTION 'LAST_PLATFORM_OWNER' USING ERRCODE = '42501';
  END IF;

  UPDATE public.users u
  SET must_reset_password = coalesce(p_must_reset_password, u.must_reset_password),
      is_suspended = coalesce(p_is_suspended, u.is_suspended),
      suspended_reason = CASE
        WHEN p_is_suspended IS TRUE THEN left(coalesce(nullif(trim(p_suspended_reason), ''), 'Suspended by Super Admin'), 500)
        WHEN p_is_suspended IS FALSE THEN NULL
        ELSE u.suspended_reason END,
      session_version = CASE WHEN v_suspending THEN u.session_version + 1 ELSE u.session_version END,
      updated_at = now()
  WHERE u.id = p_target_user_id
  RETURNING u.must_reset_password, u.is_suspended, u.session_version INTO v_must, v_susp, v_version;
  IF v_suspending THEN
    UPDATE public.refresh_tokens SET is_revoked = true WHERE user_id = p_target_user_id AND NOT is_revoked;
  END IF;
  RETURN QUERY SELECT v_must, v_susp, v_version;
END;
$$;

-- "Revoke all sessions" from the platform console. Platform administrators; another platform owner's sessions require
-- a platform owner (an owner may always end their own). Returns the number of refresh tokens revoked.
CREATE OR REPLACE FUNCTION public.platform_revoke_user_sessions(p_target_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target_owner boolean;
  v_count integer;
BEGIN
  IF NOT public.is_current_user_super_admin() THEN
    RAISE EXCEPTION 'PLATFORM_ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;
  SELECT is_platform_owner INTO v_target_owner FROM public.users WHERE id = p_target_user_id;
  IF v_target_owner IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_target_owner AND p_target_user_id <> public.current_app_user_id()
     AND NOT public.is_current_user_platform_owner() THEN
    RAISE EXCEPTION 'PLATFORM_OWNER_REQUIRED' USING ERRCODE = '42501';
  END IF;
  -- K13b order: user row first (lock + version), then the refresh tokens.
  UPDATE public.users SET session_version = session_version + 1, updated_at = now() WHERE id = p_target_user_id;
  UPDATE public.refresh_tokens SET is_revoked = true WHERE user_id = p_target_user_id AND NOT is_revoked;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Academy provisioning and deletion (the runtime role never gets INSERT/DELETE on tenants)
-- ---------------------------------------------------------------------------------------------------------------------
-- Approves an application and provisions the academy, exactly as PlatformService.reviewAcademyApplication does today:
-- tenant (ACTIVE, EGP, Africa/Cairo), main branch, OWNER membership for the applicant, SaaS subscription (requested
-- active plan, else STARTER; monthly; renewal in one month), application marked APPROVED. Platform administrators
-- only; an already approved application is refused; the slug's uniqueness is enforced by the tenants index.
-- (Approving a REJECTED application is still possible, as today; see the review notes.)
CREATE OR REPLACE FUNCTION public.platform_approve_academy_application(
  p_application_id uuid,
  p_plan_code text DEFAULT NULL,
  p_review_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := public.current_app_user_id();
  v_app public.academy_applications%ROWTYPE;
  v_tenant uuid := gen_random_uuid();
  v_plan_code public."SaaSPlanCode";
  v_price double precision;
BEGIN
  IF NOT public.is_current_user_super_admin() THEN
    RAISE EXCEPTION 'PLATFORM_ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_app FROM public.academy_applications WHERE id = p_application_id FOR UPDATE;
  IF v_app.id IS NULL THEN
    RAISE EXCEPTION 'APPLICATION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_app.status = 'APPROVED' THEN
    RAISE EXCEPTION 'APPLICATION_ALREADY_APPROVED' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.tenants (id, name, slug, status, currency, timezone, created_at, updated_at)
  VALUES (v_tenant, v_app.academy_name, v_app.academy_slug, 'ACTIVE', 'EGP', 'Africa/Cairo', now(), now());
  INSERT INTO public.branches (id, tenant_id, code, name, status, created_at, updated_at)
  VALUES (gen_random_uuid(), v_tenant, 'MAIN', 'الفرع الرئيسي', 'ACTIVE', now(), now());
  INSERT INTO public.tenant_memberships (id, tenant_id, user_id, role, status, created_at, updated_at)
  VALUES (gen_random_uuid(), v_tenant, v_app.applicant_user_id, 'OWNER', 'ACTIVE', now(), now());

  SELECT p.code, p.price_monthly INTO v_plan_code, v_price
  FROM public.saas_plans p
  WHERE p.code::text = p_plan_code AND p.is_active;
  INSERT INTO public.tenant_subscriptions (
    id, tenant_id, plan_code, status, billing_cycle, negotiated_price, currency, renewal_date, auto_renew,
    created_at, updated_at
  )
  VALUES (
    gen_random_uuid(), v_tenant, coalesce(v_plan_code, 'STARTER'), 'ACTIVE', 'MONTHLY', v_price, 'EGP',
    now() + interval '1 month', true, now(), now()
  );

  UPDATE public.academy_applications
  SET status = 'APPROVED',
      review_notes = nullif(trim(coalesce(p_review_notes, '')), ''),
      reviewed_by_user_id = v_actor,
      reviewed_at = now(),
      provisioned_tenant_id = v_tenant,
      updated_at = now()
  WHERE id = p_application_id;
  RETURN v_tenant;
END;
$$;

-- Permanent deletion of an academy without history, as PlatformService.deleteOrArchiveAcademy does today: platform
-- owner only; the typed confirmation slug must match; refused when the academy has players, financial transactions or
-- attendance events. (Archiving stays a tenant UPDATE under the existing platform-admin policy.)
CREATE OR REPLACE FUNCTION public.platform_delete_academy(p_tenant_id uuid, p_confirmation_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_slug text;
BEGIN
  IF NOT public.is_current_user_platform_owner() THEN
    RAISE EXCEPTION 'PLATFORM_OWNER_REQUIRED' USING ERRCODE = '42501';
  END IF;
  SELECT slug INTO v_slug FROM public.tenants WHERE id = p_tenant_id FOR UPDATE;
  IF v_slug IS NULL THEN
    RAISE EXCEPTION 'ACADEMY_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF p_confirmation_slug IS DISTINCT FROM v_slug THEN
    RAISE EXCEPTION 'CONFIRMATION_SLUG_MISMATCH' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.players WHERE tenant_id = p_tenant_id)
     OR EXISTS (SELECT 1 FROM public.academy_financial_transactions WHERE tenant_id = p_tenant_id)
     OR EXISTS (SELECT 1 FROM public.attendance_events WHERE tenant_id = p_tenant_id) THEN
    RAISE EXCEPTION 'ACADEMY_HAS_HISTORY' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.tenants WHERE id = p_tenant_id;
END;
$$;


-- ---------------------------------------------------------------------------------------------------------------------
-- 4. Function privileges
-- ---------------------------------------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.change_own_password(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_create_user(text, text, text, boolean, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_set_user_platform_role(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_update_user_security(uuid, boolean, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_revoke_user_sessions(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_approve_academy_application(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_delete_academy(uuid, text) FROM PUBLIC;


-- ---------------------------------------------------------------------------------------------------------------------
-- 5. Runtime privilege baseline (all runtime roles that exist)
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  r text;
  t text;
  f text;
BEGIN
  -- 5a. users (no RLS): read; register (7 columns, unchanged); own profile (name, phone). Nothing else.
  --     REVOKE ALL also drops every column-level grant on the table.
  FOREACH r IN ARRAY ARRAY['academy_runtime', 'academy_runtime_ci', 'sportexus_app', 'academy_app_user'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON TABLE public.users FROM %I', r);
      -- tenants: never INSERT/DELETE/TRUNCATE for the runtime role (provisioning and deletion via functions).
      EXECUTE format('REVOKE INSERT, DELETE, TRUNCATE ON TABLE public.tenants FROM %I', r);
    END IF;
  END LOOP;

  FOREACH r IN ARRAY ARRAY['academy_runtime', 'academy_runtime_ci', 'sportexus_app'] LOOP
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r);

    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', r);
    EXECUTE format('REVOKE CREATE ON SCHEMA public FROM %I', r);

    EXECUTE format('GRANT SELECT ON TABLE public.users TO %I', r);
    EXECUTE format('GRANT INSERT (id, email, password_hash, name, phone, created_at, updated_at) ON TABLE public.users TO %I', r);
    EXECUTE format('GRANT UPDATE (name, phone, updated_at) ON TABLE public.users TO %I', r);

    -- 5b. tenants: read and update under RLS (own tenant, or platform administrators).
    EXECUTE format('GRANT SELECT, UPDATE ON TABLE public.tenants TO %I', r);

    -- 5c. Append-only tables: read and insert only (the triggers also block UPDATE/DELETE).
    FOREACH t IN ARRAY ARRAY['attendance_corrections', 'attendance_events'] LOOP
      EXECUTE format('GRANT SELECT, INSERT ON TABLE public.%I TO %I', t, r);
      EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.%I FROM %I', t, r);
    END LOOP;

    -- 5d. Operational tables under RLS: full DML, never TRUNCATE (same list as provision-runtime-role.sql, minus the
    --     four tables narrowed by M2: audit_logs, app_notifications, academy_applications,
    --     player_registration_requests).
    FOREACH t IN ARRAY ARRAY[
      'refresh_tokens', 'tenant_memberships', 'invitations', 'branches', 'tenant_sports', 'attendance_sessions',
      'attendance_records', 'attendance_idempotency', 'players', 'guardians', 'player_enrollments',
      'training_groups', 'group_coaches', 'group_members', 'training_schedules', 'evaluation_templates',
      'player_evaluations', 'saas_plans', 'tenant_subscriptions', 'saas_invoices', 'player_subscription_plans',
      'player_subscriptions', 'academy_financial_transactions', 'session_cashier_closings', 'platform_announcements'
    ] LOOP
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO %I', t, r);
      EXECUTE format('REVOKE TRUNCATE ON TABLE public.%I FROM %I', t, r);
    END LOOP;

    EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', r);

    -- 5e. Every definer function the application calls (existing ones from earlier migrations, M1, M2, M3).
    FOREACH f IN ARRAY ARRAY[
      'public.issue_user_onboarding_token(uuid)',
      'public.issue_user_onboarding_token(uuid, text, timestamptz)',
      'public.issue_user_redemption_challenge(uuid, text, text)',
      'public.issue_user_redemption_challenge(uuid, text, timestamptz)',
      'public.provision_tenant_onboarding(uuid, text, text, text, text, text, text)',
      'public.redeem_invitation_and_activate_membership(uuid, text, text)',
      'public.inspect_invitation_preview(text)',
      'public.verify_user_email(text)',
      'public.request_email_verification(text, text, timestamptz)',
      'public.request_password_reset(text, text, timestamptz)',
      'public.complete_password_reset(text, text)',
      'public.request_password_reset_with_link(text, text, text, timestamptz)',
      'public.complete_password_reset_for_email(text, text, text)',
      'public.complete_password_reset_by_link(text, text)',
      'public.invalidate_password_reset_code_for_email(text)',
      'public.change_own_password(text)',
      'public.platform_create_user(text, text, text, boolean, boolean)',
      'public.platform_set_user_platform_role(uuid, text)',
      'public.platform_update_user_security(uuid, boolean, boolean, text)',
      'public.platform_revoke_user_sessions(uuid)',
      'public.platform_approve_academy_application(uuid, text, text)',
      'public.platform_delete_academy(uuid, text)'
    ] LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I', f, r);
    END LOOP;
  END LOOP;
END $$;

-- =====================================================================================================================
-- Rollback (forward migration). Re-granting the S6 privileges re-opens privilege escalation; do it only together with
-- switching the API back to the owner connection.
--   DROP FUNCTION IF EXISTS public.platform_delete_academy(uuid, text),
--     public.platform_approve_academy_application(uuid, text, text), public.platform_revoke_user_sessions(uuid),
--     public.platform_update_user_security(uuid, boolean, boolean, text),
--     public.platform_set_user_platform_role(uuid, text),
--     public.platform_create_user(text, text, text, boolean, boolean), public.change_own_password(text);
--   For sportexus_app only (Neon's previous state):
--     GRANT DELETE ON public.users TO sportexus_app;
--     GRANT UPDATE (password_hash, must_reset_password, is_suspended, suspended_reason, is_platform_super_admin,
--       is_platform_owner, session_version) ON public.users TO sportexus_app;
--   The 5d/5e grants are additive for existing roles and need no rollback. Never drop the session_version columns.
-- =====================================================================================================================
