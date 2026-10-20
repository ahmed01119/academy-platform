-- Sprint 1: Security Hardening - Runtime Role Column Privileges & Anti-Impersonation
-- Eliminates runtime SQL privilege escalation where an attacker could rewrite
-- onboarding_token or redemption_challenge to forge identity proofs.

-- 1. Enforce column-level privilege boundary on public.users for runtime role
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'academy_runtime_ci') THEN
    REVOKE ALL ON TABLE public.users FROM academy_runtime_ci;
    GRANT SELECT, INSERT, DELETE ON TABLE public.users TO academy_runtime_ci;
    GRANT UPDATE (
      name,
      phone,
      password_hash,
      is_email_verified,
      email_verification_token,
      email_verification_expires_at,
      password_reset_token,
      password_reset_expires_at,
      updated_at
    ) ON TABLE public.users TO academy_runtime_ci;
  END IF;
END $$;

-- 2. Update provision_tenant_onboarding to enforce single-use and valid token
CREATE OR REPLACE FUNCTION public.provision_tenant_onboarding(
  p_user_id uuid,
  p_tenant_name text,
  p_tenant_slug text,
  p_branch_name text DEFAULT 'Main Branch',
  p_branch_code text DEFAULT 'MAIN',
  p_sport text DEFAULT 'FOOTBALL',
  p_onboarding_token text DEFAULT NULL
)
RETURNS TABLE (
  tenant_id uuid,
  tenant_name text,
  tenant_slug text,
  branch_id uuid,
  branch_name text,
  membership_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_user_email text;
  v_expected_hash text;
  v_expires_at timestamptz;
  v_tenant_id uuid := gen_random_uuid();
  v_branch_id uuid := gen_random_uuid();
  v_membership_id uuid := gen_random_uuid();
  v_sport_id uuid := gen_random_uuid();
  v_tenant_slug text;
  v_tenant_name text;
  v_branch_name text;
  v_sport_enum public."SportCode";
BEGIN
  -- Input validation
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_REQUIRED' USING ERRCODE = '23502';
  END IF;

  IF p_onboarding_token IS NULL OR trim(p_onboarding_token) = '' THEN
    RAISE EXCEPTION 'ONBOARDING_TOKEN_REQUIRED' USING ERRCODE = '42501';
  END IF;

  v_tenant_name := trim(COALESCE(p_tenant_name, ''));
  IF v_tenant_name = '' THEN
    RAISE EXCEPTION 'TENANT_NAME_REQUIRED' USING ERRCODE = '22023';
  END IF;

  v_tenant_slug := lower(trim(COALESCE(p_tenant_slug, '')));
  IF v_tenant_slug = '' THEN
    RAISE EXCEPTION 'TENANT_SLUG_REQUIRED' USING ERRCODE = '22023';
  END IF;

  -- Verify user exists and check single-use onboarding authorization token
  SELECT email, onboarding_token, onboarding_expires_at
  INTO v_user_email, v_expected_hash, v_expires_at
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_expected_hash IS NULL OR v_expires_at IS NULL OR v_expires_at <= now() THEN
    RAISE EXCEPTION 'ONBOARDING_NOT_AUTHORIZED_OR_EXPIRED' USING ERRCODE = '42501';
  END IF;

  -- Cryptographic anti-impersonation token check (SHA-256 match)
  IF encode(sha256(p_onboarding_token::bytea), 'hex') <> v_expected_hash THEN
    RAISE EXCEPTION 'INVALID_ONBOARDING_TOKEN_IMPERSONATION_REJECTED' USING ERRCODE = '42501';
  END IF;

  -- Invalidate token immediately to prevent replay
  UPDATE public.users
  SET onboarding_token = NULL, onboarding_expires_at = NULL
  WHERE id = p_user_id;

  -- Parse sport enum safely
  BEGIN
    v_sport_enum := p_sport::public."SportCode";
  EXCEPTION WHEN others THEN
    v_sport_enum := 'FOOTBALL'::public."SportCode";
  END;

  v_branch_name := trim(COALESCE(p_branch_name, 'Main Branch'));

  -- Create tenant (slug uniqueness enforced by index)
  INSERT INTO public.tenants (id, name, slug, status, currency, timezone, updated_at)
  VALUES (
    v_tenant_id,
    v_tenant_name,
    v_tenant_slug,
    'ACTIVE',
    'EGP',
    'Africa/Cairo',
    now()
  );

  -- Create initial branch
  INSERT INTO public.branches (id, tenant_id, code, name, city, country, status, updated_at)
  VALUES (
    v_branch_id,
    v_tenant_id,
    upper(trim(COALESCE(p_branch_code, 'MAIN'))),
    v_branch_name,
    'Cairo',
    'EG',
    'ACTIVE',
    now()
  );

  -- Create primary sport
  INSERT INTO public.tenant_sports (id, tenant_id, sport, is_primary)
  VALUES (
    v_sport_id,
    v_tenant_id,
    v_sport_enum,
    true
  );

  -- Create owner membership
  INSERT INTO public.tenant_memberships (id, tenant_id, user_id, branch_id, role, status, updated_at)
  VALUES (
    v_membership_id,
    v_tenant_id,
    p_user_id,
    v_branch_id,
    'OWNER',
    'ACTIVE',
    now()
  );

  RETURN QUERY SELECT v_tenant_id, v_tenant_name, v_tenant_slug, v_branch_id, v_branch_name, v_membership_id;
END;
$$;

-- 3. Update redeem_invitation_and_activate_membership to support challenge verification when present or raw invitation secret
CREATE OR REPLACE FUNCTION public.redeem_invitation_and_activate_membership(
  p_actor_user_id uuid,
  p_token_hash text,
  p_redemption_challenge text DEFAULT NULL
)
RETURNS TABLE (
  invitation_id uuid,
  tenant_id uuid,
  tenant_name text,
  role text,
  branch_id uuid,
  membership_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_user_email text;
  v_user_verified boolean;
  v_expected_challenge_hash text;
  v_challenge_expires_at timestamptz;
  v_invitation record;
  v_tenant_name text;
  v_membership_id uuid;
  v_computed_hash text;
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_REQUIRED' USING ERRCODE = '23502';
  END IF;

  IF trim(COALESCE(p_token_hash, '')) = '' THEN
    RAISE EXCEPTION 'TOKEN_REQUIRED' USING ERRCODE = '22023';
  END IF;

  -- Fetch user and lock row
  SELECT email, is_email_verified, redemption_challenge, redemption_expires_at
  INTO v_user_email, v_user_verified, v_expected_challenge_hash, v_challenge_expires_at
  FROM public.users
  WHERE id = p_actor_user_id
  FOR UPDATE;

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF NOT COALESCE(v_user_verified, false) THEN
    RAISE EXCEPTION 'EMAIL_NOT_VERIFIED' USING ERRCODE = '42501';
  END IF;

  -- If user has an active challenge configured, verify challenge token
  IF v_expected_challenge_hash IS NOT NULL THEN
    IF v_challenge_expires_at IS NULL OR v_challenge_expires_at <= now() THEN
      RAISE EXCEPTION 'REDEMPTION_CHALLENGE_EXPIRED_OR_ABSENT' USING ERRCODE = '42501';
    END IF;

    IF p_redemption_challenge IS NULL OR encode(sha256(p_redemption_challenge::bytea), 'hex') <> v_expected_challenge_hash THEN
      RAISE EXCEPTION 'INVALID_REDEMPTION_CHALLENGE_IMPERSONATION_REJECTED' USING ERRCODE = '42501';
    END IF;

    -- Invalidate challenge immediately
    UPDATE public.users
    SET redemption_challenge = NULL, redemption_expires_at = NULL
    WHERE id = p_actor_user_id;
  END IF;

  -- Lock invitation row FOR UPDATE to prevent concurrent redemption
  -- Matches either direct hash or sha256(token)
  v_computed_hash := encode(sha256(p_token_hash::bytea), 'hex');
  SELECT id, tenant_id, branch_id, role, email, status, expires_at
  INTO v_invitation
  FROM public.invitations
  WHERE (token = p_token_hash OR token = v_computed_hash)
  FOR UPDATE;

  IF v_invitation.id IS NULL THEN
    RAISE EXCEPTION 'INVALID_OR_EXPIRED_INVITATION' USING ERRCODE = 'P0002';
  END IF;

  IF v_invitation.status <> 'PENDING' OR v_invitation.expires_at <= now() THEN
    RAISE EXCEPTION 'INVALID_OR_EXPIRED_INVITATION' USING ERRCODE = 'P0002';
  END IF;

  -- Strict email identity match (case-insensitive, trimmed)
  IF lower(trim(v_invitation.email)) <> lower(trim(v_user_email)) THEN
    RAISE EXCEPTION 'INVITATION_EMAIL_MISMATCH' USING ERRCODE = '42501';
  END IF;

  SELECT name INTO v_tenant_name
  FROM public.tenants
  WHERE id = v_invitation.tenant_id AND status = 'ACTIVE';

  IF v_tenant_name IS NULL THEN
    RAISE EXCEPTION 'TENANT_NOT_ACTIVE' USING ERRCODE = 'P0002';
  END IF;

  IF v_invitation.branch_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.branches
      WHERE id = v_invitation.branch_id
        AND tenant_id = v_invitation.tenant_id
        AND status = 'ACTIVE'
    ) THEN
      RAISE EXCEPTION 'BRANCH_INVALID' USING ERRCODE = '23503';
    END IF;
  END IF;

  -- Consume invitation atomically
  UPDATE public.invitations
  SET status = 'ACCEPTED'
  WHERE id = v_invitation.id;

  -- Upsert tenant membership
  INSERT INTO public.tenant_memberships (
    id,
    tenant_id,
    user_id,
    branch_id,
    role,
    status,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    v_invitation.tenant_id,
    p_actor_user_id,
    v_invitation.branch_id,
    v_invitation.role,
    'ACTIVE',
    now()
  )
  ON CONFLICT (tenant_id, user_id) DO UPDATE
  SET role = EXCLUDED.role,
      branch_id = EXCLUDED.branch_id,
      status = 'ACTIVE',
      updated_at = now()
  RETURNING id INTO v_membership_id;

  RETURN QUERY SELECT
    v_invitation.id,
    v_invitation.tenant_id,
    v_tenant_name,
    v_invitation.role::text,
    v_invitation.branch_id,
    v_membership_id;
END;
$$;

-- 4. Re-grant execute permissions to restricted runtime role
REVOKE ALL ON FUNCTION public.provision_tenant_onboarding(uuid, text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_invitation_and_activate_membership(uuid, text, text) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'academy_runtime_ci') THEN
    GRANT EXECUTE ON FUNCTION public.provision_tenant_onboarding(uuid, text, text, text, text, text, text) TO academy_runtime_ci;
    GRANT EXECUTE ON FUNCTION public.redeem_invitation_and_activate_membership(uuid, text, text) TO academy_runtime_ci;
  END IF;
END $$;
