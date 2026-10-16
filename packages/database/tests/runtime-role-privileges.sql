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
END $;

RESET ROLE;
ROLLBACK;
