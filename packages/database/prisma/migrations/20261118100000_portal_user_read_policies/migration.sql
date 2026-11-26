-- =====================================================================================================================
-- Player / guardian portal: read access to the academy, groups, branches and coaches of the user's own player(s)
-- =====================================================================================================================
-- Found by the end-to-end run as the restricted runtime role (2026-11-16). GET /portal/player/me and
-- GET /portal/guardian/me load each linked player with its academy (tenants), group memberships, training groups,
-- branches and head coaches. A portal user has no tenant context, and these five tables had no portal-user policy, so
-- the restricted role saw no rows: Prisma failed on the required `tenant` relation ("Inconsistent query result") and
-- both portals returned 500. The owner role (BYPASSRLS) hid the problem until the API switched roles.
--
-- "Portal players" of the current user (current_app_user_id()) are, as in the existing portal policies
-- (players_portal_user, attendance_records_portal_user, player_evaluations_portal_user):
--   * the player record linked to the user (PLAYER: players.user_id), and
--   * the children of the guardian records linked to the user (GUARDIAN: guardians.user_id -> guardians.player_id).
--
-- Every policy below is SELECT-only and limited to rows reachable from the user's portal players:
--   tenants             the academies of those players
--   group_members       those players' group memberships
--   training_groups     the groups those players belong to
--   branches            the branches of those groups
--   group_coaches       the coach assignments of those groups (the portal shows the head coach's name)
--   attendance_sessions sessions of those groups (upcoming sessions; the existing policy covers only sessions that
--                       already hold an attendance record of the player)
-- No write access is added. Staff access (tenant context) and platform-admin access are unchanged.
-- Without an actor (current_app_user_id() IS NULL) every subquery is empty, so nothing new is visible anonymously.
-- =====================================================================================================================

DROP POLICY IF EXISTS tenants_portal_user ON public.tenants;
CREATE POLICY tenants_portal_user ON public.tenants
  FOR SELECT TO PUBLIC
  USING (
    id IN (SELECT p.tenant_id FROM public.players p WHERE p.user_id = public.current_app_user_id())
    OR id IN (SELECT g.tenant_id FROM public.guardians g WHERE g.user_id = public.current_app_user_id())
  );

DROP POLICY IF EXISTS group_members_portal_user ON public.group_members;
CREATE POLICY group_members_portal_user ON public.group_members
  FOR SELECT TO PUBLIC
  USING (
    player_id IN (SELECT p.id FROM public.players p WHERE p.user_id = public.current_app_user_id())
    OR player_id IN (SELECT g.player_id FROM public.guardians g WHERE g.user_id = public.current_app_user_id())
  );

-- The policies below read group_members, so its portal policy above already limits them to the user's players.
DROP POLICY IF EXISTS training_groups_portal_user ON public.training_groups;
CREATE POLICY training_groups_portal_user ON public.training_groups
  FOR SELECT TO PUBLIC
  USING (id IN (SELECT gm.group_id FROM public.group_members gm));

DROP POLICY IF EXISTS group_coaches_portal_user ON public.group_coaches;
CREATE POLICY group_coaches_portal_user ON public.group_coaches
  FOR SELECT TO PUBLIC
  USING (group_id IN (SELECT gm.group_id FROM public.group_members gm));

DROP POLICY IF EXISTS branches_portal_user ON public.branches;
CREATE POLICY branches_portal_user ON public.branches
  FOR SELECT TO PUBLIC
  USING (id IN (SELECT tg.branch_id FROM public.training_groups tg
                WHERE tg.id IN (SELECT gm.group_id FROM public.group_members gm)));

DROP POLICY IF EXISTS attendance_sessions_portal_group ON public.attendance_sessions;
CREATE POLICY attendance_sessions_portal_group ON public.attendance_sessions
  FOR SELECT TO PUBLIC
  USING (group_id IN (SELECT gm.group_id FROM public.group_members gm));

-- =====================================================================================================================
-- Rollback (forward migration): DROP POLICY each of the six policies above. The portals then fail again under the
-- restricted runtime role (they keep working only for an RLS-bypassing owner connection).
-- =====================================================================================================================
