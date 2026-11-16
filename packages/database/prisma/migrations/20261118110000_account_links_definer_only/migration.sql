-- =====================================================================================================================
-- Account links (players.user_id, guardians.user_id) are written only by definer functions (owner decision 2026-11-16)
-- =====================================================================================================================
-- players.user_id / guardians.user_id decide who sees a child's data in the player and guardian portals. Until now the
-- runtime role could INSERT/UPDATE them freely, so any staff member with players.update in an academy could attach any
-- account to a record of that academy (and read the child's portal data through it).
--
-- From now on the runtime role may write every column of players and guardians EXCEPT user_id. An account is linked only
-- through definer functions that check who is asking:
--   * redeem_portal_claim(hash)         - the account holder redeems a claim code issued by the academy (M2, unchanged);
--   * link_join_request_account(...)    - a reviewer of the academy links the applicant of an APPROVED join request to
--                                         the player record (PLAYER) or the child's guardian record (GUARDIAN). New.
--
-- Note for later migrations: the column grants below are a snapshot of today's columns. A column added to players or
-- guardians later must be granted (INSERT/UPDATE) to the runtime roles in that migration.
-- =====================================================================================================================

-- ---------------------------------------------------------------------------------------------------------------------
-- link_join_request_account
-- ---------------------------------------------------------------------------------------------------------------------
-- Caller: current_app_user_id() with an ACTIVE membership in current_app_tenant_id() whose role reviews join requests
-- (OWNER, MANAGER, BRANCH_MANAGER, RECEPTIONIST, or a COACH with can_review_applications) - the same rule as the
-- API's player.application.review permission. The academy must be ACTIVE.
-- Request: in the caller's academy, status APPROVED, with an applicant account.
-- Record: p_record_id is a player (requester PLAYER) or a guardian (requester GUARDIAN) of the same academy. It must be
-- unlinked or already linked to the applicant (idempotent). A PLAYER applicant may hold one player profile in total.
-- Errors (SQLSTATE P0001 unless noted): LINK_CONTEXT_REQUIRED (42501), LINK_NOT_PERMITTED (42501), REQUEST_NOT_LINKABLE,
-- RECORD_NOT_FOUND, RECORD_ALREADY_LINKED, PLAYER_PROFILE_EXISTS.
CREATE OR REPLACE FUNCTION public.link_join_request_account(p_request_id uuid, p_record_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := public.current_app_user_id();
  v_tenant uuid := public.current_app_tenant_id();
  v_applicant uuid;
  v_type public."JoinRequesterType";
  v_current uuid;
BEGIN
  IF v_actor IS NULL OR v_tenant IS NULL THEN
    RAISE EXCEPTION 'LINK_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.tenant_memberships m
    JOIN public.tenants t ON t.id = m.tenant_id
    JOIN public.users u ON u.id = m.user_id
    WHERE m.tenant_id = v_tenant AND m.user_id = v_actor AND m.status = 'ACTIVE' AND t.status = 'ACTIVE'
      AND NOT u.is_suspended
      AND (m.role IN ('OWNER', 'MANAGER', 'BRANCH_MANAGER', 'RECEPTIONIST')
           OR (m.role = 'COACH' AND m.can_review_applications))
  ) THEN
    RAISE EXCEPTION 'LINK_NOT_PERMITTED' USING ERRCODE = '42501';
  END IF;

  SELECT r.applicant_user_id, r.requester_type INTO v_applicant, v_type
  FROM public.player_registration_requests r
  WHERE r.id = p_request_id AND r.tenant_id = v_tenant AND r.status = 'APPROVED';
  IF v_applicant IS NULL THEN
    RAISE EXCEPTION 'REQUEST_NOT_LINKABLE' USING ERRCODE = 'P0001';
  END IF;

  IF v_type = 'PLAYER' THEN
    SELECT p.user_id INTO v_current FROM public.players p WHERE p.id = p_record_id AND p.tenant_id = v_tenant;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'RECORD_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF v_current = v_applicant THEN
      RETURN;
    END IF;
    IF v_current IS NOT NULL THEN
      RAISE EXCEPTION 'RECORD_ALREADY_LINKED' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.players p WHERE p.user_id = v_applicant) THEN
      RAISE EXCEPTION 'PLAYER_PROFILE_EXISTS' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.players SET user_id = v_applicant, updated_at = now() WHERE id = p_record_id;
  ELSE
    SELECT g.user_id INTO v_current FROM public.guardians g WHERE g.id = p_record_id AND g.tenant_id = v_tenant;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'RECORD_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF v_current = v_applicant THEN
      RETURN;
    END IF;
    IF v_current IS NOT NULL THEN
      RAISE EXCEPTION 'RECORD_ALREADY_LINKED' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.guardians SET user_id = v_applicant, updated_at = now() WHERE id = p_record_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.link_join_request_account(uuid, uuid) FROM PUBLIC;

-- ---------------------------------------------------------------------------------------------------------------------
-- Runtime privileges: every column of players / guardians except user_id
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  r text;
  t text;
  cols text;
BEGIN
  FOREACH r IN ARRAY ARRAY['academy_runtime', 'academy_runtime_ci', 'sportexus_app'] LOOP
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.link_join_request_account(uuid, uuid) TO %I', r);
    FOREACH t IN ARRAY ARRAY['players', 'guardians'] LOOP
      SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO cols
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name <> 'user_id';
      EXECUTE format('REVOKE INSERT, UPDATE ON TABLE public.%I FROM %I', t, r);
      EXECUTE format('GRANT INSERT (%s), UPDATE (%s) ON TABLE public.%I TO %I', cols, cols, t, r);
    END LOOP;
  END LOOP;
END $$;

-- =====================================================================================================================
-- Rollback (forward migration): GRANT INSERT, UPDATE ON TABLE public.players, public.guardians TO <runtime role>;
-- DROP FUNCTION public.link_join_request_account(uuid, uuid). This re-opens account linking to any staff member.
-- =====================================================================================================================
