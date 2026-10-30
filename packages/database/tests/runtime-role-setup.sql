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

-- Global identity tables: Enforce strict least-privilege boundary on public.users
-- Table-level INSERT and UPDATE revoked to prevent identity spoofing or arbitrary verification
REVOKE ALL ON TABLE public.users FROM academy_runtime_ci;
GRANT SELECT, DELETE ON TABLE public.users TO academy_runtime_ci;

-- Column-level INSERT permitted ONLY on non-privileged identity registration fields
GRANT INSERT (
  id,
  email,
  password_hash,
  name,
  phone,
  created_at,
  updated_at
) ON TABLE public.users TO academy_runtime_ci;

-- Column-level UPDATE permitted ONLY on standard user profile fields
GRANT UPDATE (
  name,
  phone,
  updated_at
) ON TABLE public.users TO academy_runtime_ci;

REVOKE TRUNCATE ON TABLE public.users FROM academy_runtime_ci;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.refresh_tokens TO academy_runtime_ci;
REVOKE TRUNCATE ON TABLE public.refresh_tokens FROM academy_runtime_ci;

-- Tenant-owned operational tables
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenant_memberships, public.invitations, public.attendance_sessions, public.attendance_records, public.attendance_idempotency TO academy_runtime_ci;
REVOKE TRUNCATE ON TABLE public.tenant_memberships, public.invitations, public.attendance_sessions, public.attendance_records, public.attendance_idempotency FROM academy_runtime_ci;

-- Append-only attendance corrections: SELECT and INSERT only. Never UPDATE, DELETE, or TRUNCATE!
GRANT SELECT, INSERT ON TABLE public.attendance_corrections TO academy_runtime_ci;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.attendance_corrections FROM academy_runtime_ci;

-- Scoped onboarding, invitation redemption and identity transition boundary execution
GRANT EXECUTE ON FUNCTION public.issue_user_onboarding_token(uuid, text, timestamptz) TO academy_runtime_ci;
GRANT EXECUTE ON FUNCTION public.issue_user_redemption_challenge(uuid, text, timestamptz) TO academy_runtime_ci;
GRANT EXECUTE ON FUNCTION public.provision_tenant_onboarding(uuid, text, text, text, text, text, text) TO academy_runtime_ci;
GRANT EXECUTE ON FUNCTION public.redeem_invitation_and_activate_membership(uuid, text, text) TO academy_runtime_ci;
GRANT EXECUTE ON FUNCTION public.inspect_invitation_preview(text) TO academy_runtime_ci;
GRANT EXECUTE ON FUNCTION public.verify_user_email(text) TO academy_runtime_ci;
GRANT EXECUTE ON FUNCTION public.request_email_verification(text, text, timestamptz) TO academy_runtime_ci;
GRANT EXECUTE ON FUNCTION public.request_password_reset(text, text, timestamptz) TO academy_runtime_ci;
GRANT EXECUTE ON FUNCTION public.complete_password_reset(text, text) TO academy_runtime_ci;
