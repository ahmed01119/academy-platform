# Phase 3A: technical details for review (revision 3 addendum)

> **Review-only document.** No application code, migration, credential or runtime connection has been changed.
> It completes `PHASE_3A_SECURITY.md` (revision 2) with the details requested on 2026-11-15 (items A–D) and the
> owner's preliminary decisions. Where it differs from revision 2, **this document takes precedence.**
>
> Facts were gathered read-only from the code and the Neon development database (policy and privilege metadata only,
> no data values).

## Owner's preliminary decisions (recorded)

| Item       | Decision                                                                                                                                   | Still requires                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| K1         | Link plus code; **10 failed code attempts per account per 24 h**; the link token is hashed at rest, single-use, time-limited, never logged | implementation approval                    |
| K13/K13b   | Version counter; immediate invalidation after password change, password reset, user suspension and session revocation                      | implementation approval                    |
| S1         | Trusted-proxy design and startup requirements, subject to the spoofing tests                                                               | implementation approval                    |
| S3/S4      | Goal agreed; **M2, M3 and the runtime-role switch not approved**                                                                           | this document, then test-branch results    |
| S2         | Exact allowlist                                                                                                                            | owner confirmation of the origin list (§E) |
| Migrations | **Not approved on Neon**                                                                                                                   | §B, then test-branch results               |

## Corrections to revision 2 found during this review

1. **26 context-free queries, not 21.** Revision 2 counted only `this.prisma.<model>` calls. Five more run inside a
   plain `this.prisma.$transaction(...)` with no user or tenant context: registration's application insert, and four
   calls in portal claim redemption.
2. **Refresh-token race (K13b).** A refresh that starts just before a password change can create a new refresh token
   that the change's revocation statement does not see. With the default READ COMMITTED isolation, a blocked `UPDATE`
   re-checks only the rows already in its snapshot, not newly inserted ones. The surviving token could keep minting
   access tokens. Fix: a `session_version` on refresh tokens as well (§D).
3. **The link token must not be in a URL query string.** Hosting access logs (Render; Caddy when logging is enabled)
   record query strings. The link uses the URL **fragment** (`/reset-password#token=…&email=…`): browsers never send it
   to servers, never include it in `Referer`, and the page strips it from the address bar after reading it. The
   frontend has no analytics SDK (verified). The backend request middleware does not log URLs (verified).
4. **New finding S5: account blocking through the public application endpoint.** `POST /platform/applications/public`
   (`@Public()`, unused by our frontend) creates an application under an **existing** account when the submitted
   email belongs to one. Login gating then blocks accounts without a tenant membership whose latest application is
   pending, which includes player and guardian portal users. **Anyone who knows such a user's email can block that
   user's sign-in with one anonymous request.** A decision is needed (§A.3).
5. **Audit logging would silently stop under the runtime role.** The `audit_logs` INSERT policy requires
   `tenant_id = current_app_tenant_id()`. Context-free `logEvent` calls, and every event with a null tenant (login,
   registration, platform events), would be denied. `logEvent` swallows errors, so the loss would go unnoticed.

---

## A. S3/S4 implementation details

### A.1 Context mechanisms (existing, in `packages/database/src/tenant-transaction.ts`)

All four run inside one database transaction and set transaction-local settings (`set_config(..., true)`), so the
context cannot leak to another request on a pooled connection.

| Mechanism                                                        | Sets                                    | RLS helper that reads it                                               | Who may use it                                                                                                                         |
| ---------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **TENANT**: `withTenantTransaction(tenantContext)`               | `app.tenant_id`, `app.actor_user_id`    | `current_app_tenant_id()`, `current_app_user_id()`                     | requests that passed `TenantGuard` (membership verified)                                                                               |
| **ACTOR**: `withAuthLookupTransaction({ actorUserId, context })` | `app.auth_context`, `app.actor_user_id` | `current_app_user_id()`                                                | an authenticated user acting on their own rows, or the login flow after password verification                                          |
| **PLATFORM**: `withPlatformAdminTransaction({ actorUserId })`    | `app.actor_user_id`                     | `is_current_user_super_admin()` (reads `users`)                        | platform console routes (`PlatformSuperAdminGuard`)                                                                                    |
| **PORTAL**: `withPortalUserTransaction({ actorUserId })`         | `app.actor_user_id`                     | `current_app_user_id()`                                                | player and guardian portal routes                                                                                                      |
| **FN** (new)                                                     | —                                       | `SECURITY DEFINER` function with its own explicit authorization checks | narrow operations that must cross RLS by design (public directory, anonymous submissions, notifications to other users, audit appends) |

### A.2 The 26 affected queries, grouped by module

"As owner" = today (BYPASSRLS). "As `sportexus_app`" = what would happen if the connection were switched without code
changes.

**audit**

| #   | Location                         | Query             | As `sportexus_app`                                                                                                                 | Proposed mechanism                                           | Enforcement afterwards                                                                  |
| --- | -------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| 1   | `audit.service.ts:94` `logEvent` | `auditLog.create` | **denied** (`audit_logs_tenant_isolation` WITH CHECK; null-tenant events never pass); error swallowed, so events are silently lost | **FN** `append_audit_log(...)`: append-only insert, no reads | append-only trigger (unchanged); SELECT stays limited to tenant or super-admin policies |

**auth**

| #   | Location                                          | Query                                              | As `sportexus_app`                                             | Proposed mechanism                                                                                                                                                                                | Enforcement afterwards                                                                                          |
| --- | ------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 2   | `auth.service.ts:82` `register`                   | `tenant.findUnique` by slug                        | 0 rows, so slug collisions are missed                          | **FN** `academy_slug_in_use(slug)`                                                                                                                                                                | returns a boolean only                                                                                          |
| 3   | `auth.service.ts:83` `register`                   | `academyApplication.findFirst` by slug             | 0 rows (as #2)                                                 | same FN                                                                                                                                                                                           | same                                                                                                            |
| 22  | `auth.service.ts:105` `register` (`$transaction`) | `academyApplication.create`                        | allowed only via 104105500's insecure policies                 | **ACTOR within the transaction**: create the user (no RLS on `users`; `isEmailVerified` omitted, database default `false`), then `set_config('app.actor_user_id', <new user>, true)`, then insert | M2 `academy_applications_insert` (own `PENDING_REVIEW` row only); RETURNING through the applicant SELECT policy |
| 4   | `auth.service.ts:259` `login`                     | `academyApplication.findFirst` by applicant        | 0 rows, so **pending or rejected applicants are not blocked**  | **ACTOR** (actor = the user, after password verification)                                                                                                                                         | `academy_applications_applicant` (own rows, any status)                                                         |
| 5   | `auth.service.ts:281` `login`                     | `playerRegistrationRequest.findFirst` by applicant | 0 rows (policy is tenant-only), so join-request gating is lost | **ACTOR** + new policy `player_registration_requests_applicant` (SELECT own rows)                                                                                                                 | own rows only                                                                                                   |

**finance**

| #   | Location                                        | Query                                            | As `sportexus_app`                  | Proposed mechanism                                   | Enforcement afterwards             |
| --- | ----------------------------------------------- | ------------------------------------------------ | ----------------------------------- | ---------------------------------------------------- | ---------------------------------- |
| 6   | `finance.service.ts:796` `recordSessionExpense` | `tenantMembership.findMany` (managers to notify) | 0 rows, so no expense notifications | **TENANT** (the request already has `tenantContext`) | `tenant_memberships_tenant_select` |

**notifications**

| #     | Location                                                    | Query                         | As `sportexus_app`                        | Proposed mechanism                                                                                                                                    | Enforcement afterwards                                                              |
| ----- | ----------------------------------------------------------- | ----------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 7–9   | `notifications.service.ts:44,50,57` `listUserNotifications` | `findMany`, `count`, `count`  | 0, so empty notification list             | **ACTOR** (actor = the authenticated user)                                                                                                            | `app_notifications_owner` (`user_id = actor`); the tenant filter stays in the query |
| 10    | `:70` `getUnreadCount`                                      | `count`                       | 0                                         | **ACTOR**                                                                                                                                             | same                                                                                |
| 11–12 | `:80,94` `markAsRead`                                       | `findFirst`, `update`         | not found                                 | **ACTOR**                                                                                                                                             | same (`USING` and `WITH CHECK`)                                                     |
| 13    | `:101` `markAllAsRead`                                      | `updateMany`                  | 0 rows                                    | **ACTOR**                                                                                                                                             | same                                                                                |
| 14    | `:114` `createNotification`                                 | `create` (for _another_ user) | **denied** (`WITH CHECK user_id = actor`) | **FN** `create_app_notification(...)`: validates that the recipient exists and, when a tenant is given, holds a membership in it or is platform staff | no cross-tenant notifications; no reads                                             |

**platform**

| #     | Location                                                            | Query                                  | As `sportexus_app`                     | Proposed mechanism                                  | Enforcement afterwards                                                                                                        |
| ----- | ------------------------------------------------------------------- | -------------------------------------- | -------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 15–16 | `platform.service.ts:1389,1397` `submitAcademyApplication` (public) | slug checks                            | 0 rows                                 | **FN** `academy_slug_in_use`                        | boolean only                                                                                                                  |
| 17    | `:1428` same                                                        | `academyApplication.create`            | denied, or allowed only by 104105500   | depends on the **S5 decision** (§A.3)               | —                                                                                                                             |
| —     | `:1105, :1320` staff and user invites                               | `tx.user.create` with privileged flags | **denied** (column INSERT not granted) | **FN** `platform_create_user(...)` (revision 2, M3) | super admin required; platform owner required for the owner flag                                                              |
| —     | `:1554` academy approval (`withPlatformAdminTransaction`)           | `tx.tenant.create`                     | **denied** (no INSERT grant)           | M3 `GRANT INSERT ON tenants`                        | the existing `tenants_platform_super_admin` policy (`FOR ALL USING is_current_user_super_admin()`, which also checks inserts) |

**portal**

| #     | Location                                                           | Query                                                  | As `sportexus_app`                                | Proposed mechanism                                                                                                                                                                                   | Enforcement afterwards                                           |
| ----- | ------------------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 18–20 | `portal.service.ts:505,517,531` `submitPlayerJoinRequest` (public) | tenant lookup, request insert, staff lookup            | 0 / denied / 0                                    | **FN** `submit_player_join_request(...) RETURNS (request_id, notify_user_ids uuid[])`: requires the tenant to be ACTIVE; applicant = `current_app_user_id()` (null when anonymous); returns only IDs | no reads of other data; tenant cannot be inactive                |
| 21    | `:573` `listPublicAcademies` (public)                              | `tenant.findMany` (ACTIVE)                             | 0, so the landing page join form has no academies | **FN** `list_public_academies() RETURNS TABLE (id, name, slug)`                                                                                                                                      | exposes only the public directory fields; no tenant contact data |
| 23–26 | `:349` `redeemClaimToken` (`$transaction`)                         | `guardian.findFirst/update`, `player.findFirst/update` | 0 / denied                                        | **ACTOR** + **FN** `redeem_portal_claim(p_claim_hash)`: links the record matching an unexpired claim hash to `current_app_user_id()`, then clears the hash                                           | no client-supplied user ID; single-use claim                     |

**Not affected** (verified): `refresh_tokens` and `users` have no RLS; every other service already uses the context
helpers.

### A.3 S5: decision needed for the public academy-application endpoint

| Option                                                           | Effect                                                                                                                                                                                                                      |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A (recommended): retire** `POST /platform/applications/public` | Registration already happens through `/auth/register`, which requires a password and creates the account; no frontend calls this endpoint (integration map). Retiring removes the account-blocking vector and #17 entirely. |
| B: keep it, but **never attach to an existing account**          | Same generic response whether the email exists or not; only brand-new pending accounts are created (via `platform_create_user`-style FN for applicants). Keeps an anonymous write path.                                     |

### A.4 RLS policies: current state on Neon, and proposed changes

Only two tables change. All other policies stay exactly as they are.

| Table                                        | Current (Neon)                                                                                                                             | Proposed                                                                                                                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `academy_applications`                       | `academy_applications_applicant` SELECT `applicant_user_id = current_app_user_id()`; `academy_applications_platform_admin` ALL super admin | **unchanged** + new `academy_applications_insert` INSERT `WITH CHECK (status = 'PENDING_REVIEW' AND applicant_user_id = current_app_user_id())` (M2). 104105500's anonymous clause is **never created on Neon** (§B). |
| `player_registration_requests`               | `player_registration_requests_tenant` ALL by `app.tenant_id`                                                                               | **unchanged** + new `player_registration_requests_applicant` SELECT `USING (applicant_user_id = current_app_user_id())` (M2)                                                                                          |
| `app_notifications`                          | `_owner` ALL own rows; `_platform_admin` ALL super admin                                                                                   | unchanged (cross-user creation via FN)                                                                                                                                                                                |
| `audit_logs`                                 | `_tenant_isolation` ALL by tenant; `_platform_super_admin` SELECT                                                                          | unchanged (appends via FN)                                                                                                                                                                                            |
| `tenants`                                    | `_runtime_isolation` SELECT own tenant; `_runtime_update`; `_auth_discovery` SELECT member tenants; `_platform_super_admin` ALL            | unchanged (INSERT grant only, M3)                                                                                                                                                                                     |
| `tenant_memberships`, `players`, `guardians` | tenant-isolation policies plus portal or super-admin SELECT                                                                                | unchanged                                                                                                                                                                                                             |

**Hardening, proposed in M2:** pin `search_path = public, pg_temp` on the 7 invoker helper functions used inside
policies (`current_app_tenant_id`, `current_app_user_id`, `is_current_user_super_admin`,
`is_current_user_platform_owner`, and the 3 mutation-guard trigger functions). They currently have no pinned path.
Risk today is low, because `sportexus_app` has no `CREATE` on any schema, but pinning makes it independent of that.

### A.5 Workflows under `sportexus_app`

| Workflow                | Path                                                                                                                                                                                                                                                       | Why it works and stays safe                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Public registration** | `/auth/register` → one transaction: user insert (no RLS on `users`, column grants allow it) → actor set to the new user → application insert (M2 insert policy) → notifications via FN                                                                     | the applicant can create only their _own_ `PENDING_REVIEW` application, cannot forge status, and cannot read other applications |
| **Login gating**        | after password verification: ACTOR lookups of own application and join request                                                                                                                                                                             | sees _all_ own statuses, which **fixes** the gap where rejected or more-info applicants were not blocked                        |
| **Academy approval**    | platform console → PLATFORM transaction → review update (`academy_applications_platform_admin`) → `tenant.create` (M3 grant plus super-admin policy) → branch, membership and subscription inserts (existing grants; `branches_platform_super_admin` etc.) | only super admins or platform owners can create tenants; RLS enforces it even if a guard were missing                           |
| **Notifications**       | own list, count and mark-read via ACTOR; creation for others via `create_app_notification`                                                                                                                                                                 | a user never sees another user's notifications; cross-tenant notifications are rejected                                         |
| **Staff invitations**   | create invite: TENANT (`invitations` tenant policies); preview: `inspect_invitation_preview` (existing FN); accept: `redeem_invitation_and_activate_membership` (existing FN); platform staff invites: `platform_create_user`                              | all already designed for the runtime role, apart from the platform user-insert FN                                               |
| **Tenant creation**     | only through academy approval (above); `provision_tenant_onboarding` (older self-service flow) stays as it is                                                                                                                                              | the runtime role can insert a tenant only when RLS sees a super-admin actor                                                     |

### A.6 Grants and SECURITY DEFINER functions

**Existing definer functions:** 11, verified on Neon. All are owned by `neondb_owner`, all pin
`search_path = public, pg_temp`, `PUBLIC` EXECUTE is revoked for all, and all are granted to `sportexus_app`:
`complete_password_reset`, `inspect_invitation_preview`, `issue_user_onboarding_token` ×2,
`issue_user_redemption_challenge` ×2, `provision_tenant_onboarding`, `redeem_invitation_and_activate_membership`,
`request_email_verification`, `request_password_reset`, `verify_user_email`.

**New or changed objects:**

| Object                                                                                                                                                 | Migration | Kind                                                   | Internal authorization                                                               | Executable by                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------- |
| `users.password_reset_link_token`, `users.session_version`                                                                                             | M1        | columns                                                | —                                                                                    | `UPDATE (session_version)` granted in M3 |
| `refresh_tokens.session_version`                                                                                                                       | M1        | column (new in rev 3, §D)                              | —                                                                                    | covered by the existing table grant      |
| `request_password_reset_with_link`, `complete_password_reset_for_email`, `complete_password_reset_by_link`, `invalidate_password_reset_code_for_email` | M1        | DEFINER                                                | token or email match, expiry                                                         | runtime roles                            |
| `complete_password_reset(text,text)`                                                                                                                   | M1        | DEFINER (re-created: same behaviour plus version bump) | unchanged                                                                            | runtime roles                            |
| `academy_slug_in_use`                                                                                                                                  | M2        | DEFINER, STABLE                                        | none needed (returns a boolean)                                                      | runtime roles                            |
| `list_public_academies`                                                                                                                                | M2        | DEFINER, STABLE                                        | returns ACTIVE tenants' `id, name, slug` only                                        | runtime roles                            |
| `submit_player_join_request`                                                                                                                           | M2        | DEFINER                                                | tenant must be ACTIVE; applicant = `current_app_user_id()`                           | runtime roles                            |
| `redeem_portal_claim`                                                                                                                                  | M2        | DEFINER                                                | `current_app_user_id()` required; unexpired hash; single-use                         | runtime roles                            |
| `create_app_notification`                                                                                                                              | M2        | DEFINER                                                | recipient exists; tenant membership or platform staff                                | runtime roles                            |
| `append_audit_log`                                                                                                                                     | M2        | DEFINER                                                | insert only; action and resource type required                                       | runtime roles                            |
| `platform_create_user`                                                                                                                                 | M3        | DEFINER                                                | `is_current_user_super_admin()`; owner flag needs `is_current_user_platform_owner()` | runtime roles                            |
| `GRANT INSERT ON tenants`                                                                                                                              | M3        | grant                                                  | RLS `tenants_platform_super_admin`                                                   | runtime roles                            |

**Ownership:** the migration role (`neondb_owner` on Neon; the admin role elsewhere). Every function gets
`SET search_path = public, pg_temp`, `REVOKE ALL … FROM PUBLIC`, and an explicit `GRANT EXECUTE` to `academy_runtime`,
`academy_runtime_ci` and `sportexus_app` only. The full SQL is written once the test-branch work starts. Revision 2
already contains M1's and M3's, and M2's policy part.

### A.7 Cross-tenant prevention (layers)

1. **`TenantGuard`:** the requested tenant ID is accepted only if the signed-in user holds an **ACTIVE** membership
   in it (looked up via ACTOR). Branch-scoped roles are pinned to their own branch.
2. **Services** pass the guard-built `tenantContext` to `withTenantTransaction`, which sets `app.tenant_id`
   transaction-locally.
3. **RLS** on 31 tables filters and checks every row against `current_app_tenant_id()`. A service query that forgot
   its `tenantId` filter still cannot read or write another tenant's rows. Under `sportexus_app` this layer is
   enforced; today it is bypassed.
4. **Composite foreign keys** `(tenant_id, id)` prevent cross-tenant references.
5. **Startup guard (S3):** the API refuses to start in production and staging if its role is a superuser, has
   BYPASSRLS, or owns tables.

**Trust boundary, stated honestly:** the RLS context settings are set by the application. Anyone holding the
`sportexus_app` database password could set `app.tenant_id` themselves. RLS therefore protects against **application
bugs**, not against a stolen database credential. Credential protection relies on secret management and network
restriction. This is inherent to application-context RLS and is documented, not hidden.

**Not RLS-enforced (application-level, unchanged):** branch scoping within a tenant, and role permissions
(`PermissionsGuard`).

---

## B. Migration safety

### B.1 Transactions

- **Each migration file runs separately.** Later files start only after the earlier one committed, so every state
  _between_ files is a committed, visible state.
- **Within a file**, Prisma 6.19 applies a PostgreSQL migration as one unit. This is supported by Prisma issue
  reports (a later 7.4 report claims a change), not by an explicit statement in the official docs. **It will not be
  relied on:**
  - it is verified on the isolated test branch with a deliberately failing migration;
  - all new migrations are written idempotently (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP … IF EXISTS`), so a
    partially applied file can be re-run safely.

### B.2 Intermediate states, demonstrated rather than assumed

**Option 1 (recommended): record `20261104105500` as applied without executing it**
(`prisma migrate resolve --applied`), then apply M1 → M2 → M3.

| State             | academy_applications policies                            | Other changes                                                                            | Safe? Evidence                                                       |
| ----------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| S0 (today)        | applicant SELECT own; platform admin ALL                 | —                                                                                        | ✅ verified in `pg_policies`                                         |
| after the resolve | unchanged (only a `_prisma_migrations` row is written)   | —                                                                                        | ✅ no DDL executed                                                   |
| after M1          | unchanged                                                | new columns and functions; `complete_password_reset` keeps its contract                  | ✅ old code never calls the new functions; new columns have defaults |
| after M2          | + own-row INSERT; join-request applicant SELECT; new FNs | —                                                                                        | ✅ only narrower or own-row access is added                          |
| after M3          | unchanged                                                | `INSERT` on tenants (RLS-restricted), `UPDATE (session_version)`, `platform_create_user` | ✅ the grant is gated by the existing super-admin policy             |

The insecure policy from 104105500 **never exists on Neon**. This follows from what runs, not from timing or from who
is connected.

The **final schema is identical** to applying 104105500 and then M2, because M2 drops and re-creates both policies by
name. This is verified with `prisma migrate diff` against a database built from scratch (the CI database).

**Option 2 (not recommended): apply all four in sequence.** After 104105500 commits and before M2 commits, any session
of a non-owner, non-BYPASSRLS role with no user context can read every pending application.

- **Who could reach it:** `sportexus_app` currently has a password set. Today `pg_stat_activity` shows only
  `neondb_owner` sessions (one, mine), but I cannot prove that no one else holds that password.
- **Making it truly unreachable would require** `ALTER ROLE sportexus_app NOLOGIN` during the run, which is a
  credential change outside the current approval. Hence option 1.

**Fresh databases** (CI, new self-host installs) run 104105500 → M2 back to back: `docker-entrypoint.sh` runs
`migrate deploy` _before_ `exec node`, and CI databases have no external access. Optionally, a guard migration could
make M2 run in the same file as a re-statement. Not needed.

### B.3 Stopping the API

**Recommended on Neon:**

1. stop the dev API and any other client;
2. confirm with `pg_stat_activity` (role names and counts only) that no application sessions remain;
3. migrate;
4. verify;
5. start the API on code that matches the schema.

| Code and database combination | Works?                                                                 |
| ----------------------------- | ---------------------------------------------------------------------- |
| old code + migrated database  | ✅ backward compatible (old functions kept, new columns have defaults) |
| new code + old database       | ❌ the new functions are missing                                       |

**Order: database first, then code.** Stopping the API is a precaution, not a requirement.

### B.4 Rollback per migration

Rollback runs in reverse order (M3 → M2 → M1) and takes one statement block each, all included in the migration
files' headers. The last resort is the owner's Neon branch, or the verified `pg_dump`.

| Migration                        | Rollback                                                                                                                                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261104105500` (resolved only) | `DELETE FROM _prisma_migrations WHERE migration_name = '20261104105500_academy_applications_insert_rls';` (nothing was executed)                                                                           |
| M3                               | revoke `INSERT` on tenants and `UPDATE (session_version)` from runtime roles; drop `platform_create_user`                                                                                                  |
| M2                               | drop `academy_applications_insert` and `player_registration_requests_applicant`; drop the 6 new functions; restore `search_path` defaults on the helpers. The applicant SELECT policy stays as it is today |
| M1                               | drop the new functions; re-create `complete_password_reset` from `20261021040000`; drop the 3 new columns                                                                                                  |

---

## C. Test strategy

### C.1 Environment

- **Location:** everything runs on an **isolated Neon test branch** (`s3-runtime-test`, created by the owner from the
  dev branch), never on the current Neon database. The API runs there as `sportexus_app` (password set by the owner
  on that branch only).
- **Results** are reported before proposing any change to the current Neon database.
- **Data:** synthetic tenants, users and players only.

### C.2 Personas

| Code   | Persona                                                                       |
| ------ | ----------------------------------------------------------------------------- |
| ANON   | not signed in                                                                 |
| AUTH   | signed in, no membership (portal player or guardian)                          |
| APPL   | academy applicant (pending, more-info, rejected, approved)                    |
| UNAUTH | staff without the needed permission (VIEWER, COACH, ACCOUNTANT as applicable) |
| BM     | branch manager (branch-scoped)                                                |
| TADM   | tenant admin (OWNER, MANAGER)                                                 |
| PADM   | platform super admin                                                          |
| POWN   | platform owner                                                                |

### C.3 Workflow matrix

✅ = allowed; ⛔ = refused (401/403) or no data; "own" = own rows only.

| Workflow                                                                    | ANON                                    | AUTH                     | APPL                                           | UNAUTH                         | BM             | TADM                      | PADM                           | POWN                |
| --------------------------------------------------------------------------- | --------------------------------------- | ------------------------ | ---------------------------------------------- | ------------------------------ | -------------- | ------------------------- | ------------------------------ | ------------------- |
| Register academy (`/auth/register`)                                         | ✅ creates own pending application only | —                        | —                                              | —                              | —              | —                         | —                              | —                   |
| Login gating                                                                | —                                       | ✅                       | ⛔ pending / more-info / rejected; ✅ approved | ✅                             | ✅             | ✅                        | ✅                             | ✅                  |
| Slug availability                                                           | ✅ (boolean only)                       |                          |                                                |                                |                |                           |                                |                     |
| Read academy applications                                                   | ⛔ 0 rows                               | ⛔                       | own only                                       | ⛔                             | ⛔             | ⛔                        | ✅ all                         | ✅ all              |
| Review / approve application, tenant creation                               | ⛔                                      | ⛔                       | ⛔                                             | ⛔                             | ⛔             | ⛔                        | ✅                             | ✅                  |
| Create tenant directly (SQL, runtime role)                                  | ⛔                                      | ⛔                       | ⛔                                             | ⛔                             | ⛔             | ⛔                        | ✅ via approval context        | ✅                  |
| Platform staff invite                                                       | ⛔                                      | ⛔                       | ⛔                                             | ⛔                             | ⛔             | ⛔                        | ✅ super admin (⛔ owner flag) | ✅ incl. owner flag |
| Public academy list                                                         | ✅ id/name/slug only                    | ✅                       | ✅                                             | ✅                             | ✅             | ✅                        | ✅                             | ✅                  |
| Submit join request                                                         | ✅ (ACTIVE tenant only)                 | ✅                       |                                                |                                |                |                           |                                |                     |
| Review join requests                                                        | ⛔                                      | ⛔                       | ⛔                                             | ⛔ (no permission)             | own branch     | ✅ own tenant             | ✅ read                        | ✅ read             |
| Notifications: list / mark                                                  | ⛔                                      | own                      | own                                            | own                            | own            | own                       | own (+ admin policy)           | own                 |
| Notification to another tenant's user                                       | ⛔ (FN rejects)                         |                          |                                                |                                |                |                           |                                |                     |
| Staff invite / accept (tenant)                                              | ⛔                                      | accept own invite        |                                                | ⛔                             | per permission | ✅                        |                                |                     |
| Portal claim redemption                                                     | ⛔                                      | ✅ own claim, single-use |                                                |                                |                |                           |                                |                     |
| Players / guardians CRUD and sensitive fields                               | ⛔                                      | portal: own read         |                                                | per permission (F21–F24 rules) | own branch     | ✅                        | read                           | read                |
| Attendance (sessions, QR, scan, bulk, offline, correction)                  | ⛔                                      | ⛔                       |                                                | per permission (COACH rules)   | own branch     | ✅                        | read                           | read                |
| Finance (plans, subscriptions, payments, reversal, expenses, cashier)       | ⛔                                      | ⛔                       |                                                | per permission                 | own branch     | ✅                        | read                           | read                |
| Evaluations, groups, enrollments, branches                                  | ⛔                                      | ⛔                       |                                                | per permission                 | own branch     | ✅                        | read                           | read                |
| Audit logs: read                                                            | ⛔                                      | ⛔                       | ⛔                                             | ⛔                             | ⛔             | own tenant (if permitted) | ✅                             | ✅                  |
| Audit entries written (login, registration, platform, tenant actions)       | ✅ written                              | ✅                       | ✅                                             | ✅                             | ✅             | ✅                        | ✅                             | ✅                  |
| Platform console (metrics, users, security, storage dry-run, announcements) | ⛔                                      | ⛔                       | ⛔                                             | ⛔                             | ⛔             | ⛔                        | ✅                             | ✅                  |

Each ✅ cell asserts the HTTP status, the returned scope, and **no** `42501` / permission-denied in the API log. Each
⛔ cell asserts the refusal and that no data is returned.

### C.4 Cross-tenant isolation suite

Two tenants, A and B, each with TADM, BM and UNAUTH staff, players, guardians, groups, sessions, finance records,
evaluations, invitations, join requests, notifications and audit entries.

1. **API level:** for every tenant-scoped GET, PATCH, POST and DELETE route, A's credentials with B's resource IDs
   return 404 or 403, and **nothing changes in B** (verified by an owner-role read after the run). The same is checked
   with the `x-tenant-id` header set to B by a user without a membership in B.
2. **SQL level, as `sportexus_app` with A's context:** `SELECT`, `UPDATE` and `DELETE` on B's rows affect **0 rows**;
   an `INSERT` with B's `tenant_id` fails the RLS check; repeated for each of the 31 RLS tables.
3. **Branch scoping:** BM of branch 1 cannot read or modify branch 2's players or sessions (application-level; API
   test).

### C.5 Restricted-role tests

Run as `sportexus_app`. Each must fail or return nothing:

1. `SET ROLE neondb_owner`: denied (not a member).
2. `ALTER TABLE … DISABLE ROW LEVEL SECURITY` and `ALTER TABLE … NO FORCE …`: denied (not the owner).
3. `SET row_security = off` and then a query: error (the role lacks BYPASSRLS).
4. `CREATE FUNCTION`, `CREATE TABLE` in `public`: denied (no `CREATE`).
5. `SELECT` from `_prisma_migrations`: denied.
6. `TRUNCATE` and `DROP` on any table: denied.
7. `UPDATE` / `DELETE` on `audit_logs`, `attendance_events`, `attendance_corrections`: blocked by the append-only
   triggers.
8. `INSERT` into `users` with privileged columns (`is_platform_super_admin`, `is_platform_owner`,
   `must_reset_password`, `is_email_verified`): denied. `platform_create_user` without a super-admin context: raises
   `PLATFORM_ADMIN_REQUIRED`.
9. Calling any definer function not granted: denied. Granted functions with a forged context (e.g.
   `redeem_portal_claim` for someone else's claim) are refused by their internal checks.
10. **Startup guard:** the API started as `neondb_owner` with `NODE_ENV=production` refuses to start; as
    `sportexus_app` it starts.
11. The existing suites `packages/database/tests/{runtime-role-privileges,tenant-rls,onboarding-and-invitations,audit-append-only}.sql`
    pass against the branch.

### C.6 Migration tests (on the test branch)

1. A deliberately failing migration file confirms the rollback behaviour within a file (§B.1).
2. Option 1 sequence: resolve 104105500, then M1, M2, M3. `pg_policies` is checked after each step and matches the
   §B.2 table.
3. Schema equivalence: `prisma migrate diff` between the branch and a scratch database built by running all
   migrations normally shows no difference.
4. Each rollback block is run in reverse order and restores the previous `pg_policies`, functions and columns.

---

## D. Session invalidation (K13 + K13b)

### D.1 Mechanism (revision 3)

| Element                                             | Behaviour                                                                                                                    |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `users.session_version`                             | increments on password change, password reset (code, link or activation), user suspension, and admin session revocation      |
| access token claim `sv`                             | the version at issuance                                                                                                      |
| `refresh_tokens.session_version` (**new in rev 3**) | the version at issuance                                                                                                      |
| `JwtStrategy.validate`                              | rejects when `payload.sv ?? 0 !== user.session_version`. It already loads the user on **every** authenticated request        |
| refresh rotation                                    | rejects (and revokes the family) when `token.session_version !== user.session_version`; new tokens carry the current version |

**Coverage, verified:**

- every protected route uses `JwtAuthGuard` → `JwtStrategy` (12 controllers);
- there is no manual JWT verification, no caching of authentication or user state, no WebSocket or SSE channel;
- the Next.js `/v1` proxy sends `no-store`, and the service worker never caches `/v1`;
- `@Public()` routes require no session.

**One client-side caveat:** the frontend's 25-second in-memory GET cache can still _display_ data fetched before the
invalidation. Every new request fails and the app redirects to login. No new data can be obtained.

### D.2 Existing users and sessions at deploy time

- The new columns default to 0, and existing tokens without `sv` count as 0. **Nobody is signed out by the deploy.**
- A user's existing sessions become invalid only at that user's next password change, reset, suspension or
  revocation.

### D.3 Current device after each operation

| Operation                               | Device performing it                                                                                             | All other sessions of the affected user                      |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Password change (self)                  | **stays signed in**: new access and refresh tokens are issued in the same response                               | invalidated immediately (next request: 401; refresh refused) |
| Password reset (code, link, activation) | not signed in by definition; any session on that browser is invalidated; the user signs in with the new password | invalidated                                                  |
| User suspension (platform admin)        | the admin's own session is unaffected                                                                            | the target is invalidated immediately; sign-in is blocked    |
| Admin session revocation for a user     | the admin is unaffected, unless the admin targets themself (then everything, including the current session)      | the target is invalidated                                    |
| Logout                                  | that session's family is revoked (unchanged); no version bump                                                    | unaffected                                                   |

### D.4 Concurrency

1. **In-flight requests:** a request that passed `JwtStrategy` just before the bump completes; any request starting
   after the commit is rejected. The window is the duration of one request.
2. **Refresh racing a password change:** with refresh-token versions, a token created by a racing rotation carries
   the **old** version and is rejected at its next use. The access token minted in the race carries the old `sv` and
   is rejected on its next request.
3. **Two concurrent password changes:** both run in transactions that increment the version. The last commit wins;
   both result in a higher version, and every older token is invalid.

### D.5 Tests

1. Three devices sign in. A changes the password: A keeps working (new tokens); B and C get 401 on their next request
   **with their previous access token** (before it expires) and cannot refresh.
2. The same with a reset by code and by link: A, B and C are all invalidated.
3. Suspension and admin revocation: the target's devices fail on their next request; the admin's device is
   unaffected.
4. **Race test:** 50 parallel refresh requests from device B while device A changes the password. Afterwards, no
   token issued to B (access or refresh) is accepted. Run against a real PostgreSQL on the test branch, not mocks.
5. **Concurrent requests:** requests already started before the change complete; requests started after it fail.
6. Pre-deploy tokens (no `sv`) are accepted while the version is 0, and rejected after the first bump.
7. Performance: no additional queries per request, measured by counting queries in a test with Prisma query logging.

---

## E. S2: currently configured origins

Found in the repository and the local `.env` files. These are addresses, not secrets.

| Environment                                        | Web origin(s)                                                                           | API origin                                       | Source                                                      |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------- |
| Development                                        | `http://localhost:3000`; `*.trycloudflare.com` (tunnels from `start-sportexus.ps1`)     | `http://localhost:3001`                          | `.env`, `backend/.env`, `frontend/.env`                     |
| Staging (hostless.app)                             | `https://sportexus-web-staging.hostless.app`                                            | `https://sportexus-backend-staging.hostless.app` | `.github/workflows/deploy.yml`, `env.validation.ts` default |
| Staging (Render, branch `staging/cloud-zero-cost`) | `*.pages.dev`: a Cloudflare Pages project whose **exact name is not in the repository** | Render URL (not in the repository)               | `render.yaml`                                               |
| Production                                         | none configured; templates use placeholders (`app.example.com`)                         | —                                                | `.env.production.example`, `docker-compose.prod.yml`        |

**To confirm:**

1. Is `https://sportexus-web-staging.hostless.app` the active staging web origin?
2. Which exact `https://<project>.pages.dev` origin (and any custom domain) does the Render staging use, if it is still
   in use?
3. The production web origin(s), when known.

The development wildcard `*.trycloudflare.com` stays allowed **in development only**.

## F. Next step requested

1. The owner reviews this document.
2. If approved: **3A.1** (K1, K13, K13b, S1) is implemented and tested with mocks. In parallel, the owner creates the
   isolated test branch, and M1 is tested there.
3. **S3/S4** move to the test branch only after explicit approval of the §A design and the S5 option. M2, M3 and the
   runtime-role switch are proposed for the current Neon database **only with the test results in hand**.
