# Improvement Roadmap

> Created 2026-11-15; Phase 1 audit completed 2026-11-15. Updated after every phase.
> Related documents: `docs/API_INTEGRATION_MAP.md` (generated endpoint map) and `docs/DEVELOPMENT_STATUS.md` (issue
> history, K/F numbering).

## How we work

**Before each phase:** present the findings and the intended changes, then wait for approval.

**Approval is always required for:**

- major architectural changes;
- destructive operations;
- changes that affect existing data;
- business-rule or role changes;
- breaking API changes.

**Within an approved scope:** safe, reversible code improvements may go ahead.

**After each phase, report:**

- what was wrong;
- what changed;
- which files changed;
- why the change was needed;
- the tests run and their results;
- remaining issues;
- the next proposed phase.

Reports always say which tests used mocks and which ran against a real database or a real account. The application must
build and start locally after every phase.

## Status

| Phase | Scope                                                             | Status                                                                                                                                       |
| ----- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Complete audit                                                    | ✅ Done 2026-11-15; plan approved                                                                                                            |
| 2A    | Structure and code hygiene                                        | ✅ Done 2026-11-15, including the approved follow-ups (Prisma generation, test type checking, Next.js lint rules, Node 22). Awaiting review. |
| 3A.1  | Security: K1 + K13 + K13b + S1, S5 retired                        | ✅ Done 2026-11-15 (`45624c2`…`fb0ccad`); M1 applied to Neon dev after a verified backup. See DEVELOPMENT_STATUS §9c. Awaiting review.       |
| 3A.2  | Security: S4 (M2) + S3 (M3, runtime role)                         | SQL clarifications and isolated Neon branch tests first; needs separate approval                                                             |
| 3A.3  | Security: S2 trusted origins                                      | Needs the owner's list of origins per environment                                                                                            |
| 3B    | Backend performance                                               | Approved in principle; detailed proposal before start                                                                                        |
| 3C    | Database: Decimal money, unique receipt numbers                   | Approved in principle; migrations need backup and review                                                                                     |
| 4     | Frontend: persistent layout, data states                          | Approved in principle; detailed proposal before start                                                                                        |
| 5–7   | Integration, performance and security verification, final testing | Not started                                                                                                                                  |

## Environment facts (measured 2026-11-15)

**Where the services run**

| Component               | Development (this machine)                           | Staging (`render.yaml`)                               | Self-host (`docker-compose.prod.yml`) |
| ----------------------- | ---------------------------------------------------- | ----------------------------------------------------- | ------------------------------------- |
| API                     | `nest start --watch` on port 3001                    | Render free plan, Frankfurt                           | VPS, Docker                           |
| PostgreSQL              | **Neon cloud, aws us-east-2 (Ohio), PG 18.7, 12 MB** | Neon (same)                                           | `postgres:16-alpine`, next to the API |
| Redis                   | **Upstash cloud**                                    | —                                                     | `redis:7-alpine`                      |
| Prisma CLI / migrations | **Local PostgreSQL 17** (`packages/database/.env`)   | `docker-entrypoint.sh` runs `migrate deploy` on start | same                                  |

**Measured latency**

- **Network round trip, this machine → Neon:** about 150 ms.
- **Simple DB-backed API call:** about 150 ms.
- **Tenant request:** typically 4–6 round trips, because each runs as a transaction: `BEGIN`, `set_config`, the queries,
  then `COMMIT`.
- **Cold start:** the first request after Neon scales to zero took **5.3–6.4 s**.
- **Staging:** the Render API in Frankfurt talks to Neon in Ohio, so every query crosses the Atlantic.

**Frontend build baseline**

- First-load JavaScript is 103–232 kB per route; the heaviest route is `/attendance/scanner`.
- Both applications build.

## Phase 1 findings

### A. Critical: security and data

| #   | Finding                                                                                                                                                                                                                                                                                                                                     | Evidence                               | Layers                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------- |
| K1  | **Password-reset codes can be guessed without limit, which allows account takeover.** The try counter is keyed by the _guessed_ code; the code is accepted without the email; there is no per-IP limit.                                                                                                                                     | `auth.service.ts` `resetPassword`      | API, DB function, frontend |
| S1  | **Client IP addresses are lost or spoofable.** Express `trust proxy` is not set, and every request passes through the Next.js `/v1` proxy. `req.ip` is therefore the proxy's address for every user: audit logs record it, IP rate limits behave as one shared bucket, and the proxy forwards the client's own `X-Forwarded-For` unchecked. | `main.ts`, `app/v1/[...path]/route.ts` | API, frontend proxy        |
| K2  | A data dump is tracked and pushed to GitHub: 29 accounts, 15 real Argon2id hashes, personal data. Classified _Uncertain, leaning demo_.                                                                                                                                                                                                     | See "K2 findings"                      | Repository                 |
| K3  | Suspended academies keep working.                                                                                                                                                                                                                                                                                                           | `tenant.guard.ts`, login               | API (business rule)        |
| K8  | Closing a cashier session requires only `session_expenses.read`.                                                                                                                                                                                                                                                                            | `finance.controller.ts`                | API (role rule)            |
| K13 | Changing a password does not sign out other sessions.                                                                                                                                                                                                                                                                                       | `auth.service.ts` `changePassword`     | API                        |

### B. Integration (frontend ↔ backend)

The full list is in `docs/API_INTEGRATION_MAP.md`.

**Wiring**

- All 123 frontend API methods map to an existing backend route; none is broken.
- 19 frontend methods are never called.

**Backend features with no reachable UI**

- revoking staff access;
- archiving a branch or an academy;
- editing a training group;
- enrollment history and extra enrollments;
- attendance correction;
- creating evaluation templates;
- the player subscription detail;
- the platform announcements console;
- **staff generation of account-claim codes**, without which the player/guardian portal "claim account" flow can never
  start.

**Other gaps**

- **F17 / BR-2:** join-request fields are collected in the form but not stored.
- **K6:** public join requests never link the applicant's account.
- **Fabricated figure:** the dashboard's Players card always shows "+12%" with an up-trend (`app/dashboard/page.tsx:433`).
- **Errors shown as empty data:** 35 `.catch(() => empty)` handlers in 15 files make an API failure look like "no data"
  (worst: dashboard 8, platform 7, evaluations 4).
- **K4:** finance always writes `SAR`; 43 UI places hard-code the SAR label, while academies default to `EGP`.

### C. Frontend architecture and navigation

- **Sidebar remounts on every navigation.** The only layout is the root one, and each of 40 `page.tsx` / `loading.tsx`
  files renders its own `<AppShell>`. On every navigation, therefore:
  - the Sidebar and Topbar unmount and mount again;
  - the collapsed state is re-read from `localStorage`, so the sidebar can flash;
  - the tenant menu, scroll position and mobile drawer state reset;
  - the Topbar re-requests the unread count and restarts its 30-second polling;
  - the content fade-in animation replays.

  Fix: an App Router route-group layout.

- **Navigation itself is sound:** all internal links use `next/link`. The only full reloads are on logout, offline retry
  and service-worker updates, all intentional.
- **Oversized pages:**
  - `attendance/sessions/[id]` 2,081 lines;
  - `attendance/scanner` 1,264;
  - `settings` 1,155;
  - `groups/[id]` 1,075;
  - `evaluations` 884;
  - `sessions` 764;
  - `dashboard` 715;
  - `branches` 672;
  - `groups` 649.
- **Data loading:** hand-written per page with `useState`/`useEffect`. A shared 25-second GET cache exists in `lib/http`;
  there is no common hook for loading, error, empty and retry states (done only for players, Step 4).
- **Access guard:** F13, the evaluations pages have no client-side access guard.
- **Styling:** F10, `--brand-surface` is used but undefined.
- **Not yet audited:** responsive layout and accessibility have not been checked in a real browser at tablet or mobile
  widths. This is planned for Phase 4.

### D. Backend architecture and API

**Oversized services**

| Service      | Lines |
| ------------ | ----- |
| `platform`   | 2,112 |
| `attendance` | 1,969 |
| `players`    | 1,571 |
| `finance`    | 1,424 |
| `email`      | 1,296 |

**Duplicated or unused code**

- **Optional fallbacks:** three extracted services (`AttendanceRosterService`, `FinancePlansService`,
  `PlatformMetricsService`) are injected `@Optional()`. The original services keep full copies of the same logic as a
  fallback, so the two can drift apart.
- **Unused repository layer:** the repositories are registered, but no service uses them.

**Query efficiency**

- **N+1 loops:** `attendance.service.ts` runs 11 database calls inside loops: bulk attendance (an enrollment lookup per
  player) and offline sync (a player lookup per item).
- **In-memory aggregation:**
  - the finance dashboard loads **every** transaction and sums the amounts in JavaScript;
  - rankings load every player with all of their evaluations;
  - attendance reports load whole session sets.
- **Unpaginated lists:** enrollments, evaluations, platform academies and applications, join requests, staff.
- **K12:** the receipt email is sent inside the database transaction.

**API consistency**

- **List shapes vary:** some lists return `{ items, total, page, … }`, others a bare array.
- **Errors are uniform:** the `GlobalExceptionFilter` gives all errors one shape.

**Configuration**

- `render.yaml` defines `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_CSRF_SECRET`, `JWT_ACCESS_EXPIRES_IN`,
  `JWT_REFRESH_EXPIRES_IN` and `DIRECT_URL`; the code reads none of them.
- The Prisma schema has no `directUrl`, so migrations would run through Neon's connection pooler.

**Verified sound**

- Every endpoint is guarded or deliberately public.
- No unsafe raw SQL; all raw queries are parameterized.
- No secrets in logs.
- Cookies are `httpOnly` with `SameSite=lax`, and `Secure` in production.
- The production configuration guards reject the default JWT secret, wildcard CORS and a missing Redis.
- Security headers are set.
- No unused dependencies.

### E. Database

**Integrity is strong**

- Tenant-scoped foreign keys are composite `(tenant_id, id)`, which prevents cross-academy references.
- 74 indexes.
- Row-level security with FORCE.
- An append-only audit log.

**Problems**

- **K16:** 14 money fields and 5 score fields are `Float`. Ledger sums can accumulate rounding errors.
- **K11:** `receipt_number` is nullable, has no uniqueness constraint, and is generated with 4 random digits.
- **K5:** storage maintenance tries to delete audit logs and hits the append-only trigger.
- **K15:** the tests in `packages/database` are stale (3 of 6 fail).
- **Backups:** a full backup needs a superuser or a BYPASSRLS role; the app role cannot dump the data.
- **Version drift:** PostgreSQL 18 (Neon), 17 (local) and 16 (Docker).

### F. Code quality and CI

- **Backend lint:** 2 errors and 104 `no-explicit-any` warnings.
- **Formatting:** Prettier flags 28 files.
- **Line endings:** CRLF vs LF noise on Windows.
- **Database tests:** 3 failing (K15).
- **Passing:** type checking, unit tests and both builds.

### K2 findings (sanitized)

No values were displayed and nothing was sent externally.

- **Records:**
  - 29 users;
  - 15 academies and 15 academy applications;
  - 16 memberships;
  - 17 branches;
  - 6 players and 5 guardians;
  - 5 join requests;
  - 27 notifications;
  - 270 audit-log rows.
- **Sensitive fields:**
  - names, emails and phone numbers;
  - 15 Argon2id password hashes (the other 14 accounts hold a non-usable placeholder);
  - 1 expired reset token;
  - player national IDs and dates of birth;
  - QR card codes;
  - audit metadata with emails, IP addresses and user agents.
- **Not present:** refresh tokens and sessions.
- **Git exposure:**
  - tracked since `ae8791b` (2026-10-28), in 2 versions;
  - pushed to GitHub on `main` and 10 other branches;
  - repository visibility not verified.
- **Local database:** none of the 29 accounts exist locally. The Neon database was not checked.

## Database hosting evaluation

**Requirements**

- Users are in Egypt and Saudi Arabia (EGP/SAR, `Africa/Cairo`).
- Current data: 12 MB.
- The API runs on Render (Frankfurt) or a VPS.
- Neon is used for development and testing only (owner, 2026-11-15).
- No paid subscription without the owner's decision.

**Provider comparison**

| Option                            | Cost                                                                  | Limits that matter                                                                                                            | Fit                                                                                                                                                                        |
| --------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Neon Free**                     | $0                                                                    | 1 GB storage per project; 100 CU-hours/month; scales to zero after 5 minutes idle (cannot be disabled); 6-hour restore window | ✅ Enough for development and testing: 12 MB used, about 1% of storage. ⚠ Cold starts measured at 5–6 s. ⚠ Region (Ohio) is far from both the users and the Frankfurt API. |
| Neon Launch                       | Pay-as-you-go, about $0.106/CU-hour plus $0.35/GB-month               | 7-day restore                                                                                                                 | Later, only if usage needs it                                                                                                                                              |
| Render Postgres                   | Free tier deleted after 30 days; Basic from about $6/month            | Free has no backups                                                                                                           | Free tier is unsuitable. Basic is a sensible _production_ option when the API is on Render: same region, private network.                                                  |
| Railway                           | Hobby $5/month minimum plus usage; small always-on Postgres about $6+ | No free tier, only a trial credit                                                                                             | No advantage here                                                                                                                                                          |
| Supabase Free                     | $0                                                                    | 500 MB; **paused after 1 week of inactivity**; no backups                                                                     | Worse than Neon Free for this project                                                                                                                                      |
| Self-host (VPS, already scripted) | VPS cost only                                                         | You own backups and upgrades                                                                                                  | Cheapest for production; most operational work                                                                                                                             |

Third-party pricing pages disagree on some figures (Neon Free storage is 0.5 GB on some pages, 1 GB on Neon's own).
Confirm on each provider's pricing page before any decision.

**Recommendation**

- **Keep Neon Free for development and testing.** No migration of providers and no spending.
- **Optional:** recreate the Neon project in an EU region (Frankfurt, next to the Render API and closer to the users).
  The region cannot be changed in place, but at 12 MB a dump and restore is trivial. Region availability to be
  confirmed in the Neon console.
- **Decide production hosting separately, when it becomes relevant.** The rule: run the database in the same region as
  the API.

### Moving the Neon project to Frankfurt (evaluated, not executed)

**Why:** the API on Render runs in Frankfurt and the users are in Egypt and Saudi Arabia, but the database is in Ohio.
From the development machine a round trip is about 150 ms today. A tenant request needs 4–6 round trips, so the
API↔database distance dominates response time.

**Expected impact** (estimates, to be measured after any move):

- **Render staging:** Frankfurt↔Frankfurt round trips are a few milliseconds, instead of crossing the Atlantic. This is
  the largest gain.
- **Development from Egypt:** a shorter route to Frankfurt than to Ohio.
- **Unchanged:** the Neon Free limits, the plan, and the 5-minute scale-to-zero (cold starts remain).

**Steps:**

1. **Create the new project.** Create a new Neon project in the EU region (AWS Frankfurt, if offered in the console)
   with PostgreSQL 18, the same major version as today. No cost on Free.
2. **Recreate the roles.** Create the runtime role (`sportexus_app` / `academy_runtime`) and its grants using
   `packages/database/scripts/provision-runtime-role.sql`.
3. **Back up.** Take a full logical backup of the current project with the owner role (`pg_dump -Fc`). Verify it with
   `pg_restore --list` and row counts per table.
4. **Restore** into the new project (`pg_restore --no-owner`), then run `prisma migrate status` (expect "up to date").
   Compare row counts table by table against the source.
5. **Smoke-test.** Point a _second_ local API instance at the new project using command-line environment overrides
   (no `.env` edits): health check, login, the main lists.
6. **Cut over.** Update `DATABASE_URL` in `backend/.env` and the root `.env`, and in Render's environment
   variables. This is an owner action; credentials are not handled in chat.
7. **Retire the old project.** Keep it read-only for at least 7 days, then delete it on owner approval.

**Rollback:** restore the previous `DATABASE_URL` values. The old project is untouched until step 7. Writes made to the
new project after cut-over would need a reverse dump; the window is small at the current size of 12 MB.

**Risks:**

- Extensions or role grants missing in the new project. Mitigation: `provision-runtime-role.sql` plus the CI privilege
  test scripts in `packages/database/tests`.
- Forgetting to update one environment.
- Free-plan limits apply per project; the old project counts until it is deleted.

## Phased plan

Each phase is proposed in detail and approved before it starts. Order follows risk: security and stability first, then
architecture.

**Phase 2: Structure and hygiene, no behavior change**

- 2A Build hygiene (former Group 2):
  - fix the stale database tests;
  - make real fixes for the 2 lint errors;
  - format the 28 files;
  - add `.gitattributes` for line endings;
  - CI on Linux and Windows.
- 2B Remove dead configuration: the unused `render.yaml` variables; add `directUrl` to the Prisma schema (needs
  approval).
- 2C Remove the `@Optional()` duplicate fallbacks in the three extracted services, one module per commit.

**Phase 3: Backend and database**

- 3A Security:
  - ✅ K1 + K13 + K13b, password reset and session invalidation (3A.1);
  - ✅ S1, correct client-IP handling (3A.1);
  - S4 + S3 (3A.2), S2 (3A.3);
  - K3, K8, after business decisions.
- 3B Query performance: batch the N+1 loops; move the dashboard, rankings and reports to SQL aggregation; paginate the
  growing lists.
- 3C Data integrity:
  - K11, unique receipt numbers (migration);
  - K16, `Float` to `Decimal` for money (migration, needs approval);
  - K12, send the receipt email after commit;
  - K5, after the retention decision.

**Phase 4: Frontend**

- 4A **Persistent layout:**
  - route group `app/(app)/layout.tsx` holding the AppShell;
  - pages stop rendering their own AppShell;
  - breadcrumbs become a context or slot;
  - skeletons render inside the main area only.

  Removes the sidebar and Topbar remounts.

- 4B A shared data-loading hook (loading, empty, error, retry) and replacement of the 35 error-swallowing catches.
- 4C Continue the Phase 1 page refactors in Steps 5–13: attendance, groups, settings, evaluations, finance, dashboard,
  platform.
- 4D Responsive and accessibility pass checked in a real browser; F10, F13.

**Phase 5: Integration**

- Build UI for, or retire, the endpoints with no reachable UI (product decision for each).
- Remove the "+12%" figure.
- K4 currency, after the decision.
- BR-1, BR-2 and BR-3, after review.
- End-to-end workflow checks against the real development database with real accounts.

**Phase 6: Performance and security verification**

- Before/after measurements: API latency, navigation timing, bundle sizes.
- Security re-review.
- Neon region decision.

**Phase 7: Final testing and report**

## Decision log

| Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-15 | Group 1 (K1 + K13) approved. The migration must be shown with a backup confirmation before it is applied; nothing applied to production; the 6-digit code and 5-minute expiry are kept.                                                                                                                                                                                                        |
| 2026-11-15 | Group 2 next after Group 1. K2: no deletion or history rewrite yet. K3, K5, K8 pending. Roadmap saved.                                                                                                                                                                                                                                                                                         |
| 2026-11-15 | Neon is a development/testing database, not production. Its schema and data may be changed for development. No paid services. Full-project audit requested in phases; Phase 1 first.                                                                                                                                                                                                           |
| 2026-11-15 | Phase order approved: 2A → 3A → 3B → 3C → 4. Neon stays Free (no purchase; no provider move without a cost and performance comparison). Frankfurt move: evaluate only. Backups before destructive changes. No fake statistics ("+12%" to be replaced with real data or an unavailable state). Failed requests must be distinguishable from empty results. No feature retired without approval. |
