-- Phase 3A.1 - K1 (password reset bound to e-mail + unguessable single-use link) and K13b (session version).
--
-- Additive and idempotent: 3 new columns (all with safe defaults), 4 new SECURITY DEFINER functions, and the
-- existing complete_password_reset(text, text) re-created with identical behaviour plus the session-version bump.
-- request_password_reset(...) is unchanged (platform activation links keep using it).
--
-- Token handling: only SHA-256 hashes are stored; codes and links are single-use (cleared on success) and expire
-- after at most 5 minutes. Consuming a token and updating the password happen in ONE UPDATE statement, so they are
-- atomic; refresh tokens are revoked in the same transaction.
--
-- Session versions: users.session_version is incremented whenever a password changes. Updating the user row first
-- takes its row lock, which serialises password changes against refresh-token rotation (see TokenService).
--
-- Rollback: see docs/proposals/PHASE_3A_SECURITY_DETAILS.md section B.4 (revision 4). The session_version columns
-- are intentionally NOT dropped on rollback: dropping them would reset every user to version 0 and could make
-- previously invalidated tokens valid again.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS password_reset_link_token text NULL,
  ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;

ALTER TABLE public.refresh_tokens
  ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;

-- Issue a reset: stores the hashes of the 6-digit code and of the 256-bit link token.
CREATE OR REPLACE FUNCTION public.request_password_reset_with_link(
  p_email text,
  p_code_hash text,
  p_link_hash text,
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
  IF p_code_hash IS NULL OR trim(p_code_hash) = '' OR p_link_hash IS NULL OR trim(p_link_hash) = '' THEN
    RAISE EXCEPTION 'TOKEN_REQUIRED' USING ERRCODE = '22023';
  END IF;

  UPDATE public.users
  SET password_reset_token = p_code_hash,
      password_reset_link_token = p_link_hash,
      password_reset_expires_at = LEAST(p_expires_at, now() + interval '5 minutes'),
      updated_at = now()
  WHERE lower(trim(email)) = lower(trim(p_email))
  RETURNING id INTO v_user_id;

  RETURN v_user_id; -- NULL for unknown e-mails; the caller responds generically either way
END;
$$;

-- Complete with the 6-digit code: the code must belong to this e-mail.
CREATE OR REPLACE FUNCTION public.complete_password_reset_for_email(
  p_email text,
  p_code_hash text,
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
  IF p_email IS NULL OR trim(p_email) = '' OR p_code_hash IS NULL OR trim(p_code_hash) = '' THEN
    RAISE EXCEPTION 'TOKEN_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_new_password_hash IS NULL OR trim(p_new_password_hash) = '' THEN
    RAISE EXCEPTION 'PASSWORD_REQUIRED' USING ERRCODE = '22023';
  END IF;

  UPDATE public.users
  SET password_hash = p_new_password_hash,
      password_reset_token = NULL,
      password_reset_link_token = NULL,
      password_reset_expires_at = NULL,
      session_version = session_version + 1,
      updated_at = now()
  WHERE lower(trim(email)) = lower(trim(p_email))
    AND password_reset_token = p_code_hash
    AND password_reset_expires_at > now()
  RETURNING id INTO v_user_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_OR_EXPIRED_TOKEN' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.refresh_tokens SET is_revoked = true WHERE user_id = v_user_id AND is_revoked = false;
  RETURN v_user_id;
END;
$$;

-- Complete with the e-mailed link token (unguessable; not subject to per-account code counters).
CREATE OR REPLACE FUNCTION public.complete_password_reset_by_link(
  p_link_hash text,
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
  IF p_link_hash IS NULL OR trim(p_link_hash) = '' THEN
    RAISE EXCEPTION 'TOKEN_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_new_password_hash IS NULL OR trim(p_new_password_hash) = '' THEN
    RAISE EXCEPTION 'PASSWORD_REQUIRED' USING ERRCODE = '22023';
  END IF;

  UPDATE public.users
  SET password_hash = p_new_password_hash,
      password_reset_token = NULL,
      password_reset_link_token = NULL,
      password_reset_expires_at = NULL,
      session_version = session_version + 1,
      updated_at = now()
  WHERE password_reset_link_token = p_link_hash
    AND password_reset_expires_at > now()
  RETURNING id INTO v_user_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_OR_EXPIRED_TOKEN' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.refresh_tokens SET is_revoked = true WHERE user_id = v_user_id AND is_revoked = false;
  RETURN v_user_id;
END;
$$;

-- Cancel ONLY the 6-digit code (after 5 wrong attempts). The link from the same e-mail stays valid until it
-- expires, so wrong guesses by an attacker can never invalidate the legitimate user's link.
CREATE OR REPLACE FUNCTION public.invalidate_password_reset_code_for_email(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN;
  END IF;
  UPDATE public.users
  SET password_reset_token = NULL,
      updated_at = now()
  WHERE lower(trim(email)) = lower(trim(p_email))
    AND password_reset_token IS NOT NULL;
END;
$$;

-- Existing function (platform activation links, 64-hex tokens), re-created with identical behaviour plus the
-- session-version bump and clearing the link token.
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
      password_reset_link_token = NULL,
      password_reset_expires_at = NULL,
      session_version = session_version + 1,
      updated_at = now()
  WHERE (password_reset_token = p_token OR password_reset_token = v_token_hash)
    AND password_reset_expires_at > now()
  RETURNING id INTO v_user_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_OR_EXPIRED_TOKEN' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.refresh_tokens SET is_revoked = true WHERE user_id = v_user_id AND is_revoked = false;
  RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_password_reset_with_link(text, text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_password_reset_for_email(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_password_reset_by_link(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invalidate_password_reset_code_for_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_password_reset(text, text) FROM PUBLIC;

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['academy_runtime', 'academy_runtime_ci', 'sportexus_app'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.request_password_reset_with_link(text, text, text, timestamptz) TO %I', r);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.complete_password_reset_for_email(text, text, text) TO %I', r);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.complete_password_reset_by_link(text, text) TO %I', r);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.invalidate_password_reset_code_for_email(text) TO %I', r);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.complete_password_reset(text, text) TO %I', r);
      -- K13b: password change, suspension and session revocation bump the version from application code.
      EXECUTE format('GRANT UPDATE (session_version) ON TABLE public.users TO %I', r);
      -- Rotation stores the version on new refresh tokens (column-level grants exist on this table).
      EXECUTE format('GRANT SELECT (session_version), INSERT (session_version) ON TABLE public.refresh_tokens TO %I', r);
    END IF;
  END LOOP;
END $$;
