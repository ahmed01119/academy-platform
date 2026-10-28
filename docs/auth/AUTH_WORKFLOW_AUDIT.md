# SPORTEXUS — Authentication & Account Recovery Workflow Audit

## 1. Executive Summary

This audit verifies that the authentication, session management, and account recovery architecture across Sportexus meets strict enterprise security, anti-enumeration, and multi-tenant isolation standards.

---

## 2. Password Reset & Account Recovery Workflow

### 2.1 Password Reset Request (`POST /auth/forgot-password`)
- **Rate Limiting:** Guarded by Redis-backed rate limiting (`ratelimit:forgot-password:<ip>:<email>`) with max 3 attempts per 15 minutes.
- **Enumeration Prevention:** Regardless of whether the submitted email exists in the database, the endpoint returns an identical neutral message:
  ```json
  {
    "message": "If that email address is registered, instructions have been sent to reset your password."
  }
  ```
- **Zero Token Leakage:** The raw reset token is generated using cryptographically secure random bytes (`crypto.randomBytes(32)`), hashed via SHA-256 before storage in PostgreSQL (`public.request_password_reset`), and never included in the HTTP response body.
- **Expiration:** Tokens strictly expire after 60 minutes.
- **Delivery:** Transactional email is dispatched directly to the applicant's verified email address via `EmailService.sendPasswordReset()`.

### 2.2 Password Reset Execution (`POST /auth/reset-password`)
- **Cryptographic Verification:** The incoming token from the email query parameter is hashed with SHA-256 and matched atomically against stored hashes via PostgreSQL stored procedure `public.complete_password_reset()`.
- **Argon2id Hashing:** New passwords are hashed using Argon2id with memory cost 65536, time cost 3, and parallelism 4.
- **Global Session Revocation:** Upon successful password reset, all active refresh tokens for the user are immediately revoked (`tokenService.revokeAllUserTokens(userId)`), forcing re-authentication across all browsers and devices.
- **Audit Logging:** An immutable audit log (`AUTH_PASSWORD_RESET_COMPLETED`) is permanently recorded.

---

## 3. Platform Co-Owner Invitation & Activation Workflow

### 3.1 Invitation Initiation (`POST /platform/super-admin/invite`)
- **Authority Gate:** Protected by `PlatformOwnerGuard`. Only existing Platform Owners (including Co-Owners) can initiate invitations.
- **Role Elevation:** Supports inviting new users or promoting existing users to `PLATFORM_CO_OWNER` or `SUPER_ADMIN`.
- **Activation Token Delivery:**
  - When inviting a new administrator, a 48-hour secure activation token is generated and stored in the database.
  - An activation email is dispatched via `EmailService.sendPlatformAdminInvite()` with direct onboarding link:
    `${APP_URL}/reset-password?token=${rawToken}`.
  - The invited account is initialized with `mustResetPassword: true`.

### 3.2 Last Owner Protection
- **Role Updates (`PATCH /platform/super-admin/:id/role`):**
  - Prohibits demoting or revoking the primary platform owner (`superadmin@platform.sa`).
  - Queries active platform owners (`count({ where: { isPlatformOwner: true, isSuspended: false } })`) to ensure the last active owner can never be demoted or removed.
- **Account Suspension (`PATCH /platform/users/:id/security`):**
  - Prohibits suspending the last active platform owner.

---

## 4. Multi-Tenant Session Isolation Audit
- **JWT Verification:** Access tokens are signed using HMAC-SHA256 with 15-minute expiration.
- **Refresh Token Rotation:** Refresh tokens use family IDs to detect and prevent token replay attacks. Reusing a revoked token invalidates the entire token family.
- **Client Synchronization:** The frontend listens to `BroadcastChannel('sportexus_auth_sync')` and `storage` events to ensure logouts and tenant context switches propagate instantly across all open browser tabs.
