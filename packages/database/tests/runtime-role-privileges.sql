-- Run as the database owner in disposable CI database.
-- SET ROLE exercises privileges as a non-owner, non-BYPASSRLS identity.
BEGIN;
SET LOCAL ROLE academy_runtime_ci;

DO $$
DECLARE
  allowed boolean := false;
BEGIN
  IF (SELECT rolbypassrls OR rolsuper OR rolcreatedb OR rolcreaterole
      FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'SECURITY FAILURE: runtime role has elevated role flags';
  END IF;

  -- Verify the effective privilege boundary, not just the role name.
  IF EXISTS (
    SELECT 1 FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
        'tenants', 'branches', 'tenant_sports', 'audit_logs',
        'users', 'refresh_tokens', 'tenant_memberships', 'invitations',
        'attendance_sessions', 'attendance_records', 'attendance_corrections', 'attendance_idempotency'
      )
      AND c.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
  ) THEN
    RAISE EXCEPTION 'SECURITY FAILURE: runtime role owns application tables';
  END IF;

  IF has_schema_privilege(current_user, 'public', 'CREATE') THEN
    RAISE EXCEPTION 'SECURITY FAILURE: runtime role has schema CREATE privilege';
  END IF;

  IF has_table_privilege(current_user, 'public.tenants', 'INSERT')
    OR has_table_privilege(current_user, 'public.tenants', 'DELETE')
    OR has_table_privilege(current_user, 'public.tenants', 'TRUNCATE')
    OR has_table_privilege(current_user, 'public.audit_logs', 'UPDATE')
    OR has_table_privilege(current_user, 'public.audit_logs', 'DELETE')
    OR has_table_privilege(current_user, 'public.audit_logs', 'TRUNCATE')
    OR has_table_privilege(current_user, 'public.attendance_corrections', 'UPDATE')
    OR has_table_privilege(current_user, 'public.attendance_corrections', 'DELETE')
    OR has_table_privilege(current_user, 'public.attendance_corrections', 'TRUNCATE') THEN
    RAISE EXCEPTION 'SECURITY FAILURE: runtime role has forbidden table privileges';
  END IF;

  IF NOT has_table_privilege(current_user, 'public.tenants', 'SELECT')
    OR NOT has_table_privilege(current_user, 'public.branches', 'SELECT')
    OR NOT has_table_privilege(current_user, 'public.tenant_sports', 'SELECT')
    OR NOT has_table_privilege(current_user, 'public.audit_logs', 'INSERT')
    OR NOT has_table_privilege(current_user, 'public.attendance_sessions', 'SELECT')
    OR NOT has_table_privilege(current_user, 'public.attendance_records', 'SELECT')
    OR NOT has_table_privilege(current_user, 'public.attendance_corrections', 'INSERT') THEN
    RAISE EXCEPTION 'SECURITY FAILURE: runtime role is missing expected permissions';
  END IF;

  BEGIN
    EXECUTE 'CREATE TABLE public.ci_runtime_forbidden (id int)';
    allowed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF allowed THEN
    RAISE EXCEPTION 'SECURITY FAILURE: runtime role can create tables';
  END IF;

  allowed := false;
  BEGIN
    EXECUTE 'UPDATE public.audit_logs SET action = action WHERE false';
    allowed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF allowed THEN
    RAISE EXCEPTION 'SECURITY FAILURE: runtime role can update audit logs';
  END IF;

  allowed := false;
  BEGIN
    EXECUTE 'DELETE FROM public.audit_logs WHERE false';
    allowed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF allowed THEN
    RAISE EXCEPTION 'SECURITY FAILURE: runtime role can delete audit logs';
  END IF;

  allowed := false;
  BEGIN
    EXECUTE 'UPDATE public.attendance_corrections SET reason = ''tamper'' WHERE false';
    allowed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF allowed THEN
    RAISE EXCEPTION 'SECURITY FAILURE: runtime role can update attendance corrections';
  END IF;

  allowed := false;
  BEGIN
    EXECUTE 'DELETE FROM public.attendance_corrections WHERE false';
    allowed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF allowed THEN
    RAISE EXCEPTION 'SECURITY FAILURE: runtime role can delete attendance corrections';
  END IF;

  -- Invitation redemption must not gain cross-tenant visibility by toggling a GUC.
  PERFORM set_config('app.tenant_id', '', true);
  PERFORM set_config('app.actor_user_id', '', true);
  PERFORM set_config('app.auth_context', 'invitation_lookup', true);
  IF EXISTS (SELECT 1 FROM public.invitations) THEN
    RAISE EXCEPTION 'SECURITY FAILURE: invitation lookup flag exposed invitations';
  END IF;

  -- Even a syntactically valid tenant ID cannot authorize provisioning.
  PERFORM set_config('app.tenant_id', '00000000-0000-4000-8000-000000000201', true);
  IF has_table_privilege(current_user, 'public.tenants', 'INSERT') THEN
    RAISE EXCEPTION 'SECURITY FAILURE: runtime tenant provisioning privilege was granted';
  END IF;
  PERFORM set_config('app.tenant_id', '', true);
  PERFORM set_config('app.auth_context', '', true);

  -- Runtime identity must never provision or delete platform tenants.
  allowed := false;
  BEGIN
    EXECUTE 'INSERT INTO public.tenants (slug, name) VALUES (''ci_forbidden'', ''Forbidden'')';
    allowed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF allowed THEN
    RAISE EXCEPTION 'SECURITY FAILURE: runtime role can provision tenants';
  END IF;

  allowed := false;
  BEGIN
    EXECUTE 'DELETE FROM public.tenants WHERE false';
    allowed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF allowed THEN
    RAISE EXCEPTION 'SECURITY FAILURE: runtime role can delete tenants';
  END IF;
END $$;

RESET ROLE;
ROLLBACK;
