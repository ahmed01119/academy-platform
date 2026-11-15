# Phase 3A.2: SQL for review (S3, S4, S6)

> **Status: drafts for owner review. Nothing has been applied to the Neon database.** M2 and M3 are not in
> `packages/database/prisma/migrations`, so no `prisma migrate deploy` can pick them up. They ran only on isolated,
> throwaway PostgreSQL 18 databases with synthetic data. No Neon branch was created.
>
> Date: 2026-11-15. Branch: `frontend-architecture-uiux-audit` (not pushed).

## 0. Summary

| Deliverable                      | File                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| M2 (S4 + context functions)      | `docs/proposals/phase-3a2/migrations/20261117090000_s4_rls_context_functions/migration.sql` |
| M3 (S3 + S6 + runtime baseline)  | `docs/proposals/phase-3a2/migrations/20261117100000_s3_runtime_privileges/migration.sql`    |
| Boundary tests (121 checks)      | `docs/proposals/phase-3a2/tests/m2-m3-boundaries.sql` with `tests/fixtures.sql`             |
| Catalog verification (read-only) | `docs/proposals/phase-3a2/verify-catalog.sql`                                               |
| CI changes (drafts)              | `docs/proposals/phase-3a2/ci/runtime-role-create.sql`, `ci/runtime-role-privileges.sql`     |

The migration files are the exact SQL: every function body, policy, grant and revoke. This document explains them
and answers the seven questions from the review request.

**What changed from the revision 2/3 design while writing the real SQL:**

1. **`GRANT INSERT ON tenants` (revision 2, M3) is dropped.** The existing CI test `runtime-role-privileges.sql`
   deliberately asserts that the runtime role can never insert or delete tenants. Academy approval also inserts the
   branch and the OWNER membership, which the platform-admin context cannot pass under the current policies.
   Approval and permanent deletion therefore become definer functions.
2. **New finding S6 (High): privilege escalation through the runtime role.** `users` has no RLS. On Neon,
   `sportexus_app` may UPDATE `is_platform_super_admin`, `is_platform_owner`, `is_suspended`,
   `must_reset_password` and `password_hash` on **any** row, and DELETE any row (granted by
   `packages/database/scripts/provision-runtime-role.sql`). Any query running as the runtime role could promote an
   account to platform owner, take over an account, or delete one. CI's runtime role is already tested to be denied
   these, so Neon diverged from the tested design. M3 closes it with definer functions.
3. **`platform_create_user` needs the platform owner, not only a super admin**, for any privileged flag. This
   mirrors the application rule (only the owner invites platform admins).
4. **The RLS helpers do not get `SET search_path`.** A SET clause stops PostgreSQL from inlining a SQL function,
   and these run once per row inside policies. They are not exposed to search-path hijacking: every relation is
   schema-qualified, and built-ins resolve in `pg_catalog`, which is always searched first. The three plpgsql
   trigger functions are pinned.

## 1. Every new or modified SECURITY DEFINER function: exact SQL

The exact bodies are in the migration files, section by section:

| Function                                                                                | File, section | Kind                              |
| --------------------------------------------------------------------------------------- | ------------- | --------------------------------- |
| `academy_slug_in_use(text) → boolean`                                                   | M2 §2         | SQL, STABLE                       |
| `append_audit_log(text,text,text,jsonb,text,text,uuid,uuid) → uuid`                     | M2 §4         | plpgsql                           |
| `create_app_notification(uuid,uuid,text,text,text,text) → uuid`                         | M2 §5         | plpgsql                           |
| `list_public_academies() → TABLE(id, name, slug)`                                       | M2 §6         | SQL, STABLE                       |
| `submit_player_join_request(uuid,text,text,text,date,text) → TABLE(...)`                | M2 §6         | plpgsql                           |
| `redeem_portal_claim(text) → TABLE(entity_type, entity_id, tenant_id, first, last)`     | M2 §7         | plpgsql                           |
| `change_own_password(text) → integer`                                                   | M3 §1         | plpgsql                           |
| `platform_create_user(text,text,text,boolean,boolean) → uuid`                           | M3 §2         | plpgsql                           |
| `platform_set_user_platform_role(uuid,text) → TABLE(...)`                               | M3 §2         | plpgsql                           |
| `platform_update_user_security(uuid,boolean,boolean,text) → TABLE(...)`                 | M3 §2         | plpgsql                           |
| `platform_revoke_user_sessions(uuid) → integer`                                         | M3 §2         | plpgsql                           |
| `platform_approve_academy_application(uuid,text,text) → uuid`                           | M3 §3         | plpgsql                           |
| `platform_delete_academy(uuid,text) → void`                                             | M3 §3         | plpgsql                           |
| `is_current_user_super_admin()`, `is_current_user_platform_owner()` (modified, invoker) | M2 §1         | SQL; `AND NOT is_suspended` added |
| `prevent_audit_log_mutation()` and the two attendance trigger functions (modified)      | M2 §1         | `search_path` pinned only         |

The five M1 functions (3A.1) are already applied and unchanged.

## 2. Ownership, EXECUTE grants, revoked privileges, pinned search_path

The same rules apply to all 13 new definer functions. `verify-catalog.sql` §06 asserts them for these and for every
other definer function in `public`:

| Property           | Value                                                                                                                                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Owner              | The migration role, which is also the owner of every table: `neondb_owner` on Neon, the admin role elsewhere. It must be a superuser or have BYPASSRLS, because the functions write FORCE-RLS tables; verified on Neon (read-only) and asserted by §02 |
| `SECURITY DEFINER` | Yes                                                                                                                                                                                                                                                    |
| `search_path`      | `SET search_path = public, pg_temp` (the temp schema last, so it can never shadow `public`)                                                                                                                                                            |
| `PUBLIC`           | `REVOKE ALL ON FUNCTION … FROM PUBLIC` (PostgreSQL grants EXECUTE to PUBLIC by default)                                                                                                                                                                |
| EXECUTE            | Granted to `academy_runtime`, `academy_runtime_ci` and `sportexus_app`, each only if it exists                                                                                                                                                         |
| Identity           | No function takes the actor's user ID as a parameter. The actor is always `current_app_user_id()` and the tenant `current_app_tenant_id()`, both transaction-local settings                                                                            |

Revoked table and column privileges, for all runtime roles including the legacy `academy_app_user`:

| Object                         | Before (Neon `sportexus_app`)                       | After                                                                   | Migration |
| ------------------------------ | --------------------------------------------------- | ----------------------------------------------------------------------- | --------- |
| `audit_logs`                   | SELECT, INSERT                                      | SELECT                                                                  | M2        |
| `app_notifications`            | SELECT, INSERT, UPDATE, DELETE                      | SELECT, UPDATE (`read_at`)                                              | M2        |
| `academy_applications`         | SELECT, INSERT, UPDATE, DELETE                      | SELECT, INSERT (11 applicant columns), UPDATE (6 review columns)        | M2        |
| `player_registration_requests` | SELECT, INSERT, UPDATE, DELETE                      | SELECT, UPDATE (5 review columns)                                       | M2        |
| `users`                        | SELECT, DELETE; INSERT 7 columns; UPDATE 10 columns | SELECT; INSERT the same 7 columns; UPDATE `name`, `phone`, `updated_at` | M3        |
| `tenants`                      | SELECT, UPDATE                                      | unchanged; INSERT and DELETE are asserted absent                        | M3        |

That is the complete delta for `sportexus_app` on the Neon model: only removals, plus EXECUTE on the 13 new functions
and the column grants listed. M3 §5 also writes the full baseline for every other table **with the same privileges
Neon has today**, so self-host (`academy_runtime`), CI and Neon converge.

## 3. `append_audit_log`: actor and tenant from the transaction context

```text
v_tenant := current_app_tenant_id()   -- set by withTenantTransaction (after TenantGuard verified the membership)
v_actor  := current_app_user_id()     -- set by the ACTOR / PLATFORM / PORTAL / TENANT context helpers
```

- **Not parameters.** The caller cannot name an actor or tenant. The optional `p_expected_tenant_id` and
  `p_expected_actor_user_id` are only claims: if they differ from the context, the function raises
  `AUDIT_*_CONTEXT_MISMATCH`. This catches code that logs for one tenant while running under another.
- **Actor:** when set, it must be an existing user (`AUDIT_ACTOR_UNKNOWN`).
- **Tenant event:**
  - it requires an actor (`AUDIT_TENANT_EVENT_REQUIRES_ACTOR`);
  - the actor must be linked to that tenant: a membership in it (any status, so a revocation can still be recorded),
    a portal link (a player or guardian record in it), or an active platform administrator;
  - otherwise `AUDIT_ACTOR_NOT_LINKED_TO_TENANT`.

  A forged tenant context therefore cannot attribute events to an unrelated academy.

- **Platform-level event** (no tenant): allowed with or without an actor, for example a failed login for an unknown
  email, as today.
- **Integrity:** insert only. There is no read or update path; the append-only trigger stays; direct INSERT is
  revoked, so the function is the only write path. It returns only the new row's ID.
- **Robustness:** an oversized user agent is truncated to 512 characters, metadata over 16 KB is replaced by
  `{truncated, originalBytes}`, and a non-object JSON value is wrapped. Audit formatting therefore never aborts a
  business transaction; only the authorization rules raise. `action` must match `^[A-Z][A-Z0-9_]{2,99}$`, and
  `resource_type` an identifier pattern.
- **Trust boundary, stated plainly:** the context values are set by the application. The database guarantees that the
  values come from the context and are consistent with real memberships. It cannot tell a verified login from a
  server-side assertion; that is the documented limit of application-context RLS (revision 3 §A.7).

## 4. `create_app_notification`: sender authorization and recipient access

- **Sender:** `current_app_user_id()`, which is required (`NOTIFICATION_SENDER_REQUIRED`). The only anonymous flow,
  join requests, notifies through `submit_player_join_request`.
- **Tenant notification** (`p_tenant_id` set):
  1. it must equal the transaction's tenant context when one is set (`NOTIFICATION_TENANT_CONTEXT_MISMATCH`);
  2. the sender must be an ACTIVE member of that tenant, or an active platform administrator;
  3. the recipient must be one of:
     - an ACTIVE member of that tenant;
     - portal-linked to it (a player or guardian record);
     - the applicant of a join request in that tenant. Reviewers notify applicants who are not members yet.
- **Platform notification** (no tenant): the recipient is an active platform administrator (for example "new academy
  application"), **or** the sender is one (application decisions, admin invitations), **or** recipient = sender.
  User-to-user notifications are refused (`NOTIFICATION_NOT_PERMITTED`).
- **Content:**
  - `type` must be a `NotificationType`;
  - `href` must be an application-relative path: it starts with `/`, is not `//…`, and contains no backslash or
    whitespace. A notification can never link off-site. All current links comply;
  - title and body are required and truncated to 200 and 2,000 characters.
- **Reading:** unchanged RLS (`app_notifications_owner`: own rows only). Recipients may update only `read_at`.

All six notification patterns in the code are covered and tested (NO-01…NO-18).

## 5. `academy_applications`: column-level insert restrictions

| Layer                             | Rule                                                                                                                                                                                                                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Column INSERT grant               | `id, applicant_user_id, academy_name, academy_slug, sport, city, contact_phone, contact_email, notes, created_at, updated_at` only. **Not insertable:** `status` (database default `PENDING_REVIEW`), `review_notes`, `reviewed_by_user_id`, `reviewed_at`, `provisioned_tenant_id` |
| RLS `academy_applications_insert` | `WITH CHECK (applicant_user_id = current_app_user_id() AND status = 'PENDING_REVIEW' AND review_notes IS NULL AND reviewed_by_user_id IS NULL AND reviewed_at IS NULL AND provisioned_tenant_id IS NULL)`                                                                           |
| Column UPDATE grant               | `status, review_notes, reviewed_by_user_id, reviewed_at, provisioned_tenant_id, updated_at` only. Submitted fields can no longer be rewritten by anyone through the runtime role                                                                                                    |
| RLS for UPDATE                    | Only `academy_applications_platform_admin` (an active super admin or owner). Applicants have no UPDATE policy, so they cannot change their own application's status                                                                                                                 |
| DELETE                            | Revoked                                                                                                                                                                                                                                                                             |
| SELECT                            | `academy_applications_applicant` is re-created as **own rows only**, with no anonymous clause. Platform admins see everything                                                                                                                                                       |
| Approval                          | `platform_approve_academy_application` writes the review fields and provisions the academy atomically                                                                                                                                                                               |

The defence is two independent layers: column privileges _and_ RLS checks. Tests S4-01…S4-14 exercise both; for
example, status forging fails with "permission denied" before RLS is even evaluated.

## 6. Authorization inside `platform_create_user`, `submit_player_join_request`, `redeem_portal_claim`

**`platform_create_user(email, name, phone, super_admin, owner)`**

1. The caller must be an active (not suspended) platform administrator (`PLATFORM_ADMIN_REQUIRED`).
2. Either privileged flag requires an active platform owner (`PLATFORM_OWNER_REQUIRED`).
3. The email is normalised and validated, and the name is required. A duplicate email fails on the unique index.
4. The user is always created with `must_reset_password = true` and the existing placeholder hash. Owner implies
   super admin.

The other privileged operations follow the same pattern:

- `platform_set_user_platform_role`: owner only. The last active owner can never be demoted; any demotion ends the
  user's sessions.
- `platform_update_user_security`: admin; an owner target needs an owner; the last active owner cannot be suspended;
  suspension ends sessions.
- `platform_revoke_user_sessions`: admin; another owner's sessions need an owner.
- `platform_delete_academy`: owner; the confirmation slug must match; no history.
- `platform_approve_academy_application`: admin; refused if already approved.

**`submit_player_join_request(tenant, player, email, phone, dob, guardian)`**

1. Applicant = `current_app_user_id()` (NULL when anonymous). A signed-in applicant must exist and not be suspended.
2. The academy must be **ACTIVE**. Unknown and inactive academies get the same error (`ACADEMY_NOT_AVAILABLE`).
3. Inputs are validated: name 2–120 characters, email format and at most 254 characters, phone at most 32, date of
   birth between 1900 and today.
4. Anti-spam: at most 5 pending requests per academy and contact email.
5. The row is always `PENDING_REVIEW` with empty review fields. Notifications to the academy's OWNER, MANAGER and
   BRANCH_MANAGER (ACTIVE) are created in the same transaction, with today's text.
6. It returns only the new request's own data.

**`redeem_portal_claim(claim_hash)`**

1. Requires an active, signed-in account (`CLAIM_REQUIRES_ACTIVE_ACCOUNT`). There is no user ID parameter.
2. The code is compared as a SHA-256 hash. M2 converts existing plaintext codes in place, so outstanding codes keep
   working (Neon has 0).
3. The code must be unexpired and its academy ACTIVE. Every invalid, expired or unknown code gets the same
   `CLAIM_INVALID`.
4. The record is linked only if it is unlinked or already linked to the caller. **New:** guardians are now protected
   too; today only players are. Otherwise `CLAIM_ALREADY_LINKED`.
5. Linking, clearing the code (single use) and the audit entry all happen inside the function, in one statement per
   table.

## 7. M2 and M3: complete SQL, rollback, verification

- **Complete SQL:** the two migration files. Both are idempotent: re-running them on a migrated database produced
  **zero** catalog differences.
- **Rollback:** a forward migration, never by editing `_prisma_migrations`. Each file ends with its rollback block.
  - Never restore the anonymous S4 clause.
  - Never drop the `session_version` columns.
  - Re-granting the S6 privileges re-opens privilege escalation, so do it only together with switching the API back
    to the owner connection.
  - Claim-code hashing is one-way; there are no codes on Neon today.
- **Data changes:** one statement, the claim-code hashing. It affects 0 rows on Neon (counted read-only). Everything
  else is DDL or privileges.
- **Neon intermediate states:** today's API connects as the owner (BYPASSRLS) and is unaffected by every revoke and
  policy. M2 and M3 can be applied before the code switch; old code keeps working.

### Catalog-level verification

`verify-catalog.sql` reads only `pg_catalog` and `information_schema`, plus two counts of plaintext claim codes,
never values. It asserts:

| §   | Assertion                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 01  | Migration history: M2 and M3 finished and not rolled back; the 104105500 baseline exception recorded                                                                                                                                       |
| 02  | One owner for every table, a superuser or BYPASSRLS                                                                                                                                                                                        |
| 03  | Runtime roles: no superuser, BYPASSRLS, CREATEROLE or CREATEDB; own nothing; no CREATE on `public`; not members of the owner role                                                                                                          |
| 04  | RLS: exactly `_prisma_migrations`, `refresh_tokens` and `users` are without RLS; FORCE on the 7 tables these migrations touch                                                                                                              |
| 05  | Exact policies on `academy_applications` and `player_registration_requests`; **no policy anywhere grants rows to a context without an actor**                                                                                              |
| 06  | Every definer function in `public`: pinned `search_path`, owned by the table owner, not executable by PUBLIC. The 18 Phase 3A functions exist and are executable by every runtime role. RLS helpers stay invoker; trigger functions pinned |
| 07  | The append-only triggers exist and are enabled                                                                                                                                                                                             |
| 08  | Exact table and column privileges per runtime role (`users`, `tenants`, `audit_logs`, `app_notifications`, `academy_applications`, `player_registration_requests`, append-only tables); no TRUNCATE anywhere; no PUBLIC table privileges   |
| 09  | No plaintext claim codes                                                                                                                                                                                                                   |

**Mutation-checked:** eight deliberate regressions were each caught by the right section:

- audit INSERT re-granted;
- anonymous clause restored;
- privilege flag re-granted;
- definer function executable by PUBLIC;
- `search_path` unpinned;
- append-only trigger disabled;
- FORCE RLS removed;
- a plaintext claim code.

## 8. Test results (isolated PostgreSQL 18, synthetic data only)

| Test                                                                                                     | Result                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model fidelity                                                                                           | The isolated "Neon model" (same migration history, with 104105500 resolved only, and the repository's provisioning script) was compared with the real Neon post-M1 snapshot: policies, table grants, 1,206 column grants, function grants, triggers and ownership identical. Five function bodies differ only in line endings (CRLF on Neon) |
| Boundary suite, Neon history, as `sportexus_app`                                                         | ✅ 121/121                                                                                                                                                                                                                                                                                                                                   |
| Boundary suite, fresh history (104105500 executed), as `academy_runtime_ci`, with no provisioning script | ✅ 121/121; the anonymous clause is removed                                                                                                                                                                                                                                                                                                  |
| Idempotency (M2 and M3 re-run)                                                                           | ✅ zero catalog differences                                                                                                                                                                                                                                                                                                                  |
| Repository SQL suites in the proposed CI flow                                                            | ✅ `audit-append-only`, `runtime-role-privileges` (updated draft), `tenant-rls`, `onboarding-and-invitations`. The **current** privilege test fails only on the intended change (it asserts audit INSERT)                                                                                                                                    |
| `verify-catalog.sql` on both histories                                                                   | ✅ all 9 sections; 8/8 mutations detected                                                                                                                                                                                                                                                                                                    |
| Neon (read-only)                                                                                         | Untouched (24 migrations). 0 claim codes. The owner role bypasses RLS                                                                                                                                                                                                                                                                        |

The suite's checks include the following:

| Area                    | What the suite verifies                                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Academy applications    | Anonymous reads return nothing. Inserts for another applicant are refused. Status and review fields cannot be forged. Submitted fields cannot be rewritten |
| Platform admins         | A suspended platform admin loses admin row access                                                                                                          |
| Audit and notifications | Direct inserts into audit logs and notifications are refused. Forged tenant contexts are caught. Off-site notification links are refused                   |
| Join requests           | Refused for inactive academies, and capped per academy and email                                                                                           |
| Portal claims           | Codes are single use. Codes issued before M2 still redeem. Guardian takeover is refused                                                                    |
| User privileges         | Self-promotion, password takeover and account deletion through SQL are all refused                                                                         |
| Platform roles          | The last platform owner is protected. Demotion and suspension end sessions                                                                                 |
| Academies               | Approval provisions all five records atomically, and a slug collision provisions nothing. Deletion requires the owner and no history                       |

## 9. Behaviour changes that need your decision

| #   | Change                                                                                                    | Recommendation                                                        |
| --- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| B1  | Join requests only for **ACTIVE** academies (today any existing academy, including SUSPENDED)             | Accept                                                                |
| B2  | At most **5 pending** join requests per academy and contact email                                         | Accept (adjustable number)                                            |
| B3  | `MORE_INFO_REQUESTED` applications also reserve their slug (today a collision could block approval later) | Accept                                                                |
| B4  | A guardian record linked to an account can no longer be re-claimed by another account                     | Accept (security fix)                                                 |
| B5  | A password change also cancels outstanding reset codes and links                                          | Accept                                                                |
| B6  | A suspended platform admin no longer passes admin RLS checks (login already refuses them)                 | Accept                                                                |
| B7  | Approving a **REJECTED** application is still possible, as today                                          | Decide: keep, or allow only from PENDING_REVIEW / MORE_INFO_REQUESTED |
| B8  | Notification links limited to application-relative paths (all current links comply)                       | Accept                                                                |

## 10. Other findings from this round

| #   | Finding                                                                                                                                                                                                                                           | Status                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| S6  | Privilege escalation, account takeover and deletion through the runtime role (§0)                                                                                                                                                                 | Fixed by M3                                                                                     |
| S7  | Re-running `provision-runtime-role.sql` silently **dropped** M1's `users.session_version` grant: its `REVOKE ALL ON users` re-grants a fixed list. That would have broken K13b under the runtime role. It would also undo every M2/M3 restriction | `session_version` fix committed now; the script is reduced to role-level setup together with M3 |
| S8  | Fresh self-host/VPS installs: no repository file grants table privileges to `academy_runtime`, so the API cannot run as the runtime role there                                                                                                    | Fixed by the M3 baseline                                                                        |
| S9  | Portal claim codes: stored in plaintext; 32 bits (`ACAD-` + 8 hex characters) for 7 days; `POST /portal/claim` has no rate limit; guardian takeover. No UI generates codes today                                                                  | M2 (hashing, takeover) plus code: 10-character codes and a rate limit                           |
| S10 | Academy approval and permanent deletion would fail under the runtime role (branch and membership inserts; no DELETE on tenants)                                                                                                                   | Fixed by M3 functions                                                                           |
| —   | The 3A.1 report said "policies 101 → 101". 101 was the snapshot's **output line count**: multi-line policy expressions span several lines. The real count is 81 policies (83 after M2). The comparison itself was exact                           | Corrected in `DEVELOPMENT_STATUS.md`                                                            |
| —   | `must_reset_password` is never cleared by any code path                                                                                                                                                                                           | Reported, out of scope                                                                          |
| —   | Residual: `users` is readable on every column, including token hashes (revision 2 S3-e). Tenant staff can set `players.user_id` / `guardians.user_id` directly within their tenant                                                                | Follow-up proposals                                                                             |

## 11. Application changes that go with M2/M3 (after approval)

These are code-only and work under both the owner and the runtime role:

1. **`AuditService.logEvent`:** calls `append_audit_log` with the expected tenant and actor, inside the caller's
   transaction, or in its own context transaction.
2. **`NotificationsService`:** creation through `create_app_notification` in a context transaction; list, count and
   mark-as-read under the ACTOR context.
3. **`AuthService.register`:**
   - `academy_slug_in_use`;
   - user insert without `isEmailVerified` and application insert without `status` (database defaults);
   - the actor set to the new user before the application insert.

   Login gating runs under the ACTOR context.

4. **`AuthService.changePassword`:** `change_own_password`, then `generateTokens` with the returned version, in one
   transaction.
5. **`PortalService`:**
   - join requests, the public directory and claim redemption through the functions;
   - `generateClaimToken` stores the hash and issues 10 base-32 characters;
   - rate limit on `/portal/claim`.
6. **`PlatformService`:** invites, roles, security policy, session revocation, approval and permanent deletion
   through the functions; database error codes mapped to the existing HTTP errors.
7. **`FinanceService`:** the expense-notification membership lookup under the TENANT context.
8. **Startup guard (S3 h):** production and staging refuse a superuser, BYPASSRLS or table-owning database role.
9. **CI:**
   - create the CI role before migrations (`ci/runtime-role-create.sql`);
   - remove `runtime-role-setup.sql`, whose grants are now owned by M3, identical or narrower;
   - update `runtime-role-privileges.sql`;
   - add `m2-m3-boundaries.sql` and `verify-catalog.sql`;
   - reduce `provision-runtime-role.sql` to role creation, CONNECT and USAGE.

## 12. Proposed next steps

1. **You review this document and the SQL**, and decide B1–B8.
2. On approval:
   - move M2 and M3 into `prisma/migrations`;
   - implement §11 with unit tests;
   - run the **whole API as `sportexus_app` against the isolated synthetic database**: the revision 3 §C.3 workflow
     matrix over HTTP, plus the cross-tenant suite. This needs no Neon branch and no real data. Its catalog is proven
     identical to Neon's.
3. **Neon branch:** a branch of the dev database would copy its data, including user records. I recommend using one
   only for the final migration rehearsal, and only after you confirm the dev data is synthetic or sanitized. The
   password for the restricted role stays with you.
4. Then, with your approval: Neon backup and restore test, M2 and M3, `verify-catalog.sql`, and the runtime-role
   switch.
