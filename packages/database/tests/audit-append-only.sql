-- CI integration test: ensure audit logs cannot be updated or deleted.
-- Run after prisma migrate deploy with a PostgreSQL role permitted to insert.
BEGIN;

INSERT INTO tenants (id, slug, name, updated_at)
VALUES ('00000000-0000-4000-8000-000000000101', 'ci-audit-test', 'CI Audit Test', now());

INSERT INTO audit_logs (id, tenant_id, action, resource_type)
VALUES ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000101', 'CREATE', 'ci_test');

DO $$
DECLARE
  blocked boolean := false;
BEGIN
  BEGIN
    UPDATE audit_logs SET action = 'TAMPERED'
    WHERE id = '00000000-0000-4000-8000-000000000102';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'SECURITY FAILURE: audit log UPDATE succeeded';
  END IF;

  blocked := false;
  BEGIN
    DELETE FROM audit_logs
    WHERE id = '00000000-0000-4000-8000-000000000102';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'SECURITY FAILURE: audit log DELETE succeeded';
  END IF;

  blocked := false;
  BEGIN
    DELETE FROM tenants
    WHERE id = '00000000-0000-4000-8000-000000000101';
  EXCEPTION WHEN foreign_key_violation THEN
    blocked := true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'SECURITY FAILURE: tenant with audit evidence was deleted';
  END IF;

  IF (SELECT count(*) FROM audit_logs
      WHERE id = '00000000-0000-4000-8000-000000000102'
        AND action = 'CREATE') <> 1 THEN
    RAISE EXCEPTION 'SECURITY FAILURE: audit log content changed';
  END IF;
END;
$$;

ROLLBACK;
