-- Migration: 20261021070000_platform_super_admin_and_portal_rls
-- Implements:
-- 1. Helper function is_current_user_super_admin()
-- 2. Platform Super Admin RLS bypass policies for platform management
-- 3. Player & Guardian Portal self-service read policies

CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT is_platform_super_admin
      FROM public.users
      WHERE id = public.current_app_user_id()
    ),
    false
  );
$$;

-- 1. Super Admin access policies
DROP POLICY IF EXISTS tenants_platform_super_admin ON public.tenants;
CREATE POLICY tenants_platform_super_admin ON public.tenants
  FOR ALL TO PUBLIC
  USING (public.is_current_user_super_admin());

DROP POLICY IF EXISTS branches_platform_super_admin ON public.branches;
CREATE POLICY branches_platform_super_admin ON public.branches
  FOR SELECT TO PUBLIC
  USING (public.is_current_user_super_admin());

DROP POLICY IF EXISTS tenant_memberships_platform_super_admin ON public.tenant_memberships;
CREATE POLICY tenant_memberships_platform_super_admin ON public.tenant_memberships
  FOR SELECT TO PUBLIC
  USING (public.is_current_user_super_admin());

DROP POLICY IF EXISTS players_platform_super_admin ON public.players;
CREATE POLICY players_platform_super_admin ON public.players
  FOR SELECT TO PUBLIC
  USING (public.is_current_user_super_admin());

DROP POLICY IF EXISTS guardians_platform_super_admin ON public.guardians;
CREATE POLICY guardians_platform_super_admin ON public.guardians
  FOR SELECT TO PUBLIC
  USING (public.is_current_user_super_admin());

DROP POLICY IF EXISTS attendance_sessions_platform_super_admin ON public.attendance_sessions;
CREATE POLICY attendance_sessions_platform_super_admin ON public.attendance_sessions
  FOR SELECT TO PUBLIC
  USING (public.is_current_user_super_admin());

DROP POLICY IF EXISTS attendance_records_platform_super_admin ON public.attendance_records;
CREATE POLICY attendance_records_platform_super_admin ON public.attendance_records
  FOR SELECT TO PUBLIC
  USING (public.is_current_user_super_admin());

DROP POLICY IF EXISTS training_groups_platform_super_admin ON public.training_groups;
CREATE POLICY training_groups_platform_super_admin ON public.training_groups
  FOR SELECT TO PUBLIC
  USING (public.is_current_user_super_admin());

DROP POLICY IF EXISTS audit_logs_platform_super_admin ON public.audit_logs;
CREATE POLICY audit_logs_platform_super_admin ON public.audit_logs
  FOR SELECT TO PUBLIC
  USING (public.is_current_user_super_admin());

DROP POLICY IF EXISTS evaluation_templates_platform_super_admin ON public.evaluation_templates;
CREATE POLICY evaluation_templates_platform_super_admin ON public.evaluation_templates
  FOR SELECT TO PUBLIC
  USING (public.is_current_user_super_admin());

DROP POLICY IF EXISTS player_evaluations_platform_super_admin ON public.player_evaluations;
CREATE POLICY player_evaluations_platform_super_admin ON public.player_evaluations
  FOR SELECT TO PUBLIC
  USING (public.is_current_user_super_admin());

-- 2. Player and Guardian Portal Self-Service Policies
DROP POLICY IF EXISTS players_portal_user ON public.players;
CREATE POLICY players_portal_user ON public.players
  FOR SELECT TO PUBLIC
  USING (
    user_id = public.current_app_user_id()
    OR id IN (
      SELECT g.player_id FROM public.guardians g 
      WHERE g.user_id = public.current_app_user_id()
    )
  );

DROP POLICY IF EXISTS guardians_portal_user ON public.guardians;
CREATE POLICY guardians_portal_user ON public.guardians
  FOR SELECT TO PUBLIC
  USING (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS player_evaluations_portal_user ON public.player_evaluations;
CREATE POLICY player_evaluations_portal_user ON public.player_evaluations
  FOR SELECT TO PUBLIC
  USING (
    is_published = true 
    AND (
      player_id IN (
        SELECT p.id FROM public.players p 
        WHERE p.user_id = public.current_app_user_id()
      )
      OR player_id IN (
        SELECT g.player_id FROM public.guardians g 
        WHERE g.user_id = public.current_app_user_id()
      )
    )
  );

DROP POLICY IF EXISTS attendance_records_portal_user ON public.attendance_records;
CREATE POLICY attendance_records_portal_user ON public.attendance_records
  FOR SELECT TO PUBLIC
  USING (
    player_id IN (
      SELECT p.id FROM public.players p 
      WHERE p.user_id = public.current_app_user_id()
    )
    OR player_id IN (
      SELECT g.player_id FROM public.guardians g 
      WHERE g.user_id = public.current_app_user_id()
    )
  );

DROP POLICY IF EXISTS attendance_sessions_portal_user ON public.attendance_sessions;
CREATE POLICY attendance_sessions_portal_user ON public.attendance_sessions
  FOR SELECT TO PUBLIC
  USING (
    id IN (
      SELECT ar.session_id FROM public.attendance_records ar
      WHERE ar.player_id IN (
        SELECT p.id FROM public.players p 
        WHERE p.user_id = public.current_app_user_id()
      )
      OR ar.player_id IN (
        SELECT g.player_id FROM public.guardians g 
        WHERE g.user_id = public.current_app_user_id()
      )
    )
  );

-- 3. Grants for runtime role
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'academy_runtime_ci') THEN
    GRANT EXECUTE ON FUNCTION public.is_current_user_super_admin() TO academy_runtime_ci;
  END IF;
END $$;
