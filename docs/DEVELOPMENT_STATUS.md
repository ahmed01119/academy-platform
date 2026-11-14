# Development Status

> Last updated: **2026-11-14** — initial project-knowledge baseline (analysis only, no source changes).
> Update this file after every task (see CLAUDE.md §15).

## 1. Current phase

- Feature development phases 0–12 are marked COMPLETED in `docs/implementation/MASTER_PROGRESS.md`.
- The repository is mid-way through an **architecture/UI-UX refactor** on branch
  `frontend-architecture-uiux-audit`: ~140 uncommitted files (modified + untracked), including
  new backend repositories, extracted services, new frontend `components/{ui,finance,platform,layout}`,
  `loading.tsx` skeletons, and a `lib/ → api/ contexts/ utils/ locales/` reorganisation.
- **Next planned phase: controlled restructuring** — awaiting owner approval (not started).

## 2. Verification baseline (run 2026-11-14 on the working tree)

| Check | Result |
|---|---|
| `@academy/shared` build + test | ✅ 27/27 tests |
| `@academy/database` build | ✅ |
| `@academy/database` test | ❌ 3/6 failing — `src/tenant-transaction.test.ts` expects separate `set_config` calls; the (uncommitted) implementation now batches them into one statement. Tests are stale, behavior is intact. |
| `@academy/api` test | ✅ 227/227 tests (22 files) |
| `@academy/api` typecheck | ✅ 0 errors |
| `@academy/web` test | ✅ 84/84 tests (12 files) |
| `@academy/web` typecheck | ✅ 0 errors |
| lint, format:check, build, SQL tests, E2E | ⏳ not run in this baseline |

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

| Item | Evidence |
|---|---|
| Repository layer | `backend/src/modules/database/repositories/*` registered in `DatabaseModule` but **no service uses them**. |
| Service extraction | `AttendanceRosterService`, `FinancePlansService`, `PlatformMetricsService` are injected `@Optional()`; the original methods keep full fallback copies → duplicated logic. |
| Frontend reorganisation | `src/lib/*` are 2-line re-export shims; `src/lib/i18n/translations.ts` is a **byte-identical duplicate** of `src/locales/translations.ts`. |
| `AuthGuard` component | `frontend/src/components/layout/AuthGuard.tsx` exists, unused; every page re-implements auth redirects. |
| SaaS plan limits | Only `maxPlayers` is enforced, and only on join-request approval (`players.service.ts:1135`). `maxBranches`, `maxCoaches`, and manual player creation are not limited. |
| SaaS invoices | `saas_invoices` table/model exists; no service creates or updates invoices. |
| Support access | Records an audit entry only; no actual read-only support session mechanism. |
| Background jobs | BullMQ mentioned in README "later"; emails are sent inline. |

## 5. Known issues (verified in code — not yet fixed)

Severity is an engineering estimate; none of these were changed.

| # | Sev | Issue | Location |
|---|---|---|---|
| K1 | High | **OTP reset brute-force guard is ineffective**: the attempt counter key is the hash of the *submitted* code, so every wrong guess uses a new key; reset accepts the 6-digit code without the email, so any pending reset in the system can be guessed. | `backend/src/modules/auth/auth.service.ts:570`, `packages/shared/src/schemas/auth.ts:75` |
| K2 | High | **Committed data dump** with 29 users incl. `passwordHash` and token columns, tenants, players. | `packages/database/backup_pre_migration_coach_delegation.json` (tracked in git) |
| K3 | High | **Suspended academies keep working**: `TenantGuard` and login never check `tenant.status`; plain suspension does not revoke sessions (only Owner archive does). | `backend/src/modules/auth/guards/tenant.guard.ts`, `platform.service.ts:252` |
| K4 | Med | **Currency hard-coded to `SAR`** on payments and expenses (and across finance UI), while tenants, plans and settings default to `EGP`. | `finance.service.ts:440, 512, 834`; `frontend/src/components/finance/*`, `app/finance/page.tsx`, `app/attendance/**` |
| K5 | Med | **Storage maintenance cannot purge audit logs**: `auditLog.deleteMany` hits the append-only trigger → the whole maintenance transaction (incl. token purge) fails when old logs exist. | `platform.service.ts:2078` vs migration `20261016000100_audit_log_append_only` |
| K6 | Med | **Public join requests never link the applicant**: `POST /portal/player-join-requests` has no JWT guard, so `@CurrentUser('id')` is always undefined → `applicantUserId` null → no applicant notifications, no login gating for players. | `backend/src/modules/portal/portal.controller.ts:75` |
| K7 | Med | **National ID leaks in player list** to every `players.read` role (COACH, VIEWER, ACCOUNTANT); detail view masks it. | `players.service.ts:156` vs `:263` |
| K8 | Med | **Cashier close requires only `session_expenses.read`** (granted to RECEPTIONIST, COACH, VIEWER). | `finance.controller.ts:171-172` |
| K9 | Med | Join-request approval may **merge different children with the same first+last name** into one player; defaults gender MALE / DOB 2012-01-01 when unknown. | `players.service.ts` (`reviewPlayerJoinRequest`) |
| K10 | Low | Invitation API response returns the raw invitation token to the inviter. | `tenancy.service.ts:246` |
| K11 | Low | Receipt/expense numbers use `Math.random()` 4 digits (`REC-YYYY-####`) — collisions likely at volume; no uniqueness constraint. | `finance.service.ts:426, 823` |
| K12 | Low | Payment receipt email is sent (with retries) **inside** the DB transaction, holding the transaction open. | `finance.service.ts:506` |
| K13 | Low | `changePassword` does not revoke other refresh tokens (reset does). | `auth.service.ts` (`changePassword`) |
| K14 | Low | Missing space in class list: `bg-(--bg-base)text-(--text-main)` → text colour class not applied. | `frontend/src/components/layout/AppShell.tsx:22` |
| K15 | Low | Stale tests in `packages/database/src/tenant-transaction.test.ts` (see §2). | |
| K16 | Low | Monetary amounts stored as `Float` (double) — rounding risk for ledger sums. | `schema.prisma` (finance models) |

## 6. Documentation vs implementation discrepancies

| Doc | Says | Code does |
|---|---|---|
| `docs/security/ROLE_PERMISSION_MATRIX.md` | 18 cells differ, e.g. COACH `attendance.mark` ✅, MANAGER `players.delete` ✅, RECEPTIONIST/COACH/ACCOUNTANT/VIEWER `staff.read` ✅, VIEWER `evaluations.read` ✅, BRANCH_MANAGER `session_expenses.approve` ❌, VIEWER `reports.read` ❌ | See `ROLE_PERMISSIONS` table in BUSINESS_LOGIC.md §1.2 |
| `docs/implementation/MASTER_PROGRESS.md` | Paths `apps/api`, `apps/web`; endpoints `/platform/applications/:id/approve|reject` | Paths `backend/`, `frontend/`; endpoint `PATCH|POST /platform/applications/:id/review` |
| `MASTER_PROGRESS.md` Phase 2 | "Removed debug tokens from all public API responses" | `forgot-password` returns `debugOtp` when `NODE_ENV=development` |
| `README.md` | Runtime role denied `INSERT` on `tenants` | Platform approval creates tenants through Prisma under `withPlatformAdminTransaction` — must rely on later grants/policies (not re-verified against a live DB) |
| `README.md` | `packages/*-config` "Shared TypeScript / ESLint" and BullMQ | Config packages exist; BullMQ not installed |

## 7. Open questions (need product-owner decision)

1. **Permissions**: Which is intended — the code matrix or `ROLE_PERMISSION_MATRIX.md`? (18 differences.)
2. **Currency**: Is the product EGP, SAR, or per-tenant (`tenant.currency`)? Finance currently writes SAR.
3. **Tenant suspension**: Should a SUSPENDED academy block all staff/portal access immediately?
4. **Cashier close**: Which roles may close a session's cashier? Should a closed cashier be re-closable (currently overwritten)?
5. **Plan limits**: Should `maxBranches`, `maxCoaches` and manual player creation be enforced? What happens on downgrade?
6. **Join requests**: Must applicants be logged in (to link their account), or stay anonymous? How should duplicates be detected?
7. **Coach attendance**: Code forbids coaches from recording attendance (explicit product rule) — confirm, as the role-matrix doc says otherwise.
8. **Platform Owner without Super Admin flag**: frontend checks only `isPlatformSuperAdmin`; backend accepts either. Can an Owner-only account exist? (`scripts/create-superadmin.js` sets both.)
9. **`academy_platform_mysql.sql`** (untracked, 84 KB, MySQL 8 schema + seed): purpose? The stack is PostgreSQL-only.
10. **`backup_pre_migration_coach_delegation.json`**: demo or real data? Should it be removed from git history?
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
- [ ] Address security issues K1–K3 (after approval).

## 9. Phase 1 (frontend refactor) — analysis baseline, 2026-11-14

Status: **analysis done, target architecture proposed, awaiting approval. No frontend code changed.**

| Check (frontend) | Result |
|---|---|
| `pnpm --filter @academy/web lint` | ✅ 0 errors (warnings: Next ESLint plugin not detected; `eslint.config.js` module-type warning) |
| `typecheck` | ✅ 0 errors |
| `test` | ✅ 84/84 |
| `build` (Next 15.5.28) | ✅ 36 routes; shared JS 103 kB; largest `/attendance/scanner` 231 kB first load |
| Prettier check | ❌ 91 files differ — ~50 only by CRLF line endings (`core.autocrlf=true` checkout; repo stores LF), **41 with real formatting drift** |

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

## 10. Change log

| Date | Change | Files |
|---|---|---|
| 2026-11-14 | Initial knowledge baseline: created the five core docs; no application code modified. | `docs/PROJECT_OVERVIEW.md`, `docs/SYSTEM_ARCHITECTURE.md`, `docs/BUSINESS_LOGIC.md`, `docs/TECHNOLOGY_STACK.md`, `docs/DEVELOPMENT_STATUS.md` |
| 2026-11-14 | Phase 1 frontend analysis + verification baseline (§9); proposal pending approval. | `docs/DEVELOPMENT_STATUS.md` |
