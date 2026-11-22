# Development Status

> Last updated: **2026-11-20**: full-platform walkthrough (§9h) and detailed functional pass (§9i). Earlier: **2026-11-16**: owner decisions applied (K2-K4, K8, K9, items 5-7, S2, Render, demo data); see §9f.
> Phase 2A: §9b and `docs/IMPROVEMENT_ROADMAP.md`.
> Update this file after every task (see CLAUDE.md §15).

## 1. Current phase

- Feature development phases 0–12 are marked COMPLETED in `docs/implementation/MASTER_PROGRESS.md`.
- The repository is mid-way through an **architecture/UI-UX refactor** on branch
  `frontend-architecture-uiux-audit`: ~140 uncommitted files (modified + untracked), including
  new backend repositories, extracted services, new frontend `components/{ui,finance,platform,layout}`,
  `loading.tsx` skeletons, and a `lib/ → api/ contexts/ utils/ locales/` reorganisation.
- **Next planned phase: controlled restructuring** — awaiting owner approval (not started).

## 2. Verification baseline (run 2026-11-14 on the working tree)

| Check                                     | Result                                                                                                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@academy/shared` build + test            | ✅ 27/27 tests                                                                                                                                                                                    |
| `@academy/database` build                 | ✅                                                                                                                                                                                                |
| `@academy/database` test                  | ❌ 3/6 failing — `src/tenant-transaction.test.ts` expects separate `set_config` calls; the (uncommitted) implementation now batches them into one statement. Tests are stale, behavior is intact. |
| `@academy/api` test                       | ✅ 227/227 tests (22 files)                                                                                                                                                                       |
| `@academy/api` typecheck                  | ✅ 0 errors                                                                                                                                                                                       |
| `@academy/web` test                       | ✅ 84/84 tests (12 files)                                                                                                                                                                         |
| `@academy/web` typecheck                  | ✅ 0 errors                                                                                                                                                                                       |
| lint, format:check, build, SQL tests, E2E | ⏳ not run in this baseline                                                                                                                                                                       |

## 3. Completed (implemented in code)

Academy registration & platform approval · JWT/refresh-rotation auth, OTP reset, email verification ·
staff invitations & coach delegation · branches (archive + impact) · players & guardians (sensitive-field
gates, QR cards, safe archive) · player join requests with auto-provisioning · enrollments & transfers ·
training groups/coaches/members/schedules · attendance (manual, bulk, session QR, card scan with
lateness, offline sync, corrections, events, reports) · evaluations (templates, scoring, profile,
rankings) · academy finance (plans, subscriptions, payments, reversals, expenses with approval,
cashier closing, dashboard) · player & guardian portals · notifications · transactional email
(Resend/SMTP/dev) · platform console (academies, users, plans, announcements, audit, security,
applications, governance, storage) · bilingual UI (ar/en, RTL/LTR) · PWA/offline · CI pipeline ·
Docker/VPS/self-host deployment assets.

## 4. Incomplete / in-progress

| Item                    | Evidence                                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository layer        | `backend/src/modules/database/repositories/*` registered in `DatabaseModule` but **no service uses them**.                                                                |
| Service extraction      | `AttendanceRosterService`, `FinancePlansService`, `PlatformMetricsService` are injected `@Optional()`; the original methods keep full fallback copies → duplicated logic. |
| Frontend reorganisation | `src/lib/*` are 2-line re-export shims; `src/lib/i18n/translations.ts` is a **byte-identical duplicate** of `src/locales/translations.ts`.                                |
| `AuthGuard` component   | `frontend/src/components/layout/AuthGuard.tsx` exists, unused; every page re-implements auth redirects.                                                                   |
| SaaS plan limits        | Only `maxPlayers` is enforced, and only on join-request approval (`players.service.ts:1135`). `maxBranches`, `maxCoaches`, and manual player creation are not limited.    |
| SaaS invoices           | `saas_invoices` table/model exists; no service creates or updates invoices.                                                                                               |
| Support access          | Records an audit entry only; no actual read-only support session mechanism.                                                                                               |
| Background jobs         | BullMQ mentioned in README "later"; emails are sent inline.                                                                                                               |

## 5. Known issues (verified in code — not yet fixed)

Severity is an engineering estimate; none of these were changed.

| #   | Sev                       | Issue                                                                                                                                                                                                                                                  | Location                                                                                                             |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| K1  | ✅ Fixed `1e31a60` (3A.1) | **OTP reset brute-force guard is ineffective**: the attempt counter key is the hash of the _submitted_ code, so every wrong guess uses a new key; reset accepts the 6-digit code without the email, so any pending reset in the system can be guessed. | `backend/src/modules/auth/auth.service.ts:570`, `packages/shared/src/schemas/auth.ts:75`                             |
| K2  | ✅ Fixed `a38429b`        | **Committed data dump** with 29 users incl. `passwordHash` and token columns, tenants, players.                                                                                                                                                        | `packages/database/backup_pre_migration_coach_delegation.json` (tracked in git)                                      |
| K3  | ✅ Fixed `0d5c62f`        | **Suspended academies keep working**: `TenantGuard` and login never check `tenant.status`; plain suspension does not revoke sessions (only Owner archive does).                                                                                        | `backend/src/modules/auth/guards/tenant.guard.ts`, `platform.service.ts:252`                                         |
| K4  | ✅ Fixed `cd184d0`        | **Currency hard-coded to `SAR`** on payments and expenses (and across finance UI), while tenants, plans and settings default to `EGP`.                                                                                                                 | `finance.service.ts:440, 512, 834`; `frontend/src/components/finance/*`, `app/finance/page.tsx`, `app/attendance/**` |
| K5  | ✅ Fixed `5110e57` (3A.2) | **Storage maintenance cannot purge audit logs**: `auditLog.deleteMany` hits the append-only trigger → the whole maintenance transaction (incl. token purge) fails when old logs exist.                                                                 | `platform.service.ts:2078` vs migration `20261016000100_audit_log_append_only`                                       |
| K6  | ✅ Fixed (§9e)            | **Public join requests never link the applicant**: `POST /portal/player-join-requests` has no JWT guard, so `@CurrentUser('id')` is always undefined → `applicantUserId` null → no applicant notifications, no login gating for players.               | `backend/src/modules/portal/portal.controller.ts:75`                                                                 |
| K7  | ✅ Fixed `f1ddeca` (F22)  | **National ID leaks in player list** to every `players.read` role (COACH, VIEWER, ACCOUNTANT); detail view masks it.                                                                                                                                   | `players.service.ts:156` vs `:263`                                                                                   |
| K8  | ✅ Fixed `af61196`        | **Cashier close requires only `session_expenses.read`** (granted to RECEPTIONIST, COACH, VIEWER).                                                                                                                                                      | `finance.controller.ts:171-172`                                                                                      |
| K9  | ✅ Fixed `ee1eebd`        | Join-request approval may **merge different children with the same first+last name** into one player; defaults gender MALE / DOB 2012-01-01 when unknown.                                                                                              | `players.service.ts` (`reviewPlayerJoinRequest`)                                                                     |
| K10 | Low                       | Invitation API response returns the raw invitation token to the inviter.                                                                                                                                                                               | `tenancy.service.ts:246`                                                                                             |
| K11 | ✅ Fixed `e25d30f`        | Receipt/expense numbers use `Math.random()` 4 digits (`REC-YYYY-####`) — collisions likely at volume; no uniqueness constraint.                                                                                                                        | `finance.service.ts:426, 823`                                                                                        |
| K12 | ✅ Fixed `e25d30f`        | Payment receipt email is sent (with retries) **inside** the DB transaction, holding the transaction open.                                                                                                                                              | `finance.service.ts:506`                                                                                             |
| K13 | ✅ Fixed `1e31a60` (3A.1) | `changePassword` does not revoke other refresh tokens (reset does).                                                                                                                                                                                    | `auth.service.ts` (`changePassword`)                                                                                 |
| K14 | Low                       | Missing space in class list: `bg-(--bg-base)text-(--text-main)` → text colour class not applied.                                                                                                                                                       | `frontend/src/components/layout/AppShell.tsx:22`                                                                     |
| K15 | ✅ Fixed `b33d68f`        | Stale tests in `packages/database/src/tenant-transaction.test.ts` (see §9b).                                                                                                                                                                           |                                                                                                                      |
| K16 | ✅ Fixed `e25d30f`        | Monetary amounts stored as `Float` (double) — rounding risk for ledger sums.                                                                                                                                                                           | `schema.prisma` (finance models)                                                                                     |

## 6. Documentation vs implementation discrepancies

| Doc                                       | Says                                                                                                                                                                                                                                      | Code does                                                                                                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/security/ROLE_PERMISSION_MATRIX.md` | 18 cells differ, e.g. COACH `attendance.mark` ✅, MANAGER `players.delete` ✅, RECEPTIONIST/COACH/ACCOUNTANT/VIEWER `staff.read` ✅, VIEWER `evaluations.read` ✅, BRANCH_MANAGER `session_expenses.approve` ❌, VIEWER `reports.read` ❌ | See `ROLE_PERMISSIONS` table in BUSINESS_LOGIC.md §1.2                                                                                                         |
| `docs/implementation/MASTER_PROGRESS.md`  | Paths `apps/api`, `apps/web`; endpoints `/platform/applications/:id/approve                                                                                                                                                               | reject`                                                                                                                                                        | Paths `backend/`, `frontend/`; endpoint `PATCH | POST /platform/applications/:id/review` |
| `MASTER_PROGRESS.md` Phase 2              | "Removed debug tokens from all public API responses"                                                                                                                                                                                      | `forgot-password` returns `debugOtp` when `NODE_ENV=development`                                                                                               |
| `README.md`                               | Runtime role denied `INSERT` on `tenants`                                                                                                                                                                                                 | Platform approval creates tenants through Prisma under `withPlatformAdminTransaction` — must rely on later grants/policies (not re-verified against a live DB) |
| `README.md`                               | `packages/*-config` "Shared TypeScript / ESLint" and BullMQ                                                                                                                                                                               | Config packages exist; BullMQ not installed                                                                                                                    |

## 7. Open questions (need product-owner decision)

1. ~~**Permissions**~~ Decided 2026-11-16: `ROLE_PERMISSION_MATRIX.md` is the source of truth (§9f).
2. ~~**Currency**~~ Decided 2026-11-16: each academy's own currency (§9f, K4).
3. ~~**Tenant suspension**~~ Decided 2026-11-16: closed for everyone at once (§9f, K3).
4. ~~**Cashier close**~~ Decided 2026-11-16: owner, manager, branch manager, accountant; once (§9f, K8).
5. **Plan limits**: Should `maxBranches`, `maxCoaches` and manual player creation be enforced? What happens on downgrade?
6. ~~**Join requests**: Must applicants be logged in?~~ Decided 2026-11-16: every applicant gets a pending account (§9e).
7. **Coach attendance**: Code forbids coaches from recording attendance (explicit product rule) — confirm, as the role-matrix doc says otherwise.
8. **Platform Owner without Super Admin flag**: frontend checks only `isPlatformSuperAdmin`; backend accepts either. Can an Owner-only account exist? (`scripts/create-superadmin.js` sets both.)
9. **`academy_platform_mysql.sql`** (untracked, 84 KB, MySQL 8 schema + seed): purpose? The stack is PostgreSQL-only.
10. ~~**`backup_pre_migration_coach_delegation.json`**~~ Removed 2026-11-16 (K2), history not rewritten.
11. **Support access**: is a real time-boxed read-only access mechanism required?
12. **SaaS invoices**: manual, automatic, or out of scope?
13. **Audit log retention**: should operational logs be purgeable (conflicts with the append-only trigger)?
14. Remaining items in `docs/architecture/open-requirements.md` (PDPL consent, data residency, MFA, merchant of record…).

## 8. Pending tasks

- [ ] **Owner approval** of the project understanding and of a restructuring plan (blocking).
- [ ] Decide on open questions above (esp. 1–4, 9–10).
- [ ] Commit or otherwise stabilise the ~140 uncommitted working-tree changes before restructuring.
- [ ] Fix stale database tests (K15) so the suite is green before refactors.
- [ ] Run lint, format:check, build and SQL tests to complete the baseline.
- [x] K1 fixed (Phase 3A.1). K2 and K3 fixed 2026-11-16 (§9f).

## 9. Phase 1 (frontend refactor) — analysis baseline, 2026-11-14

Status: **analysis done, target architecture proposed, awaiting approval. No frontend code changed.**

| Check (frontend)                  | Result                                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @academy/web lint` | ✅ 0 errors (warnings: Next ESLint plugin not detected; `eslint.config.js` module-type warning)                                       |
| `typecheck`                       | ✅ 0 errors                                                                                                                           |
| `test`                            | ✅ 84/84                                                                                                                              |
| `build` (Next 15.5.28)            | ✅ 36 routes; shared JS 103 kB; largest `/attendance/scanner` 231 kB first load                                                       |
| Prettier check                    | ❌ 91 files differ — ~50 only by CRLF line endings (`core.autocrlf=true` checkout; repo stores LF), **41 with real formatting drift** |

Frontend findings (in addition to K14):

- F1 God-components: 13 pages > 650 lines (`attendance/sessions/[id]` 2,187 lines / 38 `useState`; `attendance/scanner` 1,273; `settings` 1,077; `groups/[id]` 1,074; `players/[id]` 998).
- F2 `api/client.ts` is one 1,472-line file (HTTP core + cache + refresh + tenant header + ~110 endpoint methods).
- F3 Auth/role redirect `useEffect` duplicated in 21 pages; `components/layout/AuthGuard.tsx` unused.
- F4 UI kit underused: 216 raw `<button>`, 120 `<input>`, 39 `<select>` in pages; `Select`, `DataTable`, `PageHeader`, `StatCard`, `FilterBar`, `ErrorState` almost never used.
- F5 Feedback inconsistency: 8 native `confirm()` dialogs; per-page `error/success/message` state alongside `useToast`.
- F6 Duplicates/leftovers: `src/lib/*` re-export shims used only by tests; `src/lib/i18n/translations.ts` identical to `src/locales/translations.ts`; `/auth/accept-invite` and `/scanner` alias routes (intentional redirects — keep).
- F7 Only 4 hooks exist (`useAuth`, `useLocale`, `useTheme`, `useToast`); data-loading/loading/error logic is hand-written per page.
- F8 "Quick QR Check-in Simulator" is rendered inside the production session page (`attendance/sessions/[id]/page.tsx` ~line 1603).
- F9 Currency label hard-coded "SAR/ر.س" in finance/attendance UI (business decision pending — K4).
- Good: no `any`, no XSS sinks except the two static theme/locale init scripts in `app/layout.tsx`; tokens are httpOnly cookies (only user summary + tenant id in `localStorage`); all HTTP goes through the API client.

### Phase 1 progress

| Step                                                                                                                                                                                            | Status                                    | Commit         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------- |
| 0 — checkpoint of prior WIP (sensitive `academy_platform_mysql.sql` excluded, left untracked)                                                                                                   | ✅                                        | `64c3adc`      |
| 0 — Prettier-only formatting commit (frontend)                                                                                                                                                  | ✅                                        | `0553112`      |
| Fix — restore 258 erased CSS-variable classes on `attendance/sessions/[id]` (damage from `1e77d5a`)                                                                                             | ✅                                        | `402c5df`      |
| 1 — foundation: `config/`, `lib/http/`, `features/<domain>/api.ts`, `api/client.ts` facade, contract test, `ConfirmProvider`/`useConfirm` replacing 8 native `confirm()`, dev-only QR simulator | ✅                                        | `9dcc3ad`      |
| 2 — shell & guards: `resolveAccess` + `useAccessGuard` replace 20 inline guards; `AuthGuard` rebuilt on the same hook; AppShell K14 fixed                                                       | ✅                                        | see change log |
| 3 — auth & public pages (login, register, forgot/reset password, verify email, accept invite, landing) + 8 typo fixes (F12)                                                                     | ✅                                        | see change log |
| F17 notice — join form tells applicants which fields are not submitted/saved (generated from the pending-field list)                                                                            | ✅                                        | `7ce0fac`      |
| 4 — players (`/players`, `/players/new`, `/players/[id]`, `components/player-qr-card.tsx`)                                                                                                      | ✅ awaiting owner review                  | see change log |
| 5–13                                                                                                                                                                                            | pending (awaiting owner review of Step 4) |                |

Step 4 details:

- `features/players/`: `player-permissions.ts` (`players.sensitive.read` / `players.delete` via shared `hasPermission`,
  replacing hard-coded role lists — proven identical for all 7 roles), `player-profile.ts` (transfer validation, update
  payload, bilingual labels), `new-player-form.ts` (create validation + payload, moved verbatim),
  `hooks/usePlayerProfile.ts`, `hooks/usePlayersList.ts`, components `TransferBranchModal`, `EditPlayerModal`,
  `ArchivePlayerModal`. Shared hook `hooks/useDebouncedValue.ts`.
- Bugs fixed: **players list pagination** (clicking Next loaded page 2, then the effect reloaded page 1 — users could
  not leave page 1); list **load failures** were only `console.error`ed (looked like "no players") — now an alert with
  Retry; search fired one request **per keystroke** and branches were re-fetched on every filter change — search now
  debounced 300 ms (still live), branches load once; out-of-order responses ignored; detail page **swallowed load
  errors** (e.g. 403 branch restriction showed only "does not exist") — reason now shown; create page rendered a
  **blank page** while auth loaded — skeleton now.
- i18n: ~40 Arabic-only strings on `/players/[id]` (header, sections, all three modals, archive impact report, back
  link) now bilingual; existing Arabic text unchanged.
- a11y: modals have `role="dialog"`, `aria-modal`, `aria-labelledby`, named close buttons, `label`↔`input` links;
  clear-search button named; alerts use `role="alert"`/`"status"`.
- Errors: players pages and the shared QR card show only API messages (`getErrorMessage`).
- Unchanged: API calls/bodies, validation rules, role rules (QR card manage buttons still follow the previous
  `canViewSensitive` rule), Tailwind tokens/design.

New findings (documented, not changed):

- F21 ✅ **Resolved (backend `f1ddeca` + frontend).** Root cause: `CreatePlayerSchema` had no start-date field and
  `createPlayer` hard-coded `startDate: new Date()`. Added optional `initialEnrollmentStartDate` (YYYY-MM-DD, real
  calendar date — shared `isCalendarDate`) to the contract; the service stores it as the initial
  `player_enrollments.start_date`; omitted → today (previous behaviour). The create form now sends the field it already
  collected. **No migration** (column existed); **non-breaking** (optional field). No range rule was invented — past
  and future dates are accepted, as for enrollment create/transfer (open question: should future/back-dated starts be
  limited?).
- F22 ✅ **Resolved at the API + UI (backend `f1ddeca` + frontend).** Root cause: `listPlayers` returned `nationalId`
  unmasked and searched on it for every role (K7), and `createPlayer` echoed `nationalId`/`medicalNotes` back. Now one
  helper (`players/player-sensitive-data.ts`) decides `players.sensitive.read` for list, detail, create and update; the
  list and create responses return `null` without it, and the list search no longer matches on national ID for those
  roles (closes an existence/enumeration oracle; count and results share the filter). UI: the list hides the line and
  the search placeholder reads "Search name or phone…" for those roles. **Behaviour change (approved):** Accountant,
  Receptionist (and any role without the permission) no longer see or search by national ID in the roster.
- F23 ✅ **Resolved (backend `6efea56`).** Without `players.sensitive.read`, a duplicate national ID on
  `POST /players` or `PATCH /players/:id` now returns a generic `400 VALIDATION_FAILED` ("The player could not be
  saved. Please review the entered details and try again.") instead of `409 "A player with this National ID is already
registered…"`. Actors with the permission keep the specific 409. A concurrent duplicate that slips past the pre-check
  (Prisma `P2002` on `unique_player_national_id_per_tenant`) is mapped to the same responses — previously the global
  filter answered every role with `409 "A record with this tenant_id, national_id already exists"`. The partial unique
  index is unchanged. **Residual (inherent):** the request still _fails_ when the ID exists, so a restricted user who
  tries to create a player can infer a collision from the failure itself; the message no longer confirms it, and it
  is indistinguishable from other validation failures. Fully hiding the signal would require a different product flow
  (e.g. staff review of duplicates) — not implemented.
- F24 ✅ **Resolved (backend `6efea56`).** `PATCH /players/:id` now returns `403` whenever `nationalId` or `medicalNotes`
  is present in the body from an actor without `players.sensitive.read` — checked before any lookup. The previous
  medical-notes rule compared with the stored value, so a caller could confirm a guess (request succeeded only when the
  guess matched); that oracle is closed for both fields. Creating a player with a national ID stays allowed for these
  roles (owner decision). Frontend unchanged (it never sent these fields for restricted roles); a contract test now pins
  that.
- Enrollment start date (owner decision 2026-11-15): keep the calendar-date validation; past, present and future dates
  are allowed; no further restriction without a confirmed business requirement.
- `database/repositories/player.repository.ts` still contains a national-ID search, but no service uses the repository
  layer yet (unused code; to be aligned when repositories are adopted).

Outstanding (unchanged): **real authenticated testing with an actual account**. Step 4 browser checks used an
in-browser mocked API (no backend/DB contact); authentication is **not** considered verified.

Step 3 details:

- New `features/auth/`: `AuthPageLayout`/`AuthPageSuspense`, `AuthCard`/`BackToSignInLink`, `AuthAlert`
  (`role="alert"`/`"status"`), `PasswordVisibilityToggle` (aria-label/pressed/controls), `OtpCodeField`,
  `PasswordField`, `auth-styles.ts`; pure modules `login-form.ts`, `register-form.ts`,
  `password-reset-validation.ts` (rules moved verbatim). Shared hooks `useCooldown`, `useDelayedRedirect`.
- `features/landing/components/PlayerJoinRequestModal.tsx` extracted (landing page 1,280 → ~745 lines); form state
  still survives close/re-open.
- Security: auth/public pages now show only API (`ApiError`) messages; raw runtime error text is never displayed
  (generic localized fallback). Network failures on login keep the "could not connect" message.
- Fixes: delayed `/login` redirect after password reset is cancelled on unmount; 8 missing-space class typos (F12 — resolved);
  forgot-password success alert now uses the shared success colours (text green-300 → #4ADE80, same as other pages).
- Unchanged by request: validation rules, API calls/bodies, `debugOtp` localhost-only display, SAR labels,
  `--brand-surface`, legacy `[var(--x)]` syntax.

New findings (documented, not changed — need owner decision):

- F14 ✅ **Resolved (follow-up commit after Step 3).** `/login` and `/register` now honour `?redirect=` through
  `lib/auth/safe-return-path.ts`: strict allow-list (`/accept-invite`, `/auth/accept-invite`), query preserved, fragment
  dropped; rejects external/protocol-relative URLs, other schemes, backslashes, encoded separators, dot-segments,
  control characters, credentials and > 2048 chars. Invalid/missing → existing default (login: role home; register:
  `/dashboard`). Return path is carried across the login ↔ register links. Tests: 45 unit cases + 21 browser checks.
- F15 Login error mapping checks `code === 'VALIDATION_ERROR'`; the API emits `VALIDATION_FAILED`. Field mapping still
  works via `details.issues`.
- F16 ⏸ **Deferred to the backend phase (owner decision).** The API returns **401** for pending-approval, rejected,
  rate-limited and suspended logins; the login page maps every 401 to "Invalid email or password". Frontend keeps this
  generic behaviour and does not infer account status from a 401. Required work — see §10 "Backend-phase requirements".
- F17 ⏸ **Fields kept; backend support required (owner decision, updated).** The landing "player join" form keeps all
  fields. The API contract accepts only name, email, phone, DOB and guardian name, so the frontend now builds the request
  through `features/landing/player-join-request.ts`, which returns the contract `payload` **and** an explicit
  `pendingBackendSupport` object (gender, jersey number, national ID, emergency contact name, medical notes, guardian
  relationship) — nothing is dropped implicitly, and the pending fields are deliberately not sent (the API would strip
  them). Tests pin both sets and fail if the contract changes. Required work — see §10.
- F19 Invitees have no staff sign-up path: `/accept-invite` → "Create New Account" opens `/register`, which registers an
  **academy** (application `PENDING_REVIEW`). That user's login is then blocked as pending, so they can never accept the
  invitation (acceptance also requires a verified account). Needs a product/backend decision (invite-based sign-up).
- F20 The repository lives in a OneDrive-synced folder. OneDrive converts Next.js runtime cache files
  (`.next/server/route-cache`) into cloud placeholders (reparse points), which makes the next `next build` fail with
  `EINVAL readlink`. Workaround: delete `.next/server/route-cache` (or exclude `.next`/`node_modules` from OneDrive sync,
  or move the repo outside OneDrive).
- F18 `/forgot-password` step 2 only checks password length ≥ 8 while `/reset-password` enforces every strength rule
  (both end at the same backend policy). Kept as-is.

Step 2 details:

- Guard inventory (corrected): **20** page guards, not 21 — `forgot-password`/`reset-password` only redirect to
  `/login` after a successful submit (not access control; untouched). Rules: `authenticated` (10 pages),
  `admin` (5), `admin-or-coach` (2), `no-coach` (2, page-specific toast preserved), `platform-staff` (1).
  Mapping is pinned by `src/lib/auth/page-access-map.test.ts`.
- Equivalence: `src/lib/auth/access-rules.test.ts` compares the new rules with the verbatim legacy page logic over
  600 combinations (6 user kinds × 10 memberships × loading on/off × 5 rules) — identical.
- Only intentional behaviour difference: the hook never `router.push`es to the page already open (previously a
  no-op push, e.g. VIEWER on `/dashboard`) and never repeats the same redirect.
- Browser check (headless Chrome, fresh signed-out profile, production build): all 20 guarded URLs → `/login` with
  no loops (`/platform` keeps its original `/dashboard` → `/login` hop); public pages do not redirect.
- Authenticated, per-role browser checks: **pending** owner-provided test account (rules covered by unit tests).

New findings (documented for the separate cleanup phase, not changed):

- F12 Same missing-space typo as K14 in 8 more places: `bg-(--bg-base)text-(--text-main)` in `app/{accept-invite,landing,offline,register,reset-password,verify-email}/page.tsx`, and `bg-(--bg-base)text-(--text-muted)` twice in `components/platform/CoOwnerTab.tsx`.
- F13 `/evaluations` and `/evaluations/player/[id]` have **no client-side access guard** (only API enforcement). Preserved as-is; adding one is a product decision.

Step 1 verification: typecheck ✅, lint ✅ (0 errors), Prettier ✅, tests ✅ 108/108 (15 files; +24 new),
production build ✅; simulator strings absent from `.next` output (verified by grep); production server smoke test:
all 33 page routes 200, `/`→`/dashboard` and `/scanner`→`/attendance/scanner` 307, `/auth-test` 404;
`/v1/health` proxied to the local API 200. Authenticated end-to-end flow **not verified** — the local DB's demo
account password differs from the seed default; needs a test account from the owner.

New findings during Phase 1:

- F10 `--brand-surface` CSS variable is used (`attendance/sessions/[id]`, `components/finance/PlansTab.tsx`) but never defined in `globals.css` → transparent background. Pre-existing; not changed.
- F11 Many files still use the legacy `[var(--x)]` Tailwind syntax (editor suggests `(--x)`); both work in Tailwind v4. Not changed (cosmetic, high churn).
- Rule for dev-only UI: guard with inline `process.env.NODE_ENV === 'development'` at the call site; an imported constant is not folded across modules and ships to production (verified).

## 9b. Code-quality baseline (Phase 2A, 2026-11-15)

The issues recorded during F21–F24 were resolved in Phase 2A. All of them predated that work and came from the
checkpointed WIP `64c3adc`.

| Area                  | Before                                                                                     | After Phase 2A                                                                              | Commit    |
| --------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | --------- |
| Database tests        | 3 of 6 failing (K15)                                                                       | 6/6; the tests assert the single batched `set_config` statement and bound parameters        | `b33d68f` |
| Backend lint errors   | 2 (`consistent-type-imports`)                                                              | 0                                                                                           | `4bb0699` |
| Backend lint warnings | 104 `no-explicit-any`                                                                      | 99; the rest are typed module by module when touched (no suppression)                       | `6f7277b` |
| Prettier              | 28 files with real drift                                                                   | 0 (`pnpm format:check` passes)                                                              | `4bb0699` |
| Line endings          | `core.autocrlf=true` produced CRLF checkouts, so Prettier failed on Windows                | `.gitattributes` `* text=auto eol=lf`                                                       | `ace1bd6` |
| Build side effect     | every local `next build` rewrote the tracked `version.json`                                | regenerated only for release builds (CI, deploy, release sync, `SPORTEXUS_STAMP_VERSION=1`) | `25ecbba` |
| Dead shims            | 9 re-export shims and a duplicate `translations.ts` in `frontend/src/lib` (F6)             | removed; tests moved next to their modules                                                  | `ab3a599` |
| ESLint config         | `MODULE_TYPELESS_PACKAGE_JSON` warning on every lint run                                   | `eslint.config.mjs`                                                                         | `4e00569` |
| Duplicated logic      | `@Optional()` fallback copies of three extracted services; tests exercised only the copies | removed; required injection; tests use the real services                                    | `6f7277b` |
| CI                    | Linux only                                                                                 | added a `quality-windows` job                                                               | `fea097a` |

Phase 2A completion (owner-approved follow-ups, 2026-11-15):

| Item                                      | Resolution                                                                                                                                                                                                                                                                                                                                 | Commit                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| Windows Prisma DLL lock                   | `prisma generate` removed from `@academy/database` `build`, which now verifies the generated client matches the schema (`scripts/check-prisma-client.cjs`). Generation is explicit in root `build`/`build:backend`/`dev`, CI, both Dockerfiles and `render.yaml`. Root lint, typecheck and test now pass while the dev API runs.           | `9a10f1f`                       |
| `prisma generate` required `DATABASE_URL` | `prisma.config.ts` used strict `env()`, so Docker image builds (no database URL at build time) and fresh checkouts failed since `64c3adc`. The URL is now passed only when set.                                                                                                                                                            | `478e31a`                       |
| Test files not type-checked               | Backend (110 hidden errors), frontend (31), shared (1): `tsconfig.json` includes tests, `tsconfig.build.json` excludes them from builds. The database package's tests were type-checked but compiled into `dist`; now excluded. Two vacuous assertions replaced with real ones.                                                            | `16cdd9e`, `5ae3ce6`, `0504aa3` |
| Next.js ESLint rules                      | `@next/eslint-plugin-next@15.5.28` (matches `next`), `recommended` + `core-web-vitals`. 0 errors, 3 warnings left for Phase 4.                                                                                                                                                                                                             | `7321c74`                       |
| Node.js version                           | Standardised on Node 22 LTS: `engines` `^22.0.0`, `.nvmrc`, CI, Dockerfiles, Render `NODE_VERSION`, docs.                                                                                                                                                                                                                                  | `d192a43`                       |
| Phantom dependencies                      | `express` (imported at runtime by `backend/src/main.ts`) and `dotenv` (`prisma.config.ts`) were never declared and resolved only through hoisted copies. A pnpm relink pruned `express` and the API stopped starting. Both are declared at the versions already in the lockfile; a scan of all packages finds no other undeclared imports. | `9de0902`                       |

Still open (reported, not changed):

- **OneDrive and `.next`:** besides `.next/server/route-cache` (F20), OneDrive also turned `.next/static` files into
  placeholders (`EINVAL readlink` during `next build`). Workaround: delete `frontend/.next` before building. Lasting fix:
  exclude `frontend/.next` and `node_modules` from OneDrive sync, or move the repository out of OneDrive.

- **Next.js lint warnings:** `app/layout.tsx` loads Google Fonts with `<link>` (`no-page-custom-font`, use
  `next/font`); `components/player-qr-card.tsx` uses `<img>` twice (`no-img-element`). Phase 4.
- **Node 22 end of life:** Node 22 is in maintenance LTS until 2027-04-30. Moving to Node 24 or 26 LTS needs a
  separate proposal (base-image change, verification on that version). The local machine runs Node 25 (non-LTS); pnpm
  now warns about it.
- ✅ **I1 (attendance contract drift)**: fixed in `29d6fff`. `RecordAttendanceResult` and `BulkRecordAttendanceResult` are shared types used by the API and the web client; the session page no longer casts.
- **S2, S3, S4:** security findings recorded in `docs/proposals/PHASE_3A_SECURITY.md` §9.

## 9c. Phase 3A.1 security (2026-11-15)

Scope approved by the owner: K1, K13, K13b, S1 and the S5 retirement. S2, S3 and S4 are separate phases (3A.2, 3A.3).
Design: `docs/proposals/PHASE_3A_SECURITY.md` and `PHASE_3A_SECURITY_DETAILS.md`.

| Item      | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Commit    |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| S5        | `POST /platform/applications/public` (anonymous; it filed applications under existing accounts by email) and its unused frontend method removed. Nothing called it.                                                                                                                                                                                                                                                                                                                                                                      | `45624c2` |
| S1        | The Next.js `/v1` proxy strips client-supplied identity headers, derives the client IP from `WEB_TRUSTED_PROXY_HOPS`, and attests it with `INTERNAL_PROXY_SECRET` (at least 32 characters, required in production, server-side only). The API accepts the attested IP only on a constant-time secret match; otherwise it uses Express `trust proxy` (`TRUST_PROXY_HOPS`, default 0). IPv6 rate-limit keys use the /64. Self-host compose no longer ships default JWT and Postgres secrets.                                               | `faa7e69` |
| M1        | Migration `20261116090000_password_reset_link_and_session_version`: `users.password_reset_link_token`, `users.session_version`, `refresh_tokens.session_version`; four SECURITY DEFINER reset functions; `complete_password_reset` re-created. Additive only.                                                                                                                                                                                                                                                                            | `a421c15` |
| K1        | Reset needs either the 6-digit code **with its email**, or the 256-bit link token from the email (URL fragment). Only hashes are stored; 5 minutes; single use; consumption and password update in one statement. 5 wrong codes cancel the code; 10 failures per account per 24 h suspend code entry, while the link keeps working, so an attacker cannot lock the owner out. Request flood limits: 10/h per IP, 60 s cooldown per email (5 min after 3 in an hour), 3 per 15 min per IP and email. One generic error for every failure. | `1e31a60` |
| K13, K13b | Password change, reset, platform "revoke sessions" and suspension bump `users.session_version` (row lock), then revoke refresh tokens. Access tokens carry `sv`; `JwtStrategy` rejects stale versions. Refresh rotation takes `FOR SHARE` on the user row and consumes the token with a conditional update, so a refresh racing a password change can never mint a token for the new version. `change-password` returns fresh cookies for the caller.                                                                                    | `1e31a60` |
| Tests     | Real-PostgreSQL integration tests (`session-concurrency.int.test.ts`, CI step "Integration tests (PostgreSQL)"): two deterministic interleavings, a 50-request stress test, pre-3A tokens, and the reset functions. Mutation-checked: removing `FOR SHARE` or reversing the invalidation order makes them fail.                                                                                                                                                                                                                          | `fb0ccad` |

Neon development database (not production):

- Backup before M1: a CSV logical dump of all 34 tables, with a manifest and a security snapshot, kept in the owner's
  local `academy-db-backups` folder (`neon-dev-pre-M1-20261115-185956`). Restore verified 34/34 tables identical in an
  isolated PostgreSQL 18; the restore copy was then dropped.
- **Baseline exception:** migration `20261104105500_academy_applications_insert_rls` was marked applied with
  `prisma migrate resolve --applied` **without running it**, because its anonymous SELECT policy is the S4 finding. Its
  corrected replacement is M2 (Phase 3A.2). `_prisma_migrations` was not edited directly.
- M1 applied with `prisma migrate deploy`; status up to date (24 migrations).
- Explicit before/after check:
  - policies: 81, unchanged (the earlier "101" was the snapshot's output line count; multi-line policy expressions span
    several lines. The comparison itself was exact);
  - functions: 4 new, and `complete_password_reset` redefined;
  - table grants, triggers and ownership: unchanged;
  - `sportexus_app`: 6 new column grants and 4 new function grants;
  - PUBLIC cannot execute any of the new functions;
  - every pre-existing value in `users` and `refresh_tokens`, compared column by column: identical. Only the new
    columns were added, all at their defaults.
- Rollback note: never drop the `session_version` columns. Dropping them would make invalidated sessions valid again.

Verification (2026-11-15):

| Check                                               | Result                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend unit tests                                  | ✅ 320                                                                                                                                                                                                                                                                                                                                             |
| Backend integration tests (PostgreSQL 18, isolated) | ✅ 8                                                                                                                                                                                                                                                                                                                                               |
| Shared tests                                        | ✅ 44                                                                                                                                                                                                                                                                                                                                              |
| Frontend tests                                      | ✅ 350/350, three consecutive runs in a clean clone outside OneDrive. In the OneDrive checkout, some component tests fail intermittently ("reading 'useState'" of null) because OneDrive turns `node_modules` files into reparse points. This is environmental (see §9b).                                                                          |
| Lint / typecheck / format                           | ✅ 0 errors (96 backend `no-explicit-any` warnings) / clean / clean                                                                                                                                                                                                                                                                                |
| Build                                               | ✅ `pnpm build`                                                                                                                                                                                                                                                                                                                                    |
| Migrations from scratch, repository SQL suites      | ✅ isolated PostgreSQL 18, no Prisma drift                                                                                                                                                                                                                                                                                                         |
| Runtime against Neon                                | ✅ API ready (Postgres and Redis ok); the production web build proxies `/v1`; reset responses are generic; a code requires the email; the retired route returns 404; forged `X-Forwarded-For` and client-IP headers sent through the proxy do not escape the per-IP limit. The probes' rate-limit keys were deleted from the dev Redis afterwards. |

Open after 3A.1:

- Self-host compose still sets `CORS_ORIGIN='*'` and connects as the admin database user. Both block a production
  start; they belong to S2 and S3.
- S2 needs the owner's exact list of trusted origins per environment.
- S3/S4 (M2, M3, runtime-role switch): SQL review and isolated Neon branch tests come first (Phase 3A.2).

## 9d. Phase 3A.2 (S3, S4, S6): applied (2026-11-16)

Approved by the owner on 2026-11-15 (decisions B1-B8 as recommended; B7: a REJECTED application can no longer be
approved). Design and SQL review: `docs/proposals/PHASE_3A2_SQL_REVIEW.md`.

| Item   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                               | Commit    |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| M2     | `20261117090000_s4_rls_context_functions`: S4 policies and column grants on `academy_applications`; applicant SELECT on join requests; suspended platform admins lose admin RLS; trigger functions pin `search_path`; `append_audit_log`, `create_app_notification`, `list_public_academies`, `submit_player_join_request`, `redeem_portal_claim`; claim codes hashed in place; direct INSERT on audit logs, notifications and join requests revoked | `63cf332` |
| M3     | `20261117100000_s3_runtime_privileges`: S6 (privilege flags, password hash, session version and user deletes closed to the runtime role); `change_own_password`, `platform_create_user`, `platform_set_user_platform_role`, `platform_update_user_security`, `platform_revoke_user_sessions`, `platform_approve_academy_application`, `platform_delete_academy`; one runtime privilege baseline for every runtime role                               | `63cf332` |
| CI     | Runtime role created before migrations; `security-catalog.sql` (read-only catalog assertions) and `phase3a2-boundaries.sql` (122 checks as the runtime role) added; `runtime-role-setup.sql` replaced by `runtime-role-create.sql`                                                                                                                                                                                                                   | `63cf332` |
| API    | Every query path works under the restricted runtime role: audit, notifications, registration, login gating, password change, platform user administration, approval, deletion, portal claims, join requests, public directory; startup guard refuses an RLS-bypassing role in production                                                                                                                                                             | `df4cf89` |
| Deploy | Self-host compose runs the API as `academy_runtime` with a one-shot owner `migrate` service; no committed default runtime password; `CORS_ORIGIN` required. The Prisma CLI prefers `DATABASE_ADMIN_URL`                                                                                                                                                                                                                                              | `6f79f2c` |
| K5     | Storage maintenance purges tokens and retains append-only audit logs instead of aborting                                                                                                                                                                                                                                                                                                                                                             | `5110e57` |

Verification:

| Check                                                                                        | Result                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend unit tests                                                                           | ✅ 336                                                                                                                                                                                                                                                                                                                                    |
| Integration tests (real PostgreSQL)                                                          | ✅ 8; the reversed-order mutation of `change_own_password` fails 2 of them, as intended                                                                                                                                                                                                                                                   |
| CI database steps, emulated in order on an isolated PostgreSQL 18                            | ✅ all 7 (including the 4 existing suites)                                                                                                                                                                                                                                                                                                |
| Boundary suite, Neon-like history as `sportexus_app` / fresh history as `academy_runtime_ci` | ✅ 122 / 122                                                                                                                                                                                                                                                                                                                              |
| **Full API running as `sportexus_app`** (synthetic data, HTTP)                               | ✅ 49/49 workflow checks: registration, slug collision, login gating, approval and B7, tenant data, players, claim codes, invitation and reset, public directory, join requests, notifications, password change, session revocation, suspension, platform admin invite, audit trail. **0** permission, RLS or audit errors in the API log |
| Typecheck, lint, format, all package tests                                                   | ✅ (lint: 0 errors)                                                                                                                                                                                                                                                                                                                       |

Neon development database:

- Backup before M2/M3: `neon-dev-pre-M2M3-20261115-221653` (34 tables, 225 rows), restore verified 34/34 identical in an
  isolated PostgreSQL 18, restore copy dropped.
- `prisma migrate deploy` applied M2 and M3; status up to date (26 migrations).
- `security-catalog.sql` on Neon: all 9 sections pass.
- Before/after: data changed only in `_prisma_migrations` (+2 rows); for `sportexus_app` only removals or narrowing
  (audit, notifications, applications, join requests, `users` UPDATE now `name, phone, updated_at`, no DELETE), plus
  EXECUTE on the 13 new functions; triggers and ownership unchanged. Post backup: `neon-dev-post-M2M3-20261115-222115`.
- Smoke test of the API on Neon after the migration (owner connection): ready, public directory, login and reset
  paths OK, no errors; the startup guard warns that the owner role bypasses RLS (allowed outside production).

**Still to do by the owner: switch the dev API to the runtime role.** In `backend/.env`: `DATABASE_URL` = the
`sportexus_app` connection (password set by you in the Neon console), `DATABASE_ADMIN_URL` = the current owner URL
(used only by the Prisma CLI). The app was verified end to end as `sportexus_app` on the isolated model.

Open after 3A.2:

- K6: done in §9e (owner decision 2026-11-16).
- S2: exact trusted origins per environment.
- Residual: `users` readable on every column by the runtime role. (Account links and `must_reset_password`: fixed
  in §9f, items 5 and 6.)

## 9e. K6 join requests: three applicant kinds, pending accounts (2026-11-16)

Owner decisions 2026-11-16: every join request belongs to an account that stays pending until reviewed (player,
guardian and, as before, the academy owner/coach); an existing portal user keeps signing in while a new request is
pending; the three applicant kinds are kept apart in the code, each part commented.

| Area     | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database | `20261118090000_k6_join_request_accounts`: `"JoinRequesterType"` (PLAYER/GUARDIAN), `player_registration_requests.requester_type` (not updatable), index on `applicant_user_id`; `submit_player_join_request` gains `p_requester_type`, refuses a second player profile (`PLAYER_PROFILE_EXISTS`) and a duplicate pending request (`DUPLICATE_PENDING_REQUEST`); GUARDIAN needs the guardian name                                                                                                                                                                                                                                                                                                                               |
| Database | `20261118100000_portal_user_read_policies`: SELECT-only portal policies on `tenants`, `group_members`, `training_groups`, `group_coaches`, `branches`, `attendance_sessions` (own players / children only). **Bug found by the end-to-end run**: under the restricted runtime role `/portal/player/me` and `/portal/guardian/me` returned 500 (the academy relation was invisible)                                                                                                                                                                                                                                                                                                                                              |
| API      | `POST /portal/player-join-requests`: optional authentication (`OptionalJwtAuthGuard`) + CSRF; anonymous → new pending account + request in one transaction (`applicant-account.ts`, shared with academy registration), 10 new accounts per IP and hour; signed in → linked to the account. `GET /portal/my-join-requests`. Login gating rewritten (`assertApplicantMayLogIn`): new codes `GUARDIAN_PENDING_APPROVAL`, `GUARDIAN_REJECTED`, `JOIN_MORE_INFO_REQUESTED`; existing portal users are no longer gated. Approval links the account (PLAYER → `players.user_id`, GUARDIAN → guardian record), never by name alone; notifications after the commit with `/player` or `/guardian`; more-info e-mail; e-mail HTML escaped |
| API bug  | Login and refresh read `hasPlayerProfile` / `hasGuardianProfile` without an actor context: always false under the restricted role (no portal for players/guardians). Now read under the user's context (`loadPortalAccess`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Web      | Join form: "who is applying" (guardian / player), password + confirmation when not signed in, account note when signed in, clear pending message after submission. Portal pages: "Join requests" card with statuses and a "new join request" button. Staff review list: requester badge. **Login page bug**: every 401 showed "wrong e-mail or password", so pending/rejected applicants (including academy owners) never saw why; the page now maps the account-state codes (part of BR-1, status codes unchanged)                                                                                                                                                                                                             |

Verification:

| Check                                                                     | Result                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit tests                                                                | ✅ api 355 (new: 5 login gating, 6 approval linking, 8 submission), web 360, shared 44, database 10                                                                                                                                                                                                         |
| Integration tests (real PostgreSQL)                                       | ✅ 8 (the stress test needs `connect_timeout` on a cold local server)                                                                                                                                                                                                                                       |
| CI database steps emulated in order                                       | ✅ 8/8, including the new `k6-join-request-boundaries.sql` (21 checks as the runtime role)                                                                                                                                                                                                                  |
| **Full API as `sportexus_app`** (Neon-like history, synthetic data, HTTP) | ✅ **67/67**: the 49 earlier checks plus guardian and player sign-up, pending at login, duplicate e-mail, rollback of a failed request, approval linking, guardian and player portals, signed-in second request, my requests, second player profile refused, rejection. 0 errors or warnings in the API log |
| Typecheck, lint (0 errors), format, build                                 | ✅                                                                                                                                                                                                                                                                                                          |

Neon development database:

- Backup before: `neon-dev-pre-K6-20261116-201613` (34 tables, 228 rows), restore verified 34/34 identical, copy dropped.
- `prisma migrate deploy` applied both migrations (28, up to date); `security-catalog.sql`: all 9 sections pass.
- Before/after: rows changed only in `_prisma_migrations` (+2); `player_registration_requests` content changed only by
  the new column (old rows: PLAYER). `sportexus_app`: + SELECT on `requester_type`, the 6-argument function replaced by the
  7-argument one; nothing else widened. 6 new SELECT-only policies (89 policies in total). Post backup:
  `neon-dev-post-K6-20261116-202134`.
- Smoke test as `sportexus_app` with the owner's real configuration: ready, public directory, `my-join-requests` 401 when
  anonymous; the startup guard reports no RLS bypass.

Still open: K9 (name-only match for requests made before K6; defaults gender MALE / DOB 2012-01-01); a confirmation
e-mail when a join request is received (academy registration has one); BR-1 status codes (401 kept).

## 9f. Owner decisions of 2026-11-16 applied (K2-K4, K8, K9, items 5-7, S2, Render, demo data)

Decisions: wipe the development data and replace it with synthetic Arabic/English data; one repository with independent
web, API and database; a suspended academy is closed for everyone at once (K3); each academy's own currency (K4);
cashier close by management and the accountant only, once (K8); the permission matrix of
`docs/security/ROLE_PERMISSION_MATRIX.md` is the source of truth; remove the committed dump without rewriting history
(K2); deploy web and API on Render (database on Neon).

| Item        | Change                                                                                                                                                                                                                                                                   | Commit    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| K2          | Committed dump removed; data dumps ignored                                                                                                                                                                                                                               | `a38429b` |
| RBAC        | `ROLE_PERMISSIONS` = documented matrix (a test parses the doc); `session_cashier.close`; coaches mark attendance / claim expenses for their own sessions only; web menu, navbar, page guards and buttons use one `can()` over the same matrix; VIEWER had no menu at all | `af61196` |
| K8          | Cashier close needs `session_cashier.close`; a closed cashier cannot be closed again                                                                                                                                                                                     | `af61196` |
| K3          | Suspended academy refused on every academy request (TenantGuard), at login and in the portals                                                                                                                                                                            | `0d5c62f` |
| K4          | Money recorded and shown in the academy's currency (`tenantCurrency` on memberships, `useAcademyCurrency`)                                                                                                                                                               | `cd184d0` |
| K9          | Join approval never merges two children by name alone                                                                                                                                                                                                                    | `ee1eebd` |
| 5           | `players.user_id` / `guardians.user_id` writable only by definer functions; `link_join_request_account`                                                                                                                                                                  | `ff3d19d` |
| 6           | `must_reset_password` enforced (403 `PASSWORD_CHANGE_REQUIRED`, account page) and cleared by a trigger on a real password change                                                                                                                                         | `0334632` |
| 3C          | K16 money `numeric(12,2)`; K11 CSPRNG receipt numbers + unique per academy; K12 receipt e-mail after the commit                                                                                                                                                          | `e25d30f` |
| Warnings    | Web lint 0 warnings (next/font, next/image)                                                                                                                                                                                                                              | `0720693` |
| S2 / Render | `render.yaml`: `sportexus-web`, `sportexus-api`, private Key Value; exact `CORS_ORIGIN`; `docs/deployment/RENDER.md`                                                                                                                                                     | `675e36f` |
| Demo data   | `seed-demo.cjs` replaces `seed-local-demo.js`; four leftover debug scripts removed                                                                                                                                                                                       | `06e49b7` |

Migrations added: `20261118110000_account_links_definer_only`, `20261118120000_must_reset_password_cleared`,
`20261118130000_money_numeric`, `20261118140000_unique_receipt_numbers` (32 in total).

Verification:

| Check                                                           | Result                                                                                  |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Unit tests                                                      | ✅ api 366, web 360, shared 44+, database 10                                            |
| Integration tests (real PostgreSQL)                             | ✅ 8                                                                                    |
| CI database steps emulated in order (32 migrations)             | ✅ 9/9, incl. `account-links-boundaries.sql` (13 checks)                                |
| Schema vs migrations drift (`prisma migrate diff`)              | ✅ empty                                                                                |
| Full API as `sportexus_app`, isolated Neon-like database        | ✅ 67/67 workflow checks, 0 log errors                                                  |
| Every web API call has a backend route                          | ✅ 123/123                                                                              |
| Demo data, every role, API as `sportexus_app`                   | ✅ 44/44 on the isolated copy and 44/44 on Neon dev with the owner's real configuration |
| Production web build + proxy + API + Neon (login through `/v1`) | ✅                                                                                      |
| Typecheck, lint (0 errors; web 0 warnings), format, build       | ✅                                                                                      |

Neon development database: backup `neon-dev-pre-wipe-20261116-213233` (34 tables, 230 rows, restore verified 34/34),
the four migrations applied (up to date, 32), all data replaced by the demo seed (18 accounts, 3 academies, 14
players), `security-catalog.sql` all 9 sections pass. Demo credentials: `C:/Users/IT/sportexus-demo-accounts.txt`
(outside the repository).

Not changed (needs a decision or a later phase): BR-1 status codes (401 kept, messages now shown), BR-2 extra join-form
fields, BR-3, the root Windows helper scripts (`*.ps1`, run from the repository root), `academy_platform_mysql.sql`
(now ignored, still on disk), API lint warnings (86, not errors), Phase 5 screens for platform features.

## 9g. Login error and slowness (2026-11-18)

| Problem                                                                | Cause                                                                                                                                                     | Change                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login showed "A database constraint or query operation error occurred" | Neon scales to zero after 5 idle minutes; the first request timed out while it woke up (`P1001`), and the API reported every unknown Prisma code as a 400 | P1001/P1002/P1008/P1017/P2024 and `PrismaClientInitializationError` → 503 `DATABASE_UNAVAILABLE`; the login form asks for a retry; Neon URLs carry `connect_timeout=15` (`a599ac6`)                                                                                                                               |
| The API ran as the owner role (BYPASSRLS warning) in development       | `envFilePath` started one directory too high, so `backend/.env` was never read and the root `.env` (owner URL) won                                        | `backend/.env` first, root `.env` as fallback (`a599ac6`)                                                                                                                                                                                                                                                         |
| Login spun for several seconds after the header changed                | The database was in us-east-2 (Ohio): about 190 ms per round trip from Egypt and from the Frankfurt Render services, and a request makes 5-15 round trips | Development database moved to a new Neon project in Frankfurt (aws-eu-central-1): migrations (32), runtime role, demo seed; `security-catalog.sql` 9/9, demo smoke 44/44; requests about 3x faster locally. The old Ohio project is untouched (fallback; its URLs are kept as comments in the local `.env` files) |

Signed out after waiting with two tabs open: when the 15-minute access token expired, every tab refreshed at once with the
same refresh token; the API treats a second use of a rotated token as theft and revokes the whole session family.
Fix: tabs take turns through a Web Locks lock, and a tab that finds a rotation by another tab within 10 s reloads the
session with the shared cookies instead of rotating again (`frontend/src/lib/http/token-refresh.ts`; unit test with two
tabs, plus a real two-tab Chrome run through two expiries). Reuse detection on the API is unchanged. The 401 lines in
the browser console before a refresh are expected (the expired token is rejected, then the request is retried).

First paint and login hand-over (2026-11-18):

- The root layout reads the `NEXT_LOCALE` cookie, so the server renders the chosen language (`<html lang>`, text):
  no Arabic flash in English mode and no browser offer to translate an English page. The layout is therefore dynamic.
- `themeInitScript` / `localeInitScript` had always rendered empty: they were exported from `'use client'` modules and
  the server layout received client references. Moved to `src/lib/preferences/init-scripts.ts` (server-safe).
- `SyncStatus` showed "offline" on every page: Node 21+ has a global `navigator` without `onLine`, read during the
  server render. It now starts online and reads the real state in the browser.
- After a successful login the form is replaced at once by the destination's skeleton (`PostLoginSkeleton`).

Remaining: each request still opens several short transactions (Prisma interactive transaction + `set_config`, nested
`include` = one query per relation). On Render, next to the database, that costs milliseconds; locally about 1 s per
request. Reducing round trips (e.g. Prisma `relationJoins`) is a later optimisation, not started.

## 9h. Full-platform walkthrough and fixes (2026-11-20)

Every role was signed in on the production build (`next start` + `node dist/main.js`, Neon dev data) and every page
opened with Playwright (console errors, failed requests and redirects recorded); then a recorded video tour
(outside the repo). Findings and what was done:

| #   | Finding                                                                                                                                                                                                                                    | Fix                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1  | Guardian portal: "coach guidance for the guardian" was always empty and "View full development radar" opened a staff page; the page called the staff endpoint `GET /evaluations/player/:id`, which answers 400 to a guardian.              | `GET /portal/guardian/me` returns `children[].recentEvaluations` (additive, optional; same fields as the player portal, private coach notes never included, one mapper `toPortalEvaluation` for both portals). Link removed.                                                                                                            |
| W2  | Pages and menus offered things the API refuses (403): attendance reports to branch manager, receptionist, coach, viewer (API needs `reports.read`); `/finance` to coach; `/evaluations` unguarded; `/players/new` to every signed-in user. | Page rules (`page-access-map.test.ts` updated): reports `allOf attendance.read + reports.read`, finance `payments.read`, evaluations and evaluation profile `evaluations.read`, new player `players.create`, attendance hub `attendance.read`. Sidebar, Ctrl+K palette, dashboard and attendance-hub cards follow the same permissions. |
| W3  | Dashboard showed "0" groups/sessions for roles that may not read them (refused requests) and a hard-coded "+12%" player trend.                                                                                                             | Cards and requests only for permitted roles; fake trend removed.                                                                                                                                                                                                                                                                        |
| W4  | Coach workspace title "كابتن كابتن محمد علي" (name already carries the title).                                                                                                                                                             | Title added only when the name has none.                                                                                                                                                                                                                                                                                                |
| W5  | `start-sportexus.ps1` starts the web app in production without `INTERNAL_PROXY_SECRET` / `WEB_TRUSTED_PROXY_HOPS`, so every API call through the web app fails (login impossible).                                                         | The script sets both for the servers it starts (random per-run secret unless one is configured; 1 hop for the tunnel).                                                                                                                                                                                                                  |
| W6  | Data, not code: the Falcons demo academy (seeded SUSPENDED for K3) had been reactivated on 2026-11-18 09:19 (`PLATFORM_ACADEMY_STATUS_UPDATE`), so its owner could sign in.                                                                | Suspended again through the platform console during the recorded tour; K3 blocks the owner as designed.                                                                                                                                                                                                                                 |
| W7  | Arabic pages showed scores reversed ("10 / 8.0") because the fraction followed the RTL direction (guardian, player, evaluations, landing).                                                                                                 | Score fractions are isolated as LTR (`<span dir="ltr">`), 20 places.                                                                                                                                                                                                                                                                    |
| W8  | Auto breadcrumbs linked to `/attendance/sessions` and `/evaluations/player`, which are not pages (404 on prefetch; "player portal" label on an evaluation page).                                                                           | Those prefixes produce no crumb (`NON_PAGE_PREFIXES` in `Topbar.tsx`).                                                                                                                                                                                                                                                                  |

Still open (not changed):

- Typing a forbidden URL directly: the page sends its first request before the guard redirects, so one 403 appears in
  the console (the API refuses, the user is redirected). Fix belongs in a general "don't fetch until allowed" pass.
- `/settings` opens read-looking forms for VIEWER/ACCOUNTANT (saving is refused by the API, `tenant.update`).
- Accountant has `reports.read`, so the API would serve the attendance report; the UI keeps it to roles that also hold
  `attendance.read` (matrix: "no attendance" for the accountant). Confirm if the accountant should see it.
- Demo sessions are dated from the seed day (2026-11-18): "today" lists in quick attendance are empty until reseeded.

## 9i. Detailed functional pass: scanner, notifications, reports, offline, security (2026-11-20)

Driven in a real browser against the production build and the Neon dev data. The scanner was tested with real QR
images through Chromium's fake camera; offline behaviour with the browser set offline. Results: scanner 15/17
(the 2 misses were test timing), quick attendance 7/7, notifications and finance 25/28 (3 were test assumptions),
reports 14/14, security 15/17 (2 explained below), plus an all-page sweep (both languages, 390 px width, accessibility).

| #   | Finding                                                                                                                                                                                                                                                       | Fix (commit)                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Account takeover on a development-mode API**: forgot-password returned the reset code (`debugOtp`) whenever `NODE_ENV=development`; code + e-mail resets the password. `start-sportexus.ps1` runs such an API behind a public tunnel.                       | Code returned only with `AUTH_EXPOSE_DEBUG_OTP=true` and development (default off) (`14e6b4d`).                                              |
| D2  | Quick attendance offline: marks were queued as scans with a non-UUID id and the player id as card code. The sync batch was rejected (400), the marks were lost, and valid scanner items of the same session were blocked. The page never synced on reconnect. | Separate queue for manual marks (latest status wins, idempotency key), replayed through `POST /attendance/records` on reconnect (`655e055`). |
| D3  | Scanner offline: a card held in front of the camera was queued every 2 s (counter 5 for one player).                                                                                                                                                          | Same card and session queued once, first arrival time kept (`655e055`).                                                                      |
| D4  | Finance CSV: `data:` URI cut at the first `#`, quotes not escaped, formula injection (`=`, `+`, `-`, `@`), raw codes in the Arabic file.                                                                                                                      | `utils/csv.ts` (Blob, RFC 4180, formula-safe), translated labels (`06d32f1`).                                                                |
| D5  | Printing: sidebar and top bar printed; the inner scroll box cut the page at one screen height. No print styles existed.                                                                                                                                       | `print:` variants in `AppShell` (`d9fdea6`).                                                                                                 |
| D6  | Attendance report: group filter listed groups of other branches.                                                                                                                                                                                              | Groups follow the branch; group resets on branch change (`d9fdea6`).                                                                         |
| D7  | Notifications: items were clickable `div`s (no keyboard, no screen reader); the panel did not close on Escape or outside click.                                                                                                                               | Buttons, `aria-expanded`, Escape/outside close (`f69d8f8`).                                                                                  |
| D8  | 50 Tailwind classes glued to a CSS-variable shorthand (`bg-(--bg-base)px-3`) silently ignored in 11 files.                                                                                                                                                    | Separated; `lib/tailwind-class-hygiene.test.ts` guards it (`0215704`).                                                                       |
| D9  | Unlabelled controls (labels not linked; filters, dates and fields without a name); group detail page had 22 hard-coded Arabic strings.                                                                                                                        | `htmlFor` / `aria-label`; strings follow the language (`0215704`).                                                                           |

Verified as working (no change): QR check-in on time, late with minutes, duplicate, unknown card, other branch,
closed session; tenant isolation (other academy, forged `x-tenant-id`); RBAC on writes (viewer, coach, receptionist,
cashier close K8); CSRF (no or foreign `Origin` refused); HttpOnly SameSite cookies; no account enumeration (login and
forgot-password); XSS (HTML in names rendered as text); expense approval and rejection notifications, double approval
refused; payment, reversal, short-reason and double-reversal refusals; receipt numbers `REC-YYYYMMDD-XXXXXXXX`; no
horizontal scroll at 390 px; join request staff notification and pending applicant login.

Open (need a decision or a larger change):

- Notification titles and bodies are stored as fixed text in mixed languages (English for join requests, approvals,
  invitations; Arabic for expenses). Proper fix: store a message key + parameters and render per language; it touches
  the S4 definer function that creates the join-request notification, so it needs the owner's SQL review.
- Rate limits answer 401 (login), 400 (OTP, reset, portal) or 429 (one portal path). 429 everywhere is correct but is
  an API contract change for the login page. Login throttling itself works (after 5 attempts in 15 minutes).
- The finance "statement" export contains only the 15 most recent transactions (`recentTransactions`); a full
  statement needs a transactions endpoint.
- A player of the branch who is not in the session's group can be checked in (only the branch is checked). Confirm
  whether this is intended (make-up sessions).
- Closing a session leaves unrecorded members UNMARKED (not ABSENT). Confirm the intended rule.
- `start-sportexus.ps1` still starts the API with `backend/.env` (`NODE_ENV=development`) behind a public tunnel; D1
  removes the worst consequence, but a public server should run in production mode.

## 9j. Academies of any sport (2026-11-21)

Owner request: academies of every sport can register, not only football.

| Layer    | Change                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Database | Migration `20261121120000_more_sports`: `SportCode` gains SWIMMING, TENNIS, PADEL, BASKETBALL, VOLLEYBALL, HANDBALL, MARTIAL_ARTS, GYMNASTICS, ATHLETICS, SQUASH, OTHER (additive; applied to the Neon dev database with the owner role). No policy, grant or definer-function change.                                                                                                                                               |
| Shared   | `constants/sports.ts`: `SPORT_CODES`, `SportCodeSchema`, `DEFAULT_SPORT`, `isSportCode`; every `z.enum(['FOOTBALL'])` uses it. `UpdateAcademySettings.sports` (first = main sport), `AcademyProfile.sports`. A test keeps `SPORT_CODES` equal to the Prisma enum.                                                                                                                                                                    |
| API      | Registration keeps the chosen sport (it was rewritten to FOOTBALL). After `platform_approve_academy_application` (which does not record a sport), the platform service writes the main sport in the new academy's context; on failure the academy reads as football and the owner can fix it. `GET/PATCH /tenants/profile` return and replace the academy's sports (`tenant.update` only). Evaluations no longer hard-code football. |
| Web      | `useAcademySports()` (profile, cached per academy). Settings: "Academy sports" chips + main sport. New group: sport picker when the academy has several sports; session = its group's sport; plans and new players = main sport. Registration lists all sports. Labels and icons for every sport; football-only wording (⚽ titles, examples) made generic.                                                                          |

Verified: unit tests (shared 56, API 377, web 389, database 10); end to end 15/15 in the browser: a swimming academy
registers, is approved as swimming, adds tennis, creates a tennis group and session; existing academies read as
football; only the owner may change sports; empty or unknown sports are refused.

Notes:

- Test data left on Neon dev: swimming test academies `qa.swim.*@example.com` (one completed, two from interrupted runs).
- The web unit suite sometimes fails 17 React render tests with "Cannot read properties of null (reading 'useState')"
  right after `@academy/shared` is rebuilt; the same commit passes on the next run. Environment, not code; to watch.
- Not done: sport-specific features (swimming times, tennis rankings); evaluation templates stay generic (four axes).

## 9k. Online payments, phase A: families pay subscriptions by card or wallet (2026-11-22)

Owner request: real payments. Owner decisions: both flows (families pay the academy subscription; academies pay the
platform subscription), gateway **Paymob**, and the families' money is collected in **one platform merchant account**;
the owner then transfers each academy its share (payout ledger). Phase A (this section) is the family flow.

| Layer    | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database | Migration `20261122100000_online_payments` (additive, applied to Neon dev with the owner role): enums `OnlinePaymentPurpose`, `OnlinePaymentStatus`; tables `online_payments` (one row per checkout attempt, `provider_order_id` unique, amount CHECK > 0) and `academy_payouts` (transfers from the platform to an academy). RLS forced on both. `online_payments_access`: own tenant, own payer, super admin, or the payment-webhook context. `academy_payouts`: tenant/super admin read, super admin insert. Grants for the three runtime roles. No definer function added or changed. |
| Database | `withPaymentWebhookTransaction` (package + `PrismaService`): sets `app.auth_context = 'payment_webhook'`, which only the `online_payments` policy admits, so the unauthenticated webhook can find a payment by order id and nothing else.                                                                                                                                                                                                                                                                                                                                                 |
| Shared   | `schemas/payments.ts`: `PaymentDueItem`, `CreateOnlinePaymentRequest/Response`, `OnlinePaymentStatusResponse`, `OnlinePaymentStatusSchema`.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| API      | New `payments` module: `GET /v1/payments/dues` (what the signed-in player/guardian owes), `POST /v1/payments/online` (creates a Paymob intention, returns the hosted checkout URL), `GET /v1/payments/online/:id` (status for the result page), `POST /v1/payments/paymob/webhook` (public, signed). `FinanceService.recordPayment` split into `recordPaymentInTx` + `dispatchReceipt` (same behaviour) so the webhook records the payment through the same rules as the cashier.                                                                                                         |
| Web      | `PaymentDues` card ("المستحقات" with «ادفع الآن») at the top of the guardian and player portals, hidden when nothing is due. New page `/payments/result` (authenticated) polls our API for the status; the provider's query string is never trusted.                                                                                                                                                                                                                                                                                                                                      |

Security of the webhook:

- Paymob's transaction HMAC (SHA-512 over 20 documented fields) is checked with a constant-time compare; a bad or
  missing signature is 401.
- The HMAC does not cover `merchant_order_id` or `extras`, so the payment is found by the **signed** `order.id` (stored
  as `provider_order_id` when the intention was created), and the signed amount and currency must equal the stored ones.
- Idempotent: `updateMany ... where status = PENDING` claims the payment inside the same transaction that writes the
  ledger entry, so a retried callback records nothing twice. Declines set FAILED with the provider's message.
- The ledger entry is a normal `MEMBERSHIP_FEE` with method `ONLINE`, reference `PAYMOB-<transaction id>` and the
  payer as the recorder; the receipt email and the audit event `ONLINE_PAYMENT_CONFIRMED` follow the commit.

Configuration (documented in `backend/.env.example`): `PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY`, `PAYMOB_HMAC_SECRET`,
`PAYMOB_INTEGRATION_IDS` (comma-separated: card, wallet, ...), optional `PAYMOB_API_BASE`, `PAYMOB_CHECKOUT_URL`,
`PAYMOB_CURRENCY` (EGP), and `APP_PUBLIC_URL`/`NEXT_PUBLIC_APP_URL` (builds the webhook and return URLs). Without the
four keys online payment is off: dues still show, with "السداد لدى الأكاديمية".

Verification:

- Unit: `paymob.client.test.ts` (5) and `payments.service.test.ts` (8). Full suites: API 390 passed / 8 skipped,
  web 392, shared 56, database 10; typecheck clean; lint 0 errors.
- End to end against a local stand-in for Paymob (intention API plus a checkout page that sends a signed callback),
  with the real API, web app and Neon dev database: 13/13 checks passed. Dues shown, then checkout; a declined card
  leaves the balance; a paid card shows "تم الدفع بنجاح" with a receipt number and the subscription leaves the dues;
  a retried callback adds no second ledger row (checked in the database); a forged signature and a tampered amount
  get 401; another user gets 404 for the payment and for paying the subscription.

Notes and pending:

- Test data left on Neon dev: hany.parent's two demo subscriptions (Adam 300, Laila 1,650 EGP) are now paid online.
- Not yet tested against Paymob itself: needs the owner's merchant account and keys (test mode first).
- Phase B (academies pay the platform subscription; payouts screen): done, see §9l.
- Refunds are not automated: reversing the ledger entry does not refund the card; a refund is made in Paymob.
- Collecting on behalf of academies needs the owner's legal and accounting arrangement (contracts, invoices, fees).

## 9l. Online payments, phase B: academies renew the platform subscription; payouts (2026-11-22)

Owner request: continue with phase B.

| Layer    | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database | Migration `20261122130000_platform_subscription_payments` (additive; applied to Neon dev with the owner's approval): `online_payments.billing_months` (1-12, CHECK) and `online_payments.saas_invoice_id` (unique, FK to `saas_invoices`, SET NULL). New definer function `fulfil_platform_subscription_payment(payment_id)`: callable only in the payment-webhook context, only for a PAID `PLATFORM_SUBSCRIPTION` payment; sets the subscription ACTIVE, moves `renewal_date` forward by `billing_months` from the later of the current renewal date and now, clears `grace_ends_at`, creates a PAID invoice (`INV-<yyyymmdd>-<10 chars>`, method ONLINE) and links it; idempotent. EXECUTE revoked from PUBLIC, granted to the runtime roles. **Security-relevant: please review the SQL in the migration before merging to main.**                                        |
| Shared   | `SAAS_BILLING_CYCLE_MONTHS`, `PlatformSubscriptionQuote`, `AcademyPayoutBalanceItem`, `AcademyPayoutItem`, `CreateAcademyPayoutRequestSchema`, `AcademyOnlineCollectionsSummary`; `OnlinePaymentStatusResponse` gains optional `purpose`, `invoiceNumber`, `renewalDate` (backward compatible).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| API      | `GET /v1/payments/platform-subscription/quote` and `POST /v1/payments/platform-subscription` (tenant + `tenant.update`, i.e. the academy owner); `GET /v1/payments/academy-summary` (tenant + `payments.read`); `GET /v1/platform/payouts/balances`, `GET /v1/platform/payouts` (platform staff), `POST /v1/platform/payouts` (platform owner only). The webhook fulfils `PLATFORM_SUBSCRIPTION` payments: claim PENDING to PAID and call the definer function in one webhook transaction; audit `PLATFORM_SUBSCRIPTION_PAID_ONLINE`. Payouts: balance = PAID family payments minus payouts per academy and currency; a payout may not exceed the balance (`PAYOUT_EXCEEDS_BALANCE`), with a per-academy advisory lock; audit `ACADEMY_PAYOUT_RECORDED`. Checkout start now marks the payment FAILED if the provider order id cannot be stored (it could never be confirmed). |
| Web      | Finance > plans tab: "جدّد اشتراك المنصة أونلاين" with amount, period and the new renewal date (owner only; hidden otherwise). Finance > overview: "الدفع الإلكتروني والتحويلات" card (collected online, transferred, still held, latest transfers; hidden until the first online payment). Platform console: new tab and sidebar entry "تحويلات الأكاديميات" (balances per academy, total owed, transfer history; "تسجيل تحويل" dialog for the platform owner). Result page handles platform payments (invoice number, renewed-until date).                                                                                                                                                                                                                                                                                                                                  |

Business rule chosen (prices are monthly across the platform, as the console's MRR shows): one payment buys one billing
cycle. Cycle price = monthly price (negotiated price, else the plan's monthly price) times the cycle's months
(1/3/6/12); an annual cycle on the list price uses the plan's yearly price when it is set. The owner can change this.

Verification:

- Unit: payments 24 tests (pricing and renewal date, platform webhook fulfilment once, amount mismatch, checkout
  abandoned when the order id cannot be stored) and payouts 4 tests (balances, record within balance, refuse above the
  balance, unknown academy). Full suites: API 401 passed / 8 skipped, web 392, shared 56, database 10; typecheck and
  lint clean.
- End to end against the local Paymob stand-in with the real API, web app and Neon dev database: 14/14. The owner of
  أكاديمية النجوم sees the renewal card (1,299 EGP, one month), pays, and the result page shows the invoice number and
  the new date; the subscription moved from 2026-12-18 to 2027-01-18; a repeated callback renews nothing (one invoice in
  the database); a manager gets 403; the academy summary shows 1,950 EGP collected; a platform admin sees the balance but
  gets 403 when recording; a parent gets 403; a payout above the balance gets 400; the platform owner records 1,000 EGP
  through the dialog and the balance drops to 950 for both the console and the academy.

Notes and pending:

- Test data left on Neon dev: أكاديمية النجوم renewed to 2027-01-18 with invoice `INV-20261121-DFA4EE091B`; a payout of
  1,000 EGP (reference CIB-TRX-55821); one PENDING platform payment without an order id from a test-setup failure (the
  stand-in reused an order number), harmless.
- Environment incident: the first `prisma migrate deploy` ran against the **local** database (`localhost:5432`,
  `packages/database/.env`), because the schema's `DATABASE_URL` wins over `DATABASE_ADMIN_URL` from the shell. That
  local database was 12 migrations behind (from `20261116090000` to this one) and all of them were applied; it holds
  almost nothing (0 academies, 7 users) and nothing was deleted. To target Neon, set `DATABASE_URL` itself for the CLI.
- To check: `FinanceService.getTenantSubscription` creates a missing subscription in the academy's context, which RLS
  allows only to platform staff; an academy without a subscription row would get an error there (pre-existing; every
  demo academy has a row).
- Platform subscription payment does not change the plan (upgrade/downgrade stays a platform-console action).
- Not yet tested against Paymob itself (needs the merchant keys). Refunds stay manual in Paymob.

## 9m. Owner test-list findings: ten fixes (2026-11-22)

Found by the owner while following the test plan.

| #   | Problem reported                                                                                                   | Cause                                                                                                                                                                                                                                                                              | Fix                                                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | The site opens on the login page, not the landing page                                                             | `next.config.ts` redirected `/` to `/dashboard` (and `app/page.tsx` did the same), which sends visitors to the login                                                                                                                                                               | Redirect removed; `app/page.tsx` renders the landing page (it already shows signed-in users a dashboard button). Sidebar logo links to `/dashboard`.                                                                                                                                 |
| 2   | Every action on a pending request should e-mail the applicant, in the platform's design, from the platform address | Academy reviews already e-mailed; join-request e-mails were plain HTML; no "received" e-mail; the shell was dark                                                                                                                                                                   | `renderBaseTemplate` redesigned (light, Sportexus wordmark, brand gradient, inline styles and tables only); dark colours in existing bodies replaced. New `sendJoinRequestReceived` (on submit) and `sendJoinRequestDecision` (approved / rejected / more info).                     |
| 3   | Registering a player has no player e-mail; the father's e-mail became the player's                                 | One e-mail field, under the guardian section, was the account e-mail for PLAYER requests; approval also put it on the guardian record                                                                                                                                              | PLAYER form asks for the player's own e-mail (sign-in) and the guardian's e-mail (optional, must differ). Migration `20261122150000_join_request_guardian_email` (column + `submit_player_join_request` gains `p_guardian_email`); approval stores it on the guardian.               |
| 4   | Example text should disappear when typing; no people's names in examples                                           | Native placeholders stayed visible until the first character; several placeholders used names/real-looking data                                                                                                                                                                    | Global CSS hides placeholders on focus; examples replaced with generic ones (`name@example.com`, `01XXXXXXXXX`, "الاسم الأول"...).                                                                                                                                                   |
| 5   | Two eye icons in password fields                                                                                   | Microsoft Edge draws its own reveal button next to ours                                                                                                                                                                                                                            | CSS hides `::-ms-reveal` / `::-ms-clear`.                                                                                                                                                                                                                                            |
| 6   | "Remember me" did not work                                                                                         | The first refresh (after 15 minutes) re-issued the refresh cookie without an expiry, so the session ended with the browser                                                                                                                                                         | `remember_me` cookie (httpOnly, `/v1/auth`) keeps the choice; refresh and password change re-issue a persistent cookie when it is set.                                                                                                                                               |
| 7   | "Join as player" mixed player and guardian                                                                         | One form with an in-form "who is applying" switch                                                                                                                                                                                                                                  | Two buttons on the landing page (hero, call to action, footer): "انضمام كلاعب" and "تسجيل ابني / ابنتي (ولي أمر)", each opening its own form.                                                                                                                                        |
| 8   | Sudden sign-outs                                                                                                   | (a) a 10-second timer signed users out when the 15-minute access token's stored expiry passed (never updated on refresh); (b) a network/server error on refresh or on `/auth/me` signed users out; (c) a refresh whose answer was lost made the next refresh look like token theft | (a) timer and the expiry check on load removed; (b) only a 401/403 ends the session, temporary failures surface as a retryable 503; (c) 60-second reuse grace window in `TokenService` (revokes the unused successor, issues one fresh token; theft detection unchanged after 60 s). |
| 9   | The camera could not be turned off                                                                                 | No stop control; a stream that opened after a stop stayed on                                                                                                                                                                                                                       | "إيقاف" button over the video; the stream is kept in a ref and a late stream is closed at once.                                                                                                                                                                                      |
| 10  | The attendance counter did not update after a scan                                                                 | The session totals were loaded once with the page                                                                                                                                                                                                                                  | Totals reloaded (bypassing the 25 s GET cache) after each successful scan and offline sync, and every 15 s while the page is visible.                                                                                                                                                |

Verification: unit tests added (token grace window x2, transient refresh x4, join e-mails x4, join form rules x2);
full suites API 407 passed / 8 skipped, web 398, shared 56, database 10; typecheck and lint clean. End to end on a
separate local copy (ports 3100/3101, real Neon dev database, fake camera): 20/20 checks for the ten items.

Notes:

- E-mails are only logged while `MAIL_PROVIDER=dev` (current `backend/.env`); real delivery needs a sender: Resend with
  a verified domain (`RESEND_API_KEY`, `MAIL_FROM_EMAIL`) or SMTP (`SMTP_*`). Owner decision pending.
- Test data on Neon dev: three approved QA players (`qa.player.<n>@example.com`, guardians `qa.guardian.<n>@example.com`)
  in أكاديمية النجوم, and five "U12 QA" sessions today (all closed).
- Build EPERM (`query_engine-windows.dll.node`): Windows locks the Prisma engine while an API process runs, and
  `prisma generate` rewrites it every time. The root `build`, `build:backend` and `dev` now run
  `db:generate:if-needed` (`packages/database/scripts/generate-if-needed.cjs`), which skips generation when the client
  already matches the schema; verified by building while an API was running. After a schema change, stop the API
  first. `pnpm db:generate` still always regenerates (CI, Docker).
- Security-relevant SQL in this round: `submit_player_join_request` re-created with one extra parameter (same body);
  review before merging to main.

## 10. Backend requirements (recorded by owner decisions)

**Workflow (owner direction 2026-11-15):** frontend issues whose root cause is in the backend are now fixed across both
layers in the same increment (inspect both → fix root cause → server-side authorization → tests on both sides →
separate commits). No large backend refactor. Status: BR-1 and BR-2 — documented, **pending scope review** before any
implementation; BR-3 — **pending product decision**.

### BR-1 (F16) Distinguishable login failures without account enumeration

Current API: every failure below is HTTP 401 (`UnauthorizedException`). Order in `AuthService.login`: rate limit →
password verification → suspension → pending/rejected application or join request.

| Situation                               | Checked         | Current                        | Required status + `code`                          | Frontend message (to implement then)        |
| --------------------------------------- | --------------- | ------------------------------ | ------------------------------------------------- | ------------------------------------------- |
| Wrong email or password                 | —               | 401 `INVALID_CREDENTIALS`      | keep 401 `INVALID_CREDENTIALS`                    | generic "Invalid email or password"         |
| Too many attempts                       | before password | 401 `RATE_LIMIT_EXCEEDED`      | 429 `RATE_LIMIT_EXCEEDED` (+ retry-after seconds) | "Too many attempts, try again in N min"     |
| Account suspended                       | after password  | 401 `FORBIDDEN`                | 403 `ACCOUNT_SUSPENDED` (new code)                | "Account suspended — contact support"       |
| Academy application pending / more info | after password  | 401 `ACADEMY_PENDING_APPROVAL` | 403 `ACADEMY_PENDING_APPROVAL`                    | "Your academy application is under review"  |
| Academy application rejected            | after password  | 401 `ACADEMY_REJECTED`         | 403 `ACADEMY_REJECTED`                            | "Your academy application was not approved" |
| Player join request pending             | after password  | 401 `PLAYER_PENDING_APPROVAL`  | 403 `PLAYER_PENDING_APPROVAL`                     | "Your join request is under review"         |
| Player join request rejected            | after password  | 401 `PLAYER_REJECTED`          | 403 `PLAYER_REJECTED`                             | "Your join request was not approved"        |

Rules: account-specific codes only **after** successful password verification (already true), so they reveal nothing
to someone without the password; add the new codes to `packages/shared` `ErrorCode`; the frontend maps on `code`
(never on message text or bare status) inside `features/auth/login-form.ts` `resolveLoginError`, with localized copy;
unknown codes keep the generic message. Also fix F15 (`VALIDATION_ERROR` → `VALIDATION_FAILED`) at the same time.

### BR-2 (F17) Persist all player join-request fields

- Schema/migration: add to `player_registration_requests` — `gender`, `jersey_number`, `national_id`,
  `emergency_contact_name`, `emergency_contact_phone`, `medical_notes`, `guardian_relationship` (nullable; reversible migration;
  existing rows untouched).
- Contract: extend `CreatePlayerJoinRequestSchema` (optional fields, lengths/enums matching `CreatePlayerRequestSchema`
  and `GuardianRelationship`), DTOs, service and the approval flow (copy into `players` / `guardians` instead of the
  current defaults gender MALE / placeholders).
- Protection: `national_id` and `medical_notes` readable only with `players.sensitive.read` (same as player records);
  masked in list endpoints; excluded from notifications, e-mails and audit metadata; RLS unchanged (tenant-scoped).
- Frontend then: send `pendingBackendSupport` fields (remove them from `JOIN_FIELDS_PENDING_BACKEND_SUPPORT`; the
  contract-drift test will flag the change).

### BR-3 (F19) Invite-based staff sign-up

Product decision needed: a staff sign-up that creates an account bound to the invitation email (no academy application),
with e-mail verification, so invitees can accept invitations.

## 11. Change log

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Files                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-22 | Owner test-list fixes (§9m): landing at `/`, join-request e-mails in the platform design, separate player/guardian e-mails and forms, placeholders, single password eye, remember me, no sudden sign-outs, scanner stop button and live counter.                                                                                                                                                                                                                                                           |
| 2026-11-22 | Online payments phase B (§9l): academies renew the platform subscription online (definer function, paid invoice); payouts ledger with platform-console tab and academy card.                                                                                                                                                                                                                                                                                                                               |
| 2026-11-22 | Online payments phase A (§9k): families pay subscriptions through Paymob into the platform account; a signed, idempotent webhook records the ledger entry and receipt; dues card and result page.                                                                                                                                                                                                                                                                                                          |
| 2026-11-21 | Academies of any sport (§9j): 11 new sports, registration keeps the sport, academy sports in settings, forms follow the academy's sports.                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-11-20 | Detailed functional pass (§9i): debug reset code opt-in (D1), offline quick marks and scan dedupe (D2, D3), safe CSV (D4), printing (D5), report group filter (D6), accessible notifications (D7), 50 lost classes (D8), labels and group page language (D9).                                                                                                                                                                                                                                              |
| 2026-11-20 | Full-platform walkthrough (§9h): guardian coach feedback via the portal (W1), UI follows the API permissions (W2), dashboard without refused counts or fake trend (W3), coach title (W4), laptop start script proxy settings (W5).                                                                                                                                                                                                                                                                         |
| 2026-11-18 | Login error and slowness (§9g): unreachable database = 503 with a retry message; `backend/.env` loaded first; development database moved to Neon Frankfurt.                                                                                                                                                                                                                                                                                                                                                | `backend/src/common/filters`, `backend/src/config`, `frontend/src/features/auth`, `docs`                                                                                                                                                                                                                                                                                              |
| 2026-11-16 | **Owner decisions applied** (§9f): documented RBAC matrix, K8, K3, K4, K9, account links via definer functions, must-reset-password, K16/K11/K12, web lint warnings, Render blueprint + S2, demo seed; Neon dev data replaced after a verified backup.                                                                                                                                                                                                                                                     | `packages/{shared,database}`, `backend/src`, `frontend/src`, `render.yaml`, `docs/{deployment,security}`                                                                                                                                                                                                                                                                              |
| 2026-11-16 | **K6** (§9e): join requests from PLAYER / GUARDIAN with pending accounts, login gating per applicant kind, approval links the account, portal "join requests" card, login page shows account-state messages; portal read policies (portals were broken under the runtime role) and portal flags read under the actor context. Both migrations applied to Neon dev after a verified backup.                                                                                                                 | `packages/database/{prisma,tests}`, `packages/shared/src/schemas/platform.ts`, `backend/src/modules/{auth,players,portal}`, `frontend/src/{app/{guardian,player},components/dashboard,features/{auth,landing,portal}}`, `.github/workflows/ci.yml`                                                                                                                                    |
| 2026-11-16 | **Phase 3A.2 applied** (§9d): migrations M2/M3 (S4, S6, definer functions, runtime privilege baseline), API runs under the restricted runtime role (verified end to end as `sportexus_app`), CI database steps, self-host compose, K5. M2/M3 applied to Neon dev after a verified backup.                                                                                                                                                                                                                  | `packages/database/{prisma/migrations,tests,scripts,prisma.config.ts}`, `backend/src/{common,modules/{audit,auth,database,evaluations,finance,notifications,platform,players,portal}}`, `frontend/src/{app/{guardian,player},components/platform/StorageTab.tsx}`, `packages/shared/src/schemas/platform.ts`, `.github/workflows/ci.yml`, `docker-compose.selfhost.yml`, env examples |
| 2026-11-15 | **Phase 3A.2 SQL review package** (§9d): M2/M3 drafts, boundary tests, catalog verification; `provision-runtime-role.sql` keeps the `session_version` grant (S7); policy-count wording corrected in §9c. No migration applied.                                                                                                                                                                                                                                                                             | `docs/proposals/PHASE_3A2_SQL_REVIEW.md`, `docs/proposals/phase-3a2/**`, `packages/database/scripts/provision-runtime-role.sql`                                                                                                                                                                                                                                                       |
| 2026-11-15 | **Phase 3A.1 security** (§9c): S5 retired, S1 trusted client IP, M1 migration, K1 reset bound to email plus link token, K13/K13b session versions, real-PostgreSQL concurrency tests. M1 applied to the Neon dev database after a verified backup; 104105500 recorded as a baseline exception. API change: `reset-password` needs `email` with a code.                                                                                                                                                     | backend `modules/auth/**`, `common/client-ip.ts`, `config/*`, `main.ts`, `platform.*`; frontend `app/{reset,forgot}-password`, `features/auth/reset-link.ts`, `lib/http/proxy-forwarding.ts`, `app/v1/[...path]/route.ts`; `packages/shared/src/schemas/auth.ts`; migration M1; compose, Render and env examples; CI                                                                  |
| 2026-11-15 | **Phase 2A completion.** Prisma generation made explicit, with a client freshness check (`9a10f1f`); `prisma generate` no longer needs `DATABASE_URL`, fixing Docker and fresh-checkout builds (`478e31a`); test files type-checked in all packages, with 142 hidden errors fixed (`16cdd9e`, `5ae3ce6`, `0504aa3`); Next.js ESLint rules (`7321c74`); Node 22 LTS everywhere (`d192a43`). Phase 3A proposal written (`docs/proposals/PHASE_3A_SECURITY.md`).                                              | see §9b                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-11-15 | **Phase 2A, structure and hygiene (no behaviour change).** Database tests fixed (K15); 0 lint errors; Prettier clean; LF line endings enforced; `version.json` no longer rewritten by local builds; `frontend/src/lib` shims and the duplicate translations removed; duplicated `@Optional()` fallbacks removed from the attendance, finance and platform services; Windows CI job. Commits `b33d68f`, `4bb0699`, `ace1bd6`, `25ecbba`, `ab3a599`, `4e00569`, `6f7277b`, `fea097a`.                        | see §9b                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-11-14 | Initial knowledge baseline: created the five core docs; no application code modified.                                                                                                                                                                                                                                                                                                                                                                                                                      | `docs/PROJECT_OVERVIEW.md`, `docs/SYSTEM_ARCHITECTURE.md`, `docs/BUSINESS_LOGIC.md`, `docs/TECHNOLOGY_STACK.md`, `docs/DEVELOPMENT_STATUS.md`                                                                                                                                                                                                                                         |
| 2026-11-14 | Phase 1 frontend analysis + verification baseline (§9); proposal pending approval.                                                                                                                                                                                                                                                                                                                                                                                                                         | `docs/DEVELOPMENT_STATUS.md`                                                                                                                                                                                                                                                                                                                                                          |
| 2026-11-15 | F23 + F24. **Backend `6efea56`:** generic 400 for duplicate national ID without `players.sensitive.read` (specific 409 kept for permitted roles); P2002 race mapped; presence-based 403 for `nationalId`/`medicalNotes` on update. **Frontend:** contract test only. Docs: §9b pre-existing issues. No migration; API error responses changed for restricted roles only.                                                                                                                                   | `backend/src/modules/players/{players.service.ts,player-sensitive-data.ts}` (+2 test files), `frontend/src/features/players/players-logic.test.ts`                                                                                                                                                                                                                                    |
| 2026-11-15 | F22 + F21 full-stack. **Backend `f1ddeca`:** `players/player-sensitive-data.ts` (single sensitive-data rule), list/create responses mask `nationalId`/`medicalNotes`, list search excludes national ID without `players.sensitive.read`; `CreatePlayerSchema.initialEnrollmentStartDate` (optional) + `isCalendarDate`; `createPlayer` uses it. **Frontend:** create form sends the start date; roster hides national ID + adjusts search placeholder by permission. No migration; no breaking API change. | `backend/src/modules/players/{players.service.ts,player-sensitive-data.ts}` (+2 test files), `packages/shared/src/schemas/player.ts` (+test), `frontend/src/features/players/new-player-form.ts`, `frontend/src/app/players/{page,new/page}.tsx`                                                                                                                                      |
| 2026-11-14 | Phase 1 Step 4: players feature (`features/players/**`), pagination/search/error-state fixes, bilingual + accessible player profile and modals; F17 applicant notice (`7ce0fac`). No backend/API/DB/currency changes.                                                                                                                                                                                                                                                                                      | `frontend/src/app/players/{page,new/page,[id]/page}.tsx`, `frontend/src/components/player-qr-card.tsx`, `frontend/src/features/players/**`, `frontend/src/hooks/useDebouncedValue.ts` (+2 test files)                                                                                                                                                                                 |
| 2026-11-14 | Step 3 follow-up: F14 safe return path implemented; F17 explicit contract mapping (fields kept, pending list); F16/F17/F19 backend requirements documented (§10). No backend/API/DB changes.                                                                                                                                                                                                                                                                                                               | `frontend/src/lib/auth/safe-return-path.ts`, `frontend/src/hooks/useSafeReturnPath.ts`, `frontend/src/app/{login,register,accept-invite}/page.tsx`, `frontend/src/features/landing/{player-join-request.ts,components/PlayerJoinRequestModal.tsx}` (+2 test files)                                                                                                                    |
| 2026-11-14 | Phase 1 Step 3: auth & public pages restructured onto `features/auth` + `features/landing`; error-message hardening; 8 typo fixes. No API, validation-rule, backend or currency changes.                                                                                                                                                                                                                                                                                                                   | `frontend/src/app/{login,register,forgot-password,reset-password,verify-email,accept-invite,landing,offline}/page.tsx`, `frontend/src/components/platform/CoOwnerTab.tsx`, `frontend/src/features/{auth,landing}/**`, `frontend/src/hooks/{useCooldown,useDelayedRedirect}.ts` (+6 test files)                                                                                        |
| 2026-11-14 | Phase 1 Step 2: shared access guard, AuthGuard rebuilt, AppShell text colour fixed. No permission, API or backend changes.                                                                                                                                                                                                                                                                                                                                                                                 | `frontend/src/lib/auth/access-rules.ts`, `frontend/src/hooks/useAccessGuard.ts`, `frontend/src/components/layout/{AuthGuard,AppShell}.tsx`, 20 pages under `frontend/src/app/` (+3 test files)                                                                                                                                                                                        |
| 2026-11-14 | Phase 1 Steps 0–1 + session-page CSS repair (see §9 progress). No backend, API contract or currency changes.                                                                                                                                                                                                                                                                                                                                                                                               | `frontend/src/{config,lib/http,features/*/api.ts,api/client.ts,components/ui/ConfirmDialog.tsx,features/attendance/components/QrCheckInSimulator.tsx}`, 5 pages (confirm dialogs), `app/layout.tsx`                                                                                                                                                                                   |
