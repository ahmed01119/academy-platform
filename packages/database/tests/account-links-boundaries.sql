-- Account links (item 5) and must_reset_password (item 6) boundary tests: migrations 20261118110000, 20261118120000.
-- Run after phase3a2-fixtures.sql on an isolated database, by the admin role. Link checks run AS the runtime role.
-- Usage: psql -v ON_ERROR_STOP=1 -v runtime_role=academy_runtime_ci -f phase3a2-fixtures.sql -f account-links-boundaries.sql
\set QUIET on
SET client_min_messages = warning;

CREATE OR REPLACE FUNCTION pg_temp.al_ctx(p_actor text, p_tenant text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('app.actor_user_id', coalesce(p_actor, ''), false),
         set_config('app.current_actor_user_id', '', false),
         set_config('app.tenant_id', coalesce(p_tenant, ''), false);
$$;
CREATE OR REPLACE FUNCTION pg_temp.al_fail(p_label text, p_sql text, p_pattern text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE OR REPLACE FUNCTION pg_temp.al_check(p_label text, p_ok boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL %', p_label;
  END IF;
  RAISE NOTICE 'PASS %', p_label;
END;
$$;
\set A '''00000000-0000-4000-8000-0000000000a1'''
\set OWNER_A '''00000000-0000-4000-8000-000000000010'''
\set COACH_A '''00000000-0000-4000-8000-000000000011'''

SET client_min_messages = notice;
SET ROLE :runtime_role;

-- Setup as the runtime role: an applicant account and a PLAYER join request at tenant A.
BEGIN;
SELECT pg_temp.al_ctx(NULL, NULL);
INSERT INTO public.users (id, email, password_hash, name, phone, created_at, updated_at)
VALUES (gen_random_uuid(), 'al-player@example.test', '$argon2id$v=19$synthetic', 'AL Player', NULL, now(), now())
RETURNING id::text AS al_applicant \gset
SELECT set_config('app.actor_user_id', :'al_applicant', true);
SELECT request_id::text AS al_request FROM public.submit_player_join_request(:A, 'AL Player', 'al-player@example.test',
  NULL, NULL, NULL, 'PLAYER') \gset
COMMIT;

-- Staff (tenant A owner) create the player record without an account, as the approval does.
SELECT pg_temp.al_ctx(:OWNER_A, :A);
INSERT INTO public.players (id, tenant_id, first_name, last_name, date_of_birth, emergency_contact_name,
                            emergency_contact_phone, updated_at)
VALUES (gen_random_uuid(), :A, 'AL', 'Player', '2010-01-01', 'Contact', '000', now())
RETURNING id::text AS al_player \gset
SELECT pg_temp.al_check('AL-01 staff create a player record without user_id', :'al_player' IS NOT NULL);

SELECT pg_temp.al_fail('AL-02 staff cannot set players.user_id directly',
  format($$UPDATE public.players SET user_id = %L WHERE id = %L$$, :'al_applicant', :'al_player'), 'permission denied');
SELECT pg_temp.al_fail('AL-03 staff cannot create a player already linked to an account',
  format($$INSERT INTO public.players (id, tenant_id, first_name, last_name, date_of_birth, emergency_contact_name,
           emergency_contact_phone, updated_at, user_id)
           VALUES (gen_random_uuid(), '00000000-0000-4000-8000-0000000000a1', 'X', 'Y', '2010-01-01', 'C', '0', now(), %L)$$,
         :'al_applicant'), 'permission denied');
SELECT pg_temp.al_fail('AL-04 staff cannot set guardians.user_id directly',
  format($$UPDATE public.guardians SET user_id = %L WHERE id = '00000000-0000-4000-8000-00000000d002'$$, :'al_applicant'),
  'permission denied');
SELECT pg_temp.al_fail('AL-05 a request that is not APPROVED cannot be linked',
  format($$SELECT public.link_join_request_account(%L, %L)$$, :'al_request', :'al_player'), 'REQUEST_NOT_LINKABLE');

UPDATE public.player_registration_requests SET status = 'APPROVED', reviewed_by_user_id = :OWNER_A::uuid,
  reviewed_at = now(), updated_at = now() WHERE id = :'al_request'::uuid;

SELECT pg_temp.al_ctx(:COACH_A, :A);
SELECT pg_temp.al_fail('AL-06 a coach without delegation cannot link accounts',
  format($$SELECT public.link_join_request_account(%L, %L)$$, :'al_request', :'al_player'), 'LINK_NOT_PERMITTED');
SELECT pg_temp.al_ctx(:OWNER_A, '00000000-0000-4000-8000-0000000000b1');
SELECT pg_temp.al_fail('AL-07 another academy''s context cannot link the request',
  format($$SELECT public.link_join_request_account(%L, %L)$$, :'al_request', :'al_player'), 'LINK_NOT_PERMITTED');

SELECT pg_temp.al_ctx(:OWNER_A, :A);
SELECT public.link_join_request_account(:'al_request'::uuid, :'al_player'::uuid);
SELECT pg_temp.al_check('AL-08 a reviewer links the approved applicant to the player record',
  (SELECT user_id::text FROM public.players WHERE id = :'al_player'::uuid) = :'al_applicant');
SELECT public.link_join_request_account(:'al_request'::uuid, :'al_player'::uuid);
SELECT pg_temp.al_check('AL-09 linking again is a no-op', true);
SELECT pg_temp.al_fail('AL-10 the request cannot be linked to a record already linked to someone else',
  format($$SELECT public.link_join_request_account(%L, '00000000-0000-4000-8000-00000000f001')$$, :'al_request'),
  'RECORD_ALREADY_LINKED');

RESET ROLE;

-- ---------------------------------------------------------------------------------------------------------------------
-- Item 6: must_reset_password is cleared by a password change and only by that (trigger, so checked as the admin)
-- ---------------------------------------------------------------------------------------------------------------------
UPDATE public.users SET must_reset_password = true WHERE id = :'al_applicant'::uuid;
UPDATE public.users SET name = 'AL Player renamed' WHERE id = :'al_applicant'::uuid;
SELECT pg_temp.al_check('MR-01 other changes keep the flag set',
  (SELECT must_reset_password FROM public.users WHERE id = :'al_applicant'::uuid));
UPDATE public.users SET password_hash = '$argon2id$v=19$synthetic-new' WHERE id = :'al_applicant'::uuid;
SELECT pg_temp.al_check('MR-02 a new password clears the flag',
  NOT (SELECT must_reset_password FROM public.users WHERE id = :'al_applicant'::uuid));
UPDATE public.users SET must_reset_password = true WHERE id = :'al_applicant'::uuid;
UPDATE public.users SET password_hash = password_hash WHERE id = :'al_applicant'::uuid;
SELECT pg_temp.al_check('MR-03 re-writing the same hash does not clear it',
  (SELECT must_reset_password FROM public.users WHERE id = :'al_applicant'::uuid));

SELECT pg_temp.al_ctx(NULL, NULL);
\echo 'account-links-boundaries: all checks passed'
