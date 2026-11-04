# SPORTEXUS — Authentication & Account Recovery Workflow Audit

## 1. Executive Summary

This audit verifies that the authentication, session management, account recovery, and player onboarding architecture across Sportexus meets strict enterprise security, anti-enumeration, and multi-tenant isolation standards.

---

## 2. Password Reset & Account Recovery Workflow (Phase 6)

### 2.1 Password Reset Request (`POST /auth/forgot-password`)

- **Rate Limiting & Cooldown:** Guarded by Redis-backed rate limiting with a 60-second resend cooldown per email (`ratelimit:forgot-password:cooldown:<email>`) and max 3 requests per 15 minutes (`ratelimit:forgot-password:<ip>:<email>`).
- **Enumeration Prevention:** Regardless of whether the submitted email exists in the database, the endpoint returns an identical neutral message:
  ```json
  {
    "message": "If that email address is registered, instructions have been sent to reset your password with a 6-digit verification code."
  }
  ```
- **Cryptographic 6-Digit OTP:** Generated using cryptographically secure random integers (`crypto.randomInt(100000, 1000000)`), hashed via SHA-256 before storage in PostgreSQL (`public.request_password_reset`).
- **5-Minute Expiration:** Verification codes strictly expire after **5 minutes** (reduced from 60 minutes for high security).
- **Environment Isolation:** In production, zero token/OTP leakage occurs. In local development only (`NODE_ENV === 'development'`), a `debugOtp` field is returned to facilitate rapid local testing without requiring active SMTP relays.
- **Delivery:** Transactional email is dispatched directly to the applicant's verified email address via `EmailService.sendPasswordReset()`, containing the 6-digit OTP code along with a direct reset link (`/reset-password?token=<otp>&email=<email>`).

### 2.2 Password Reset Execution (`POST /auth/reset-password`)

- **Cryptographic Verification:** The incoming 6-digit OTP code (or token) is trimmed, hashed with SHA-256, and matched atomically against stored hashes via PostgreSQL stored procedure `public.complete_password_reset()`.
- **Brute-Force Protection:** Capped at a maximum of 5 verification attempts per code window (`ratelimit:reset-password-attempts:<hash>`). Exceeding 5 attempts immediately clears the reset token from the database, requiring the user to request a fresh OTP.
- **Argon2id Hashing:** New passwords are validated (minimum 8 characters with uppercase, lowercase, and numeric complexity rules) and hashed using Argon2id with memory cost 65536, time cost 3, and parallelism 4.
- **Global Session Revocation:** Upon successful password reset, all active refresh tokens for the user are immediately revoked (`tokenService.revokeAllUserTokens(userId)`), forcing re-authentication across all browsers and devices.
- **Audit Logging:** An immutable audit log (`AUTH_PASSWORD_RESET_COMPLETED`) is permanently recorded.
- **UI Experience:** Supported seamlessly through two synchronized interfaces:
  1. `/forgot-password`: In-place 2-step flow (Email entry → 6-digit OTP & new password entry with live countdown cooldown and copyable debug OTP in local dev).
  2. `/reset-password`: Deep-link handling that pre-fills the 6-digit OTP and optional target email from query parameters (`?token=...&email=...` or `?otp=...` or `?code=...`).

---

## 3. Player Join Request Auto-Provisioning & Email Workflow (Phase 8)

### 3.1 Review & Approval Flow (`POST /v1/players/join-requests/:id/review`)

- **Authority Gate:** Requires authenticated tenant administrator or branch manager permissions.
- **Atomic Database Provisioning:** Executed inside a single PostgreSQL tenant transaction:
  1. Updates the `PlayerJoinRequest` status to `APPROVED` or `REJECTED`.
  2. On **APPROVED**:
     - Automatically creates a new `Player` entity with full details (name, date of birth, gender, emergency contacts, medical notes).
     - If guardian information is provided (email and phone), checks for existing `Guardian` record or provisions a new one with linked `User` and `GUARDIAN` role.
     - Enrolls the player into the requested academy branch and sport program (`Enrollment`).
     - Adds the player to the designated training group or squad (`GroupMember`).
- **Post-Transaction Transactional Email Dispatch:**
  - Email notification is dispatched **outside** the database transaction via `dispatchPlayerReviewEmail`. This guarantees that transient SMTP/provider latency cannot stall or roll back database commits.
  - **Approval Email:** Sent to the guardian/applicant email in Arabic and English, including player name, academy name, branch name, group assignment, and a direct access link to the parent/player portal (`/portal` or `/guardian`).
  - **Rejection Email:** Dispatched with empathetic messaging and reviewer feedback/notes, with academy contact guidance.

---

## 4. Platform Co-Owner Invitation & Activation Workflow

### 4.1 Invitation Initiation (`POST /platform/super-admin/invite`)

- **Authority Gate:** Protected by `PlatformOwnerGuard`. Only existing Platform Owners (including Co-Owners) can initiate invitations.
- **Role Elevation:** Supports inviting new users or promoting existing users to `PLATFORM_CO_OWNER` or `SUPER_ADMIN`.
- **Activation Token Delivery:**
  - When inviting a new administrator, a 48-hour secure activation token is generated and stored in the database.
  - An activation email is dispatched via `EmailService.sendPlatformAdminInvite()` with direct onboarding link:
    `${APP_URL}/reset-password?token=${rawToken}`.
  - The invited account is initialized with `mustResetPassword: true`.

### 4.2 Last Owner Protection

- **Role Updates (`PATCH /platform/super-admin/:id/role`):**
  - Prohibits demoting or revoking the primary platform owner (`superadmin@platform.sa`).
  - Queries active platform owners (`count({ where: { isPlatformOwner: true, isSuspended: false } })`) to ensure the last active owner can never be demoted or removed.
- **Account Suspension (`PATCH /platform/users/:id/security`):**
  - Prohibits suspending the last active platform owner.

---

## 5. Multi-Tenant Session Isolation Audit

- **JWT Verification:** Access tokens are signed using HMAC-SHA256 with 15-minute expiration.
- **Refresh Token Rotation:** Refresh tokens use family IDs to detect and prevent token replay attacks. Reusing a revoked token invalidates the entire token family.
- **Client Synchronization:** The frontend listens to `BroadcastChannel('sportexus_auth_sync')` and `storage` events to ensure logouts and tenant context switches propagate instantly across all open browser tabs.
- **Immediate State Invalidation:** On user logout, authentication tokens, cookies, in-memory auth context, and cached tenant keys are cleared immediately and redirected via `window.location.replace('/login')` to prevent stale view lingering or back-button leaks.
