-- Phase 3A.2 catalog verification (READ-ONLY: queries pg_catalog / information_schema only, never table data).
-- Asserts the security end state after M2 + M3 directly in the catalog; a Prisma schema diff cannot see any of this.
-- Run as the migration (owner) role:  psql -v ON_ERROR_STOP=1 -f security-catalog.sql
-- Every check raises on failure; success prints PASS lines.
\set QUIET on
SET client_min_messages = notice;

DO $$
DECLARE
  roles text[] := ARRAY(SELECT rolname::text FROM pg_roles
                        WHERE rolname IN ('academy_runtime', 'academy_runtime_ci', 'sportexus_app') ORDER BY 1);
  r text;
  v text;
  n int;
  owner_role text;
  new_definers text[] := ARRAY[
    -- M1
    'request_password_reset_with_link(text,text,text,timestamp with time zone)',
    'complete_password_reset_for_email(text,text,text)', 'complete_password_reset_by_link(text,text)',
    'invalidate_password_reset_code_for_email(text)', 'complete_password_reset(text,text)',
    -- M2
    'academy_slug_in_use(text)', 'append_audit_log(text,text,text,jsonb,text,text,uuid,uuid)',
    'create_app_notification(uuid,uuid,text,text,text,text)', 'list_public_academies()',
    'redeem_portal_claim(text)',
    -- M3
    'change_own_password(text)', 'platform_create_user(text,text,text,boolean,boolean)',
    'platform_set_user_platform_role(uuid,text)', 'platform_update_user_security(uuid,boolean,boolean,text)',
    'platform_revoke_user_sessions(uuid)', 'platform_approve_academy_application(uuid,text,text)',
    'platform_delete_academy(uuid,text)',
    -- Join request: K6 replaced the M2 six-argument version; the current one also carries the guardian e-mail
    -- (20261122150000) and the profile fields (20261125090000)
    'submit_player_join_request(uuid,text,text,text,date,text,text,text,text,integer,text,text)',
    -- account links (item 5)
    'link_join_request_account(uuid,uuid)',
    -- platform subscription paid online (20261122130000)
    'fulfil_platform_subscription_payment(uuid)',
    -- academy applicant answers a "more details" request (20261124090000)
    'academy_application_for_reply(uuid,timestamp with time zone)',
    'submit_academy_application_reply(uuid,timestamp with time zone,text,text,text)',
    -- guardian links to a child who has an account (20261124100000)
    'find_guardian_link_candidates(text,text)', 'guardian_link_request_view(uuid,uuid)',
    'approve_guardian_link(uuid,uuid)'
  ];
  f text;
BEGIN
  IF array_length(roles, 1) IS NULL THEN
    RAISE EXCEPTION 'FAIL no runtime role exists';
  END IF;
  RAISE NOTICE 'runtime roles checked: %', roles;

  -- 1. Migration history: M2, M3, K6 and the portal read policies finished; 104105500 recorded (baseline exception on Neon).
  SELECT count(*) INTO n FROM public._prisma_migrations
  WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    AND migration_name IN ('20261104105500_academy_applications_insert_rls',
                           '20261117090000_s4_rls_context_functions', '20261117100000_s3_runtime_privileges',
                           '20261118090000_k6_join_request_accounts', '20261118100000_portal_user_read_policies',
                           '20261118110000_account_links_definer_only', '20261118120000_must_reset_password_cleared');
  IF n <> 7 THEN RAISE EXCEPTION 'FAIL 01 migration history: % of 7 expected rows', n; END IF;
  RAISE NOTICE 'PASS 01 migration history';

  -- 2. Ownership: one owner for every public table; it must bypass RLS (definer functions write FORCE-RLS tables).
  SELECT string_agg(DISTINCT pg_get_userbyid(c.relowner), ',') INTO owner_role
  FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace WHERE ns.nspname = 'public' AND c.relkind = 'r';
  IF owner_role LIKE '%,%' THEN RAISE EXCEPTION 'FAIL 02 several table owners: %', owner_role; END IF;
  IF NOT (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = owner_role) THEN
    RAISE EXCEPTION 'FAIL 02 owner % neither superuser nor BYPASSRLS: definer functions would be filtered by RLS', owner_role;
  END IF;
  RAISE NOTICE 'PASS 02 single table owner % with RLS bypass', owner_role;

  -- 3. Runtime roles: no elevated flags, own nothing, cannot CREATE in public, not members of the owner role.
  FOREACH r IN ARRAY roles LOOP
    IF (SELECT rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb FROM pg_roles WHERE rolname = r) THEN
      RAISE EXCEPTION 'FAIL 03 % has elevated role flags', r;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
               WHERE ns.nspname = 'public' AND pg_get_userbyid(c.relowner) = r) THEN
      RAISE EXCEPTION 'FAIL 03 % owns objects in public', r;
    END IF;
    IF has_schema_privilege(r, 'public', 'CREATE') THEN RAISE EXCEPTION 'FAIL 03 % can CREATE in public', r; END IF;
    IF pg_has_role(r, owner_role, 'MEMBER') THEN RAISE EXCEPTION 'FAIL 03 % is a member of %', r, owner_role; END IF;
  END LOOP;
  RAISE NOTICE 'PASS 03 runtime role attributes';

  -- 4. RLS flags: exactly the three identity/bookkeeping tables are without RLS; the M2 tables keep FORCE.
  SELECT string_agg(c.relname, ',' ORDER BY c.relname) INTO v
  FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;
  IF v IS DISTINCT FROM '_prisma_migrations,refresh_tokens,users' THEN
    RAISE EXCEPTION 'FAIL 04 tables without RLS: %', v;
  END IF;
  SELECT count(*) INTO n FROM pg_class
  WHERE oid IN ('public.academy_applications'::regclass, 'public.app_notifications'::regclass,
                'public.audit_logs'::regclass, 'public.player_registration_requests'::regclass,
                'public.players'::regclass, 'public.guardians'::regclass, 'public.tenants'::regclass)
    AND relrowsecurity AND relforcerowsecurity;
  IF n <> 7 THEN RAISE EXCEPTION 'FAIL 04 FORCE RLS missing on an M2/M3 table (% of 7)', n; END IF;
  RAISE NOTICE 'PASS 04 RLS enabled/forced as expected';

  -- 5. Policies on the changed tables: exact names, commands and expressions.
  SELECT string_agg(policyname || ':' || cmd, ',' ORDER BY policyname) INTO v
  FROM pg_policies WHERE schemaname = 'public' AND tablename = 'academy_applications';
  IF v IS DISTINCT FROM 'academy_applications_applicant:SELECT,academy_applications_insert:INSERT,academy_applications_platform_admin:ALL' THEN
    RAISE EXCEPTION 'FAIL 05 academy_applications policies: %', v;
  END IF;
  IF (SELECT qual FROM pg_policies WHERE tablename = 'academy_applications' AND policyname = 'academy_applications_applicant')
     <> '(applicant_user_id = current_app_user_id())' THEN
    RAISE EXCEPTION 'FAIL 05 applicant SELECT policy is not own-rows-only (anonymous clause present?)';
  END IF;
  IF (SELECT with_check FROM pg_policies WHERE tablename = 'academy_applications' AND policyname = 'academy_applications_insert')
     !~ 'applicant_user_id = current_app_user_id\(\).*PENDING_REVIEW.*review_notes IS NULL.*reviewed_by_user_id IS NULL.*reviewed_at IS NULL.*provisioned_tenant_id IS NULL' THEN
    RAISE EXCEPTION 'FAIL 05 academy_applications_insert WITH CHECK differs';
  END IF;
  SELECT string_agg(policyname || ':' || cmd || ':' || coalesce(qual, ''), ' | ' ORDER BY policyname) INTO v
  FROM pg_policies WHERE schemaname = 'public' AND tablename = 'player_registration_requests';
  IF v IS DISTINCT FROM 'player_registration_requests_applicant:SELECT:(applicant_user_id = current_app_user_id()) | player_registration_requests_tenant:ALL:(tenant_id = current_app_tenant_id())' THEN
    RAISE EXCEPTION 'FAIL 05 player_registration_requests policies: %', v;
  END IF;
  -- No policy anywhere may grant rows to a context WITHOUT an actor (the S4 pattern).
  SELECT string_agg(tablename || '.' || policyname, ',') INTO v FROM pg_policies
  WHERE schemaname = 'public' AND (qual ~ 'current_app_user_id\(\) IS NULL' OR with_check ~ 'current_app_user_id\(\) IS NULL');
  IF v IS NOT NULL THEN RAISE EXCEPTION 'FAIL 05 policies granting access without an actor: %', v; END IF;
  RAISE NOTICE 'PASS 05 policies';

  -- 6. Definer functions: every SECURITY DEFINER function in public pins search_path, is owned by the table owner and
  --    is not executable by PUBLIC; the 18 Phase 3A functions exist and are executable by every runtime role.
  SELECT string_agg(p.oid::regprocedure::text, ',') INTO v
  FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public' AND p.prosecdef
    AND (p.proconfig IS NULL OR NOT ('search_path=public, pg_temp' = ANY (p.proconfig))
         OR pg_get_userbyid(p.proowner) <> owner_role
         OR has_function_privilege('public', p.oid, 'EXECUTE'));
  IF v IS NOT NULL THEN RAISE EXCEPTION 'FAIL 06 unsafe definer functions: %', v; END IF;
  FOREACH f IN ARRAY new_definers LOOP
    IF to_regprocedure('public.' || f) IS NULL THEN RAISE EXCEPTION 'FAIL 06 missing function %', f; END IF;
    IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure('public.' || f)) THEN
      RAISE EXCEPTION 'FAIL 06 % is not SECURITY DEFINER', f;
    END IF;
    FOREACH r IN ARRAY roles LOOP
      IF NOT has_function_privilege(r, to_regprocedure('public.' || f), 'EXECUTE') THEN
        RAISE EXCEPTION 'FAIL 06 % cannot execute %', r, f;
      END IF;
    END LOOP;
  END LOOP;
  -- K6: the M2 six-argument join request function is gone (no stale overload with the old checks).
  IF to_regprocedure('public.submit_player_join_request(uuid,text,text,text,date,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL 06 the old submit_player_join_request(6 arguments) still exists';
  END IF;
  -- ...and so are the 7- and 8-argument versions it was replaced by.
  IF to_regprocedure('public.submit_player_join_request(uuid,text,text,text,date,text,text)') IS NOT NULL
     OR to_regprocedure('public.submit_player_join_request(uuid,text,text,text,date,text,text,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL 06 an older submit_player_join_request overload still exists';
  END IF;
  -- RLS helpers stay invoker (inlinable) and executable; trigger functions pin search_path.
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid IN ('public.current_app_tenant_id()'::regprocedure,
             'public.current_app_user_id()'::regprocedure, 'public.is_current_user_super_admin()'::regprocedure,
             'public.is_current_user_platform_owner()'::regprocedure) AND (prosecdef OR proconfig IS NOT NULL)) THEN
    RAISE EXCEPTION 'FAIL 06 RLS helpers must be invoker functions without SET clauses';
  END IF;
  IF pg_get_functiondef('public.is_current_user_super_admin()'::regprocedure) !~ 'NOT is_suspended' THEN
    RAISE EXCEPTION 'FAIL 06 is_current_user_super_admin ignores suspension';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid IN ('public.prevent_audit_log_mutation()'::regprocedure,
             'public.prevent_attendance_correction_mutation()'::regprocedure,
             'public.prevent_attendance_events_mutation()'::regprocedure)
             AND (proconfig IS NULL OR NOT ('search_path=public, pg_temp' = ANY (proconfig)))) THEN
    RAISE EXCEPTION 'FAIL 06 trigger functions without pinned search_path';
  END IF;
  RAISE NOTICE 'PASS 06 functions (% Phase 3A definer functions)', array_length(new_definers, 1);

  -- 7. Append-only triggers present and enabled.
  SELECT count(*) INTO n FROM pg_trigger t
  WHERE NOT t.tgisinternal AND t.tgenabled = 'O'
    AND t.tgrelid IN ('public.audit_logs'::regclass, 'public.attendance_corrections'::regclass,
                      'public.attendance_events'::regclass);
  IF n < 3 THEN RAISE EXCEPTION 'FAIL 07 append-only triggers: % enabled', n; END IF;
  RAISE NOTICE 'PASS 07 append-only triggers';

  -- 8. Table and column privileges of every runtime role.
  FOREACH r IN ARRAY roles LOOP
    -- No TRUNCATE anywhere; no PUBLIC table privileges.
    SELECT string_agg(c.relname, ',') INTO v FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public' AND c.relkind = 'r' AND has_table_privilege(r, c.oid, 'TRUNCATE');
    IF v IS NOT NULL THEN RAISE EXCEPTION 'FAIL 08 % can TRUNCATE %', r, v; END IF;

    -- users (no RLS): SELECT; INSERT on exactly 7 registration columns; UPDATE on exactly name, phone, updated_at.
    IF has_table_privilege(r, 'public.users', 'DELETE') OR NOT has_table_privilege(r, 'public.users', 'SELECT') THEN
      RAISE EXCEPTION 'FAIL 08 % users table privileges', r;
    END IF;
    SELECT string_agg(attname, ',' ORDER BY attname) INTO v FROM pg_attribute
    WHERE attrelid = 'public.users'::regclass AND attnum > 0 AND NOT attisdropped
      AND has_column_privilege(r, 'public.users', attname, 'UPDATE');
    IF v IS DISTINCT FROM 'name,phone,updated_at' THEN RAISE EXCEPTION 'FAIL 08 % users UPDATE columns: %', r, v; END IF;
    SELECT string_agg(attname, ',' ORDER BY attname) INTO v FROM pg_attribute
    WHERE attrelid = 'public.users'::regclass AND attnum > 0 AND NOT attisdropped
      AND has_column_privilege(r, 'public.users', attname, 'INSERT');
    IF v IS DISTINCT FROM 'created_at,email,id,name,password_hash,phone,updated_at' THEN
      RAISE EXCEPTION 'FAIL 08 % users INSERT columns: %', r, v;
    END IF;

    -- tenants: SELECT, UPDATE only.
    IF has_table_privilege(r, 'public.tenants', 'INSERT') OR has_table_privilege(r, 'public.tenants', 'DELETE')
       OR NOT has_table_privilege(r, 'public.tenants', 'SELECT') OR NOT has_table_privilege(r, 'public.tenants', 'UPDATE') THEN
      RAISE EXCEPTION 'FAIL 08 % tenants privileges', r;
    END IF;

    -- audit_logs: SELECT only.
    IF has_any_column_privilege(r, 'public.audit_logs', 'INSERT') OR has_any_column_privilege(r, 'public.audit_logs', 'UPDATE')
       OR has_table_privilege(r, 'public.audit_logs', 'DELETE') OR NOT has_table_privilege(r, 'public.audit_logs', 'SELECT') THEN
      RAISE EXCEPTION 'FAIL 08 % audit_logs privileges', r;
    END IF;

    -- app_notifications: SELECT and UPDATE (read_at) only.
    SELECT string_agg(attname, ',' ORDER BY attname) INTO v FROM pg_attribute
    WHERE attrelid = 'public.app_notifications'::regclass AND attnum > 0 AND NOT attisdropped
      AND has_column_privilege(r, 'public.app_notifications', attname, 'UPDATE');
    IF v IS DISTINCT FROM 'read_at' OR has_any_column_privilege(r, 'public.app_notifications', 'INSERT')
       OR has_table_privilege(r, 'public.app_notifications', 'DELETE') THEN
      RAISE EXCEPTION 'FAIL 08 % app_notifications privileges (UPDATE: %)', r, v;
    END IF;

    -- academy_applications: INSERT applicant columns only; UPDATE review columns only; no DELETE.
    SELECT string_agg(attname, ',' ORDER BY attname) INTO v FROM pg_attribute
    WHERE attrelid = 'public.academy_applications'::regclass AND attnum > 0 AND NOT attisdropped
      AND has_column_privilege(r, 'public.academy_applications', attname, 'INSERT');
    IF v IS DISTINCT FROM 'academy_name,academy_slug,applicant_user_id,city,contact_email,contact_phone,created_at,id,notes,sport,updated_at' THEN
      RAISE EXCEPTION 'FAIL 08 % academy_applications INSERT columns: %', r, v;
    END IF;
    SELECT string_agg(attname, ',' ORDER BY attname) INTO v FROM pg_attribute
    WHERE attrelid = 'public.academy_applications'::regclass AND attnum > 0 AND NOT attisdropped
      AND has_column_privilege(r, 'public.academy_applications', attname, 'UPDATE');
    IF v IS DISTINCT FROM 'provisioned_tenant_id,review_notes,reviewed_at,reviewed_by_user_id,status,updated_at' THEN
      RAISE EXCEPTION 'FAIL 08 % academy_applications UPDATE columns: %', r, v;
    END IF;
    IF has_table_privilege(r, 'public.academy_applications', 'DELETE') THEN
      RAISE EXCEPTION 'FAIL 08 % can delete academy_applications', r;
    END IF;

    -- Item 5: account links are written only by definer functions (redeem_portal_claim, link_join_request_account).
    IF has_column_privilege(r, 'public.players', 'user_id', 'INSERT')
       OR has_column_privilege(r, 'public.players', 'user_id', 'UPDATE')
       OR has_column_privilege(r, 'public.guardians', 'user_id', 'INSERT')
       OR has_column_privilege(r, 'public.guardians', 'user_id', 'UPDATE')
       OR has_table_privilege(r, 'public.players', 'UPDATE')
       OR has_table_privilege(r, 'public.guardians', 'UPDATE') THEN
      RAISE EXCEPTION 'FAIL 08 % can write players.user_id / guardians.user_id', r;
    END IF;
    IF NOT has_column_privilege(r, 'public.players', 'first_name', 'UPDATE')
       OR NOT has_column_privilege(r, 'public.guardians', 'phone', 'INSERT') THEN
      RAISE EXCEPTION 'FAIL 08 % lost the ordinary players / guardians column privileges', r;
    END IF;
    -- player_registration_requests: no INSERT/DELETE; UPDATE review columns only.
    SELECT string_agg(attname, ',' ORDER BY attname) INTO v FROM pg_attribute
    WHERE attrelid = 'public.player_registration_requests'::regclass AND attnum > 0 AND NOT attisdropped
      AND has_column_privilege(r, 'public.player_registration_requests', attname, 'UPDATE');
    IF v IS DISTINCT FROM 'review_notes,reviewed_at,reviewed_by_user_id,status,updated_at'
       OR has_any_column_privilege(r, 'public.player_registration_requests', 'INSERT')
       OR has_table_privilege(r, 'public.player_registration_requests', 'DELETE') THEN
      RAISE EXCEPTION 'FAIL 08 % player_registration_requests privileges (UPDATE: %)', r, v;
    END IF;

    -- Append-only tables: no UPDATE/DELETE.
    IF has_any_column_privilege(r, 'public.attendance_corrections', 'UPDATE') OR has_table_privilege(r, 'public.attendance_corrections', 'DELETE')
       OR has_any_column_privilege(r, 'public.attendance_events', 'UPDATE') OR has_table_privilege(r, 'public.attendance_events', 'DELETE') THEN
      RAISE EXCEPTION 'FAIL 08 % can modify append-only attendance tables', r;
    END IF;
  END LOOP;
  SELECT string_agg(c.relname, ',') INTO v FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public' AND c.relkind = 'r'
    AND (has_table_privilege('public', c.oid, 'SELECT') OR has_table_privilege('public', c.oid, 'INSERT')
         OR has_table_privilege('public', c.oid, 'UPDATE') OR has_table_privilege('public', c.oid, 'DELETE'));
  IF v IS NOT NULL THEN RAISE EXCEPTION 'FAIL 08 PUBLIC has table privileges on %', v; END IF;
  RAISE NOTICE 'PASS 08 table and column privileges';

  -- 9. No claim code stored in plaintext (all NULL or a SHA-256 digest). Counts only, never values.
  SELECT (SELECT count(*) FROM public.players WHERE claim_token IS NOT NULL AND claim_token !~ '^[0-9a-f]{64}$')
       + (SELECT count(*) FROM public.guardians WHERE claim_token IS NOT NULL AND claim_token !~ '^[0-9a-f]{64}$')
  INTO n;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL 09 % plaintext claim codes remain', n; END IF;
  RAISE NOTICE 'PASS 09 claim codes hashed at rest';
END $$;
\echo 'security-catalog: all checks passed'
