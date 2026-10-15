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

SET LOCAL ROLE academy_runtime_ci;

DO $$
BEGIN
 IF (SELECT count(*) FROM public.branches) <> 0 THEN
   RAISE EXCEPTION 'SECURITY FAILURE: missing tenant context exposes branches';
 END IF;
END $$;

SELECT set_config('app.tenant_id','00000000-0000-4000-8000-000000000201',true);

DO $$
BEGIN
 IF (SELECT count(*) FROM public.branches) <> 1 THEN
   RAISE EXCEPTION 'SECURITY FAILURE: tenant A can see wrong branches';
 END IF;
 IF (SELECT count(*) FROM public.branches WHERE code = 'B') <> 0 THEN
   RAISE EXCEPTION 'SECURITY FAILURE: tenant B data visible to tenant A';
 END IF;
 IF (SELECT count(*) FROM public.branches WHERE tenant_id =
   '00000000-0000-4000-8000-000000000202') <> 0 THEN
   RAISE EXCEPTION 'SECURITY FAILURE: tenant B rows visible';
 END IF;
END $$;

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
  RAISE EXCEPTION 'SECURITY FAILURE: cross-tenant insert permitted';
 END IF;
 IF (SELECT count(*) FROM public.branches
     WHERE id='00000000-0000-4000-8000-000000000212') <> 0 THEN
  RAISE EXCEPTION 'SECURITY FAILURE: cross-tenant record visible';
 END IF;
END $$;

UPDATE public.branches SET name='HACKED' WHERE code='B';
DELETE FROM public.branches WHERE code='B';

-- Simulate a new request with a different verified tenant context.
SELECT set_config('app.tenant_id','00000000-0000-4000-8000-000000000202',true);
DO $$
BEGIN
 IF (SELECT count(*) FROM public.branches) <> 1
    OR (SELECT count(*) FROM public.branches WHERE code='A') <> 0 THEN
   RAISE EXCEPTION 'SECURITY FAILURE: tenant context switch leaks prior tenant rows';
 END IF;
END $$;

-- A missing context must fail closed even after a prior tenant request.
SELECT set_config('app.tenant_id','',true);
DO $$
BEGIN
 IF (SELECT count(*) FROM public.branches) <> 0 THEN
   RAISE EXCEPTION 'SECURITY FAILURE: cleared tenant context exposes rows';
 END IF;
END $$;

RESET ROLE;

DO $$
BEGIN
 IF (SELECT name FROM public.branches
     WHERE id='00000000-0000-4000-8000-000000000212') <> 'Branch B' THEN
  RAISE EXCEPTION 'SECURITY FAILURE: cross-tenant record mutated';
 END IF;
END $$;

ROLLBACK;
