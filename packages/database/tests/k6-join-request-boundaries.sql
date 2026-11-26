-- K6 access-boundary tests: join requests from PLAYER and GUARDIAN applicants (migration 20261118090000).
-- Run after phase3a2-fixtures.sql (and optionally phase3a2-boundaries.sql) on an isolated database, by the admin role.
-- Every check runs AS the runtime role (SET ROLE :runtime_role), so RLS, column privileges and function checks apply.
-- Usage: psql -v ON_ERROR_STOP=1 -v runtime_role=academy_runtime_ci -f phase3a2-fixtures.sql -f k6-join-request-boundaries.sql
\set QUIET on
SET client_min_messages = warning;

CREATE OR REPLACE FUNCTION pg_temp.k6_ctx(p_actor text, p_tenant text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('app.actor_user_id', coalesce(p_actor, ''), false),
         set_config('app.current_actor_user_id', '', false),
         set_config('app.tenant_id', coalesce(p_tenant, ''), false);
$$;
CREATE OR REPLACE FUNCTION pg_temp.k6_fail(p_label text, p_sql text, p_pattern text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ~* p_pattern THEN
      RAISE NOTICE 'PASS %', p_label;
      RETURN;
    END IF;
    RAISE EXCEPTION 'FAIL % - wrong error: % (expected /%/)', p_label, SQLERRM, p_pattern;
  END;
  RAISE EXCEPTION 'FAIL % - statement succeeded but must fail: %', p_label, p_sql;
END;
$$;
CREATE OR REPLACE FUNCTION pg_temp.k6_check(p_label text, p_ok boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL %', p_label;
  END IF;
  RAISE NOTICE 'PASS %', p_label;
END;
$$;
\set A '''00000000-0000-4000-8000-0000000000a1'''
\set B '''00000000-0000-4000-8000-0000000000b1'''

SET client_min_messages = notice;
SET ROLE :runtime_role;
SELECT pg_temp.k6_check('K6-00 running as a non-owner, non-BYPASSRLS role',
  NOT (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user));

-- ---------------------------------------------------------------------------------------------------------------------
-- New pending account + GUARDIAN request in one transaction (the API's anonymous path)
-- ---------------------------------------------------------------------------------------------------------------------
BEGIN;
SELECT pg_temp.k6_ctx(NULL, NULL);
INSERT INTO public.users (id, email, password_hash, name, phone, created_at, updated_at)
VALUES (gen_random_uuid(), 'k6-guardian@example.test', '$argon2id$v=19$synthetic', 'K6 Guardian', NULL, now(), now())
RETURNING id::text AS k6_user \gset
SELECT set_config('test.k6_user', :'k6_user', false);
SELECT set_config('app.actor_user_id', current_setting('test.k6_user'), true);
SELECT pg_temp.k6_check('K6-01 GUARDIAN request recorded with the new account as applicant',
  (SELECT applicant_user_id::text = current_setting('test.k6_user') AND requester_type = 'GUARDIAN'
          AND status = 'PENDING_REVIEW'
   FROM public.submit_player_join_request(:A, 'K6 Child', 'k6-guardian@example.test', '+20100', '2016-02-02',
                                          'K6 Guardian', 'GUARDIAN')));
COMMIT;

SELECT pg_temp.k6_ctx(current_setting('test.k6_user'), NULL);
SELECT pg_temp.k6_check('K6-02 the applicant reads their own request, with its requester type',
  (SELECT count(*) = 1 AND bool_and(requester_type = 'GUARDIAN') FROM public.player_registration_requests));
SELECT pg_temp.k6_fail('K6-03 GUARDIAN request without the guardian name refused',
  $$SELECT * FROM public.submit_player_join_request('00000000-0000-4000-8000-0000000000a1', 'Other Child',
      'k6-guardian@example.test', NULL, NULL, NULL, 'GUARDIAN')$$, 'GUARDIAN_NAME_REQUIRED');
SELECT pg_temp.k6_fail('K6-04 unknown requester type refused',
  $$SELECT * FROM public.submit_player_join_request('00000000-0000-4000-8000-0000000000a1', 'Other Child',
      'k6-guardian@example.test', NULL, NULL, 'G', 'COACH')$$, 'REQUESTER_TYPE_INVALID');
SELECT pg_temp.k6_fail('K6-05 second pending request for the same child at the same academy refused',
  $$SELECT * FROM public.submit_player_join_request('00000000-0000-4000-8000-0000000000a1', ' k6 child ',
      'k6-guardian@example.test', NULL, NULL, 'K6 Guardian', 'GUARDIAN')$$, 'DUPLICATE_PENDING_REQUEST');
SELECT pg_temp.k6_check('K6-06 the same guardian may ask for another child',
  (SELECT count(*) = 1 FROM public.submit_player_join_request(:A, 'K6 Second Child', 'k6-guardian@example.test',
                                                              NULL, NULL, 'K6 Guardian', 'GUARDIAN')));
SELECT pg_temp.k6_check('K6-07 ... or for the same child at another academy',
  (SELECT count(*) = 1 FROM public.submit_player_join_request(:B, 'K6 Child', 'k6-guardian@example.test',
                                                              NULL, NULL, 'K6 Guardian', 'GUARDIAN')));

-- ---------------------------------------------------------------------------------------------------------------------
-- PLAYER requests
-- ---------------------------------------------------------------------------------------------------------------------
SELECT pg_temp.k6_ctx('00000000-0000-4000-8000-000000000040', NULL);   -- portal-player: already holds a player profile
SELECT pg_temp.k6_fail('K6-08 PLAYER request from an account that already has a player profile refused',
  $$SELECT * FROM public.submit_player_join_request('00000000-0000-4000-8000-0000000000b1', 'Linked Player',
      'portal-player@example.test', NULL, NULL, NULL, 'PLAYER')$$, 'PLAYER_PROFILE_EXISTS');
SELECT pg_temp.k6_check('K6-09 the same account may still apply as a GUARDIAN for a child',
  (SELECT requester_type = 'GUARDIAN'
   FROM public.submit_player_join_request(:B, 'Their Child', 'portal-player@example.test', NULL, NULL,
                                          'Portal Player', 'GUARDIAN')));
SELECT pg_temp.k6_ctx(NULL, NULL);
SELECT pg_temp.k6_check('K6-10 six-argument calls keep meaning PLAYER (older callers)',
  (SELECT requester_type = 'PLAYER'
   FROM public.submit_player_join_request(:A, 'K6 Anonymous Kid', 'k6-anon@example.test', NULL, NULL, 'Parent')));

-- ---------------------------------------------------------------------------------------------------------------------
-- Privileges: the requester type is fixed once submitted; staff see it
-- ---------------------------------------------------------------------------------------------------------------------
SELECT pg_temp.k6_ctx('00000000-0000-4000-8000-000000000010', :A);     -- tenant A owner
SELECT pg_temp.k6_check('K6-11 tenant staff read the requester type of their academy''s requests',
  (SELECT count(*) = 2 FROM public.player_registration_requests WHERE requester_type = 'GUARDIAN'));
SELECT pg_temp.k6_fail('K6-12 requester type cannot be changed after submission',
  $$UPDATE public.player_registration_requests SET requester_type = 'PLAYER' WHERE requester_type = 'GUARDIAN'$$,
  'permission denied');
SELECT pg_temp.k6_fail('K6-13 applicant cannot be re-assigned after submission',
  $$UPDATE public.player_registration_requests SET applicant_user_id = NULL$$, 'permission denied');
SELECT pg_temp.k6_check('K6-14 tenant A staff never see tenant B requests',
  (SELECT count(*) = 0 FROM public.player_registration_requests WHERE tenant_id = '00000000-0000-4000-8000-0000000000b1'));

-- ---------------------------------------------------------------------------------------------------------------------
-- Portal read policies (migration 20261118100000): a player / guardian sees only the academy of their own player(s)
-- ---------------------------------------------------------------------------------------------------------------------
SELECT pg_temp.k6_ctx('00000000-0000-4000-8000-000000000040', NULL);   -- portal player of tenant A
SELECT pg_temp.k6_check('PU-01 a portal player reads exactly the academy of their player record',
  (SELECT array_agg(id::text) = ARRAY['00000000-0000-4000-8000-0000000000a1'] FROM public.tenants));
SELECT pg_temp.k6_ctx('00000000-0000-4000-8000-000000000042', NULL);   -- guardian linked to a tenant A child
SELECT pg_temp.k6_check('PU-02 a linked guardian reads exactly the academy of their child',
  (SELECT array_agg(id::text) = ARRAY['00000000-0000-4000-8000-0000000000a1'] FROM public.tenants));
SELECT pg_temp.k6_check('PU-03 ... and no other academy''s groups, branches or members',
  (SELECT count(*) FROM public.training_groups WHERE tenant_id <> '00000000-0000-4000-8000-0000000000a1') = 0
  AND (SELECT count(*) FROM public.branches WHERE tenant_id <> '00000000-0000-4000-8000-0000000000a1') = 0
  AND (SELECT count(*) FROM public.group_members WHERE tenant_id <> '00000000-0000-4000-8000-0000000000a1') = 0);
SELECT pg_temp.k6_ctx('00000000-0000-4000-8000-000000000050', NULL);   -- account without any portal link
SELECT pg_temp.k6_check('PU-04 an account without a portal link reads no academy or group',
  (SELECT count(*) FROM public.tenants) = 0 AND (SELECT count(*) FROM public.training_groups) = 0);
SELECT pg_temp.k6_ctx(NULL, NULL);
SELECT pg_temp.k6_check('PU-05 anonymous reads no academy, group, branch, member or coach',
  (SELECT count(*) FROM public.tenants) = 0 AND (SELECT count(*) FROM public.training_groups) = 0
  AND (SELECT count(*) FROM public.branches) = 0 AND (SELECT count(*) FROM public.group_members) = 0
  AND (SELECT count(*) FROM public.group_coaches) = 0);

RESET ROLE;
SELECT pg_temp.k6_check('PU-06 the six portal policies are SELECT-only',
  (SELECT count(*) = 6 AND bool_and(cmd = 'SELECT') FROM pg_policies
   WHERE schemaname = 'public'
     AND policyname IN ('tenants_portal_user', 'group_members_portal_user', 'training_groups_portal_user',
                        'group_coaches_portal_user', 'branches_portal_user', 'attendance_sessions_portal_group')));
SELECT pg_temp.k6_ctx(NULL, NULL);
\echo 'k6-join-request-boundaries: all checks passed'
