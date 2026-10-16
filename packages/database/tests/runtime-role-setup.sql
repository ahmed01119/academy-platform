-- Disposable CI database only. Production role creation belongs in infrastructure
-- provisioning with secrets managed outside source control.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'academy_runtime_ci') THEN
    CREATE ROLE academy_runtime_ci NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;

GRANT CONNECT ON DATABASE academy TO academy_runtime_ci;
GRANT USAGE ON SCHEMA public TO academy_runtime_ci;
GRANT SELECT, UPDATE ON TABLE public.tenants TO academy_runtime_ci;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.branches, public.tenant_sports TO academy_runtime_ci;
REVOKE INSERT, DELETE, TRUNCATE ON TABLE public.tenants FROM academy_runtime_ci;
GRANT SELECT, INSERT ON TABLE public.audit_logs TO academy_runtime_ci;
REVOKE CREATE ON SCHEMA public FROM academy_runtime_ci;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.audit_logs FROM academy_runtime_ci;

-- Global identity tables
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users, public.refresh_tokens TO academy_runtime_ci;
REVOKE TRUNCATE ON TABLE public.users, public.refresh_tokens FROM academy_runtime_ci;

-- Tenant-owned operational tables
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenant_memberships, public.invitations, public.attendance_sessions, public.attendance_records, public.attendance_idempotency TO academy_runtime_ci;
REVOKE TRUNCATE ON TABLE public.tenant_memberships, public.invitations, public.attendance_sessions, public.attendance_records, public.attendance_idempotency FROM academy_runtime_ci;

-- Append-only attendance corrections: SELECT and INSERT only. Never UPDATE, DELETE, or TRUNCATE!
GRANT SELECT, INSERT ON TABLE public.attendance_corrections TO academy_runtime_ci;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.attendance_corrections FROM academy_runtime_ci;
