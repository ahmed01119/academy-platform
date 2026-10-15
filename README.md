# Academy Platform

Production-oriented multi-tenant Sports Academy Management SaaS monorepo.

**Stack:** Next.js · NestJS · PostgreSQL · Prisma · Redis · BullMQ (jobs later) · pnpm · Turborepo

Sprint 0 establishes the foundation only. Authentication, billing, and domain features are intentionally not implemented yet.

## Repository layout

```
apps/web          Next.js UI (Arabic RTL default, English LTR ready)
apps/api          NestJS modular monolith (/v1)
packages/shared   Zod schemas, errors, shared constants
packages/database Prisma schema + client factory
packages/*-config Shared TypeScript / ESLint
docs/             Architecture, ADRs, database design
```

## Prerequisites

- Node.js 22+ (`nvm use` / see `.nvmrc`)
- pnpm 11+ (`corepack enable` then `corepack prepare pnpm@11.13.0 --activate`)
- Docker Desktop (PostgreSQL + Redis)

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

# 4) Generate Prisma client (and optionally create first migration)
pnpm db:generate
pnpm --filter @academy/database migrate:dev --name sprint0_foundation

# 5) Run apps (API :3001, Web :3000)
pnpm dev
```

Health check: [http://localhost:3001/v1/health](http://localhost:3001/v1/health)

## Verify (CI parity)

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Architecture docs

- [Overview](docs/architecture/overview.md)
- [Multi-tenancy](docs/architecture/multi-tenancy.md)
- [Security invariants](docs/architecture/security-invariants.md)
- [Modular boundaries](docs/architecture/modular-boundaries.md)
- [Open requirements](docs/architecture/open-requirements.md)
- [Initial database design](docs/database/initial-design.md)
- [ADRs](docs/adr/)

## Security note

Sprint 0 does **not** ship authentication. Do not treat local defaults or health endpoints as a security model. Tenant isolation invariants are documented and must be enforced before any tenant-owned CRUD.
