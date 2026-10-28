# Sprint 1 — Secure Onboarding & Privilege Boundaries

Status: **IMPLEMENTED & VERIFIED**. Registration, tenant provisioning, staff invitations, and identity boundaries are hardened and pass all tests under the restricted PostgreSQL runtime role (`academy_runtime_ci`) with FORCE RLS.

## Security Architecture & Privilege Boundaries

### 1. Database Provisioning Boundary (`provision_tenant_onboarding`)

- Tenant creation is strictly isolated: the runtime role (`academy_runtime_ci`) is denied table-level `INSERT`, `DELETE`, and `TRUNCATE` privileges on `public.tenants`.
- Provisioning is performed via the PostgreSQL function `public.provision_tenant_onboarding(...)`, defined as `SECURITY DEFINER` with fixed `search_path = public, pg_temp` to prevent search_path poisoning.
- The function requires a cryptographic single-use `p_onboarding_token`. During registration, `AuthService.register()` stores `sha256(raw_onboarding_token)` in `users.onboarding_token`. The database function validates `sha256(p_onboarding_token::bytea) = v_expected_hash` and immediately invalidates the token to eliminate replay attacks.
- Atomically provisions the tenant, initial branch (`الفرع الرئيسي`), primary sport, and `OWNER` membership in a single transaction with automatic rollback on failure.

### 2. Runtime Role Column-Level Privilege Restrictions on `public.users`

- Table-level `INSERT` and `UPDATE` on `public.users` are revoked from the runtime role (`academy_runtime_ci`).
- Column-level grants are strictly constrained to non-sensitive fields:
  ```sql
  REVOKE INSERT, UPDATE ON TABLE public.users FROM academy_runtime_ci;
  GRANT SELECT, DELETE ON TABLE public.users TO academy_runtime_ci;
  GRANT INSERT (id, email, password_hash, name, phone, created_at, updated_at) ON TABLE public.users TO academy_runtime_ci;
  GRANT UPDATE (name, phone, updated_at) ON TABLE public.users TO academy_runtime_ci;
  ```
- All sensitive authentication tokens and verification flags are completely untouchable by direct runtime DML:
  - `onboarding_token`, `onboarding_expires_at`
  - `redemption_challenge`, `redemption_expires_at`
  - `is_email_verified`
  - `email_verification_token`, `email_verification_expires_at`
  - `password_reset_token`, `password_reset_expires_at`
- **Security Invariant**: Any direct SQL caller attempting `INSERT` or `UPDATE` on these protected columns is blocked with PostgreSQL error `42501 (insufficient_privilege)`.
- Identity lifecycle state changes are mediated strictly through audited `SECURITY DEFINER` procedures:
  - `public.issue_user_onboarding_token(p_user_id, p_token_hash)`
  - `public.issue_user_redemption_challenge(p_user_id, p_challenge_hash)`
  - `public.verify_user_email(p_token_hash)`
  - `public.request_email_verification(p_user_id, p_token_hash)`
  - `public.request_password_reset(p_email, p_token_hash)`
  - `public.complete_password_reset(p_token_hash, p_new_password_hash)`

### 3. Invitation Redemption Security Boundary (`redeem_invitation_and_activate_membership`)

- Invitation tokens are never stored in plaintext in the database: `invitations.token` stores `sha256(raw_token)`.
- Redemption requires the authentic raw token from the invitation email and an active, verified user account (`is_email_verified = true`).
- Enforces cryptographic challenge validation: caller must present a valid redemption challenge hash previously issued via `issue_user_redemption_challenge`.
- The database function asserts `lower(trim(invitation.email)) = lower(trim(user.email))` and consumes the invitation conditionally with row locking (`FOR UPDATE`) to prevent concurrent consumption or race conditions.
- Immediately consumes and clears the redemption challenge upon activation to prevent replay.
- Direct runtime writes to `public.users` during redemption are completely eliminated.

### 4. Actor-Scoped Context Discovery

- Membership discovery via `withAuthLookupTransaction` operates with `app.actor_user_id` set to the verified user's ID.
- Setting arbitrary GUC values (e.g. `app.auth_context = 'invitation_lookup'`) grants zero bypasses under FORCE RLS.

## Automated Verification Suite

The following automated test suites enforce these security invariants on every build in CI and local verification:

1. `audit-append-only.sql`: Verifies `audit_logs` UPDATE and DELETE are blocked, and RESTRICT foreign keys prevent deleting tenants with audit evidence.
2. `runtime-role-setup.sql`: Provisions the disposable least-privilege `academy_runtime_ci` role with table and column restrictions.
3. `runtime-role-privileges.sql`: Verifies negative privilege assertions (denial of `INSERT tenants`, denial of `UPDATE audit_logs`, denial of `UPDATE users (onboarding_token, redemption_challenge)`).
4. `tenant-rls.sql`: Verifies cross-tenant data isolation and FORCE RLS policies.
5. `onboarding-and-invitations.sql`: End-to-end integration tests under `academy_runtime_ci` proving anti-impersonation, expired token rejection, email mismatch rejection, replay prevention, and atomic provisioning.
