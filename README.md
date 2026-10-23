# Academy Platform

Production-oriented multi-tenant Sports Academy Management SaaS monorepo.

**Stack:** Next.js · NestJS · PostgreSQL · Prisma · Redis · BullMQ (jobs later) · pnpm · Turborepo

Sprint 1 establishes the production-hardened multi-tenant foundation, authentication, role-based access control (RBAC), scoped tenant provisioning, secure staff invitation redemption, and attendance session tracking.

## Repository layout

```
apps/web          Next.js UI (Arabic RTL default, English LTR ready, /auth-test suite)
apps/api          NestJS modular monolith (/v1) with Argon2id, JWT rotation, Redis rate-limiting
packages/shared   Zod schemas, errors, shared constants, RBAC matrix
packages/database Prisma schema, migrations, PostgreSQL runtime role privilege tests
packages/*-config Shared TypeScript / ESLint
docs/             Architecture, ADRs, database design, security boundaries
```

## Prerequisites

- Node.js 22+ (`nvm use` / see `.nvmrc`)
- pnpm 11+ (`corepack enable` then `corepack prepare pnpm@11.13.0 --activate`)
- Docker Desktop or local PostgreSQL 16+ & Redis 7+

## Quick start

```bash
# 1) Install dependencies
pnpm install

# 2) Start infrastructure
docker compose up -d

# 3) Configure local env files
cp .env.example .env
cp packages/database/.env.example packages/database/.env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 4) Deploy migrations and generate Prisma client
pnpm db:generate
pnpm db:migrate:deploy

# 5) Run apps (API :3001, Web :3000)
pnpm dev
```

- API Health Check: [http://localhost:3001/v1/health](http://localhost:3001/v1/health)
- Interactive Auth Test Suite: [http://localhost:3000/auth-test](http://localhost:3000/auth-test)

## Production (self-hosted, no mandatory cloud fee)

See [self-hosting runbook](docs/operations/self-hosting.md), [offline matrix](docs/architecture/offline-capability-matrix.md), and [ADR-004](docs/adr/ADR-004-zero-subscription-self-host.md).

```bash
cp .env.production.example .env.production
docker compose -f docker-compose.prod.yml --env-file .env.production config
# After secrets are set on the host:
# docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

This repository does **not** purchase domains, enable paid plans, or deploy to a public URL without owner approval.

## Verify (CI parity)

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Security & Architecture docs

- [Overview](docs/architecture/overview.md)
- [Multi-tenancy](docs/architecture/multi-tenancy.md)
- [Security invariants](docs/architecture/security-invariants.md)
- [Sprint 1 Onboarding & Privilege Boundaries](docs/security/sprint-1-onboarding-boundaries.md)
- [Modular boundaries](docs/architecture/modular-boundaries.md)
- [Initial database design](docs/database/initial-design.md)
- [ADRs](docs/adr/)

## Sprint 1 Security Foundation

Sprint 1 enforces strict defense-in-depth security invariants:

1. **Least-Privilege PostgreSQL Runtime Role**: `academy_runtime_ci` is denied table-level `INSERT` on `tenants` and restricted to column-level `UPDATE` on `public.users` (excluding `onboarding_token` and `redemption_challenge`) to prevent runtime SQL privilege escalation.
2. **Cryptographic Identity Challenges**: Tenant onboarding and invitation redemption require single-use cryptographic token challenges evaluated inside `SECURITY DEFINER` procedures with `search_path = public, pg_temp`.
3. **Actor-Scoped Multi-Tenancy**: Discovery of memberships is bound to authenticated actor identity; cross-tenant operations are blocked by PostgreSQL Row-Level Security (FORCE RLS).
4. **Append-Only Auditing**: Tampering or deletion of `audit_logs` and `attendance_corrections` is prevented at the database trigger and role privilege levels.
5. **Fail-Closed Rate Limiting**: In production (`NODE_ENV === 'production'`), authentication rate limiting fails closed if Redis is unavailable.
