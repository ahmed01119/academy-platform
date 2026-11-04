-- Allow prospective academy owners to submit registration applications
DROP POLICY IF EXISTS academy_applications_insert ON public.academy_applications;
CREATE POLICY academy_applications_insert ON public.academy_applications
  FOR INSERT TO PUBLIC
  WITH CHECK (status = 'PENDING_REVIEW');

-- Allow applicants to query their application (including RETURNING clause during unauthenticated registration)
DROP POLICY IF EXISTS academy_applications_applicant ON public.academy_applications;
CREATE POLICY academy_applications_applicant ON public.academy_applications
  FOR SELECT TO PUBLIC
  USING (
    applicant_user_id = public.current_app_user_id()
    OR (public.current_app_user_id() IS NULL AND status = 'PENDING_REVIEW')
  );

