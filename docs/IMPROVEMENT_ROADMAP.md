# Improvement Roadmap

> Created 2026-11-15 from the full-stack review. Updated after every approved group.
> Detailed issue history: `docs/DEVELOPMENT_STATUS.md`.

## How we work

For every issue or group:

1. State the root cause and the impact.
2. Propose a fix, naming the layers touched and any API, migration or business-rule change.
3. Wait for owner approval.
4. Implement only what was approved.
5. Test the affected layers.
6. Report the results and wait for review.

After every group, both applications must build and start locally. Reports always say which tests used mocks and
which ran against a real database or real accounts.

Until the critical security and stability work (groups 1–2) is done:

- no broad refactors;
- no breaking API changes;
- no migrations;
- no role or business-rule changes without approval;
- no Phase 1 Step 5 and no new features.

## Status

| Group | Scope                                                                                   | Status                                                                                                   |
| ----- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1     | Password-reset hardening (K1 + K13)                                                     | Approved. Migration drafted, not applied. **Waiting on the owner's choice of target database (see E1).** |
| 2     | Build hygiene: typecheck, lint, format, all tests and builds green on Windows and Linux | Approved as the next priority. To be proposed as focused tasks after Group 1.                            |
| —     | K2 committed backup                                                                     | Investigated (see below). Remediation awaits owner approval.                                             |
| —     | K3, K5, K8                                                                              | Pending. Explain the current logic and propose rules before any change.                                  |
| —     | BR-1, BR-2                                                                              | Pending scope review.                                                                                    |
| —     | BR-3                                                                                    | Pending the staff-invitation product decision.                                                           |
| —     | Real authenticated login test                                                           | Outstanding (needs a test account).                                                                      |

## A. Critical security and data

| #   | Issue                                                                                                                                                                                                                                                                                                        | Layers                         | Change type                                                    | Status                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | -------------------------------------------------------------- | ------------------------------- |
| K1  | The 6-digit password-reset code can be guessed without limit. The try counter is keyed by the _guessed_ code, the code is accepted without the email, and there is no per-IP limit. Result: account takeover.                                                                                                | Backend, frontend, DB function | API: `email` required with 6-digit codes. Migration: additive. | Group 1                         |
| K2  | `packages/database/backup_pre_migration_coach_delegation.json` is tracked and pushed. It contains account data and password hashes.                                                                                                                                                                          | Repository                     | History rewrite needs approval                                 | Investigated; awaiting decision |
| K3  | Suspended academies keep working: no `tenant.status` check in the tenant guard or at login.                                                                                                                                                                                                                  | Backend                        | Business rule                                                  | Pending                         |
| K8  | Closing a cashier session needs only `session_expenses.read` (granted to Receptionist, Coach and Viewer).                                                                                                                                                                                                    | Backend                        | Role permission                                                | Pending                         |
| E1  | **Environment wiring.** The API's `backend/.env` and root `.env` point to a **cloud** Neon PostgreSQL and cloud Upstash Redis. `packages/database/.env`, which Prisma CLI and migrations use, points to **local** PostgreSQL. The running dev API and `prisma migrate` therefore target different databases. | Configuration                  | Owner decision                                                 | Found 2026-11-15                |

### K2 findings (sanitized, 2026-11-15)

No values were displayed and nothing was sent externally.

- **Classification:** Uncertain, mostly development or test data. Indicators:
  - test and `.local` email domains;
  - placeholder phone and national-ID patterns;
  - loopback-only IP addresses in the audit log;
  - many scripted user agents;
  - all records created in 2026-10.

  However, some accounts use public webmail addresses and realistic names, so real people (developers, testers or pilot
  users) cannot be ruled out.

- **Records:**
  - 29 users;
  - 15 academies and 15 academy applications;
  - 16 memberships;
  - 17 branches;
  - 6 players and 5 guardians;
  - 5 join requests;
  - 27 notifications;
  - 270 audit-log rows;
  - other operational tables.
- **Sensitive fields:**
  - names, emails and phone numbers;
  - 15 real Argon2id password hashes. The other 14 accounts hold a non-usable placeholder value defined in the code.
  - 1 password-reset token, expired;
  - player national IDs and dates of birth;
  - guardian phone numbers;
  - player QR card codes (6, of which 1 is revoked);
  - attendance QR secrets (all expired);
  - audit metadata containing emails, IP addresses and user agents.
- **Not present:** refresh tokens and sessions.
- **Git exposure:**
  - tracked since `ae8791b` (2026-10-28), 2 versions;
  - pushed to `origin` (github.com) on `main` and 10 other remote branches;
  - repository visibility not verified (owner to confirm).
- **Local database:** none of the 29 accounts exist in the local PostgreSQL database, so the dump came from another
  environment. The cloud database (E1) was not checked.

## B. Functional bugs

| #   | Issue                                                                                     | Needs                      |
| --- | ----------------------------------------------------------------------------------------- | -------------------------- |
| K13 | Changing a password does not sign out other sessions.                                     | Group 1                    |
| K5  | Storage maintenance fails once old audit logs exist (append-only trigger).                | Retention decision         |
| K6  | Public join requests never link the applicant's account.                                  | Decision (open question 6) |
| K9  | Join-request approval can merge same-name children and defaults gender and date of birth. | Business rule (with BR-2)  |
| K11 | Receipt numbers have only 4 random digits and are not unique.                             | Probably a migration       |
| K12 | The receipt email is sent inside the database transaction.                                | Backend fix                |
| K10 | The invite response returns the raw invitation token.                                     | Small API change           |
| F15 | The frontend checks for `VALIDATION_ERROR`; the API sends `VALIDATION_FAILED`.            | With BR-1                  |
| F10 | `--brand-surface` is used but never defined.                                              | Frontend fix               |
| K4  | Finance always writes `SAR`; tenants default to `EGP`.                                    | Currency decision          |

## C. Build hygiene (Group 2)

Baseline 2026-11-15:

- **Database tests:** 3/6 fail; the tests are stale (K15).
- **Backend lint:** 2 errors and 104 `no-explicit-any` warnings.
- **Formatting:** Prettier flags 28 files: 16 in the backend, 5 docs, and others.
- **Line endings:** CRLF vs LF noise on Windows.

Rule for this group: no disabling of rules and no suppression.

## D. Architecture (incremental, each step needs approval)

**Backend**

- Oversized services: `platform` 2,112 lines, `attendance` 1,969, `players` 1,571, `finance` 1,424.
- Optional extracted services duplicate the logic of the originals.
- The repository layer is unused.

**Frontend**

- Phase 1 Steps 5–13 remain: attendance session and scanner, settings, groups, evaluations, finance, dashboard,
  platform.
- F13: the evaluations pages have no client-side access guard.

**Documentation**

- The role-permission matrix doc differs from the code in 18 cells.

## E. Optional, later

- Store money as `Decimal` (migration).
- Enforce plan limits.
- Generate SaaS invoices.
- Move email sending to a background job queue.
- Prisma major-version upgrade (not recommended now).

## Decision log

| Date       | Decision                                                                                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11-15 | Group 1 (K1 + K13) approved. The migration must be shown, with a backup confirmation, before it is applied to the local database. Nothing is applied to production. The 6-digit code and 5-minute expiry are kept. |
| 2026-11-15 | Group 2 is next after Group 1. K2: do not delete the file or rewrite history yet. K3, K5, K8 stay pending. Roadmap saved here.                                                                                     |
