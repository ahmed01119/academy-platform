-- Sprint 1 Security Hardening: Identity Boundary, Controlled Sensitive Transitions & Invitation Redemption Hardening

-- 1. Security Definer Function: issue_user_onboarding_token
-- Runtime role cannot directly insert or update onboarding_token on public.users.
-- Onboarding tokens can strictly only be issued for users with ZERO memberships who do not already have an active onboarding token.
CREATE OR REPLACE FUNCTION public.issue_user_onboarding_token(
  p_user_id uuid,
  p_token_hash text,
  p_expires_at timestamptz DEFAULT (now() + interval '15 minutes')
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_REQUIRED' USING ERRCODE = '23502';
  END IF;
  IF p_token_hash IS NULL OR trim(p_token_hash) = '' THEN
    RAISE EXCEPTION 'TOKEN_REQUIRED' USING ERRCODE = '22023';
  END IF;

  -- Ensure user exists and has NO existing tenant memberships
  IF EXISTS (SELECT 1 FROM public.tenant_memberships WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'USER_ALREADY_MEMBER_OF_TENANT' USING ERRCODE = '42501';
  END IF;

  UPDATE public.users
  SET onboarding_token = p_token_hash,
      onboarding_expires_at = p_expires_at,
      updated_at = now()
  WHERE id = p_user_id
    AND onboarding_token IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ONBOARDING_TOKEN_ALREADY_ISSUED_OR_USER_NOT_FOUND' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- 2. Security Definer Function: issue_user_redemption_challenge
-- Enforces that a redemption challenge can only be issued for an existing, email-verified user.
CREATE OR REPLACE FUNCTION public.issue_user_redemption_challenge(
  p_user_id uuid,
  p_challenge_hash text,
  p_expires_at timestamptz DEFAULT (now() + interval '5 minutes')
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_REQUIRED' USING ERRCODE = '23502';
  END IF;
  IF p_challenge_hash IS NULL OR trim(p_challenge_hash) = '' THEN
    RAISE EXCEPTION 'CHALLENGE_REQUIRED' USING ERRCODE = '22023';
  END IF;

  UPDATE public.users
  SET redemption_challenge = p_challenge_hash,
      redemption_expires_at = p_expires_at,
      updated_at = now()
  WHERE id = p_user_id
    AND is_email_verified = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND_OR_UNVERIFIED' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- 3. Security Definer Function: verify_user_email
-- Verifies user email by presenting a valid, unexpired email verification token hash.
CREATE OR REPLACE FUNCTION public.verify_user_email(p_token_hash text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF p_token_hash IS NULL OR trim(p_token_hash) = '' THEN
    RAISE EXCEPTION 'TOKEN_REQUIRED' USING ERRCODE = '22023';
  END IF;

  UPDATE public.users
  SET is_email_verified = true,
      email_verification_token = NULL,
      email_verification_expires_at = NULL,
      updated_at = now()
  WHERE email_verification_token = p_token_hash
    AND email_verification_expires_at > now()
  RETURNING id INTO v_user_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_OR_EXPIRED_TOKEN' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_user_id;
END;
$$;

-- 4. Security Definer Function: request_email_verification
CREATE OR REPLACE FUNCTION public.request_email_verification(
  p_email text,
  p_token_hash text,
  p_expires_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'EMAIL_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_token_hash IS NULL OR trim(p_token_hash) = '' THEN
    RAISE EXCEPTION 'TOKEN_REQUIRED' USING ERRCODE = '22023';
  END IF;

  UPDATE public.users
  SET email_verification_token = p_token_hash,
      email_verification_expires_at = p_expires_at,
      updated_at = now()
  WHERE lower(trim(email)) = lower(trim(p_email))
    AND is_email_verified = false
  RETURNING id INTO v_user_id;

  RETURN v_user_id;
END;
$$;

-- 5. Security Definer Function: request_password_reset
CREATE OR REPLACE FUNCTION public.request_password_reset(
  p_email text,
  p_token_hash text,
  p_expires_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'EMAIL_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_token_hash IS NULL OR trim(p_token_hash) = '' THEN
    RAISE EXCEPTION 'TOKEN_REQUIRED' USING ERRCODE = '22023';
  END IF;

  UPDATE public.users
  SET password_reset_token = p_token_hash,
      password_reset_expires_at = p_expires_at,
      updated_at = now()
  WHERE lower(trim(email)) = lower(trim(p_email))
  RETURNING id INTO v_user_id;

  RETURN v_user_id;
END;
$$;

-- 6. Security Definer Function: complete_password_reset
CREATE OR REPLACE FUNCTION public.complete_password_reset(
  p_token_hash text,
  p_new_password_hash text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF p_token_hash IS NULL OR trim(p_token_hash) = '' THEN
    RAISE EXCEPTION 'TOKEN_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_new_password_hash IS NULL OR trim(p_new_password_hash) = '' THEN
    RAISE EXCEPTION 'PASSWORD_REQUIRED' USING ERRCODE = '22023';
  END IF;

  UPDATE public.users
  SET password_hash = p_new_password_hash,
      password_reset_token = NULL,
      password_reset_expires_at = NULL,
      updated_at = now()
  WHERE password_reset_token = p_token_hash
    AND password_reset_expires_at > now()
  RETURNING id INTO v_user_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_OR_EXPIRED_TOKEN' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_user_id;
END;
$$;

-- 7. Hardened redeem_invitation_and_activate_membership
-- Reject redemption when challenge is missing, expired, incorrect, or replayed.
-- Enforce authenticated identity, verified email, email match, pending status, expiry, tenant validity, branch validity.
DROP FUNCTION IF EXISTS public.redeem_invitation_and_activate_membership(uuid, text, text);

CREATE OR REPLACE FUNCTION public.redeem_invitation_and_activate_membership(
  p_actor_user_id uuid,
  p_token_hash text,
  p_redemption_challenge text
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

  -- Mandatory challenge enforcement: Reject redemption when the challenge is missing
  IF p_redemption_challenge IS NULL OR trim(p_redemption_challenge) = '' THEN
    RAISE EXCEPTION 'REDEMPTION_CHALLENGE_REQUIRED' USING ERRCODE = '42501';
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

  -- Reject missing, expired, or incorrect challenges
  IF v_expected_challenge_hash IS NULL THEN
    RAISE EXCEPTION 'REDEMPTION_CHALLENGE_ABSENT' USING ERRCODE = '42501';
  END IF;

  IF v_challenge_expires_at IS NULL OR v_challenge_expires_at <= now() THEN
    RAISE EXCEPTION 'REDEMPTION_CHALLENGE_EXPIRED' USING ERRCODE = '42501';
  END IF;

  IF encode(sha256(p_redemption_challenge::bytea), 'hex') <> v_expected_challenge_hash THEN
    RAISE EXCEPTION 'INVALID_REDEMPTION_CHALLENGE' USING ERRCODE = '42501';
  END IF;

  -- Clear challenge immediately to prevent replay
  UPDATE public.users
  SET redemption_challenge = NULL, redemption_expires_at = NULL
  WHERE id = p_actor_user_id;

  -- Lock invitation row FOR UPDATE to prevent concurrent double redemption
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

  -- Enforce tenant validity
  SELECT name INTO v_tenant_name
  FROM public.tenants
  WHERE id = v_invitation.tenant_id AND status = 'ACTIVE';

  IF v_tenant_name IS NULL THEN
    RAISE EXCEPTION 'TENANT_NOT_ACTIVE' USING ERRCODE = 'P0002';
  END IF;

  -- Enforce branch validity if branch_id is specified
  IF v_invitation.branch_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.branches
      WHERE id = v_invitation.branch_id
        AND tenant_id = v_invitation.tenant_id
        AND status = 'ACTIVE'
    ) THEN
      RAISE EXCEPTION 'BRANCH_NOT_VALID' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  -- Mark invitation as accepted atomically
  UPDATE public.invitations
  SET status = 'ACCEPTED'
  WHERE id = v_invitation.id;

  -- Activate membership
  v_membership_id := gen_random_uuid();
  INSERT INTO public.tenant_memberships (
    id, tenant_id, user_id, branch_id, role, status, updated_at
  )
  VALUES (
    v_membership_id,
    v_invitation.tenant_id,
    p_actor_user_id,
    v_invitation.branch_id,
    v_invitation.role::public."TenantRole",
    'ACTIVE',
    now()
  );

  RETURN QUERY SELECT
    v_invitation.id,
    v_invitation.tenant_id,
    v_tenant_name,
    v_invitation.role::text,
    v_invitation.branch_id,
    v_membership_id;
END;
$$;

-- 8. Revoke EXECUTE from PUBLIC on all new and updated functions
REVOKE ALL ON FUNCTION public.issue_user_onboarding_token(uuid, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.issue_user_redemption_challenge(uuid, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_user_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_email_verification(text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_password_reset(text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_password_reset(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_invitation_and_activate_membership(uuid, text, text) FROM PUBLIC;

-- 9. Grant EXECUTE to academy_runtime_ci if role exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'academy_runtime_ci') THEN
    GRANT EXECUTE ON FUNCTION public.issue_user_onboarding_token(uuid, text, timestamptz) TO academy_runtime_ci;
    GRANT EXECUTE ON FUNCTION public.issue_user_redemption_challenge(uuid, text, timestamptz) TO academy_runtime_ci;
    GRANT EXECUTE ON FUNCTION public.verify_user_email(text) TO academy_runtime_ci;
    GRANT EXECUTE ON FUNCTION public.request_email_verification(text, text, timestamptz) TO academy_runtime_ci;
    GRANT EXECUTE ON FUNCTION public.request_password_reset(text, text, timestamptz) TO academy_runtime_ci;
    GRANT EXECUTE ON FUNCTION public.complete_password_reset(text, text) TO academy_runtime_ci;
    GRANT EXECUTE ON FUNCTION public.redeem_invitation_and_activate_membership(uuid, text, text) TO academy_runtime_ci;
  END IF;
END $$;
