# System Architecture

> Describes the implementation as of 2026-11-14 (branch `frontend-architecture-uiux-audit`,
> with ~140 uncommitted working-tree changes). ADR context: `docs/adr/ADR-001..004`.

## 1. High-level shape

A **pnpm/Turborepo monorepo** containing a **modular-monolith NestJS API**, a **Next.js web
app/PWA**, and shared packages. One PostgreSQL database, multi-tenant by `tenant_id` column
with Row-Level Security; Redis for rate limiting.

```
Browser (Next.js client components, PWA service worker, IndexedDB offline queue)
   │  fetch('/v1/...')  same-origin, credentials: 'include', x-tenant-id header
   ▼
Next.js server  ── app/v1/[...path]/route.ts  (runtime reverse proxy → INTERNAL_API_URL; attests client IP)
   ▼
NestJS API  /v1   (Express; cookie-parser; correlation id; security headers; CORS; CSRF guard)
   │  Guards: JwtAuthGuard → TenantGuard → PermissionsGuard (+ Platform guards)
   │  Services (business logic) → PrismaService transaction helpers (set_config for RLS)
   ▼
PostgreSQL 16  (RLS FORCE on tenant tables, append-only triggers, SECURITY DEFINER functions)
Redis 7        (rate limits; in-memory fallback outside production)
Email          (Resend HTTP API | SMTP | dev in-memory logger)
```

## 2. Repository layout

```
backend/                 @academy/api   NestJS app
  src/main.ts            bootstrap: body limits 10mb, cookies, CORS (exact + *.suffix), prefix /v1, GlobalExceptionFilter
  src/app.module.ts      registers all domain modules
  src/config/            Zod env validation + AppConfigService
  src/common/            correlation & security-header middleware, exception filters
  src/modules/<domain>/  controller · service · module · *.test.ts
     auth/ (guards/, decorators/, password & token services)
     database/ (PrismaService, repositories/ — new, not yet used by services)
     tenancy, branches, players, enrollments, groups, attendance, evaluations,
     finance, portal, platform, notifications, email, audit, redis, health
frontend/                @academy/web   Next.js App Router
  src/app/<route>/page.tsx   ~35 pages, each a client component; loading.tsx skeletons
  src/app/v1/[...path]/route.ts  API reverse proxy
  src/api/client.ts      typed API client (single-flight refresh, tenant header)
  src/contexts/          auth, locale (ar/en, RTL/LTR), theme
  src/components/        layout (AppShell, Sidebar, Topbar, AuthGuard), ui kit, finance/, platform/, pwa/
  src/utils/             role-routing, offline engine/store, data-translator, validation
  src/locales/           translations
  src/lib/               legacy re-export shims (+ a duplicated translations file)
  public/sw.js           service worker (VERSION stamped per build), manifest, version.json
packages/shared/         Zod schemas & DTO types, ROLE_PERMISSIONS, ErrorCode, locales
packages/database/       prisma/schema.prisma, migrations, tenant-transaction helpers, SQL tests, seed
infrastructure/          caddy, nginx, postgres runtime-role init, backup/restore scripts
scripts/                 ops scripts (superadmin provisioning, backups, release sync, verification)
docs/                    this documentation set + ADRs, audits, QA reports
```

## 3. Backend architecture

### 3.1 Request pipeline

1. Express middleware: JSON/urlencoded (10 MB), `cookie-parser`, correlation id, security headers.
2. CORS: comma-separated `CORS_ORIGIN`, supports exact origins and `*.suffix` wildcards; credentials enabled.
3. **Guards are declared per controller** with `@UseGuards(...)` — there is **no global guard**.
   Typical tenant controller: `JwtAuthGuard, TenantGuard, PermissionsGuard, CsrfGuard`.
   - `JwtAuthGuard` — Passport JWT from `access_token` cookie or `Authorization: Bearer`; honors `@Public()`.
     `JwtStrategy.validate` reloads the user + memberships from DB on every request.
   - `TenantGuard` — tenant id from `x-tenant-id` header → `tenant_id` cookie → `?tenantId` → route param → JWT `tenantId`;
     requires an ACTIVE membership; branch-scoped roles (BRANCH_MANAGER, RECEPTIONIST, COACH) are pinned to their
     `membership.branchId`; builds `request.tenantContext` `{tenantId, branchId, actorUserId, locale, role, permissions}`.
   - `PermissionsGuard` — checks `@RequirePermissions(...)` against `ROLE_PERMISSIONS` (shared package);
     special case: COACH with `canReviewApplications` passes `player.application.review`.
   - `CsrfGuard` — for non-GET requests carrying auth cookies, requires Origin/Referer in the CORS allowlist.
   - `PlatformSuperAdminGuard` / `PlatformOwnerGuard` — re-check user flags in the DB.
4. Controller parses `body: unknown` with a shared Zod schema → calls service.
5. Errors → `GlobalExceptionFilter` (unified contract with `code`, `message`, request id).

### 3.2 Layering

- Controllers are thin (parse + delegate). Business rules live in services.
- Services access Prisma **directly** inside transaction helpers; the new `database/repositories/*`
  classes are registered in `DatabaseModule` but are an in-progress refactor (see status doc).
- Cross-module calls: services inject `AuditService`, `EmailService`, `NotificationsService`, `RedisService`.

### 3.3 Data-access & tenant isolation

`packages/database/src/tenant-transaction.ts` wraps every query in an interactive transaction
(maxWait 15 s, timeout 30 s) and sets **transaction-local** PostgreSQL settings used by RLS policies:

| Helper                         | Settings                                                      | Used for                                                    |
| ------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------- |
| `withTenantTransaction`        | `app.tenant_id`, `app.current_tenant_id`, `app.actor_user_id` | All tenant-owned data                                       |
| `withAuthLookupTransaction`    | `app.auth_context`, `app.actor_user_id`                       | Membership discovery at login/refresh/me, invitation lookup |
| `withPlatformAdminTransaction` | `app.actor_user_id` (policies check super-admin flag)         | Platform console                                            |
| `withPortalUserTransaction`    | `app.actor_user_id`                                           | Player/guardian self-service                                |

Some code paths use the raw `PrismaService` without a helper (e.g. login user lookup, refresh
tokens, registration) — these touch the non-RLS tables `users`/`refresh_tokens` or rely on
`SECURITY DEFINER` functions.

## 4. Frontend architecture

- **Routing**: App Router; `/` redirects to `/dashboard` (both `next.config.ts` and `app/page.tsx`);
  `/scanner` → `/attendance/scanner`; `/auth/accept-invite` re-exports `/accept-invite`;
  `/auth-test` is a dev-only test harness (`notFound()` in production); `/landing` is the marketing page.
- **Auth state**: `contexts/auth-context.tsx` — state machine, cross-tab sync
  (`BroadcastChannel('sportexus_auth_sync')` + storage events). Tokens live in httpOnly cookies;
  only the active tenant id is kept in `localStorage` (`academy_active_tenant_id`).
- **API client**: transport in `lib/http/` (`request.ts` — browser always calls relative `/v1`,
  adds `x-tenant-id`, 25 s GET cache + in-flight de-dup cleared by any mutation, on 401 runs a
  **single-flight** `/auth/refresh` and retries once; `api-error.ts`; `active-tenant.ts`; `auth-events.ts`).
  Endpoints live per domain in `features/<domain>/api.ts`; `api/client.ts` composes them into the
  `api` object (shape pinned by `api/client.contract.test.ts`). Config in `config/env.ts` and `config/constants.ts`.
- **Confirmations**: `components/ui/ConfirmDialog.tsx` (`ConfirmProvider` in the root layout, `useConfirm()`);
  native `confirm()` is no longer used.
- **Access control in UI**: `utils/role-routing.ts` (`getRoleHomeRoute`, `canAccessAdminRoutes`, ...).
  Page access rules live in `lib/auth/access-rules.ts` (`authenticated`, `admin`, `admin-or-coach`,
  `no-coach`, `platform-staff`); pages call `useAccessGuard(rule)` (`hooks/useAccessGuard.ts`), which
  redirects only after auth has resolved, never to the current route, and at most once per decision.
  `components/layout/AuthGuard.tsx` wraps the same hook for declarative use. There is no `middleware.ts`.
  UI checks are convenience only — the API enforces authorization.
- **Role landing**: super admin → `/dashboard`; COACH → `/coach`; OWNER/MANAGER/BRANCH_MANAGER/
  ACCOUNTANT/RECEPTIONIST → `/dashboard`; player → `/player`; guardian → `/guardian`.
- **i18n**: `contexts/locale-context.tsx` + `locales/translations.ts`; `utils/data-translator.ts`
  translates enum/data values; `dir` switches RTL/LTR.
- **PWA/offline**: `public/sw.js` caches the app shell (cache name = build VERSION);
  `utils/offline-engine.ts` + `offline-attendance-store.ts` (IndexedDB) queue attendance scans and
  evaluation drafts, synced through `POST /attendance/sessions/:id/offline-sync`. Finance and admin are online-only.

## 5. Communication contract

- Base path **`/v1`**; JSON; DTO types imported by both sides from `@academy/shared` (single contract).
- Auth: cookies `access_token` (15 min) and `refresh_token` (`REFRESH_TOKEN_EXPIRES_DAYS`, default 7);
  `secure` controlled by `COOKIE_SECURE` (mandatory in production).
- Tenant selection: `x-tenant-id` header (preferred), branch override `x-branch-id` (only for non-branch-scoped roles).
- Access tokens carry the user's session version (`sv`); `JwtStrategy` rejects a token whose version is older than
  `users.session_version` (K13b).
- **Client IP (S1)**: the web proxy (`frontend/src/lib/http/proxy-forwarding.ts`) removes client-supplied
  `x-sportexus-*` and forwarding headers, takes the client address from `X-Forwarded-For` counted from the right by
  `WEB_TRUSTED_PROXY_HOPS` (the number of reverse proxies in front of the web app), and sends it as
  `x-sportexus-client-ip` with `x-sportexus-proxy-auth: INTERNAL_PROXY_SECRET`. The API middleware
  (`backend/src/common/client-ip.ts`, registered first) accepts that header only on a constant-time secret match,
  otherwise uses Express `trust proxy` = `TRUST_PROXY_HOPS`. It deletes both headers and sets `req.clientIp`. The secret
  is server-only (never `NEXT_PUBLIC_*`), at least 32 characters, and required in production on both services.
- Error body: `{ statusCode, code (ErrorCode), message, ... }`.

### Endpoint map (controller → prefix)

| Prefix           | Guarding                                                   | Highlights                                                                                                                                        |
| ---------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/auth`          | public + CSRF; `me`, `change-password`, `profile` need JWT | register, login, refresh, logout, forgot/reset password, verify/resend email                                                                      |
| `/tenants`       | JWT (+Tenant+Permissions per route)                        | my-memberships, switch, invitations (CRUD, accept, resend), memberships revoke, coach-delegation, staff, branches, profile                        |
| `/branches`      | JWT+Tenant+Perm+CSRF                                       | list/get/create/update, deletion-impact, DELETE = archive                                                                                         |
| `/players`       | JWT+Tenant+Perm+CSRF                                       | CRUD, qr-card (get/rotate/revoke), registration-requests (+ `join-requests` aliases) review, deletion-impact, DELETE = safe archive               |
| `/enrollments`   | JWT+Tenant+Perm+CSRF                                       | list, create, `:id/transfer`                                                                                                                      |
| `/groups`        | JWT+Tenant+Perm+CSRF                                       | CRUD, coaches, members, schedules                                                                                                                 |
| `/attendance`    | JWT+Tenant+Perm+CSRF                                       | sessions (create/list/get/close/qr/checkin-qr/scan-player-qr/offline-sync/events), records, records/bulk, corrections, reports                    |
| `/evaluations`   | JWT+Tenant+Perm+CSRF                                       | templates, create, player list/profile, session list, rankings                                                                                    |
| `/finance`       | JWT+Tenant+Perm+CSRF                                       | subscription, player-plans, player-subscriptions, payments/collect, transactions/:id/reverse, sessions/:id/cashier                                | expense | close, expenses/:id/approve | reject, dashboard |
| `/portal`        | mixed                                                      | player/me, player/qr-card, guardian/me, claim (JWT); claim-token (staff); **public** player-join-requests, academies                              |
| `/notifications` | JWT+CSRF (no tenant guard)                                 | list, unread-count, :id/read, mark-all-read                                                                                                       |
| `/platform`      | JWT+PlatformSuperAdmin+CSRF (+PlatformOwner on some)       | metrics, academies, users, saas-plans, announcements, audit-logs, security-events, applications (public submit), super-admin invite/role, storage |
| `/health`        | public                                                     | liveness, `/ready` (Postgres + Redis)                                                                                                             |

## 6. Database architecture

PostgreSQL schema `public`, managed by Prisma (`packages/database/prisma/schema.prisma`, 33 models).

### 6.1 Entity groups

- **Identity (global, no RLS)**: `users`, `refresh_tokens`.
- **Tenancy**: `tenants`, `tenant_memberships` (unique tenant+user, role, status, optional branch,
  `can_review_applications`), `invitations`, `tenant_sports`, `branches` (unique tenant+code).
- **People**: `players` (optional 1:1 `user_id`, QR card code, claim token), `guardians` (N per player),
  `player_enrollments` (player ↔ branch).
- **Training**: `training_groups` (per branch), `group_coaches`, `group_members`, `training_schedules` (dayOfWeek + times).
- **Attendance**: `attendance_sessions` (branch, optional group/coach, QR secret, status),
  `attendance_records` (unique session+player, `version` for optimistic locking),
  `attendance_events` (append-only stream), `attendance_corrections` (append-only),
  `attendance_idempotency` (unique tenant+key, cached response).
- **Evaluations**: `evaluation_templates`, `player_evaluations`.
- **Academy finance**: `player_subscription_plans`, `player_subscriptions` (fee, discount, paid,
  outstanding, status), `academy_financial_transactions` (ledger: type, method, status,
  reversal/approval fields, idempotency key), `session_cashier_closings` (one per session).
- **SaaS billing (platform)**: `saas_plans` (limits: maxBranches/Players/Coaches), `tenant_subscriptions`
  (1 per tenant), `saas_invoices`.
- **Platform & comms**: `platform_announcements`, `academy_applications`, `player_registration_requests`,
  `app_notifications`, `audit_logs` (append-only).

Composite uniques `(tenant_id, id)` exist on most tenant tables to support tenant-scoped
lookups (`tenantId_id`). Monetary columns are `Float` (double precision).

### 6.2 Security features in SQL

- **RLS** is enabled on 31 of 34 tables and forced on 21 (verified on the development database, 2026-11-15); policies
  key on `current_setting('app.tenant_id')` / actor / super-admin context. RLS binds only roles without `BYPASSRLS`;
  the API currently connects as the database owner (finding S3, Phase 3A.2).
- **Append-only** triggers on `audit_logs` (blocks UPDATE/DELETE) and attendance corrections.
- **Least-privilege runtime role** (`academy_runtime_ci` in CI, e.g. `sportexus_app` in prod;
  `infrastructure/postgres/01-runtime-role.sql`): column-restricted updates on `users`;
  production env validation refuses admin DB users (`postgres`, `academy`, `root`).
- **SECURITY DEFINER** functions for token flows: `request_password_reset`, `request_password_reset_with_link`,
  `complete_password_reset_for_email`, `complete_password_reset_by_link`, `invalidate_password_reset_code_for_email`,
  `complete_password_reset` (legacy link fallback),
  `verify_user_email`, `request_email_verification`, invitation redemption / onboarding.
- SQL test suites: `packages/database/tests/*.sql` (run in CI).

## 7. Deployment topologies

| Topology        | File                                          | Components                                                 |
| --------------- | --------------------------------------------- | ---------------------------------------------------------- |
| Local dev       | `docker-compose.yml`                          | Postgres 16 + Redis 7 (apps run via `pnpm dev`)            |
| Local no-Docker | `packages/database/scripts/start-local-pg.js` | embedded-postgres                                          |
| Production VPS  | `docker-compose.prod.yml`, `deploy-vps.sh`    | postgres, redis, migrate (one-shot), api, web, caddy (TLS) |
| Self-host       | `docker-compose.selfhost.yml`                 | + nginx + cloudflared tunnel                               |
| PaaS            | `render.yaml`                                 | Render blueprint                                           |

Runbooks: `docs/operations/*`, `docs/deployment/*`.
