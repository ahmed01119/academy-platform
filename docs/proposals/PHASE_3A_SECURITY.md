# Phase 3A proposal (revision 2): security hardening

> **Revision 3 addendum (2026-11-15):** see `PHASE_3A_SECURITY_DETAILS.md`. It records the owner’s preliminary decisions,
> corrects this document (26 context-free queries, not 21; refresh-token versioning; link token in the URL fragment; new
> finding S5) and adds the S3/S4 details, migration safety, test strategy and session-invalidation analysis. Where the two
> differ, the addendum takes precedence.

> **Status: proposal, awaiting owner approval. Nothing is implemented, and no migration has been created in the
> repository or applied.**
> Revision 2 (2026-11-15) replaces revision 1 and includes the owner's review decisions.
> Branch: `frontend-architecture-uiux-audit` (not pushed).

## 0. Summary

| Sub-phase | Issues                                                                       | Database migration |
| --------- | ---------------------------------------------------------------------------- | ------------------ |
| 3A.1      | K1 (password reset), K13 + K13b (session revocation), S1 (trusted client IP) | M1                 |
| 3A.2      | S4 (academy-application RLS), S3 (runtime role instead of database owner)    | M2, M3             |
| 3A.3      | S2 (explicit trusted origins)                                                | none               |
| 3A.4      | Security regression and integration testing                                  | none               |

**What changed from revision 1:**

- **K1:** the per-account daily lockout is **dropped**. Instead:
  - every reset email carries an unguessable link in addition to the 6-digit code;
  - only _code entry_ is ever restricted;
  - an attacker can therefore never block a user from resetting through the link.
- **K13b:** a `session_version` counter, not a timestamp. It has no clock-skew edge cases and costs no extra queries.
- **S3 and S4:** investigated in depth. Both depend on application code that queries row-level-security tables
  **without setting a user context**. That works today only because the API connects as the database owner, which
  bypasses RLS. They must be fixed together, in code and in the database.
- **S2:** risk re-assessed. Browsers only ever call the same-origin `/v1` proxy, and cookies are `SameSite=Lax`, so
  this is a defense-in-depth gap, not an open door. It is still fixed.

---

## 1. K1: password reset

### Root cause (verified)

1. **The counter is keyed by the guess.** The attempt counter key is `ratelimit:reset-password-attempts:<hash of the
submitted code>`, so every guess gets a fresh counter.
2. **The code is not bound to an email.** `complete_password_reset(text, text)` matches any user's pending code.
3. **There is no per-IP limit.**
4. **The "invalidate after 5 failures" step can never succeed.** It runs a direct `UPDATE … WHERE password_reset_token
= <hash of the guess>`. It also uses a column the runtime role may not update.
5. **The emailed link contains the 6-digit code itself** (`/reset-password?token=<code>&email=…`), which places the
   code in browser history and server logs.

Impact: an attacker who knows an email address can take over the account.

### Why revision 1's daily cap was rejected, and the replacement

A per-account failure cap stops brute force, but it lets anyone who knows an email exhaust the cap and block the real
user. Revision 2 removes the conflict by giving the legitimate user a second way in that **cannot be guessed and is
never counted**: the emailed link. Every reset email contains both:

| Credential       | Format                                                      | Who uses it                            | Brute-force exposure  | Can an attacker block it?                                      |
| ---------------- | ----------------------------------------------------------- | -------------------------------------- | --------------------- | -------------------------------------------------------------- |
| **Link**         | 256-bit random token (64 hex characters), stored as SHA-256 | the user clicks it                     | none (2^256 space)    | **No.** Not subject to per-account counters; per-IP limit only |
| **6-digit code** | as today, 5-minute expiry                                   | typed manually, e.g. on another device | guessable, so limited | Only code _entry_ can be suspended; the link keeps working     |

### Final limits

| Control                            | Value                                                                                                               | Scope                               | Notes                                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code expiry                        | 5 minutes                                                                                                           | per code                            | unchanged (approved)                                                                                                                                  |
| Wrong attempts per code            | **5**, then the code is cancelled                                                                                   | per code                            | approved. Cancels **only the code**: the link from the same email stays valid until it expires. Otherwise 5 wrong guesses would kill the user's link. |
| Code-entry suspension              | after **10** failed code attempts in a rolling 24 h, code entry is refused for that account until the window passes | per account                         | **Not reset by requesting new codes** (approved principle). The link path is unaffected.                                                              |
| Reset attempts per IP              | **30 / 15 min**                                                                                                     | per client IP (IPv6 grouped by /64) | covers both the code and the link paths. Relies on S1.                                                                                                |
| Reset requests per account         | 60 s between requests; after **3 requests in 1 h**, at least **5 min** between requests                             | per email                           | the 5-minute step equals the code lifetime, so an attacker cannot repeatedly replace a user's still-valid email                                       |
| Reset requests per IP + email      | 3 / 15 min                                                                                                          | existing                            | unchanged                                                                                                                                             |
| Reset requests per IP (all emails) | **10 / hour**                                                                                                       | per client IP                       | new; prevents spraying many accounts from one IP                                                                                                      |

**Security implications:**

- **Brute force:** at most 10 code guesses per account per 24 h, so P(success) ≤ 10 / 1,000,000 = **0.001 % per
  day**. Each guess also requires the attacker to trigger reset emails, which go to the victim.
  - A stricter alternative is a suspension threshold of **5** (≤ 0.0005 %/day). The cost is that a user who mistypes
    5 times must use the link. _Owner choice; 10 is recommended._
- **Denial of service:** an attacker who knows an email can at most:
  - (a) suspend _code entry_ for that account for 24 h (the link still works);
  - (b) slow reset _requests_ to one per 5 minutes.

  They cannot lock the account, block sign-in with the current password, or block a link-based reset.

- **Enumeration:**
  - `forgot-password` always returns the same generic message, and its cooldowns are keyed by the submitted email
    whether or not an account exists;
  - every reset failure (unknown email, wrong or expired or cancelled code, suspended code entry) returns the same
    `400 TOKEN_INVALID` message: _"The code or link is invalid or has expired. Use the link from your most recent
    email, or request a new one."_;
  - the database function is called for unknown emails too, so response timing does not reveal account existence.

### Solution, step by step

**Email (`EmailService.sendPasswordReset`):** the link becomes
`/reset-password?token=<64-hex link token>&email=<email>`; the 6-digit code is shown separately. The template's
wording and layout do not change.

**`forgotPassword`:**

1. Generate the code and a link token.
2. Store both SHA-256 hashes via the new `request_password_reset_with_link(...)`.
3. Apply the issuance limits from the table above.

**`resetPassword`:**

1. Per-IP limit.
2. Route by token shape:
   - **6 digits:** requires `email` (schema). Check code-entry suspension; increment the per-code and 24-hour
     counters; call `complete_password_reset_for_email`. On the 5th failure for this code, call
     `invalidate_password_reset_code_for_email`, which clears only the code.
   - **64 hex:** try `complete_password_reset_by_link`. If that fails, fall back to the existing
     `complete_password_reset(text, text)`, which keeps serving platform staff **activation** links. Those are also
     64-hex tokens stored in the code column.
3. **On success:** clear the per-code counter (not the 24-hour one). Sessions are invalidated (see K13b).

**Contract (`ResetPasswordRequestSchema`):** `email` is optional in the type, and required by a refinement when
`token` is 6 digits.

**Frontend:**

- `/forgot-password` sends the email typed in step 1.
- `/reset-password` sends the `email` query parameter.
- The generic error text is used.

### Files

| File                                                                                                                                                         | Change                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| `packages/shared/src/schemas/auth.ts` (+ test)                                                                                                               | `email` and the 6-digit refinement |
| `backend/src/modules/auth/auth.service.ts` (+ tests)                                                                                                         | `forgotPassword`, `resetPassword`  |
| `backend/src/modules/email/email.service.ts` (+ test)                                                                                                        | reset link carries the link token  |
| `frontend/src/app/forgot-password/page.tsx`, `frontend/src/app/reset-password/page.tsx`, `frontend/src/features/auth/password-reset-validation.ts` (+ tests) | send `email`; generic error        |
| `packages/database/prisma/migrations/<M1>/migration.sql`                                                                                                     | section 6                          |
| `packages/database/scripts/provision-runtime-role.sql`, `packages/database/tests/runtime-role-setup.sql`                                                     | grants                             |

### Backward compatibility

- **Reset emails already sent** with the old `?token=<code>&email=` link: the token is 6 digits and the email is
  present, so they take the code path and keep working until they expire (5 minutes).
- **Platform activation links** (64 hex, no email): handled by the unchanged legacy function.
- **API:** the only new error is a 6-digit code without an email (400). Our own frontend always sends the email.

### Tests (automated, mocked unless noted)

1. Correct code + correct email: succeeds; sessions invalidated.
2. Correct code + another existing account's email: generic error; neither account changes.
3. Correct code + unknown email: same generic error.
4. 6-digit code without email: `400 VALIDATION_FAILED`.
5. 5 wrong codes: the code is cancelled and the correct code fails afterwards; **the link from the same email still
   works**.
6. 10 failures spread over several fresh codes in 24 h: code entry is refused (generic error) even with the correct
   code; **the link still works**.
7. A new code request does not reset the 24-hour counter.
8. 31 attempts from one IP across different emails: the 31st is limited. An IPv6 /64 counts as one bucket.
9. A valid link without an email succeeds. A wrong link fails with the generic error and is per-IP limited.
10. A platform activation link (legacy) still works.
11. Expired code or link: generic error.
12. Issuance: after 3 requests in an hour the next request needs 5 minutes; the response is generic either way.
13. Redis unavailable in production: refused (fail-closed).
14. **Real (Neon, after M1):** forgot → link → reset; forgot → code → reset; old password fails; other sessions die.

### Rollback

`git revert` of the 3A.1 commits, plus the M1 rollback block. Codes and links issued in between become invalid; users
simply request a new email.

---

## 2. K13 + K13b: session revocation

### Root cause

- `changePassword` updates the hash, but never revokes refresh tokens.
- Neither change nor reset affects **access** tokens. These are stateless 15-minute JWTs, so a stolen access token
  keeps working for up to 15 minutes after a password change or reset.

### Solution

1. **`users.session_version integer NOT NULL DEFAULT 0`** (migration M1).
2. **Access tokens carry `sv`** (the user's `session_version` at issuance), set in `TokenService`.
3. **`JwtStrategy.validate`** already loads the user on every request. It rejects the token with `401 UNAUTHORIZED`
   when `payload.sv ?? 0 !== user.sessionVersion`.
4. **Password change:** one transaction does all of the following:
   - updates the hash;
   - increments `session_version`;
   - revokes **all** refresh-token families.

   Then a **fresh token pair is issued to the current device** in the same response. The current session continues
   ("preserve the current session where appropriate"); every other device and every older access token stop working
   immediately.

5. **Password reset** (by code, link or activation): the SQL functions increment `session_version` and revoke all
   refresh tokens. No session is preserved, because the user is not signed in.
6. **Optional reuse (recommended):** platform "suspend user" and "revoke sessions" also increment `session_version`.
   Today they leave a 15-minute access window.

### Why `session_version` rather than a `password_changed_at` timestamp

- A timestamp must be compared with the JWT's `iat`, which has 1-second resolution and comes from the API's clock,
  while the timestamp comes from the database's clock. That produces edge cases around the exact second of the change.
- An integer version is exact.

### Performance

- **Zero additional queries.** The strategy already performs one user lookup per authenticated request; the check is
  one integer comparison on a column that lookup already returns.
- Token size grows by about 8 bytes.
- The increment is part of the existing password `UPDATE`.

### Files

| File                                                                       | Change                                                      |
| -------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `backend/src/modules/auth/token.service.ts` (+ test)                       | `sv` claim; revoke all families                             |
| `backend/src/modules/auth/guards/jwt.strategy.ts` (+ test)                 | version check                                               |
| `backend/src/modules/auth/auth.service.ts`, `auth.controller.ts` (+ tests) | change-password flow, fresh cookies for the current device  |
| `backend/src/modules/platform/platform.service.ts` (+ test)                | optional reuse for suspend / revoke                         |
| M1                                                                         | the column, and the version bump inside the reset functions |

### Backward compatibility

- Tokens issued before the deploy have no `sv`, which is treated as `0`, and every existing user has version `0`. So
  **no one is signed out by the deploy itself**; old tokens are rejected only after that user's next password change
  or reset.
- API responses are unchanged, except that change-password also sets new cookies.

### Tests

15. A password change invalidates other refresh families **and** previously issued access tokens (strategy rejects
    the old `sv`); the current device receives working new tokens.
16. A wrong current password changes nothing (version unchanged).
17. A reset (code, link or activation) increments the version, and all old tokens are rejected.
18. Tokens without `sv` are accepted while the version is 0.
19. _(If approved)_ suspend and revoke-sessions reject access tokens immediately.
20. **Real:** two browsers; change the password in one; the other is rejected on its **next request**, not after 15
    minutes.

### Rollback

Revert the code. The column is harmless if left in place; dropping it is in the M1 rollback block.

---

## 3. S1: trusted client IP

### Root cause (verified)

- Express `trust proxy` is unset, and every browser request arrives through the Next.js `/v1` proxy. `req.ip`
  therefore holds the proxy's address for every user, which breaks audit logs and every per-IP limit.
- The proxy forwards the client's own `X-Forwarded-For`.
- The API is also reachable **directly** (`API_DOMAIN` through Caddy; its own public URL on Render), so trusting
  `X-Forwarded-For` would let any caller set an arbitrary IP.

### Solution

**Next.js proxy (`frontend/src/app/v1/[...path]/route.ts`):**

1. **Remove** client-supplied identity headers: `x-forwarded-for`, `x-real-ip`, `forwarded`, `true-client-ip`,
   `cf-connecting-ip`, and every `x-sportexus-*` header.
2. **Determine the real client IP itself** from the inbound `X-Forwarded-For`, using `WEB_TRUSTED_PROXY_HOPS`:
   - the number of trusted proxies in front of the web app;
   - `1` behind Caddy or Render, because Caddy overwrites untrusted client values and Render appends the real peer;
   - the IP is the entry _hops_ positions from the right, which the client cannot forge;
   - `0` (development) means no forwarded IP.
3. **Attach** `x-sportexus-client-ip: <ip>` and `x-sportexus-proxy-auth: <INTERNAL_PROXY_SECRET>`.
4. **Fail safe:** in production, `INTERNAL_PROXY_SECRET` and `WEB_TRUSTED_PROXY_HOPS` must be set, or every `/v1`
   request returns `500` with a configuration error (the same pattern as the existing `INTERNAL_API_URL` check).

**API (`backend/src/common/client-ip.middleware.ts`, registered first in `main.ts`):**

1. Compare `x-sportexus-proxy-auth` with `INTERNAL_PROXY_SECRET` (`crypto.timingSafeEqual`, equal-length buffers).
   **Only if it matches** and `x-sportexus-client-ip` passes `net.isIP`, use that value.
2. Otherwise use `req.ip`, with Express `trust proxy` = `TRUST_PROXY_HOPS`:
   - default `0`, meaning the socket address;
   - `1` behind Caddy or Render, meaning the address that hop observed.

   `X-Forwarded-For` is **never** read directly; only Express's hop-limited parsing is used, so it is never trusted
   blindly.

3. Delete both `x-sportexus-*` headers from the request, and store the result as `req.clientIp`.
4. A `@ClientIp()` decorator replaces the 8 `req.ip || req.socket.remoteAddress` call sites in `auth.controller.ts`.
   Audit entries and all rate-limit keys use it. IPv6 addresses are grouped by /64 for rate limiting.

**Configuration (`env.validation.ts`):** in production, which also covers **staging**, because Render staging runs
`NODE_ENV=production`, startup fails when:

- `INTERNAL_PROXY_SECRET` is missing or shorter than 32 characters;
- `TRUST_PROXY_HOPS` is not an integer between 0 and 3.

**Deployments:**

- `render.yaml`: an environment group shared by web and API, holding the generated secret, with
  `TRUST_PROXY_HOPS=1` and `WEB_TRUSTED_PROXY_HOPS=1`.
- `docker-compose.prod.yml` and `.env*.example`: the same variables.

**Development:** no secret is needed; the API uses the socket address (127.0.0.1).

### Files

| File                                                                                                           | Change                                                      |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `frontend/src/app/v1/[...path]/route.ts` (+ test)                                                              | header removal, client IP, proxy auth, production fail-safe |
| `backend/src/common/client-ip.middleware.ts`, `backend/src/common/decorators/client-ip.decorator.ts` (+ tests) | new                                                         |
| `backend/src/main.ts`, `backend/src/config/env.validation.ts`, `app-config.service.ts` (+ tests)               | trust proxy, new variables                                  |
| `backend/src/modules/auth/auth.controller.ts`                                                                  | `@ClientIp()`                                               |
| `render.yaml`, `docker-compose.prod.yml`, `.env.example`, `.env.production.example`, `.env.staging.example`    | new variables                                               |

### Security implications

Per-IP limits become real, and audit logs record actual clients. The secret only authenticates the web proxy to the
API: it is never sent to browsers and is never logged.

### Backward compatibility

- No API contract change.
- **Deployments must add the new variables, or production and staging will refuse to start.** That is intended:
  fail-safe.

### Explicit IP-spoofing tests

21. **Through the proxy:** a client sends `X-Forwarded-For: 1.2.3.4`, `X-Real-IP`, `Forwarded`, `True-Client-IP`,
    `CF-Connecting-IP`, `x-sportexus-client-ip` and `x-sportexus-proxy-auth`. **None** is forwarded as-is; the
    forwarded IP is the trusted-hop value.
22. **Through the proxy:** with `X-Forwarded-For: <forged>, <real-from-LB>` and hops = 1, the result is
    `<real-from-LB>`.
23. **Direct to the API:** `x-sportexus-client-ip: 1.2.3.4` without a secret, or with a wrong one, is ignored; the IP
    is `req.ip`.
24. **Direct to the API:** a correct secret with a malformed IP (`1.2.3.4; drop`, `::ffff:999.1.1.1`, an empty value)
    is ignored.
25. **Direct to the API:** a forged `X-Forwarded-For` with `TRUST_PROXY_HOPS=1` yields the load balancer-observed
    peer; with `0`, the socket address.
26. **Secret comparison:** constant-time; a shorter or longer guess never throws; the length check precedes the
    comparison.
27. The `x-sportexus-*` headers are absent from the request after the middleware runs.
28. **Production config:** a missing or short secret fails startup (API) and makes the proxy return 500 (web).
29. **Rate limiting:** 30 requests with 30 different forged headers through the proxy fall into **one** IP bucket.
30. **Real (local stack: web + API):** tests 21 and 29 end-to-end.

### Rollback

Revert the commits and remove the new variables. With the variables removed, behaviour returns to today's.

---

## 4. S4: public read access to pending academy applications

### Root cause (verified)

- Pending migration `20261104105500_academy_applications_insert_rls` was applied locally, but **not on Neon**. It
  creates:
  - `INSERT … WITH CHECK (status = 'PENDING_REVIEW')`, which lets anyone insert an application **for any
    applicant**;
  - `SELECT … USING (applicant_user_id = current_app_user_id() OR (current_app_user_id() IS NULL AND status =
'PENDING_REVIEW'))`, which lets **any query running without a user context read every pending application**,
    including applicants' contact emails and phone numbers.
- **Why it was written:** registration (`AuthService.register`), the slug-availability loop, login gating and the
  public application endpoint (`PlatformService` ~line 1397) query `academy_applications` through the plain Prisma
  client, **with no user context set**. Under a restricted role those queries need exactly these over-broad policies.
  Today they work only because the API runs as the owner, which bypasses RLS (S3).
- **Further defect found:** under correct policies, **login gating** (`findFirst` by `applicantUserId`, no context)
  would see nothing. Rejected or pending applicants would then not be blocked. And even under 104105500, only
  `PENDING_REVIEW` rows are visible, so `REJECTED` and `MORE_INFO_REQUESTED` applicants would pass the gate.

**Exposure today:** no current endpoint returns another applicant's application. The over-broad policy is a latent
defense-in-depth failure: any future or unintended context-free query would leak all pending applicants. It becomes
live in every runtime-role deployment (CI, self-hosting, and Neon after S3).

### Solution: code and database together

**Code:** every `academy_applications` access runs with an explicit context.

- **Register:**
  1. inside the transaction, create the user (the `users` table has no RLS);
  2. call `set_config('app.actor_user_id', <new user id>, true)`;
  3. create the application.

  The `INSERT` check (`applicant_user_id = current_app_user_id()`) and the `RETURNING` (applicant `SELECT` policy)
  both pass for the user's **own** row only. The same applies to the public application endpoint.

- **Login gating:** runs in `withAuthLookupTransaction({ actorUserId: user.id })` after the password is verified. The
  user sees all their own applications, whatever the status, which fixes the gating gap.
- **Slug availability:** a `SECURITY DEFINER` function `academy_slug_in_use(slug) RETURNS boolean` checks tenants and
  pending or approved applications. It reveals only availability, which is inherently public.
- **Platform admin list and review:** already use `withPlatformAdminTransaction`; unchanged.

**Database:** corrective migration **M2**, ordered after 104105500.

### Migration M2 (complete)

```sql
-- S4: academy_applications RLS - remove anonymous access introduced by 20261104105500.
-- Final policy set:
--   academy_applications_platform_admin (unchanged): FOR ALL, super admins / platform owners
--   academy_applications_applicant: SELECT own rows only (any status)
--   academy_applications_insert:    INSERT own PENDING_REVIEW application only
DROP POLICY IF EXISTS academy_applications_applicant ON public.academy_applications;
CREATE POLICY academy_applications_applicant ON public.academy_applications
  FOR SELECT TO PUBLIC
  USING (applicant_user_id = public.current_app_user_id());

DROP POLICY IF EXISTS academy_applications_insert ON public.academy_applications;
CREATE POLICY academy_applications_insert ON public.academy_applications
  FOR INSERT TO PUBLIC
  WITH CHECK (
    status = 'PENDING_REVIEW'
    AND applicant_user_id = public.current_app_user_id()
  );

-- Slug availability without exposing application rows.
CREATE OR REPLACE FUNCTION public.academy_slug_in_use(p_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.tenants WHERE slug = lower(trim(p_slug)))
      OR EXISTS (
        SELECT 1 FROM public.academy_applications
        WHERE academy_slug = lower(trim(p_slug))
          AND status IN ('PENDING_REVIEW', 'MORE_INFO_REQUESTED', 'APPROVED')
      );
$$;
REVOKE ALL ON FUNCTION public.academy_slug_in_use(text) FROM PUBLIC;
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['academy_runtime', 'academy_runtime_ci', 'sportexus_app'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.academy_slug_in_use(text) TO %I', r);
    END IF;
  END LOOP;
END $$;

-- Rollback: recreate the two policies exactly as in 20261104105500 (NOT recommended) or as in
-- 20261023180000 (applicant SELECT own rows, no INSERT policy), and
-- DROP FUNCTION IF EXISTS public.academy_slug_in_use(text);
```

### Access verification (SQL tests, run as the runtime role on a Neon test branch and in CI)

| Context                                        | SELECT                                      | INSERT                                             |
| ---------------------------------------------- | ------------------------------------------- | -------------------------------------------------- |
| Anonymous (no actor)                           | **0 rows** (was: every pending application) | denied                                             |
| Authenticated applicant A                      | own applications, any status                | own `PENDING_REVIEW` only; for applicant B: denied |
| Authenticated, not an applicant (staff, coach) | 0 rows                                      | denied, except their own                           |
| Platform super admin / owner                   | all                                         | all (unchanged)                                    |
| Status forging (applicant inserts `APPROVED`)  | —                                           | denied                                             |

**Workflow tests:** registration end to end; slug collision (second registration with the same academy name gets
`-1`); login gating for `PENDING_REVIEW`, `MORE_INFO_REQUESTED` and `REJECTED`; platform list, review and approve.

### Backward compatibility

No API change.

### Rollback

Revert the code, and run the M2 rollback block. Do not restore the anonymous clause.

---

## 5. S3: the API connects as the database owner (RLS bypassed)

### Root cause (verified, read-only)

- `backend/.env` connects as `neondb_owner`: the owner of all 34 tables, with `BYPASSRLS = true`. Row-level security
  on 31 tables, including the 21 FORCE tables, is therefore **not enforced** for the API on Neon.
- The intended runtime role **`sportexus_app` exists** and is correctly restricted:
  - not a superuser;
  - `BYPASSRLS = false`;
  - no `CREATE` on the schema;
  - table and column grants on 33 tables;
  - 18 executable functions (11 of them `SECURITY DEFINER`).
- The production guard rejects only the user names `postgres`, `academy` and `root`, so an owner or BYPASSRLS role
  passes.

### Audit: what would break if the connection string were simply switched

| #   | Area                                                                                                                                                          | Finding                                                                                                                                                      | Fix                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a   | 21 direct `this.prisma.<model>` calls on RLS tables **without a user context**: audit (1), auth (4), finance (1), notifications (8), platform (3), portal (4) | under RLS these return **no rows** or are denied, for example notifications, public academy list, membership lookups, audit writes                           | wrap each in the correct context helper (`withTenantTransaction`, `withAuthLookupTransaction`, `withPortalUserTransaction`, `withPlatformAdminTransaction`), or use a narrowly scoped `SECURITY DEFINER` function                                                         |
| b   | `users` INSERT is granted on only 7 columns                                                                                                                   | registration sets `isEmailVerified: false`; platform invites set `isPlatformSuperAdmin`, `isPlatformOwner`, `mustResetPassword`, so they would be **denied** | registration: omit the field (database default `false`). Invites: a `SECURITY DEFINER` function `platform_create_user(...)` that checks `is_current_user_super_admin()` (and `is_current_user_platform_owner()` for the owner flag)                                       |
| c   | `tenants` has no INSERT grant                                                                                                                                 | **academy approval** (`tx.tenant.create` in `PlatformService`) would be denied                                                                               | `GRANT INSERT ON tenants`. The existing `tenants_platform_super_admin` policy (`FOR ALL USING is_current_user_super_admin()`) also acts as the insert check, so only super admins can insert                                                                              |
| d   | direct `UPDATE users SET password_reset_token…`                                                                                                               | denied (column not granted)                                                                                                                                  | removed by K1                                                                                                                                                                                                                                                             |
| e   | `users` readable on all 21 columns, including token hashes                                                                                                    | a hardening gap, not a breakage                                                                                                                              | **follow-up** (not in 3A): column-level `SELECT` restriction requires explicit Prisma `select`/`omit` everywhere `users` is read                                                                                                                                          |
| f   | background jobs and scheduled tasks                                                                                                                           | **none exist**: no cron, intervals or queues; email is sent inline                                                                                           | nothing to migrate; confirmed by code search                                                                                                                                                                                                                              |
| g   | migrations and Prisma CLI                                                                                                                                     | must keep using the owner                                                                                                                                    | `DATABASE_URL` = `sportexus_app` (pooled) for the API. `DATABASE_ADMIN_URL` / `DIRECT_URL` = owner (direct, non-pooled) for `prisma migrate` only. `docker-entrypoint.sh` already uses `DATABASE_ADMIN_URL`; `prisma.config.ts` will prefer `DIRECT_URL` for CLI commands |
| h   | startup safety                                                                                                                                                | —                                                                                                                                                            | the API queries `rolsuper`, `rolbypassrls` and table ownership for `current_user` at boot. **Production and staging refuse to start** if the role is a superuser, has BYPASSRLS, or owns tables. Development logs a warning                                               |

### Migration M3 (complete)

```sql
-- S3: privileges the runtime role needs for existing workflows (least privilege).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['academy_runtime', 'academy_runtime_ci', 'sportexus_app'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      -- Academy approval creates the tenant; RLS (tenants_platform_super_admin) restricts it to super admins.
      EXECUTE format('GRANT INSERT ON TABLE public.tenants TO %I', r);
      -- K13b: password change / suspension bump the session version.
      EXECUTE format('GRANT UPDATE (session_version) ON TABLE public.users TO %I', r);
    END IF;
  END LOOP;
END $$;

-- Platform staff / invited users with privileged flags, created only by platform administrators.
CREATE OR REPLACE FUNCTION public.platform_create_user(
  p_email text,
  p_name text,
  p_is_platform_super_admin boolean,
  p_is_platform_owner boolean,
  p_must_reset_password boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_current_user_super_admin() THEN
    RAISE EXCEPTION 'PLATFORM_ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_is_platform_owner AND NOT public.is_current_user_platform_owner() THEN
    RAISE EXCEPTION 'PLATFORM_OWNER_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_email IS NULL OR trim(p_email) = '' OR p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'EMAIL_AND_NAME_REQUIRED' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.users (id, email, name, password_hash, is_platform_super_admin,
                            is_platform_owner, must_reset_password, created_at, updated_at)
  VALUES (gen_random_uuid(), lower(trim(p_email)), trim(p_name), 'INVITED_PENDING_ACTIVATION',
          p_is_platform_super_admin, p_is_platform_owner, p_must_reset_password, now(), now())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.platform_create_user(text, text, boolean, boolean, boolean) FROM PUBLIC;
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['academy_runtime', 'academy_runtime_ci', 'sportexus_app'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.platform_create_user(text, text, boolean, boolean, boolean) TO %I', r);
    END IF;
  END LOOP;
END $$;

-- Rollback:
--   REVOKE INSERT ON public.tenants FROM sportexus_app, academy_runtime, academy_runtime_ci;
--   REVOKE UPDATE (session_version) ON public.users FROM sportexus_app, academy_runtime, academy_runtime_ci;
--   DROP FUNCTION IF EXISTS public.platform_create_user(text, text, boolean, boolean, boolean);
```

**Placeholder password value:** `'INVITED_PENDING_ACTIVATION'` is the value `PlatformService` already writes, so
behaviour is unchanged. Whether `gen_random_uuid()` is available (PostgreSQL 13+, built in) is verified on the test
branch.

### Verification plan: the whole application, not just the connection string

1. **Owner actions (credentials never handled by me):**
   - create a Neon branch `s3-runtime-test` from the dev branch;
   - set a password for `sportexus_app` on that branch (Neon console → Roles);
   - put the runtime URL in a local, uncommitted override file.
2. Apply M1–M3 to the **test branch** only, and run the API there as `sportexus_app`.
3. **Automated workflow suite** (new script, `scripts/e2e-runtime-role.mjs`), driving the real API over HTTP:
   - **Accounts and access:** register → verify email (development code) → platform approve → login → switch tenant
     → invite staff → accept invitation.
   - **Academy setup:** branches CRUD; players CRUD, QR rotate and revoke, archive.
   - **Join requests:** submit, then review.
   - **Training:** enrollments and transfer; groups, coaches, members and schedules.
   - **Attendance:** session, QR check-in, card scan, bulk, offline sync, correction, reports.
   - **Evaluations:** templates, evaluations, rankings.
   - **Finance:** plans, subscriptions, payment, reversal, expense, approve and reject, cashier close.
   - **Notifications:** list, read, read-all.
   - **Portal:** claim token, claim, player and guardian views.
   - **Platform console:** metrics, academies, users, audit, security events, storage dry-run, announcements.

   Each step asserts its HTTP status **and** that no `42501` / permission-denied error appears in the API log.

4. **Tenant-isolation suite:** two academies with staff of each role. Every cross-tenant read, update or delete
   attempt by ID returns 404 or 403 and **0 rows**, both through the API and directly in SQL as `sportexus_app` with
   another tenant's context.
5. **Role-privilege suite:** the existing `packages/database/tests/{runtime-role-privileges,tenant-rls,onboarding-and-invitations,audit-append-only}.sql`,
   run against the branch as `sportexus_app`, plus the M2 access matrix.
6. Only when steps 3–5 are clean is the dev `DATABASE_URL` switched, by the owner, followed by the same suite again.

### Rollback

- Switch `DATABASE_URL` back to the owner URL (configuration only).
- Code changes (context wrappers) are correct for both roles and do not need reverting.
- M3 rollback block.

---

## 6. Migration M1 (3A.1, complete)

```sql
-- M1: K1 (bind codes to e-mail, unguessable reset link) and K13b (session version).
-- Adds 2 columns and 5 functions; re-creates complete_password_reset(text,text) with identical
-- behaviour plus the session-version bump. Existing request_password_reset(...) is unchanged
-- (platform activation links keep using it).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS password_reset_link_token text NULL,
  ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;

-- Issue a reset: stores the hash of the 6-digit code AND of the 256-bit link token.
CREATE OR REPLACE FUNCTION public.request_password_reset_with_link(
  p_email text,
  p_code_hash text,
  p_link_hash text,
  p_expires_at timestamptz
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
  IF p_code_hash IS NULL OR trim(p_code_hash) = '' OR p_link_hash IS NULL OR trim(p_link_hash) = '' THEN
    RAISE EXCEPTION 'TOKEN_REQUIRED' USING ERRCODE = '22023';
  END IF;

  UPDATE public.users
  SET password_reset_token = p_code_hash,
      password_reset_link_token = p_link_hash,
      password_reset_expires_at = LEAST(p_expires_at, now() + interval '5 minutes'),
      updated_at = now()
  WHERE lower(trim(email)) = lower(trim(p_email))
  RETURNING id INTO v_user_id;

  RETURN v_user_id; -- NULL for unknown e-mails; the caller responds generically either way
END;
$$;

-- Complete with the 6-digit code; the code must belong to this e-mail.
CREATE OR REPLACE FUNCTION public.complete_password_reset_for_email(
  p_email text,
  p_code_hash text,
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
  IF p_email IS NULL OR trim(p_email) = '' OR p_code_hash IS NULL OR trim(p_code_hash) = '' THEN
    RAISE EXCEPTION 'TOKEN_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_new_password_hash IS NULL OR trim(p_new_password_hash) = '' THEN
    RAISE EXCEPTION 'PASSWORD_REQUIRED' USING ERRCODE = '22023';
  END IF;

  UPDATE public.users
  SET password_hash = p_new_password_hash,
      password_reset_token = NULL,
      password_reset_link_token = NULL,
      password_reset_expires_at = NULL,
      session_version = session_version + 1,
      updated_at = now()
  WHERE lower(trim(email)) = lower(trim(p_email))
    AND password_reset_token = p_code_hash
    AND password_reset_expires_at > now()
  RETURNING id INTO v_user_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_OR_EXPIRED_TOKEN' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.refresh_tokens SET is_revoked = true WHERE user_id = v_user_id;
  RETURN v_user_id;
END;
$$;

-- Complete with the emailed link token (unguessable; not subject to per-account counters).
CREATE OR REPLACE FUNCTION public.complete_password_reset_by_link(
  p_link_hash text,
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
  IF p_link_hash IS NULL OR trim(p_link_hash) = '' THEN
    RAISE EXCEPTION 'TOKEN_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_new_password_hash IS NULL OR trim(p_new_password_hash) = '' THEN
    RAISE EXCEPTION 'PASSWORD_REQUIRED' USING ERRCODE = '22023';
  END IF;

  UPDATE public.users
  SET password_hash = p_new_password_hash,
      password_reset_token = NULL,
      password_reset_link_token = NULL,
      password_reset_expires_at = NULL,
      session_version = session_version + 1,
      updated_at = now()
  WHERE password_reset_link_token = p_link_hash
    AND password_reset_expires_at > now()
  RETURNING id INTO v_user_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_OR_EXPIRED_TOKEN' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.refresh_tokens SET is_revoked = true WHERE user_id = v_user_id;
  RETURN v_user_id;
END;
$$;

-- Cancel ONLY the 6-digit code (after 5 wrong attempts); the link stays valid until it expires.
CREATE OR REPLACE FUNCTION public.invalidate_password_reset_code_for_email(p_email text)
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
      updated_at = now()
  WHERE lower(trim(email)) = lower(trim(p_email))
    AND password_reset_token IS NOT NULL;
END;
$$;

-- Existing function, re-created with identical behaviour plus: session-version bump and clearing
-- the link token. Still serves 64-hex platform activation links.
CREATE OR REPLACE FUNCTION public.complete_password_reset(
  p_token text,
  p_new_password_hash text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_token_hash text;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RAISE EXCEPTION 'TOKEN_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_new_password_hash IS NULL OR trim(p_new_password_hash) = '' THEN
    RAISE EXCEPTION 'PASSWORD_REQUIRED' USING ERRCODE = '22023';
  END IF;

  v_token_hash := encode(sha256(p_token::bytea), 'hex');

  UPDATE public.users
  SET password_hash = p_new_password_hash,
      password_reset_token = NULL,
      password_reset_link_token = NULL,
      password_reset_expires_at = NULL,
      session_version = session_version + 1,
      updated_at = now()
  WHERE (password_reset_token = p_token OR password_reset_token = v_token_hash)
    AND password_reset_expires_at > now()
  RETURNING id INTO v_user_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_OR_EXPIRED_TOKEN' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.refresh_tokens SET is_revoked = true WHERE user_id = v_user_id;
  RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_password_reset_with_link(text, text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_password_reset_for_email(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_password_reset_by_link(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invalidate_password_reset_code_for_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_password_reset(text, text) FROM PUBLIC;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['academy_runtime', 'academy_runtime_ci', 'sportexus_app'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.request_password_reset_with_link(text, text, text, timestamptz) TO %I', r);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.complete_password_reset_for_email(text, text, text) TO %I', r);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.complete_password_reset_by_link(text, text) TO %I', r);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.invalidate_password_reset_code_for_email(text) TO %I', r);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.complete_password_reset(text, text) TO %I', r);
    END IF;
  END LOOP;
END $$;

-- Rollback:
--   DROP FUNCTION IF EXISTS public.request_password_reset_with_link(text, text, text, timestamptz);
--   DROP FUNCTION IF EXISTS public.complete_password_reset_for_email(text, text, text);
--   DROP FUNCTION IF EXISTS public.complete_password_reset_by_link(text, text);
--   DROP FUNCTION IF EXISTS public.invalidate_password_reset_code_for_email(text);
--   Re-create complete_password_reset(text, text) from 20261021040000 (without the two new SET lines).
--   ALTER TABLE public.users DROP COLUMN IF EXISTS password_reset_link_token, DROP COLUMN IF EXISTS session_version;
--   DELETE FROM _prisma_migrations WHERE migration_name = '<M1 name>';
```

**Note on `ADD COLUMN … NOT NULL DEFAULT 0`:** on PostgreSQL 11+ this is a metadata-only change (no table rewrite).
Neon runs PostgreSQL 18.

---

## 7. S2: explicit trusted origins

### Root cause and accurate risk

- Staging `CORS_ORIGIN` is `*.pages.dev,http://localhost:3000`. The same list feeds both CORS (`main.ts`) and the
  CSRF guard's `Origin`/`Referer` check (`csrf.guard.ts`), which accepts any origin ending in `.pages.dev`.
- **Practical risk is limited:**
  - browsers always call the same-origin `/v1` proxy (`config/env.ts`), so the auth cookies belong to the web
    origin;
  - the cookies are `SameSite=Lax`, so cross-site `fetch` and `POST` requests from a foreign page do not carry them.
- **It is still a real gap:** the CSRF check trusts _every_ Cloudflare Pages site. If any environment ever sets
  cookies on the API host, or relaxes SameSite, any `*.pages.dev` page could make authenticated requests.
- **Production** rejects a bare `*` but **accepts `*.` wildcards**, and staging runs `NODE_ENV=production`.

### Solution

- **Policy:** in production and staging, `CORS_ORIGIN` must be a list of **exact** `https://` origins. Wildcard
  entries (`*`, `*.x`) and `http://` origins other than `localhost` **fail startup**.
- **Development** keeps `localhost` and the `*.trycloudflare.com` wildcard used by `start-sportexus.ps1` tunnels. It is
  allowed only when `NODE_ENV=development`.
- **One shared origin-matching function**, used by CORS and CSRF alike. It does exact URL-origin comparison: scheme,
  host and port. No substring or suffix matching outside development.
- **Staging:** `render.yaml` lists the exact staging web origin(s). The owner confirms the exact list; preview
  deployments such as `<hash>.<project>.pages.dev` are **not** allowed unless explicitly listed.
- **CORS hardening:** credentials are only ever combined with an exact-match origin. A request without an `Origin`
  header (server-to-server) stays allowed for CORS; the CSRF guard still demands `Origin`/`Referer` for
  cookie-authenticated mutations, as today.

### Files

`backend/src/main.ts`, `backend/src/modules/auth/guards/csrf.guard.ts`, a new `backend/src/common/trusted-origins.ts`
(+ tests), `backend/src/config/env.validation.ts` (+ test), `render.yaml`, `.env*.example`.

### Backward compatibility

- An environment that relied on a wildcard must list its exact origins, otherwise it refuses to start (fail-safe).
- Local development is unchanged.

### Tests (CSRF and cross-origin)

31. Production config: `*.pages.dev`, `*` or `http://example.com` in `CORS_ORIGIN` fails startup; exact https
    origins pass.
32. CORS: an allowed exact origin gets `Access-Control-Allow-Origin` echoed with credentials. `evil.pages.dev`,
    `https://staging.example.com.evil.com`, a different scheme or a different port get no CORS headers.
33. CSRF: a cookie-authenticated `POST`/`PATCH`/`DELETE` with an untrusted `Origin` gets 403; with no `Origin` and no
    `Referer`, 403; with an untrusted `Referer` and no `Origin`, 403; with a malformed `Referer`, 403; with a trusted
    origin, passes.
34. CSRF: `GET`/`HEAD`/`OPTIONS` and cookie-less requests are unaffected (as today).
35. Development: `*.trycloudflare.com` and `localhost` still work.
36. **Real:** the staging-like local stack (`NODE_ENV=production` build) with an exact origin; login and a mutation
    through the proxy succeed; a forged `Origin` is rejected.

### Rollback

Revert the commits and restore the previous `CORS_ORIGIN` values.

---

## 8. Migration history, Neon state and backup

### Current history (verified, read-only)

- The repository has 23 migrations.
- Neon has **22 applied**; `20261104105500_academy_applications_insert_rls` is **pending**.
- Local PostgreSQL (unused by the API) has all 23. Per the owner's decision, it is not migrated further.

### Handling of the pending migration

**Order on Neon:** `20261104105500` → **M1** → **M2** → **M3**.

- **Recommended:** apply all of them in **one** `prisma migrate deploy` run.
  - The insecure intermediate policy state exists for a few seconds only. Until S3 is switched on, the API connects
    as the owner (BYPASSRLS), so that intermediate state is not reachable at all.
  - The migration history then stays identical to every other environment (CI, self-host), which is the safest
    long-term state.
- **Not recommended:** `prisma migrate resolve --applied 20261104105500` (mark as applied without running it). This
  leaves Neon's history different from what its schema went through.

**Fresh databases** (CI, new self-host installs) run the same sequence; M2 always follows the insecure migration.

### Backup and restore verification (before any migration)

1. **Owner:** create the Neon branch `pre-phase-3a-YYYYMMDD` (a backup, never modified).
2. **Full dump:** `pg_dump -Fc` as the owner role. It is complete because the owner has BYPASSRLS, which I verified.
   - The connection string is read from `backend/.env` inside the script and never printed.
   - The dump goes to `C:\Users\IT\academy-db-backups\` (outside OneDrive and the repository) and is never deleted
     or overwritten (timestamped name).
3. **Readability:** `pg_restore --list`, plus SHA-256 of the file.
4. **Restore test in an isolated environment:**
   - `pg_restore` into a **new, throwaway database** on the local PostgreSQL 17 server (`academy_restore_test`),
     created by the owner or by a role with `CREATEDB`;
   - compare row counts per table with the source;
   - check that functions, policies and grants exist.

   PG 18 → 17 restore compatibility is checked; if it fails, the restore target is a second Neon branch instead.

5. Report: file, size, checksum, table count, row-count comparison. **No data values.**
6. Apply migrations **only after the owner approves the final SQL**.

---

## 9. Execution and test plan (3A.4)

**Order:** 3A.1 → 3A.2 → 3A.3 → 3A.4. Each sub-phase is committed separately, followed by a report and owner review.

**3A.4 regression:**

- everything in 3A.1–3A.3;
- all existing suites (backend 273, frontend 333, shared 44, database 10);
- type check (tests included), lint, format;
- both production builds and the clean-clone build;
- the S3 workflow, isolation and privilege suites;
- a browser smoke test of the main flows;
- **real login** with an owner-provided test account (still outstanding).

**What remains mocked versus real is reported explicitly.**

## 10. Decisions needed before implementation

1. **K1:**
   - approve the link-plus-code design and the limits in §1;
   - choose the code-entry suspension threshold: **10 (recommended)** or 5 per 24 h.
2. **K1 email change:** the reset link carries a link token instead of the code. Layout and wording are unchanged.
3. **K13b:** approve `session_version` (instead of a timestamp), and its optional reuse for suspend / revoke sessions.
4. **S1:**
   - approve the header names and variables;
   - approve that production **and** staging refuse to start without the secret.
5. **S4:** approve M2 and the code changes (explicit contexts and `academy_slug_in_use`).
6. **S3:**
   - approve M3, `platform_create_user` and the startup role guard;
   - the owner creates the `s3-runtime-test` branch and sets the `sportexus_app` password there.
7. **S2:** provide the exact list of legitimate staging and production web origins.
8. **Migration order:** approve the recommended single run on Neon (104105500 → M1 → M2 → M3).
9. **Follow-up (not 3A):** column-level `SELECT` hardening on `users` (item 5e).
