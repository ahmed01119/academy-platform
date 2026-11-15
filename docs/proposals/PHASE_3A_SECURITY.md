# Phase 3A proposal: password reset, sessions and client IP (K1, K13, S1)

> **Status: proposal, awaiting owner approval. Nothing below is implemented or applied.**
> Prepared 2026-11-15 on branch `frontend-architecture-uiux-audit`.

## 1. K1: password-reset codes can be guessed without limit (critical)

### Root cause (verified in code)

`AuthService.resetPassword` (`backend/src/modules/auth/auth.service.ts`) has four flaws:

1. **The attempt counter is keyed by the guessed code.** The key is `ratelimit:reset-password-attempts:<sha256(submitted code)>`,
   so every new guess starts a new counter at 1. The "5 attempts" limit never triggers for a brute-force attack.
2. **The code is not bound to an account.** `ResetPasswordRequestSchema` accepts `{ token, newPassword }` with no email.
   `public.complete_password_reset(text, text)` matches the hash against _all_ users with a pending reset, so one
   correct guess resets the password of whichever account owns that code.
3. **There is no per-IP limit** on `POST /auth/reset-password`.
4. **The "invalidate after 5 failures" step can never work.** It runs
   `UPDATE users … WHERE password_reset_token = <hash of the guess>`, which matches the real code only if the guess is
   already correct.

The intended design is visible in the code: `forgotPassword` resets a per-email counter
`ratelimit:reset-attempts:<email>` that `resetPassword` never reads.

**Attack:** request a reset for a victim's email (public endpoint), then submit codes from `000000` to `999999` while
the code is valid (5 minutes), from one or many IPs. Every guess is free. Result: **account takeover**, including
platform super admins.

### Fix

**Contract (`packages/shared` `ResetPasswordRequestSchema`):**

- Add `email` (optional in the schema type).
- A refinement makes `email` **required when `token` is a 6-digit code**. Every other token shape keeps working
  without it.
- The 256-bit activation links sent to invited platform staff (`/reset-password?token=<64 hex>`, created by
  `PlatformService`) carry no email, are not guessable, and keep working.
- A 6-digit code without an email returns `400 VALIDATION_FAILED`.

**Database:** one additive migration (section 6) adds two functions:

- `complete_password_reset_for_email(email, code_hash, new_password_hash)` succeeds only when the code belongs to that
  email. Its effects are identical to today's function: it sets the password, clears the code and revokes all refresh
  tokens.
- `invalidate_password_reset_for_email(email)` cancels that account's pending code.

**Service, 6-digit code path, in this order:**

1. **Per-IP limit** (shared with the activation path): `ratelimit:reset-password:ip:<clientIp>`, at most **30
   attempts per 15 minutes**. Depends on S1, since without trustworthy IPs this limit would be shared by all users.
2. **Per-account daily cap:** `ratelimit:reset-attempts-daily:<email>`, at most **20 failed attempts per 24 hours**.
   _Not_ reset when a new code is issued, so requesting fresh codes cannot be used to farm guesses.
3. **Per-code limit:** `ratelimit:reset-attempts:<email>` (the key `forgotPassword` already resets). After **5 failed
   attempts** the code is cancelled through `invalidate_password_reset_for_email`, and the user must request a new code.
4. `complete_password_reset_for_email(...)`.
5. **On success:** clear the per-code counter. The daily counter is kept.

Unknown email, wrong code, expired code and cancelled code all return the **same** `400 TOKEN_INVALID` message, so the
endpoint does not reveal whether an email exists. Rate-limit responses keep the current convention
(`400 RATE_LIMIT_EXCEEDED`); moving to `429` is part of BR-1, which is pending.

**Service, 64-hex activation token path:** the per-IP limit plus the existing `complete_password_reset(text, text)`
function.

**Frontend:**

- `/forgot-password` step 2 sends the email the user typed in step 1.
- `/reset-password` sends the `email` query parameter that reset emails already include (`?token=…&email=…`).
- If an emailed link has no `email` parameter (only activation links, which use 64-hex tokens), the page behaves as
  today.

**Unchanged:**

- the 6-digit code;
- the 5-minute expiry;
- the email content;
- the `forgot-password` limits (one request per minute per email; 3 per 15 minutes per IP and email).

**Trade-off, stated honestly:** anyone who knows a user's email can use up that user's reset attempts for the day
(20). They still cannot take over the account, and the user can still sign in with their current password. This is the
standard trade-off and is acceptable.

**Residual brute-force risk after the fix:** at most 5 guesses per issued code, 20 per account per day. The chance of
success is 20 / 1,000,000 per day (≈0.002 %), and each attempt also requires a fresh email to the victim.

## 2. K13: changing a password does not sign out other sessions

**Root cause:** `AuthService.changePassword` updates the hash, but never touches `refresh_tokens`. A password reset
already revokes every session (inside the SQL function); a change, which is often done _because_ of a suspected
compromise, does not.

**Fix:** a new `TokenService.revokeOtherUserTokens(userId, currentRefreshToken?)` revokes every refresh-token family
of the user except the one in the request's `refresh_token` cookie. If there is no cookie, or it is unknown, every
family is revoked, which is the safe default. The user stays signed in on the device where they changed the password.

**Relationship with K1:** both close the "attacker keeps access" path.

- **K1** stops a takeover via reset.
- **K13** makes sure that after the legitimate owner changes the password, any attacker session dies.

Both live in the same module and test suite.

**Residual risk:** an already-issued **access** token (a 15-minute JWT) stays valid until it expires.

**Optional K13b (needs a second migration; recommendation: yes):**

- Add a nullable `users.password_changed_at` column, set on change and reset.
- `JwtStrategy`, which already loads the user on every request, rejects tokens issued before that time.
- This makes invalidation immediate.
- **Decision for the owner:** include it or not.

## 3. S1: trusted client IP behind the Next.js proxy

### Root cause (verified)

- The API never sets Express `trust proxy`. Every browser request goes browser → (platform proxy) → Next.js
  `/v1/[...path]` route → API, so `req.ip` is the **proxy's** address for every user:
  - audit logs record the proxy;
  - per-IP rate limits behave as one bucket shared by all users;
  - the "login rate limit per IP + email" is effectively per email.
- The Next.js proxy copies the client's own `X-Forwarded-For` header upstream unchanged.
- The API is reachable **directly** as well (`API_DOMAIN` through Caddy in the self-hosted setup; its own public URL on
  Render). Trusting `X-Forwarded-For` would therefore let any direct caller set an arbitrary IP and escape every per-IP
  limit.
- The 8 call sites in `auth.controller.ts` repeat `req.ip || req.socket.remoteAddress`.

### Design: authenticate the proxy; never trust a client-supplied IP header

**Next.js proxy (`frontend/src/app/v1/[...path]/route.ts`):**

1. Drop every client-supplied identity header before forwarding: `x-forwarded-for`, `x-real-ip`, `forwarded`,
   `x-sportexus-client-ip`, `x-sportexus-proxy-auth`.
2. Determine the client IP from the inbound `X-Forwarded-For`, using `WEB_TRUSTED_PROXY_HOPS`:
   - the number of trusted proxies in front of the web app (Caddy or Render's load balancer = `1`);
   - the IP is the entry _hops_ positions from the right, which a client cannot forge;
   - default `0`, meaning no forwarded IP (local development).
3. When an IP was determined, send `x-sportexus-client-ip: <ip>` and `x-sportexus-proxy-auth: <INTERNAL_PROXY_SECRET>`.

**API, new `ClientIpMiddleware` registered first in `main.ts`:**

1. If `x-sportexus-proxy-auth` equals `INTERNAL_PROXY_SECRET` (constant-time compare; the secret must be at least 32
   characters) **and** `x-sportexus-client-ip` is a valid IPv4 or IPv6 address (`net.isIP`), the client IP is that
   value.
2. Otherwise the client IP is `req.ip`, with Express `trust proxy` set from `TRUST_PROXY_HOPS`:
   - default `0`, meaning the socket address;
   - `1` for Caddy or a Render load balancer in front of the API, which yields the address that hop observed.
3. The proxy headers are always deleted from the request afterwards, so nothing downstream can read them.

**Consumers:**

- A `@ClientIp()` parameter decorator replaces the 8 controller call sites.
- Audit entries and rate-limit keys use the same value.

**Configuration:**

- `env.validation.ts` validates the new variables.
- In production, `INTERNAL_PROXY_SECRET` (at least 32 characters) is **required**; startup fails without it
  (fail-closed). In development it is optional, and without it the API simply uses `req.ip`.

**Deployments:**

- `render.yaml`: the same generated secret for the web and API services (Render environment group).
- `docker-compose.prod.yml` / `.env.production.example`: the secret, plus `WEB_TRUSTED_PROXY_HOPS=1` and
  `TRUST_PROXY_HOPS=1`. Caddy 2.x (`caddy:2-alpine`) ignores a client-supplied `X-Forwarded-For` and sets the real peer
  address, because no `trusted_proxies` are configured.

**Why not hop counting alone:** on Render the API receives proxied and direct requests through the same load balancer.
A direct caller can prepend any `X-Forwarded-For` value, so the right position for one path is wrong for the other.
The shared secret distinguishes the two paths; hop counting stays only for the direct path, where it is correct.

**Spoofing analysis:**

| Attacker action                                                            | Result                                                                               |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Sends `X-Forwarded-For: 1.2.3.4` through the web app                       | The proxy drops it; the IP comes from the trusted hop                                |
| Sends `x-sportexus-client-ip: 1.2.3.4` through the web app                 | The proxy drops it                                                                   |
| Calls the API directly with `x-sportexus-client-ip` but without the secret | Ignored; `req.ip` from hop counting is used                                          |
| Calls the API directly with `X-Forwarded-For: 1.2.3.4`                     | With `TRUST_PROXY_HOPS=1`, only the entry added by the trusted load balancer is used |
| Guesses the secret                                                         | 32+ random characters, constant-time comparison                                      |
| Sends a malformed IP in the header                                         | Rejected by `net.isIP`; falls back to `req.ip`                                       |

## 4. Rate limits after Phase 3A

All counters live in Redis. In production the limiter fails closed when Redis is unavailable (existing behaviour).

| Endpoint                              | Key             | Limit                                      | Status                                |
| ------------------------------------- | --------------- | ------------------------------------------ | ------------------------------------- |
| `POST /auth/login`                    | IP + email      | 5 / 15 min                                 | existing (IP becomes correct with S1) |
| `POST /auth/forgot-password`          | email           | 1 / 60 s                                   | existing                              |
| `POST /auth/forgot-password`          | IP + email      | 3 / 15 min                                 | existing                              |
| `POST /auth/resend-verification`      | IP + email      | 3 / 15 min                                 | existing                              |
| `POST /auth/reset-password`           | IP              | **30 / 15 min**                            | **new**                               |
| `POST /auth/reset-password` (6-digit) | email, per code | **5 failures, then the code is cancelled** | **fixed** (was ineffective)           |
| `POST /auth/reset-password` (6-digit) | email, daily    | **20 failures / 24 h**                     | **new**                               |

## 5. Files

| Layer  | File                                                                                                                                            | Change                                                             |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Shared | `packages/shared/src/schemas/auth.ts` (+ test)                                                                                                  | `email` on the reset request; required for 6-digit codes           |
| DB     | `packages/database/prisma/migrations/2026111…_bind_password_reset_code_to_email/migration.sql`                                                  | new (section 6)                                                    |
| DB     | `packages/database/scripts/provision-runtime-role.sql`, `packages/database/tests/runtime-role-setup.sql`                                        | grant EXECUTE on the 2 functions                                   |
| API    | `backend/src/modules/auth/auth.service.ts` (+ tests)                                                                                            | K1 logic, K13                                                      |
| API    | `backend/src/modules/auth/token.service.ts` (+ tests)                                                                                           | `revokeOtherUserTokens`                                            |
| API    | `backend/src/modules/auth/auth.controller.ts`                                                                                                   | `@ClientIp()`, pass the current refresh cookie to `changePassword` |
| API    | `backend/src/common/client-ip.middleware.ts`, `backend/src/common/decorators/client-ip.decorator.ts` (+ tests)                                  | new (S1)                                                           |
| API    | `backend/src/main.ts`, `backend/src/config/env.validation.ts`, `app-config.service.ts` (+ tests)                                                | trust proxy, new variables                                         |
| Web    | `frontend/src/app/v1/[...path]/route.ts` (+ tests)                                                                                              | header stripping, client IP, proxy auth                            |
| Web    | `frontend/src/app/forgot-password/page.tsx`, `frontend/src/app/reset-password/page.tsx`, `features/auth/password-reset-validation.ts` (+ tests) | send `email`                                                       |
| Deploy | `render.yaml`, `docker-compose.prod.yml`, `.env*.example`                                                                                       | new variables                                                      |
| Docs   | `BUSINESS_LOGIC.md`, `SYSTEM_ARCHITECTURE.md`, `DEVELOPMENT_STATUS.md`                                                                          | rules and architecture                                             |

**Not changed:**

- the existing SQL functions;
- the 6-digit code and 5-minute expiry;
- the email templates;
- the login and forgot-password limits;
- the response shapes, apart from the documented new 400 for a 6-digit code without an email.

## 6. Migration SQL (complete)

Additive only. No table, column, index, constraint, policy or row is touched; the existing functions are unchanged.

```sql
-- K1 — Bind 6-digit password-reset codes to the account e-mail.
-- ADDITIVE ONLY. Existing request_password_reset(...) and complete_password_reset(text, text) are
-- unchanged; the latter keeps serving 256-bit activation links (no e-mail, not guessable).
--
-- Rollback (Prisma has no down-migrations):
--   DROP FUNCTION IF EXISTS public.complete_password_reset_for_email(text, text, text);
--   DROP FUNCTION IF EXISTS public.invalidate_password_reset_for_email(text);
--   DELETE FROM _prisma_migrations WHERE migration_name = '<this migration name>';

CREATE OR REPLACE FUNCTION public.complete_password_reset_for_email(
  p_email text,
  p_token_hash text,
  p_new_password_hash text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'EMAIL_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_token_hash IS NULL OR trim(p_token_hash) = '' THEN
    RAISE EXCEPTION 'TOKEN_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_new_password_hash IS NULL OR trim(p_new_password_hash) = '' THEN
    RAISE EXCEPTION 'PASSWORD_REQUIRED' USING ERRCODE = '22023';
  END IF;

  UPDATE public.users
  SET password_hash = p_new_password_hash,
      password_reset_token = NULL,
      password_reset_expires_at = NULL,
      updated_at = now()
  WHERE lower(trim(email)) = lower(trim(p_email))
    AND password_reset_token = p_token_hash
    AND password_reset_expires_at > now()
  RETURNING id INTO v_user_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_OR_EXPIRED_TOKEN' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.refresh_tokens
  SET is_revoked = true
  WHERE user_id = v_user_id;

  RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.invalidate_password_reset_for_email(
  p_email text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN;
  END IF;

  UPDATE public.users
  SET password_reset_token = NULL,
      password_reset_expires_at = NULL,
      updated_at = now()
  WHERE lower(trim(email)) = lower(trim(p_email))
    AND password_reset_token IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_password_reset_for_email(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invalidate_password_reset_for_email(text) FROM PUBLIC;

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['academy_runtime', 'academy_runtime_ci', 'sportexus_app'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.complete_password_reset_for_email(text, text, text) TO %I', r);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.invalidate_password_reset_for_email(text) TO %I', r);
    END IF;
  END LOOP;
END $$;
```

**Optional K13b migration (only if approved):**

```sql
ALTER TABLE public.users ADD COLUMN password_changed_at timestamptz NULL;
-- Rollback: ALTER TABLE public.users DROP COLUMN password_changed_at;
```

The two reset functions would also set it. That means re-creating them with `CREATE OR REPLACE` and identical
behaviour plus that one assignment, so K13b would not be purely additive.

## 7. Databases, backup and rollback

| Database                     | Used by                               | Migration state                                                                   | Backup method                                                                             |
| ---------------------------- | ------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Neon (dev/test, `us-east-2`) | the running API (`backend/.env`)      | **22 of 23 applied**: `20261104105500_academy_applications_insert_rls` is pending | Neon branch + `pg_dump` (the owner role has BYPASSRLS, so the dump is complete)           |
| Local PostgreSQL 17          | Prisma CLI (`packages/database/.env`) | 23 of 23                                                                          | `pg_dump` as `postgres` superuser (owner action; the app role cannot read FORCE-RLS rows) |

**Important:** `prisma migrate deploy` applies **all** pending migrations. On Neon it would also apply
`20261104105500_academy_applications_insert_rls`, which has a security concern of its own (S4 below). Decide on S4
before migrating Neon.

**Procedure (Neon):**

1. **Neon branch backup** (owner, in the Neon console: Branches → Create branch from `main`, named
   `pre-phase-3a-YYYYMMDD`). It is an instant copy-on-write snapshot, available on the Free plan (10 branches). Neon
   also keeps a 6-hour restore window on Free.
2. **Logical backup:** `pg_dump -Fc` as the owner role into `C:\Users\IT\academy-db-backups\` (outside OneDrive).
   Verified with `pg_restore --list` and row counts per table. Credentials are read from `.env` and never printed.
3. **Apply:** `prisma migrate deploy` against Neon, only after the owner confirms that steps 1 and 2 exist.
4. **Verify:**
   - `migrate status` reports "up to date";
   - both functions exist with the expected grants;
   - an end-to-end reset works on a test account.

**Rollback:**

| Problem        | Rollback                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| Code           | `git revert` of the Phase 3A commits                                                                 |
| Database       | Run the 3 statements in the migration header (drops only the new functions and the migration record) |
| Anything worse | Restore from the Neon branch (console: Branches → Restore) or from the `pg_dump` file                |

## 8. Test plan

All tests are automated (mocked unit tests) unless marked **real**.

**K1: account takeover prevention**

1. A correct 6-digit code with the correct email resets the password and revokes refresh tokens.
2. A correct code with a **different** email (another existing account) fails with the generic error; nothing changes
   for either account.
3. A correct code with an unknown email fails with the same generic error (no enumeration).
4. A 6-digit code without an email returns 400 `VALIDATION_FAILED` (schema).
5. 5 wrong codes for one email: the 6th attempt fails _and_ the real code is cancelled, so the correct code no longer
   works.
6. Wrong codes spread across many freshly requested codes for one email: blocked after 20 failures in 24 hours, even
   when each code was requested fresh.
7. 31 attempts from one IP within 15 minutes, across different emails: the 31st is rate-limited.
8. Guesses against a 64-hex activation token: per-IP limited; a valid activation link still works without an email.
9. An expired code fails the same way as a wrong code.
10. Success clears the per-code counter, but not the daily counter.
11. Redis unavailable in production: requests are refused (fail-closed), not unlimited.
12. **Real (Neon, after migration):** the full forgot → email code → reset flow on a test account. Afterwards the old
    password fails, the new one works, and existing sessions are revoked.

**K13** 13. A password change revokes every other refresh-token family of the user and keeps the current one. 14. With no or an unknown refresh cookie, all families are revoked. 15. A wrong current password changes nothing. 16. **Real:** sign in on two browsers, change the password on one; the other loses its session at the next refresh, or
immediately with K13b.

**S1: IP spoofing** 17. Proxy: client `X-Forwarded-For`, `X-Real-IP`, `Forwarded` and `x-sportexus-*` headers are never forwarded as-is. 18. Proxy: with `WEB_TRUSTED_PROXY_HOPS=1`, the client IP is the entry added by the trusted hop. A forged left-most
entry is ignored. 19. API: a valid secret plus a valid IP header is used. A missing or wrong secret is ignored; the IP falls back to
`req.ip`. 20. API: a valid secret with a malformed IP is ignored. 21. API: a direct call with a forged `X-Forwarded-For` and `TRUST_PROXY_HOPS=1` yields the load balancer's observed
peer. 22. API: the proxy headers are removed after the middleware runs. 23. Config: production without `INTERNAL_PROXY_SECRET` fails startup (fail-closed). 24. Rate limits and audit entries receive the resolved IP (controller and decorator tests). 25. **Real (local stack):** two requests through the web proxy with different forged headers count toward the same IP
bucket.

**Regression:** all existing suites (backend 273, frontend 333, shared 44, database 10), type check (now including
tests), lint, format, both production builds, and the clean-clone install-and-build check.

## 9. Related findings (reported, not part of Phase 3A unless approved)

| #   | Finding                                                                                                                                                                                                                                                                                  | Recommendation                                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| S2  | `render.yaml` staging `CORS_ORIGIN` includes `*.pages.dev`, so **any** Cloudflare Pages site can make credentialed requests to the staging API. The production guard rejects only a bare `*`.                                                                                            | Replace with the exact staging origin, and reject wildcard sub-domains in production.                                             |
| S3  | The API connects to Neon as `neondb_owner`, which has **BYPASSRLS**. Tenant row-level security is therefore not enforced in that environment, even though the restricted `sportexus_app` role exists. The production guard rejects only the user names `postgres`, `academy` and `root`. | Connect as `sportexus_app`, keep the owner for migrations only, and reject BYPASSRLS roles at startup.                            |
| S4  | Pending migration `20261104105500` adds a `SELECT` policy `... OR (current_app_user_id() IS NULL AND status = 'PENDING_REVIEW')`. Any query running without a user context can read **all** pending academy applications, including applicant contact data.                              | Before applying it to Neon, add a follow-up migration that narrows the policy. The applied migration cannot be edited (checksum). |
| I1  | Attendance contract drift: the frontend types `recordAttendance` as `AttendanceRosterItem` and the bulk result as `{ count, updated }`; the API returns `{ record, previousStatus }` and `{ count, records }`. The session page works around this with casts.                            | Shared response types (Phase 4/5).                                                                                                |

## 10. Decisions needed

1. **Approve K1 + K13 + S1** as designed, including the new 400 for a 6-digit code without an email.
2. **Approve the rate-limit values:** 30 / 15 min per IP; 5 per code; 20 / 24 h per account.
3. **K13b**, immediate access-token invalidation (extra column): yes or no.
4. **Migrations:**
   - apply to **Neon**, local, or both;
   - and how to handle S4 first: a follow-up tightening migration (recommended), or apply as-is.
5. **Backups:**
   - the owner creates the Neon branch, or authorises it;
   - the owner runs the local `postgres` dump, or we skip local, since the API does not use it.
6. **Whether S2 and S3 join Phase 3A or wait for a later phase.**
