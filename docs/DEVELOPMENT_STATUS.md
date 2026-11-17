# Development Status

> Last updated: **2026-11-16**: owner decisions applied (K2-K4, K8, K9, items 5-7, S2, Render, demo data); see §9f.
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
