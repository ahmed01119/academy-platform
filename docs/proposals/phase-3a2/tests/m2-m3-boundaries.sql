-- M2/M3 access-boundary tests. Run by the admin role on an isolated database built with fixtures.sql + M2 + M3.
-- Every check runs AS the runtime role (SET ROLE :runtime_role) with an explicit context, so RLS, column privileges
-- and function checks all apply. Any failed expectation raises and stops the run (psql ON_ERROR_STOP).
-- Usage: psql -v ON_ERROR_STOP=1 -v runtime_role=sportexus_app -f m2-m3-boundaries.sql
\set QUIET on
SET client_min_messages = warning;

-- Helpers (session-local).
CREATE FUNCTION pg_temp.ctx(p_actor text, p_tenant text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('app.actor_user_id', coalesce(p_actor, ''), false),
         set_config('app.current_actor_user_id', '', false),
         set_config('app.tenant_id', coalesce(p_tenant, ''), false);
$$;
CREATE FUNCTION pg_temp.u(p int) RETURNS text LANGUAGE sql AS $$
  SELECT '00000000-0000-4000-8000-0000000000' || lpad(p::text, 2, '0');
$$;
CREATE FUNCTION pg_temp.expect_fail(p_label text, p_sql text, p_pattern text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION pg_temp.check(p_label text, p_ok boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL %', p_label;
  END IF;
  RAISE NOTICE 'PASS %', p_label;
END;
$$;
CREATE FUNCTION pg_temp.n(p_sql text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v bigint;
BEGIN
  EXECUTE 'SELECT count(*) FROM (' || p_sql || ') x' INTO v;
  RETURN v;
END;
$$;
\set A '''00000000-0000-4000-8000-0000000000a1'''
\set B '''00000000-0000-4000-8000-0000000000b1'''
\set S '''00000000-0000-4000-8000-0000000000c1'''
\set E '''00000000-0000-4000-8000-0000000000e1'''

SET client_min_messages = notice;
SET ROLE :runtime_role;
SELECT pg_temp.check('00 running as a non-owner, non-BYPASSRLS role',
  NOT (SELECT rolbypassrls OR rolsuper FROM pg_roles WHERE rolname = current_user));

-- =====================================================================================================================
-- M2.2 academy_applications (S4)
-- =====================================================================================================================
SELECT pg_temp.ctx(NULL, NULL);
SELECT pg_temp.check('S4-01 anonymous context reads no applications (pending ones included)',
  pg_temp.n('SELECT 1 FROM public.academy_applications') = 0);
SELECT pg_temp.ctx(pg_temp.u(31), NULL);
SELECT pg_temp.check('S4-02 applicant sees own applications of every status (REJECTED + MORE_INFO), nothing else',
  pg_temp.n('SELECT 1 FROM public.academy_applications') = 2
  AND pg_temp.n($$SELECT 1 FROM public.academy_applications WHERE applicant_user_id <> current_app_user_id()$$) = 0);
SELECT pg_temp.ctx(pg_temp.u(11), :A);
SELECT pg_temp.check('S4-03 tenant staff context reads no applications',
  pg_temp.n('SELECT 1 FROM public.academy_applications') = 0);

SELECT pg_temp.ctx(pg_temp.u(60), NULL);
INSERT INTO public.academy_applications (id, applicant_user_id, academy_name, academy_slug, contact_email, updated_at)
VALUES ('00000000-0000-4000-8000-00000000ab60', pg_temp.u(60)::uuid, 'Own Academy', 'own-academy', 'plain@example.test', now());
SELECT pg_temp.check('S4-04 own application inserted with the PENDING_REVIEW default and readable by its applicant',
  (SELECT status::text FROM public.academy_applications WHERE id = '00000000-0000-4000-8000-00000000ab60') = 'PENDING_REVIEW');
SELECT pg_temp.expect_fail('S4-05 insert for another applicant denied',
  $$INSERT INTO public.academy_applications (id, applicant_user_id, academy_name, academy_slug, contact_email, updated_at)
    VALUES (gen_random_uuid(), '00000000-0000-4000-8000-000000000030', 'X', 'x-forged', 'x@example.test', now())$$,
  'row-level security');
SELECT pg_temp.expect_fail('S4-06 status cannot be supplied (column privilege)',
  $$INSERT INTO public.academy_applications (id, applicant_user_id, academy_name, academy_slug, contact_email, status, updated_at)
    VALUES (gen_random_uuid(), current_app_user_id(), 'X', 'x-approved', 'x@example.test', 'APPROVED', now())$$,
  'permission denied');
SELECT pg_temp.expect_fail('S4-07 review fields cannot be supplied (column privilege)',
  $$INSERT INTO public.academy_applications (id, applicant_user_id, academy_name, academy_slug, contact_email, provisioned_tenant_id, updated_at)
    VALUES (gen_random_uuid(), current_app_user_id(), 'X', 'x-prov', 'x@example.test', '00000000-0000-4000-8000-0000000000a1', now())$$,
  'permission denied');
SELECT pg_temp.expect_fail('S4-08 applicant cannot rewrite submitted fields (column privilege)',
  $$UPDATE public.academy_applications SET academy_name = 'Changed' WHERE id = '00000000-0000-4000-8000-00000000ab60'$$,
  'permission denied');
UPDATE public.academy_applications SET status = 'APPROVED' WHERE id = '00000000-0000-4000-8000-00000000ab60';
SELECT pg_temp.check('S4-09 applicant cannot change the status of their own application (no UPDATE policy: 0 rows)',
  (SELECT status::text FROM public.academy_applications WHERE id = '00000000-0000-4000-8000-00000000ab60') = 'PENDING_REVIEW');
SELECT pg_temp.expect_fail('S4-10 applications cannot be deleted by the runtime role',
  $$DELETE FROM public.academy_applications WHERE id = '00000000-0000-4000-8000-00000000ab60'$$, 'permission denied');

SELECT pg_temp.ctx(pg_temp.u(3), NULL);
SELECT pg_temp.check('S4-11 a suspended platform admin is not a platform admin for RLS',
  pg_temp.n('SELECT 1 FROM public.academy_applications') = 0);
SELECT pg_temp.ctx(pg_temp.u(2), NULL);
SELECT pg_temp.check('S4-12 active platform admin reads every application',
  pg_temp.n('SELECT 1 FROM public.academy_applications') = 5);
UPDATE public.academy_applications SET review_notes = 'checked', updated_at = now()
WHERE id = '00000000-0000-4000-8000-00000000aa03';
SELECT pg_temp.check('S4-13 platform admin updates review columns',
  (SELECT review_notes FROM public.academy_applications WHERE id = '00000000-0000-4000-8000-00000000aa03') = 'checked');

SELECT pg_temp.ctx(NULL, NULL);
SELECT pg_temp.check('S4-14 slug check: tenant slug, pending, more-info slugs in use; rejected and new slugs free',
  public.academy_slug_in_use('Tenant-A ') AND public.academy_slug_in_use('alpha-academy')
  AND public.academy_slug_in_use('gamma-academy') AND NOT public.academy_slug_in_use('beta-academy')
  AND NOT public.academy_slug_in_use('brand-new'));

-- =====================================================================================================================
-- M2.3 / M2.6 player_registration_requests and join requests
-- =====================================================================================================================
SELECT pg_temp.ctx(NULL, NULL);
SELECT pg_temp.expect_fail('JR-01 direct insert denied (function is the only path)',
  $$INSERT INTO public.player_registration_requests (id, tenant_id, player_name, contact_email, updated_at)
    VALUES (gen_random_uuid(), '00000000-0000-4000-8000-0000000000a1', 'X', 'x@example.test', now())$$, 'permission denied');
SELECT pg_temp.check('JR-02 anonymous join request accepted for an ACTIVE academy',
  (SELECT applicant_user_id IS NULL AND status = 'PENDING_REVIEW' AND tenant_name = 'Tenant A'
   FROM public.submit_player_join_request(:A, ' Kid One ', 'Parent@Example.TEST', NULL, '2015-05-05', 'Parent')));
SELECT pg_temp.expect_fail('JR-03 suspended academy refused',
  $$SELECT * FROM public.submit_player_join_request('00000000-0000-4000-8000-0000000000c1', 'Kid', 'p@example.test')$$,
  'ACADEMY_NOT_AVAILABLE');
SELECT pg_temp.expect_fail('JR-04 unknown academy refused with the same error',
  $$SELECT * FROM public.submit_player_join_request(gen_random_uuid(), 'Kid', 'p@example.test')$$, 'ACADEMY_NOT_AVAILABLE');
SELECT pg_temp.expect_fail('JR-05 invalid e-mail refused',
  $$SELECT * FROM public.submit_player_join_request('00000000-0000-4000-8000-0000000000a1', 'Kid', 'not-an-email')$$,
  'CONTACT_EMAIL_INVALID');
SELECT pg_temp.expect_fail('JR-06 future date of birth refused',
  $$SELECT * FROM public.submit_player_join_request('00000000-0000-4000-8000-0000000000a1', 'Kid', 'p@example.test', NULL, current_date + 1)$$,
  'DATE_OF_BIRTH_INVALID');
SELECT pg_temp.check('JR-setup four more pending requests for the same e-mail',
  (SELECT count(*) FROM public.submit_player_join_request(:A, 'Kid Two', 'parent@example.test')) = 1
  AND (SELECT count(*) FROM public.submit_player_join_request(:A, 'Kid Three', 'parent@example.test')) = 1
  AND (SELECT count(*) FROM public.submit_player_join_request(:A, 'Kid Four', 'parent@example.test')) = 1
  AND (SELECT count(*) FROM public.submit_player_join_request(:A, 'Kid Five', 'parent@example.test')) = 1);
SELECT pg_temp.expect_fail('JR-07 sixth pending request for the same academy and e-mail refused',
  $$SELECT * FROM public.submit_player_join_request('00000000-0000-4000-8000-0000000000a1', 'Kid Six', 'PARENT@example.test')$$,
  'TOO_MANY_PENDING_REQUESTS');
SELECT pg_temp.check('JR-08 anonymous context cannot read join requests',
  pg_temp.n('SELECT 1 FROM public.player_registration_requests') = 0);

SELECT pg_temp.ctx(pg_temp.u(50), NULL);
SELECT pg_temp.check('JR-09 signed-in applicant recorded as applicant',
  (SELECT applicant_user_id = current_app_user_id()
   FROM public.submit_player_join_request(:A, 'Own Kid', 'join-applicant@example.test')));
SELECT pg_temp.check('JR-10 applicant reads own requests only (login gating)',
  pg_temp.n('SELECT 1 FROM public.player_registration_requests') = 1);
SELECT pg_temp.ctx(pg_temp.u(61), NULL);
SELECT pg_temp.expect_fail('JR-11 suspended signed-in applicant refused',
  $$SELECT * FROM public.submit_player_join_request('00000000-0000-4000-8000-0000000000a1', 'Kid', 's@example.test')$$,
  'APPLICANT_NOT_PERMITTED');

SELECT pg_temp.ctx(pg_temp.u(10), :A);
SELECT pg_temp.check('JR-12 tenant A staff read the 6 requests of tenant A',
  pg_temp.n('SELECT 1 FROM public.player_registration_requests') = 6);
SELECT pg_temp.check('JR-13 notifications went to OWNER/MANAGER/BRANCH_MANAGER only (A owner: 6; coach: none)',
  (SELECT count(*) FROM public.app_notifications WHERE type = 'PLAYER_REGISTRATION') = 6);
UPDATE public.player_registration_requests SET status = 'REJECTED', review_notes = 'no', reviewed_at = now(),
  reviewed_by_user_id = current_app_user_id(), updated_at = now()
WHERE player_name = 'Kid Five';
SELECT pg_temp.check('JR-14 staff update review columns in their tenant',
  (SELECT status::text FROM public.player_registration_requests WHERE player_name = 'Kid Five') = 'REJECTED');
SELECT pg_temp.expect_fail('JR-15 staff cannot rewrite submitted fields',
  $$UPDATE public.player_registration_requests SET player_name = 'Changed'$$, 'permission denied');
SELECT pg_temp.ctx(pg_temp.u(11), :A);
SELECT pg_temp.check('JR-16 coach (not OWNER/MANAGER/BRANCH_MANAGER) received no join-request notification',
  (SELECT count(*) FROM public.app_notifications WHERE type = 'PLAYER_REGISTRATION') = 0);
SELECT pg_temp.ctx(pg_temp.u(20), :B);
SELECT pg_temp.check('JR-17 tenant B staff see none of tenant A requests',
  pg_temp.n('SELECT 1 FROM public.player_registration_requests') = 0);
UPDATE public.player_registration_requests SET status = 'APPROVED', updated_at = now();
SELECT pg_temp.ctx(pg_temp.u(10), :A);
SELECT pg_temp.check('JR-18 cross-tenant update affected 0 rows',
  pg_temp.n($$SELECT 1 FROM public.player_registration_requests WHERE status = 'APPROVED'$$) = 0);

-- =====================================================================================================================
-- M2.4 append_audit_log
-- =====================================================================================================================
SELECT pg_temp.ctx(pg_temp.u(10), :A);
SELECT pg_temp.expect_fail('AU-01 direct audit insert denied',
  $$INSERT INTO public.audit_logs (id, tenant_id, action, resource_type) VALUES (gen_random_uuid(), '00000000-0000-4000-8000-0000000000a1', 'X_X_X', 'T')$$,
  'permission denied');
SELECT set_config('test.id', public.append_audit_log('BRANCH_UPDATE', 'Branch', 'b1', '{"k":1}', '127.0.0.1', 'ua')::text, false);
SELECT pg_temp.check('AU-02 member writes a tenant event; actor and tenant come from the context',
  (SELECT tenant_id::text = :A AND actor_user_id::text = pg_temp.u(10)
   FROM public.audit_logs WHERE id = current_setting('test.id')::uuid));
SELECT pg_temp.expect_fail('AU-03 claimed tenant differs from the context',
  $$SELECT public.append_audit_log('BRANCH_UPDATE', 'Branch', NULL, NULL, NULL, NULL, '00000000-0000-4000-8000-0000000000b1')$$,
  'AUDIT_TENANT_CONTEXT_MISMATCH');
SELECT pg_temp.expect_fail('AU-04 claimed actor differs from the context',
  $$SELECT public.append_audit_log('BRANCH_UPDATE', 'Branch', NULL, NULL, NULL, NULL, NULL, '00000000-0000-4000-8000-000000000011')$$,
  'AUDIT_ACTOR_CONTEXT_MISMATCH');
SELECT pg_temp.ctx(pg_temp.u(20), :A);
SELECT pg_temp.expect_fail('AU-05 actor with no link to the tenant cannot write its events (forged tenant context)',
  $$SELECT public.append_audit_log('BRANCH_UPDATE', 'Branch')$$, 'AUDIT_ACTOR_NOT_LINKED_TO_TENANT');
SELECT pg_temp.ctx(pg_temp.u(12), :A);
SELECT pg_temp.check('AU-06 revoked member can still be recorded (membership history counts)',
  public.append_audit_log('MEMBERSHIP_REVOKED', 'TenantMembership') IS NOT NULL);
SELECT pg_temp.ctx(pg_temp.u(40), :A);
SELECT pg_temp.check('AU-07 portal-linked user can be recorded for the tenant',
  public.append_audit_log('PORTAL_VIEW', 'Player') IS NOT NULL);
SELECT pg_temp.ctx(pg_temp.u(2), :B);
SELECT pg_temp.check('AU-08 platform admin can be recorded for any tenant',
  public.append_audit_log('PLATFORM_ACADEMY_STATUS_UPDATE', 'Tenant') IS NOT NULL);
SELECT pg_temp.ctx(NULL, :A);
SELECT pg_temp.expect_fail('AU-09 tenant event without an actor refused',
  $$SELECT public.append_audit_log('BRANCH_UPDATE', 'Branch')$$, 'AUDIT_TENANT_EVENT_REQUIRES_ACTOR');
SELECT pg_temp.ctx(NULL, NULL);
SELECT pg_temp.check('AU-10 anonymous platform-level event allowed (e.g. failed login for an unknown e-mail)',
  public.append_audit_log('AUTH_LOGIN_FAILURE', 'User') IS NOT NULL);
SELECT pg_temp.ctx('00000000-0000-4000-8000-000000000099', NULL);
SELECT pg_temp.expect_fail('AU-11 unknown actor refused', $$SELECT public.append_audit_log('AUTH_LOGOUT', 'User')$$,
  'AUDIT_ACTOR_UNKNOWN');
SELECT pg_temp.ctx(pg_temp.u(60), NULL);
SELECT pg_temp.expect_fail('AU-12 malformed action refused', $$SELECT public.append_audit_log('drop table', 'User')$$,
  'AUDIT_ACTION_INVALID');
SELECT pg_temp.ctx(pg_temp.u(2), NULL);
SELECT set_config('test.id', public.append_audit_log('AUTH_LOGIN_SUCCESS', 'User', NULL,
  jsonb_build_object('blob', repeat('x', 20000)), NULL, repeat('u', 2000))::text, false);
SELECT pg_temp.check('AU-13 oversized metadata and user agent are truncated, never rejected',
  (SELECT metadata ? 'truncated' AND length(user_agent) = 512 FROM public.audit_logs
   WHERE id = current_setting('test.id')::uuid));
SELECT pg_temp.expect_fail('AU-14 audit rows stay immutable (UPDATE)',
  $$UPDATE public.audit_logs SET action = 'TAMPERED'$$, 'permission denied');

-- =====================================================================================================================
-- M2.5 create_app_notification
-- =====================================================================================================================
SELECT pg_temp.ctx(pg_temp.u(11), :A);
SELECT pg_temp.expect_fail('NO-01 direct notification insert denied',
  $$INSERT INTO public.app_notifications (id, user_id, type, title, body) VALUES (gen_random_uuid(), current_app_user_id(), 'SYSTEM', 't', 'b')$$,
  'permission denied');
SELECT pg_temp.check('NO-02 member notifies a member of the same tenant',
  public.create_app_notification(pg_temp.u(10)::uuid, :A, 'EXPENSE_APPROVAL', 'Expense', 'Pending', '/finance') IS NOT NULL);
SELECT pg_temp.expect_fail('NO-03 recipient outside the tenant refused',
  $$SELECT public.create_app_notification('00000000-0000-4000-8000-000000000020', '00000000-0000-4000-8000-0000000000a1', 'SYSTEM', 't', 'b')$$,
  'NOTIFICATION_RECIPIENT_NOT_IN_TENANT');
SELECT pg_temp.expect_fail('NO-04 tenant differs from the context',
  $$SELECT public.create_app_notification('00000000-0000-4000-8000-000000000020', '00000000-0000-4000-8000-0000000000b1', 'SYSTEM', 't', 'b')$$,
  'NOTIFICATION_TENANT_CONTEXT_MISMATCH');
SELECT pg_temp.ctx(pg_temp.u(12), NULL);
SELECT pg_temp.expect_fail('NO-05 revoked member cannot send tenant notifications',
  $$SELECT public.create_app_notification('00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-0000000000a1', 'SYSTEM', 't', 'b')$$,
  'NOTIFICATION_SENDER_NOT_IN_TENANT');
SELECT pg_temp.ctx(pg_temp.u(10), :A);
SELECT pg_temp.check('NO-06 reviewer notifies a join applicant who is not a member yet',
  public.create_app_notification(pg_temp.u(50)::uuid, :A, 'PLAYER_REGISTRATION', 'Update', 'Reviewed', '/player') IS NOT NULL);
SELECT pg_temp.check('NO-07 staff notifies a portal-linked user',
  public.create_app_notification(pg_temp.u(40)::uuid, :A, 'SYSTEM', 'Hello', 'Body') IS NOT NULL);
SELECT pg_temp.expect_fail('NO-08 off-site link refused', $$SELECT public.create_app_notification('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-0000000000a1', 'SYSTEM', 't', 'b', 'https://evil.example')$$,
  'NOTIFICATION_HREF_INVALID');
SELECT pg_temp.expect_fail('NO-09 protocol-relative link refused', $$SELECT public.create_app_notification('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-0000000000a1', 'SYSTEM', 't', 'b', '//evil.example')$$,
  'NOTIFICATION_HREF_INVALID');
SELECT pg_temp.expect_fail('NO-10 unknown type refused', $$SELECT public.create_app_notification('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-0000000000a1', 'PHISHING', 't', 'b')$$,
  'NOTIFICATION_TYPE_INVALID');
SELECT pg_temp.ctx(NULL, NULL);
SELECT pg_temp.expect_fail('NO-11 anonymous sender refused', $$SELECT public.create_app_notification('00000000-0000-4000-8000-000000000002', NULL, 'SYSTEM', 't', 'b')$$,
  'NOTIFICATION_SENDER_REQUIRED');
SELECT pg_temp.ctx(pg_temp.u(30), NULL);
SELECT pg_temp.check('NO-12 applicant notifies platform admins (new application)',
  public.create_app_notification(pg_temp.u(2)::uuid, NULL, 'ACADEMY_APPLICATION', 'New', 'Application', '/platform?tab=applications') IS NOT NULL);
SELECT pg_temp.expect_fail('NO-13 user-to-user platform notification refused',
  $$SELECT public.create_app_notification('00000000-0000-4000-8000-000000000060', NULL, 'SYSTEM', 't', 'b')$$, 'NOTIFICATION_NOT_PERMITTED');
SELECT pg_temp.ctx(pg_temp.u(2), NULL);
SELECT pg_temp.check('NO-14 platform admin notifies any user (application decision)',
  public.create_app_notification(pg_temp.u(31)::uuid, NULL, 'ACADEMY_APPLICATION', 'Decision', 'Rejected', '/') IS NOT NULL);
SELECT pg_temp.ctx(pg_temp.u(10), :A);
SELECT pg_temp.check('NO-15 recipient reads own notifications only',
  pg_temp.n($$SELECT 1 FROM public.app_notifications WHERE user_id <> current_app_user_id()$$) = 0
  AND pg_temp.n('SELECT 1 FROM public.app_notifications') > 0);
UPDATE public.app_notifications SET read_at = now() WHERE type = 'EXPENSE_APPROVAL';
SELECT pg_temp.check('NO-16 recipient marks own notification as read',
  pg_temp.n($$SELECT 1 FROM public.app_notifications WHERE type = 'EXPENSE_APPROVAL' AND read_at IS NOT NULL$$) = 1);
SELECT pg_temp.expect_fail('NO-17 notification text cannot be rewritten', $$UPDATE public.app_notifications SET title = 'x'$$,
  'permission denied');
SELECT pg_temp.ctx(pg_temp.u(11), :A);
UPDATE public.app_notifications SET read_at = now();
SELECT pg_temp.ctx(pg_temp.u(10), :A);
SELECT pg_temp.check('NO-18 another user cannot mark my notifications (0 rows)',
  pg_temp.n($$SELECT 1 FROM public.app_notifications WHERE read_at IS NULL$$) >= 1);

-- =====================================================================================================================
-- M2.6 public directory, M2.7 claim redemption
-- =====================================================================================================================
SELECT pg_temp.ctx(NULL, NULL);
SELECT pg_temp.check('PD-01 public directory lists ACTIVE academies only',
  (SELECT count(*) = 3 AND bool_and(slug <> 'tenant-s') FROM public.list_public_academies()));
SELECT pg_temp.check('PD-02 anonymous context reads no tenant rows directly', pg_temp.n('SELECT 1 FROM public.tenants') = 0);

SELECT pg_temp.expect_fail('CL-01 claim requires a signed-in account',
  $$SELECT * FROM public.redeem_portal_claim(encode(sha256(convert_to('ACAD-11AA22BB', 'UTF8')), 'hex'))$$,
  'CLAIM_REQUIRES_ACTIVE_ACCOUNT');
SELECT pg_temp.ctx(pg_temp.u(60), NULL);
SELECT pg_temp.expect_fail('CL-02 the plaintext code no longer matches (stored hashed)',
  $$SELECT * FROM public.redeem_portal_claim('ACAD-11AA22BB')$$, 'CLAIM_INVALID');
SELECT pg_temp.check('CL-03 a code issued before M2 still redeems (converted in place), linking the caller',
  (SELECT entity_type = 'PLAYER' AND first_name = 'Claimable'
   FROM public.redeem_portal_claim(encode(sha256(convert_to('ACAD-11AA22BB', 'UTF8')), 'hex'))));
SELECT pg_temp.expect_fail('CL-04 single use',
  $$SELECT * FROM public.redeem_portal_claim(encode(sha256(convert_to('ACAD-11AA22BB', 'UTF8')), 'hex'))$$, 'CLAIM_INVALID');
SELECT pg_temp.expect_fail('CL-05 expired code refused with the same error',
  $$SELECT * FROM public.redeem_portal_claim(encode(sha256(convert_to('ACAD-99AA00BB', 'UTF8')), 'hex'))$$, 'CLAIM_INVALID');
SELECT pg_temp.expect_fail('CL-06 code of a suspended academy refused with the same error',
  $$SELECT * FROM public.redeem_portal_claim(encode(sha256(convert_to('ACAD-77AA88BB', 'UTF8')), 'hex'))$$, 'CLAIM_INVALID');
SELECT pg_temp.expect_fail('CL-07 guardian linked to another account cannot be taken over (new protection)',
  $$SELECT * FROM public.redeem_portal_claim(encode(sha256(convert_to('ACAD-33CC44DD', 'UTF8')), 'hex'))$$, 'CLAIM_ALREADY_LINKED');
SELECT pg_temp.check('CL-08 free guardian code redeems',
  (SELECT entity_type = 'GUARDIAN' FROM public.redeem_portal_claim(encode(sha256(convert_to('ACAD-55EE66FF', 'UTF8')), 'hex'))));
SELECT pg_temp.ctx(pg_temp.u(61), NULL);
SELECT pg_temp.expect_fail('CL-09 suspended account cannot claim',
  $$SELECT * FROM public.redeem_portal_claim(encode(sha256(convert_to('ACAD-11AA22BB', 'UTF8')), 'hex'))$$, 'CLAIM_REQUIRES_ACTIVE_ACCOUNT');
SELECT pg_temp.ctx(pg_temp.u(10), :A);
SELECT pg_temp.check('CL-10 claims were audited in the tenant',
  pg_temp.n($$SELECT 1 FROM public.audit_logs WHERE action IN ('PORTAL_PLAYER_ACCOUNT_CLAIMED', 'PORTAL_GUARDIAN_ACCOUNT_CLAIMED')$$) = 2);

-- =====================================================================================================================
-- M3.5a users (S6): privileged columns and deletes are closed to the runtime role
-- =====================================================================================================================
SELECT pg_temp.ctx(pg_temp.u(60), NULL);
SELECT pg_temp.expect_fail('S6-01 self-promotion to platform super admin denied',
  $$UPDATE public.users SET is_platform_super_admin = true WHERE id = current_app_user_id()$$, 'permission denied');
SELECT pg_temp.expect_fail('S6-02 platform owner flag denied',
  $$UPDATE public.users SET is_platform_owner = true WHERE id = current_app_user_id()$$, 'permission denied');
SELECT pg_temp.expect_fail('S6-03 direct password_hash update (account takeover) denied',
  $$UPDATE public.users SET password_hash = 'x' WHERE id = '00000000-0000-4000-8000-000000000002'$$, 'permission denied');
SELECT pg_temp.expect_fail('S6-04 un-suspending through SQL denied',
  $$UPDATE public.users SET is_suspended = false WHERE id = '00000000-0000-4000-8000-000000000061'$$, 'permission denied');
SELECT pg_temp.expect_fail('S6-05 session_version cannot be reset directly',
  $$UPDATE public.users SET session_version = 0$$, 'permission denied');
SELECT pg_temp.expect_fail('S6-06 deleting accounts denied', $$DELETE FROM public.users WHERE id = '00000000-0000-4000-8000-000000000031'$$,
  'permission denied');
SELECT pg_temp.expect_fail('S6-07 insert with a privileged flag denied',
  $$INSERT INTO public.users (id, email, password_hash, name, is_platform_owner, updated_at) VALUES (gen_random_uuid(), 'f@example.test', 'x', 'F', true, now())$$,
  'permission denied');
UPDATE public.users SET name = 'Plain renamed', updated_at = now() WHERE id = current_app_user_id();
SELECT pg_temp.check('S6-08 profile update (name) still allowed',
  (SELECT name FROM public.users WHERE id = current_app_user_id()) = 'Plain renamed');
SELECT pg_temp.expect_fail('S3-01 runtime role cannot create tenants directly',
  $$INSERT INTO public.tenants (id, slug, name, updated_at) VALUES (gen_random_uuid(), 'forged', 'Forged', now())$$, 'permission denied');
SELECT pg_temp.expect_fail('S3-02 runtime role cannot delete tenants directly',
  $$DELETE FROM public.tenants WHERE id = '00000000-0000-4000-8000-0000000000e1'$$, 'permission denied');

-- =====================================================================================================================
-- M3.1 change_own_password
-- =====================================================================================================================
SELECT pg_temp.ctx(NULL, NULL);
SELECT pg_temp.expect_fail('PW-01 requires a signed-in actor', $$SELECT public.change_own_password('$argon2id$v=19$new')$$,
  'AUTHENTICATION_REQUIRED');
SELECT pg_temp.ctx(pg_temp.u(60), NULL);
SELECT pg_temp.expect_fail('PW-02 placeholder or non-Argon2 value refused',
  $$SELECT public.change_own_password('INVITED_PENDING_ACTIVATION')$$, 'PASSWORD_HASH_INVALID');
SELECT set_config('test.id', public.change_own_password('$argon2id$v=19$new')::text, false);
SELECT pg_temp.check('PW-03 own password changed: version + 1, every refresh token revoked',
  current_setting('test.id') = '1'
  AND (SELECT count(*) FROM public.refresh_tokens WHERE user_id = current_app_user_id() AND NOT is_revoked) = 0);
SELECT pg_temp.ctx(pg_temp.u(61), NULL);
SELECT pg_temp.expect_fail('PW-04 suspended account refused', $$SELECT public.change_own_password('$argon2id$v=19$new')$$,
  'ACCOUNT_NOT_ACTIVE');

-- =====================================================================================================================
-- M3.2 platform user administration
-- =====================================================================================================================
SELECT pg_temp.ctx(pg_temp.u(60), NULL);
SELECT pg_temp.expect_fail('PU-01 non-admin cannot create users', $$SELECT public.platform_create_user('n1@example.test', 'N1')$$,
  'PLATFORM_ADMIN_REQUIRED');
SELECT pg_temp.ctx(pg_temp.u(3), NULL);
SELECT pg_temp.expect_fail('PU-02 suspended admin cannot create users', $$SELECT public.platform_create_user('n1@example.test', 'N1')$$,
  'PLATFORM_ADMIN_REQUIRED');
SELECT pg_temp.ctx(pg_temp.u(2), NULL);
SELECT set_config('test.id', public.platform_create_user(' N1@Example.test ', 'N1')::text, false);
SELECT pg_temp.check('PU-03 admin invites a plain user (must reset password, no flags)',
  (SELECT must_reset_password AND NOT is_platform_super_admin AND NOT is_platform_owner AND email = 'n1@example.test'
   FROM public.users WHERE id = current_setting('test.id')::uuid));
SELECT pg_temp.expect_fail('PU-04 a non-owner admin cannot create a super admin',
  $$SELECT public.platform_create_user('n2@example.test', 'N2', NULL, true, false)$$, 'PLATFORM_OWNER_REQUIRED');
SELECT pg_temp.expect_fail('PU-05 duplicate e-mail refused', $$SELECT public.platform_create_user('n1@example.test', 'Dup')$$,
  'duplicate key');
SELECT pg_temp.ctx(pg_temp.u(1), NULL);
SELECT set_config('test.id', public.platform_create_user('co-owner@example.test', 'Co', NULL, false, true)::text, false);
SELECT pg_temp.check('PU-06 owner creates a co-owner (owner implies super admin)',
  (SELECT is_platform_owner AND is_platform_super_admin FROM public.users WHERE id = current_setting('test.id')::uuid));

SELECT pg_temp.ctx(pg_temp.u(2), NULL);
SELECT pg_temp.expect_fail('PR-01 only a platform owner changes platform roles',
  $$SELECT * FROM public.platform_set_user_platform_role('00000000-0000-4000-8000-000000000060', 'SUPER_ADMIN')$$,
  'PLATFORM_OWNER_REQUIRED');
SELECT pg_temp.ctx(pg_temp.u(1), NULL);
SELECT pg_temp.check('PR-02a owner demotes an admin: flags cleared, version + 1',
  (SELECT NOT is_platform_super_admin AND session_version = 1
   FROM public.platform_set_user_platform_role(pg_temp.u(2)::uuid, 'REVOKE')));
SELECT pg_temp.check('PR-02b the demoted admin''s refresh tokens are revoked',
  (SELECT count(*) FROM public.refresh_tokens WHERE user_id = pg_temp.u(2)::uuid AND NOT is_revoked) = 0);
SELECT pg_temp.check('PR-03 promotion does not end sessions',
  (SELECT is_platform_super_admin AND session_version = 1
   FROM public.platform_set_user_platform_role(pg_temp.u(2)::uuid, 'SUPER_ADMIN')));
SELECT pg_temp.expect_fail('PR-04 unknown role refused',
  $$SELECT * FROM public.platform_set_user_platform_role('00000000-0000-4000-8000-000000000002', 'GOD')$$, 'PLATFORM_ROLE_INVALID');

SELECT pg_temp.ctx(pg_temp.u(2), NULL);
SELECT pg_temp.expect_fail('PS-01 admin cannot change a platform owner''s security policy',
  $$SELECT * FROM public.platform_update_user_security('00000000-0000-4000-8000-000000000001', NULL, true, 'x')$$,
  'PLATFORM_OWNER_REQUIRED');
SELECT pg_temp.check('PS-02 admin suspends a user: reason stored, version + 1',
  (SELECT is_suspended AND session_version = 2
   FROM public.platform_update_user_security(pg_temp.u(60)::uuid, NULL, true, 'abuse')));
SELECT pg_temp.check('PS-03a lifting the suspension keeps the version and sets must-reset',
  (SELECT NOT is_suspended AND must_reset_password AND session_version = 2
   FROM public.platform_update_user_security(pg_temp.u(60)::uuid, true, false, NULL)));
SELECT pg_temp.check('PS-03b the suspension reason is cleared',
  (SELECT suspended_reason IS NULL FROM public.users WHERE id = pg_temp.u(60)::uuid));
SELECT pg_temp.expect_fail('PS-04 admin cannot end a platform owner''s sessions',
  $$SELECT public.platform_revoke_user_sessions('00000000-0000-4000-8000-000000000001')$$, 'PLATFORM_OWNER_REQUIRED');
SELECT pg_temp.ctx(pg_temp.u(1), NULL);
SELECT pg_temp.check('PS-setup co-owner demoted, leaving one active owner',
  (SELECT NOT is_platform_owner FROM public.platform_set_user_platform_role(
    (SELECT id FROM public.users WHERE email = 'co-owner@example.test'), 'REVOKE')));
SELECT pg_temp.expect_fail('PS-05 the last active platform owner cannot be suspended',
  $$SELECT * FROM public.platform_update_user_security('00000000-0000-4000-8000-000000000001', NULL, true, 'x')$$,
  'LAST_PLATFORM_OWNER');
SELECT pg_temp.expect_fail('PS-06 the last active platform owner cannot be demoted',
  $$SELECT * FROM public.platform_set_user_platform_role('00000000-0000-4000-8000-000000000001', 'SUPER_ADMIN')$$,
  'LAST_PLATFORM_OWNER');
SELECT pg_temp.check('PS-07 an owner may end their own sessions',
  public.platform_revoke_user_sessions(pg_temp.u(1)::uuid) >= 0);

-- =====================================================================================================================
-- M3.3 academy provisioning and deletion
-- =====================================================================================================================
SELECT pg_temp.ctx(pg_temp.u(30), NULL);
SELECT pg_temp.expect_fail('AP-01 applicant cannot approve their own application',
  $$SELECT public.platform_approve_academy_application('00000000-0000-4000-8000-00000000aa01', 'PRO')$$, 'PLATFORM_ADMIN_REQUIRED');
SELECT pg_temp.ctx(pg_temp.u(2), NULL);
SELECT set_config('test.new_tenant', public.platform_approve_academy_application('00000000-0000-4000-8000-00000000aa01', 'PRO', ' ok ')::text, false);
SELECT pg_temp.check('AP-02 approval provisions tenant, branch, OWNER membership, PRO subscription; application APPROVED',
  (SELECT status = 'ACTIVE' AND slug = 'alpha-academy' FROM public.tenants WHERE id = current_setting('test.new_tenant')::uuid)
  AND (SELECT count(*) FROM public.branches WHERE tenant_id = current_setting('test.new_tenant')::uuid AND code = 'MAIN') = 1
  AND (SELECT count(*) FROM public.tenant_memberships WHERE tenant_id = current_setting('test.new_tenant')::uuid
         AND user_id = pg_temp.u(30)::uuid AND role = 'OWNER' AND status = 'ACTIVE') = 1
  AND (SELECT plan_code::text FROM public.tenant_subscriptions WHERE tenant_id = current_setting('test.new_tenant')::uuid) = 'PRO'
  AND (SELECT status::text = 'APPROVED' AND review_notes = 'ok' AND reviewed_by_user_id = pg_temp.u(2)::uuid
         AND provisioned_tenant_id = current_setting('test.new_tenant')::uuid
       FROM public.academy_applications WHERE id = '00000000-0000-4000-8000-00000000aa01'));
SELECT pg_temp.expect_fail('AP-03 an approved application cannot be approved again',
  $$SELECT public.platform_approve_academy_application('00000000-0000-4000-8000-00000000aa01')$$, 'APPLICATION_ALREADY_APPROVED');
SELECT pg_temp.expect_fail('AP-04 slug collision with an existing academy is refused (unique index), nothing provisioned',
  $$SELECT public.platform_approve_academy_application('00000000-0000-4000-8000-00000000aa04')$$, 'duplicate key');
SELECT set_config('test.id', public.platform_approve_academy_application('00000000-0000-4000-8000-00000000aa03', 'NOPE')::text, false);
SELECT pg_temp.check('AP-05 unknown plan falls back to STARTER',
  (SELECT plan_code::text FROM public.tenant_subscriptions WHERE tenant_id = current_setting('test.id')::uuid) = 'STARTER');

SELECT pg_temp.expect_fail('DA-01 a non-owner admin cannot delete academies',
  $$SELECT public.platform_delete_academy('00000000-0000-4000-8000-0000000000e1', 'tenant-e')$$, 'PLATFORM_OWNER_REQUIRED');
SELECT pg_temp.ctx(pg_temp.u(1), NULL);
SELECT pg_temp.expect_fail('DA-02 confirmation slug must match',
  $$SELECT public.platform_delete_academy('00000000-0000-4000-8000-0000000000e1', 'tenant-x')$$, 'CONFIRMATION_SLUG_MISMATCH');
SELECT pg_temp.expect_fail('DA-03 academy with players cannot be deleted',
  $$SELECT public.platform_delete_academy('00000000-0000-4000-8000-0000000000a1', 'tenant-a')$$, 'ACADEMY_HAS_HISTORY');
SELECT public.platform_delete_academy(:E, 'tenant-e');
SELECT pg_temp.check('DA-04 empty academy deleted', NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = :E));

RESET ROLE;
SELECT pg_temp.ctx(NULL, NULL);
\echo 'm2-m3-boundaries: all checks passed'
