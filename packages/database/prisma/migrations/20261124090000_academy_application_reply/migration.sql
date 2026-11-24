-- Owner request 2026-11-24: when the platform asks an academy applicant for more details (MORE_INFO_REQUESTED), the
-- applicant answers from a link in the e-mail; the application goes back to review and the platform admins are
-- notified.
--
-- The applicant's account is still pending (it cannot sign in), and the runtime role may not update applications
-- (only platform admins may, RLS academy_applications_platform_admin). The reply therefore goes through two narrow
-- SECURITY DEFINER functions. The API calls them only with a signed link that names the application and the time of
-- the request (reviewed_at): a link works only while that same request is open, and only once.

ALTER TABLE public.academy_applications
  ADD COLUMN IF NOT EXISTS applicant_reply text,
  ADD COLUMN IF NOT EXISTS applicant_replied_at timestamptz(3);

COMMENT ON COLUMN public.academy_applications.applicant_reply IS
  'The applicant''s latest answer to a MORE_INFO_REQUESTED review (via the e-mailed reply link).';

-- What the reply page shows: the request and the fields the applicant may correct. Nothing when the link no longer
-- matches an open request.
CREATE OR REPLACE FUNCTION public.academy_application_for_reply(p_application_id uuid, p_reviewed_at timestamptz)
RETURNS TABLE (
  academy_name text,
  sport text,
  city text,
  contact_phone text,
  review_notes text,
  applicant_user_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT a.academy_name, a.sport::text, a.city, a.contact_phone, a.review_notes, a.applicant_user_id
  FROM public.academy_applications a
  WHERE a.id = p_application_id
    AND a.status = 'MORE_INFO_REQUESTED'
    AND a.reviewed_at = p_reviewed_at;
$$;

-- Stores the answer, optionally corrects city and phone, and returns the application to PENDING_REVIEW. Returns false
-- when the link no longer matches an open request (already answered, or a newer request was made).
CREATE OR REPLACE FUNCTION public.submit_academy_application_reply(
  p_application_id uuid,
  p_reviewed_at timestamptz,
  p_reply text,
  p_city text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reply text := nullif(trim(coalesce(p_reply, '')), '');
BEGIN
  IF v_reply IS NULL OR length(v_reply) > 2000 THEN
    RAISE EXCEPTION 'REPLY_INVALID' USING ERRCODE = '22023';
  END IF;
  UPDATE public.academy_applications
  SET applicant_reply = v_reply,
      applicant_replied_at = now(),
      city = coalesce(nullif(left(trim(coalesce(p_city, '')), 100), ''), city),
      contact_phone = coalesce(nullif(left(trim(coalesce(p_contact_phone, '')), 30), ''), contact_phone),
      status = 'PENDING_REVIEW',
      updated_at = now()
  WHERE id = p_application_id
    AND status = 'MORE_INFO_REQUESTED'
    AND reviewed_at = p_reviewed_at;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.academy_application_for_reply(uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_academy_application_reply(uuid, timestamptz, text, text, text) FROM PUBLIC;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['academy_runtime', 'academy_runtime_ci', 'sportexus_app'] LOOP
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.academy_application_for_reply(uuid, timestamptz) TO %I', r);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.submit_academy_application_reply(uuid, timestamptz, text, text, text) TO %I', r);
  END LOOP;
END
$$;
