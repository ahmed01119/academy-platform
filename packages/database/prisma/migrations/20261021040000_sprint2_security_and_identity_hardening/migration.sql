-- Sprint 2 Security & Identity Hardening:
-- 1. Anti-Impersonation & Unforgeable Identity Proofs on SECURITY DEFINER functions
-- 2. Partial unique index on active player enrollments (preventing duplicate concurrent active enrollments per sport)
-- 3. Partial unique index on player national ID per tenant (preventing duplicate national IDs)

-- 1. Partial Unique Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_player_enrollment" 
ON public.player_enrollments (tenant_id, player_id, sport) 
WHERE status = 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS "unique_player_national_id_per_tenant" 
ON public.players (tenant_id, national_id) 
WHERE national_id IS NOT NULL;

-- 2. Hardened issue_user_onboarding_token
-- Generates raw token securely inside PostgreSQL if called with 1 argument,
-- and strictly validates user created within last 15 minutes with 0 memberships.
CREATE OR REPLACE FUNCTION public.issue_user_onboarding_token(
  p_user_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_raw_token text;
  v_token_hash text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_REQUIRED' USING ERRCODE = '23502';
  END IF;

  -- Ensure user exists, has NO existing tenant memberships, and was created within the last 15 minutes
  IF EXISTS (SELECT 1 FROM public.tenant_memberships WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'USER_ALREADY_MEMBER_OF_TENANT' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id
      AND created_at >= (now() - interval '15 minutes')
  ) THEN
    RAISE EXCEPTION 'USER_NOT_ELIGIBLE_FOR_ONBOARDING' USING ERRCODE = '42501';
  END IF;

  v_raw_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(sha256(v_raw_token::bytea), 'hex');

  UPDATE public.users
  SET onboarding_token = v_token_hash,
      onboarding_expires_at = now() + interval '15 minutes',
      updated_at = now()
  WHERE id = p_user_id
    AND onboarding_token IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ONBOARDING_TOKEN_ALREADY_ISSUED_OR_USER_NOT_FOUND' USING ERRCODE = '42501';
  END IF;

  RETURN v_raw_token;
END;
$$;

-- Overloaded 2/3 arg version for backward compatibility, enforcing the same preconditions
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

  IF EXISTS (SELECT 1 FROM public.tenant_memberships WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'USER_ALREADY_MEMBER_OF_TENANT' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id
      AND created_at >= (now() - interval '15 minutes')
  ) THEN
    RAISE EXCEPTION 'USER_NOT_ELIGIBLE_FOR_ONBOARDING' USING ERRCODE = '42501';
  END IF;

  UPDATE public.users
  SET onboarding_token = p_token_hash,
      onboarding_expires_at = LEAST(p_expires_at, now() + interval '15 minutes'),
      updated_at = now()
  WHERE id = p_user_id
    AND onboarding_token IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ONBOARDING_TOKEN_ALREADY_ISSUED_OR_USER_NOT_FOUND' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- 3. Hardened issue_user_redemption_challenge
-- Validates that the caller cannot issue a challenge for an arbitrary account without possessing a valid, pending invitation token addressed to that user's email.
CREATE OR REPLACE FUNCTION public.issue_user_redemption_challenge(
  p_user_id uuid,
  p_invitation_token text,
  p_challenge_hash text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_email text;
  v_invitation_email text;
  v_computed_hash text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_REQUIRED' USING ERRCODE = '23502';
  END IF;
  IF p_invitation_token IS NULL OR trim(p_invitation_token) = '' THEN
    RAISE EXCEPTION 'TOKEN_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_challenge_hash IS NULL OR trim(p_challenge_hash) = '' THEN
    RAISE EXCEPTION 'CHALLENGE_REQUIRED' USING ERRCODE = '22023';
  END IF;

  SELECT email INTO v_user_email
  FROM public.users
  WHERE id = p_user_id
    AND is_email_verified = true;

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND_OR_UNVERIFIED' USING ERRCODE = '42501';
  END IF;

  v_computed_hash := encode(sha256(p_invitation_token::bytea), 'hex');
  SELECT email INTO v_invitation_email
  FROM public.invitations
  WHERE (token = p_invitation_token OR token = v_computed_hash)
    AND status = 'PENDING'
    AND expires_at > now();

  IF v_invitation_email IS NULL THEN
    RAISE EXCEPTION 'INVALID_OR_EXPIRED_INVITATION' USING ERRCODE = 'P0002';
  END IF;

  IF lower(trim(v_invitation_email)) <> lower(trim(v_user_email)) THEN
    RAISE EXCEPTION 'INVITATION_EMAIL_MISMATCH' USING ERRCODE = '42501';
  END IF;

  UPDATE public.users
  SET redemption_challenge = p_challenge_hash,
      redemption_expires_at = now() + interval '5 minutes',
      updated_at = now()
  WHERE id = p_user_id
    AND is_email_verified = true;
END;
$$;

-- Backward-compatible 2-arg issue_user_redemption_challenge with strict 5-minute cap
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
      redemption_expires_at = LEAST(p_expires_at, now() + interval '5 minutes'),
      updated_at = now()
  WHERE id = p_user_id
    AND is_email_verified = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND_OR_UNVERIFIED' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- 4. Hardened complete_password_reset
-- Validates token, updates password, and revokes all refresh tokens
CREATE OR REPLACE FUNCTION public.complete_password_reset(
  p_token text,
  p_new_password_hash text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_token_hash text;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RAISE EXCEPTION 'TOKEN_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_new_password_hash IS NULL OR trim(p_new_password_hash) = '' THEN
    RAISE EXCEPTION 'PASSWORD_REQUIRED' USING ERRCODE = '22023';
  END IF;

  v_token_hash := encode(sha256(p_token::bytea), 'hex');

  UPDATE public.users
  SET password_hash = p_new_password_hash,
      password_reset_token = NULL,
      password_reset_expires_at = NULL,
      updated_at = now()
  WHERE (password_reset_token = p_token OR password_reset_token = v_token_hash)
    AND password_reset_expires_at > now()
  RETURNING id INTO v_user_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_OR_EXPIRED_TOKEN' USING ERRCODE = 'P0002';
  END IF;

  -- Revoke all active refresh tokens for the compromised or reset account
  UPDATE public.refresh_tokens
  SET is_revoked = true
  WHERE user_id = v_user_id;

  RETURN v_user_id;
END;
$$;

-- 5. Revoke from PUBLIC
REVOKE ALL ON FUNCTION public.issue_user_onboarding_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.issue_user_onboarding_token(uuid, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.issue_user_redemption_challenge(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.issue_user_redemption_challenge(uuid, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_password_reset(text, text) FROM PUBLIC;

-- 6. Grant to academy_runtime_ci
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'academy_runtime_ci') THEN
    GRANT EXECUTE ON FUNCTION public.issue_user_onboarding_token(uuid) TO academy_runtime_ci;
    GRANT EXECUTE ON FUNCTION public.issue_user_onboarding_token(uuid, text, timestamptz) TO academy_runtime_ci;
    GRANT EXECUTE ON FUNCTION public.issue_user_redemption_challenge(uuid, text, text) TO academy_runtime_ci;
    GRANT EXECUTE ON FUNCTION public.issue_user_redemption_challenge(uuid, text, timestamptz) TO academy_runtime_ci;
    GRANT EXECUTE ON FUNCTION public.complete_password_reset(text, text) TO academy_runtime_ci;
  END IF;
END $$;
