-- =====================================================================================================================
-- K6: join requests belong to an account, and say who is asking (owner decision 2026-11-16)
-- =====================================================================================================================
-- The platform has three kinds of applicant, each with its own request and its own "pending" state:
--
--   * COACH / academy owner  -> academy_applications (POST /auth/register). Reviewed by the platform. Unchanged here.
--   * PLAYER (asks for self) -> player_registration_requests, requester_type = 'PLAYER'. Reviewed by the academy.
--   * GUARDIAN (for a child) -> player_registration_requests, requester_type = 'GUARDIAN'. Reviewed by the academy.
--
-- Until now a join request was anonymous: nothing linked it to an account, so there was no pending state, no
-- notification to the applicant and nothing to link after approval. From now on the API creates the applicant's
-- account (or uses the signed-in one) and the request records applicant_user_id and requester_type. On approval the
-- academy links that account to the player record (PLAYER) or to the child's guardian record (GUARDIAN).
--
-- This migration:
--   1. adds the "JoinRequesterType" enum and player_registration_requests.requester_type (existing rows: 'PLAYER';
--      they are anonymous, so the value has no effect on them);
--   2. replaces submit_player_join_request with a version that takes the requester type and refuses requests that
--      could never be approved (see the function's comment).
-- Privileges: the runtime roles keep SELECT and the review-column UPDATE on the table (M2); requester_type is not
-- among the updatable columns, so it cannot be changed after submission.
-- =====================================================================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'JoinRequesterType') THEN
    CREATE TYPE public."JoinRequesterType" AS ENUM ('PLAYER', 'GUARDIAN');
  END IF;
END $$;

ALTER TABLE public.player_registration_requests
  ADD COLUMN IF NOT EXISTS requester_type public."JoinRequesterType" NOT NULL DEFAULT 'PLAYER';

-- The applicant's own requests are read by applicant_user_id (login gating, "my requests" in the portal).
CREATE INDEX IF NOT EXISTS player_registration_requests_applicant_user_id_idx
  ON public.player_registration_requests (applicant_user_id);


-- ---------------------------------------------------------------------------------------------------------------------
-- submit_player_join_request (replaces the M2 version; the signature gains p_requester_type)
-- ---------------------------------------------------------------------------------------------------------------------
-- Unchanged from M2: the applicant is current_app_user_id() (never a parameter); the academy must be ACTIVE; input
-- validation; at most 5 pending requests per academy and e-mail; the academy's OWNER/MANAGER/BRANCH_MANAGER members
-- are notified in the same statement.
-- New:
--   * p_requester_type: 'PLAYER' (the applicant is the athlete) or 'GUARDIAN' (the applicant is the child's parent or
--     guardian). A GUARDIAN request must name the guardian (that is the applicant's own name).
--   * PLAYER_PROFILE_EXISTS: an account can hold one player profile (unique players.user_id), so a PLAYER request
--     from an account that already has one could never be linked on approval.
--   * DUPLICATE_PENDING_REQUEST: the same account already has a pending request for the same player at this academy.
-- These two use SQLSTATE P0001: Prisma reports 23505 (unique_violation) as a constraint error without the message,
-- so the API could not tell the codes apart.
-- Anonymous calls (no actor) are still accepted by the database; the API no longer makes them.
DROP FUNCTION IF EXISTS public.submit_player_join_request(uuid, text, text, text, date, text);

CREATE OR REPLACE FUNCTION public.submit_player_join_request(
  p_tenant_id uuid,
  p_player_name text,
  p_contact_email text,
  p_contact_phone text DEFAULT NULL,
  p_date_of_birth date DEFAULT NULL,
  p_guardian_name text DEFAULT NULL,
  p_requester_type text DEFAULT 'PLAYER'
)
RETURNS TABLE (
  request_id uuid,
  tenant_name text,
  applicant_user_id uuid,
  requester_type text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_applicant uuid := public.current_app_user_id();
  v_tenant_name text;
  v_name text := trim(coalesce(p_player_name, ''));
  v_email text := lower(trim(coalesce(p_contact_email, '')));
  v_phone text := nullif(trim(coalesce(p_contact_phone, '')), '');
  v_guardian text := nullif(trim(coalesce(p_guardian_name, '')), '');
  v_type public."JoinRequesterType";
  v_id uuid := gen_random_uuid();
  v_now timestamptz := now();
BEGIN
  IF v_applicant IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_applicant AND NOT is_suspended) THEN
    RAISE EXCEPTION 'APPLICANT_NOT_PERMITTED' USING ERRCODE = '42501';
  END IF;

  BEGIN
    v_type := upper(trim(coalesce(p_requester_type, 'PLAYER')))::public."JoinRequesterType";
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'REQUESTER_TYPE_INVALID' USING ERRCODE = '22023';
  END;

  SELECT t.name INTO v_tenant_name FROM public.tenants t WHERE t.id = p_tenant_id AND t.status = 'ACTIVE';
  IF v_tenant_name IS NULL THEN
    RAISE EXCEPTION 'ACADEMY_NOT_AVAILABLE' USING ERRCODE = 'P0002';
  END IF;

  IF length(v_name) < 2 OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'PLAYER_NAME_INVALID' USING ERRCODE = '22023';
  END IF;
  IF length(v_email) > 254 OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'CONTACT_EMAIL_INVALID' USING ERRCODE = '22023';
  END IF;
  IF v_phone IS NOT NULL AND length(v_phone) > 32 THEN
    RAISE EXCEPTION 'CONTACT_PHONE_INVALID' USING ERRCODE = '22023';
  END IF;
  IF v_guardian IS NOT NULL AND length(v_guardian) > 120 THEN
    RAISE EXCEPTION 'GUARDIAN_NAME_INVALID' USING ERRCODE = '22023';
  END IF;
  IF v_type = 'GUARDIAN' AND (v_guardian IS NULL OR length(v_guardian) < 2) THEN
    RAISE EXCEPTION 'GUARDIAN_NAME_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_date_of_birth IS NOT NULL AND (p_date_of_birth < DATE '1900-01-01' OR p_date_of_birth > current_date) THEN
    RAISE EXCEPTION 'DATE_OF_BIRTH_INVALID' USING ERRCODE = '22023';
  END IF;

  IF v_applicant IS NOT NULL THEN
    IF v_type = 'PLAYER' AND EXISTS (SELECT 1 FROM public.players p WHERE p.user_id = v_applicant) THEN
      RAISE EXCEPTION 'PLAYER_PROFILE_EXISTS' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.player_registration_requests r
      WHERE r.tenant_id = p_tenant_id
        AND r.applicant_user_id = v_applicant
        AND r.status IN ('PENDING_REVIEW', 'MORE_INFO_REQUESTED')
        AND lower(r.player_name) = lower(v_name)
    ) THEN
      RAISE EXCEPTION 'DUPLICATE_PENDING_REQUEST' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF (
    SELECT count(*) FROM public.player_registration_requests r
    WHERE r.tenant_id = p_tenant_id AND r.contact_email = v_email AND r.status = 'PENDING_REVIEW'
  ) >= 5 THEN
    RAISE EXCEPTION 'TOO_MANY_PENDING_REQUESTS' USING ERRCODE = '54000';
  END IF;

  INSERT INTO public.player_registration_requests (
    id, tenant_id, applicant_user_id, requester_type, player_name, contact_email, contact_phone, date_of_birth,
    guardian_name, status, created_at, updated_at
  )
  VALUES (
    v_id, p_tenant_id, v_applicant, v_type, v_name, v_email, v_phone, p_date_of_birth,
    v_guardian, 'PENDING_REVIEW', v_now, v_now
  );

  INSERT INTO public.app_notifications (id, user_id, tenant_id, type, title, body, href, created_at)
  SELECT gen_random_uuid(), m.user_id, p_tenant_id, 'PLAYER_REGISTRATION', 'New Player Join Request',
         '"' || left(v_name, 120) || '" submitted a join request for review'
           || CASE WHEN v_type = 'GUARDIAN' THEN ' (by guardian ' || left(v_guardian, 120) || ').' ELSE '.' END,
         '/players?tab=applications', v_now
  FROM public.tenant_memberships m
  WHERE m.tenant_id = p_tenant_id
    AND m.status = 'ACTIVE'
    AND m.role IN ('OWNER', 'MANAGER', 'BRANCH_MANAGER');

  RETURN QUERY SELECT v_id, v_tenant_name, v_applicant, v_type::text, 'PENDING_REVIEW'::text, v_now, v_now;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_player_join_request(uuid, text, text, text, date, text, text) FROM PUBLIC;

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['academy_runtime', 'academy_runtime_ci', 'sportexus_app'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.submit_player_join_request(uuid, text, text, text, date, text, text) TO %I', r);
    END IF;
  END LOOP;
END $$;

-- =====================================================================================================================
-- Rollback (forward migration): recreate the M2 function body under its 6-argument signature (copy it from
-- 20261117090000_s4_rls_context_functions), re-grant EXECUTE, then
--   DROP FUNCTION public.submit_player_join_request(uuid, text, text, text, date, text, text);
--   DROP INDEX public.player_registration_requests_applicant_user_id_idx;
--   ALTER TABLE public.player_registration_requests DROP COLUMN requester_type;   -- loses who asked; export first
--   DROP TYPE public."JoinRequesterType";
-- Requests linked to accounts stay valid under the old function (applicant_user_id already existed).
-- =====================================================================================================================
