-- Owner decision 2026-11-25: a join request (landing page or the signed-in portal) stores the same player fields as
-- the staff enrollment form: gender, jersey number, national ID and medical notes (besides name, birth year and the
-- guardian's name and phone, already stored). On approval they are copied to the new player record. National ID and
-- medical notes are shown to staff with players.sensitive.read only (enforced in the API). Players get a jersey number
-- column (below).
--
-- submit_player_join_request gains four optional parameters; the 8-parameter version is replaced (same checks, same
-- rules, plus validation of the new fields).

ALTER TABLE public.player_registration_requests
  ADD COLUMN IF NOT EXISTS gender "PlayerGender",
  ADD COLUMN IF NOT EXISTS jersey_number integer,
  ADD COLUMN IF NOT EXISTS national_id text,
  ADD COLUMN IF NOT EXISTS medical_notes text;

ALTER TABLE public.player_registration_requests
  ADD CONSTRAINT player_registration_requests_jersey_number_range
  CHECK (jersey_number IS NULL OR jersey_number BETWEEN 1 AND 99);

-- Players get their own jersey number column. Until now a jersey number typed in the staff form was stored as the
-- membership number (a different thing, shown on the QR card); existing rows are left as they are.
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS jersey_number integer;
ALTER TABLE public.players
  ADD CONSTRAINT players_jersey_number_range CHECK (jersey_number IS NULL OR jersey_number BETWEEN 1 AND 99);

DROP FUNCTION IF EXISTS public.submit_player_join_request(uuid, text, text, text, date, text, text, text);

CREATE OR REPLACE FUNCTION public.submit_player_join_request(
  p_tenant_id uuid,
  p_player_name text,
  p_contact_email text,
  p_contact_phone text DEFAULT NULL,
  p_date_of_birth date DEFAULT NULL,
  p_guardian_name text DEFAULT NULL,
  p_requester_type text DEFAULT 'PLAYER',
  p_guardian_email text DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_jersey_number integer DEFAULT NULL,
  p_national_id text DEFAULT NULL,
  p_medical_notes text DEFAULT NULL
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
  v_guardian_email text := nullif(lower(trim(coalesce(p_guardian_email, ''))), '');
  v_type public."JoinRequesterType";
  v_gender public."PlayerGender";
  v_national_id text := nullif(trim(coalesce(p_national_id, '')), '');
  v_medical text := nullif(trim(coalesce(p_medical_notes, '')), '');
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
  IF v_guardian_email IS NOT NULL
     AND (length(v_guardian_email) > 254 OR v_guardian_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') THEN
    RAISE EXCEPTION 'GUARDIAN_EMAIL_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_gender IS NOT NULL THEN
    BEGIN
      v_gender := upper(trim(p_gender))::public."PlayerGender";
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'GENDER_INVALID' USING ERRCODE = '22023';
    END;
  END IF;
  IF p_jersey_number IS NOT NULL AND (p_jersey_number < 1 OR p_jersey_number > 99) THEN
    RAISE EXCEPTION 'JERSEY_NUMBER_INVALID' USING ERRCODE = '22023';
  END IF;
  IF v_national_id IS NOT NULL AND length(v_national_id) > 30 THEN
    RAISE EXCEPTION 'NATIONAL_ID_INVALID' USING ERRCODE = '22023';
  END IF;
  IF v_medical IS NOT NULL AND length(v_medical) > 500 THEN
    RAISE EXCEPTION 'MEDICAL_NOTES_INVALID' USING ERRCODE = '22023';
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
    guardian_name, guardian_email, gender, jersey_number, national_id, medical_notes, status, created_at, updated_at
  )
  VALUES (
    v_id, p_tenant_id, v_applicant, v_type, v_name, v_email, v_phone, p_date_of_birth,
    v_guardian, v_guardian_email, v_gender, p_jersey_number, v_national_id, v_medical, 'PENDING_REVIEW', v_now, v_now
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

REVOKE ALL ON FUNCTION public.submit_player_join_request(uuid, text, text, text, date, text, text, text, text, integer, text, text) FROM PUBLIC;

DO $do$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['academy_runtime', 'academy_runtime_ci', 'sportexus_app'] LOOP
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.submit_player_join_request(uuid, text, text, text, date, text, text, text, text, integer, text, text) TO %I', r);
  END LOOP;
END
$do$;
