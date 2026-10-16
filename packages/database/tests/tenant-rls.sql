-- Real PostgreSQL integration test under restricted runtime identity.
BEGIN;

INSERT INTO public.tenants (id, slug, name, updated_at)
VALUES
 ('00000000-0000-4000-8000-000000000201','ci-tenant-a','CI Tenant A',now()),
 ('00000000-0000-4000-8000-000000000202','ci-tenant-b','CI Tenant B',now());

INSERT INTO public.branches (id, tenant_id, code, name, updated_at)
VALUES
 ('00000000-0000-4000-8000-000000000211','00000000-0000-4000-8000-000000000201','A','Branch A',now()),
 ('00000000-0000-4000-8000-000000000212','00000000-0000-4000-8000-000000000202','B','Branch B',now());

INSERT INTO public.tenant_sports (id, tenant_id, sport, is_primary)
VALUES
 ('00000000-0000-4000-8000-000000000221','00000000-0000-4000-8000-000000000201','FOOTBALL',true),
 ('00000000-0000-4000-8000-000000000222','00000000-0000-4000-8000-000000000202','FOOTBALL',true);

INSERT INTO public.audit_logs (id, tenant_id, action, resource_type)
VALUES
 ('00000000-0000-4000-8000-000000000231','00000000-0000-4000-8000-000000000201','CREATE','rls_test'),
 ('00000000-0000-4000-8000-000000000232','00000000-0000-4000-8000-000000000202','CREATE','rls_test');

-- Users and memberships fixtures
INSERT INTO public.users (id, email, password_hash, name, updated_at)
VALUES
 ('00000000-0000-4000-8000-000000000241','user-a@ci.local','hash-a','User A',now()),
 ('00000000-0000-4000-8000-000000000242','user-b@ci.local','hash-b','User B',now());

INSERT INTO public.tenant_memberships (id, tenant_id, user_id, role, status, branch_id, updated_at)
VALUES
 ('00000000-0000-4000-8000-000000000251','00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000241','OWNER','ACTIVE','00000000-0000-4000-8000-000000000211',now()),
 ('00000000-0000-4000-8000-000000000252','00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000242','OWNER','ACTIVE','00000000-0000-4000-8000-000000000212',now());

-- Attendance sessions, records, corrections fixtures
INSERT INTO public.attendance_sessions (id, tenant_id, branch_id, group_name, session_date, start_time, end_time, status, updated_at)
VALUES
 ('00000000-0000-4000-8000-000000000261','00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000211','U12 Team A','2026-10-16','16:00','17:30','SCHEDULED',now()),
 ('00000000-0000-4000-8000-000000000262','00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000212','U12 Team B','2026-10-16','16:00','17:30','SCHEDULED',now());

INSERT INTO public.attendance_records (id, tenant_id, session_id, player_id, status, version, updated_at)
VALUES
 ('00000000-0000-4000-8000-000000000271','00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000261','00000000-0000-4000-8000-000000000281','PRESENT',1,now()),
 ('00000000-0000-4000-8000-000000000272','00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000262','00000000-0000-4000-8000-000000000282','PRESENT',1,now());

INSERT INTO public.attendance_corrections (id, tenant_id, record_id, previous_status, new_status, reason, corrected_by_user_id)
VALUES
 ('00000000-0000-4000-8000-000000000291','00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000271','UNMARKED','PRESENT','Correction valid','00000000-0000-4000-8000-000000000241'),
 ('00000000-0000-4000-8000-000000000292','00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000272','UNMARKED','PRESENT','Correction valid','00000000-0000-4000-8000-000000000242');

INSERT INTO public.attendance_idempotency (id, tenant_id, key, session_id)
VALUES
 ('00000000-0000-4000-8000-000000000295','00000000-0000-4000-8000-000000000201','idem-key-a','00000000-0000-4000-8000-000000000261'),
 ('00000000-0000-4000-8000-000000000296','00000000-0000-4000-8000-000000000202','idem-key-b','00000000-0000-4000-8000-000000000262');

SET LOCAL ROLE academy_runtime_ci;

-- 1. Missing context: must fail closed for all tenant-scoped tables
DO $$
BEGIN
 IF (SELECT count(*) FROM public.tenants) <> 0 OR
    (SELECT count(*) FROM public.branches) <> 0 OR
    (SELECT count(*) FROM public.tenant_sports) <> 0 OR
    (SELECT count(*) FROM public.audit_logs) <> 0 OR
    (SELECT count(*) FROM public.tenant_memberships) <> 0 OR
    (SELECT count(*) FROM public.attendance_sessions) <> 0 OR
    (SELECT count(*) FROM public.attendance_records) <> 0 OR
    (SELECT count(*) FROM public.attendance_corrections) <> 0 OR
    (SELECT count(*) FROM public.attendance_idempotency) <> 0 THEN
   RAISE EXCEPTION 'SECURITY FAILURE: missing context exposes tenant records';
 END IF;
END $$;

-- 2. Set tenant context to Tenant A
SELECT set_config('app.tenant_id','00000000-0000-4000-8000-000000000201',true);

DO $$
BEGIN
 IF (SELECT count(*) FROM public.branches) <> 1 THEN
   RAISE EXCEPTION 'SECURITY FAILURE: tenant A can see wrong branches';
 END IF;
 IF (SELECT count(*) FROM public.tenants) <> 1 OR
    (SELECT count(*) FROM public.tenant_sports) <> 1 OR
    (SELECT count(*) FROM public.audit_logs) <> 1 OR
    (SELECT count(*) FROM public.tenant_memberships) <> 1 OR
    (SELECT count(*) FROM public.attendance_sessions) <> 1 OR
    (SELECT count(*) FROM public.attendance_records) <> 1 OR
    (SELECT count(*) FROM public.attendance_corrections) <> 1 OR
    (SELECT count(*) FROM public.attendance_idempotency) <> 1 THEN
   RAISE EXCEPTION 'SECURITY FAILURE: tenant A can see cross-tenant rows or count mismatch';
 END IF;
 IF (SELECT count(*) FROM public.branches WHERE code = 'B') <> 0 THEN
   RAISE EXCEPTION 'SECURITY FAILURE: tenant B branch visible to tenant A';
 END IF;
 IF (SELECT count(*) FROM public.attendance_sessions WHERE tenant_id =
   '00000000-0000-4000-8000-000000000202') <> 0 THEN
   RAISE EXCEPTION 'SECURITY FAILURE: tenant B sessions visible to tenant A';
 END IF;
END $$;

-- Cross-tenant branch insert rejection
DO $$
DECLARE rejected boolean := false;
BEGIN
 BEGIN
  INSERT INTO public.branches (id,tenant_id,code,name,updated_at)
  VALUES ('00000000-0000-4000-8000-000000000213',
    '00000000-0000-4000-8000-000000000202','X','Cross-tenant',now());
 EXCEPTION WHEN insufficient_privilege THEN
  rejected := true;
 END;
 IF NOT rejected THEN
  RAISE EXCEPTION 'SECURITY FAILURE: cross-tenant branch insert permitted';
 END IF;
END $$;

-- Cross-tenant session insert rejection
DO $$
DECLARE rejected boolean := false;
BEGIN
 BEGIN
  INSERT INTO public.attendance_sessions (id, tenant_id, branch_id, group_name, session_date, start_time, end_time, status, updated_at)
  VALUES ('00000000-0000-4000-8000-000000000263',
    '00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000212','X','2026-10-16','10:00','11:00','SCHEDULED',now());
 EXCEPTION WHEN insufficient_privilege THEN
  rejected := true;
 END;
 IF NOT rejected THEN
  RAISE EXCEPTION 'SECURITY FAILURE: cross-tenant session insert permitted';
 END IF;
END $$;

-- Cross-branch composite foreign key protection:
-- Attempting to create a session in Tenant A referencing Branch B (belonging to Tenant B) must fail!
DO $$
DECLARE rejected boolean := false;
BEGIN
 BEGIN
  INSERT INTO public.attendance_sessions (id, tenant_id, branch_id, group_name, session_date, start_time, end_time, status, updated_at)
  VALUES ('00000000-0000-4000-8000-000000000264',
    '00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000212','X','2026-10-16','10:00','11:00','SCHEDULED',now());
 EXCEPTION WHEN foreign_key_violation THEN
  rejected := true;
 END;
 IF NOT rejected THEN
  RAISE EXCEPTION 'SECURITY FAILURE: cross-branch session referencing other tenant branch was permitted';
 END IF;
END $$;

-- Cross-tenant record insert rejection
DO $$
DECLARE rejected boolean := false;
BEGIN
 BEGIN
  INSERT INTO public.attendance_records (id, tenant_id, session_id, player_id, status, version, updated_at)
  VALUES ('00000000-0000-4000-8000-000000000273',
    '00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000262','00000000-0000-4000-8000-000000000283','PRESENT',1,now());
 EXCEPTION WHEN insufficient_privilege THEN
  rejected := true;
 END;
 IF NOT rejected THEN
  RAISE EXCEPTION 'SECURITY FAILURE: cross-tenant record insert permitted';
 END IF;
END $$;

-- Cross-tenant correction insert rejection
DO $$
DECLARE rejected boolean := false;
BEGIN
 BEGIN
  INSERT INTO public.attendance_corrections (id, tenant_id, record_id, previous_status, new_status, reason, corrected_by_user_id)
  VALUES ('00000000-0000-4000-8000-000000000293',
    '00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000272','UNMARKED','PRESENT','Tamper','00000000-0000-4000-8000-000000000241');
 EXCEPTION WHEN insufficient_privilege THEN
  rejected := true;
 END;
 IF NOT rejected THEN
  RAISE EXCEPTION 'SECURITY FAILURE: cross-tenant correction insert permitted';
 END IF;
END $$;

-- 3. Switch context to Tenant B
SELECT set_config('app.tenant_id','00000000-0000-4000-8000-000000000202',true);
DO $$
BEGIN
 IF (SELECT count(*) FROM public.branches) <> 1
    OR (SELECT count(*) FROM public.branches WHERE code='A') <> 0
    OR (SELECT count(*) FROM public.tenants) <> 1
    OR (SELECT count(*) FROM public.tenant_sports) <> 1
    OR (SELECT count(*) FROM public.audit_logs) <> 1
    OR (SELECT count(*) FROM public.tenant_memberships) <> 1
    OR (SELECT count(*) FROM public.attendance_sessions) <> 1
    OR (SELECT count(*) FROM public.attendance_records) <> 1
    OR (SELECT count(*) FROM public.attendance_corrections) <> 1
    OR (SELECT count(*) FROM public.attendance_idempotency) <> 1 THEN
   RAISE EXCEPTION 'SECURITY FAILURE: tenant context switch leaks prior tenant rows';
 END IF;
END $$;

-- 4. Clear context: fails closed
SELECT set_config('app.tenant_id','',true);
DO $$
BEGIN
 IF (SELECT count(*) FROM public.tenants) <> 0 OR
    (SELECT count(*) FROM public.branches) <> 0 OR
    (SELECT count(*) FROM public.tenant_sports) <> 0 OR
    (SELECT count(*) FROM public.audit_logs) <> 0 OR
    (SELECT count(*) FROM public.tenant_memberships) <> 0 OR
    (SELECT count(*) FROM public.attendance_sessions) <> 0 OR
    (SELECT count(*) FROM public.attendance_records) <> 0 OR
    (SELECT count(*) FROM public.attendance_corrections) <> 0 OR
    (SELECT count(*) FROM public.attendance_idempotency) <> 0 THEN
   RAISE EXCEPTION 'SECURITY FAILURE: cleared tenant context exposes rows';
 END IF;
END $$;

-- 5. Discovery path verification:
-- When tenant_id is unset, but actor_user_id is set to User A, User A can discover their own membership
SELECT set_config('app.actor_user_id','00000000-0000-4000-8000-000000000241',true);
DO $$
BEGIN
 IF (SELECT count(*) FROM public.tenant_memberships) <> 1 THEN
   RAISE EXCEPTION 'SECURITY FAILURE: authenticated user cannot discover their own memberships';
 END IF;
 IF (SELECT count(*) FROM public.tenant_memberships WHERE user_id = '00000000-0000-4000-8000-000000000242') <> 0 THEN
   RAISE EXCEPTION 'SECURITY FAILURE: user A discovered user B membership';
 END IF;
END $$;

RESET ROLE;

ROLLBACK;
