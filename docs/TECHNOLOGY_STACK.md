# Technology Stack

> Versions below are the **resolved versions in `pnpm-lock.yaml`** (lockfile v9.0), checked
> 2026-11-14. Manifest ranges are in each `package.json`.

## 1. Languages

| Language                                                                  | Where                                                                               |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| TypeScript 5.9.3 (strict, shared configs in `packages/typescript-config`) | All apps and packages                                                               |
| SQL (PostgreSQL dialect)                                                  | Prisma migrations, RLS policies, `SECURITY DEFINER` functions, SQL tests            |
| JavaScript (Node scripts, CommonJS)                                       | `scripts/*.js`, `packages/database/scripts/*.js`, `frontend/public/sw.js`           |
| Shell / PowerShell                                                        | Deployment & local ops (`deploy-vps.sh`, `docker-entrypoint.sh`, `*-sportexus.ps1`) |

## 2. Runtime & monorepo tooling

| Tool      | Version                                                                                                                                                                                                                                            | Notes                                                                                                        |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Node.js   | **22 LTS** (`engines` `^22.0.0`, `.nvmrc` = 22; CI, Dockerfiles `node:22-alpine`, Render `NODE_VERSION=22`). Maintenance LTS until 2027-04-30; move to a newer LTS is a pending proposal. Local machine observed on v25.2.1 (non-LTS, unsupported) |                                                                                                              |
| pnpm      | 11.13.1 (`packageManager`)                                                                                                                                                                                                                         | Workspaces: `backend`, `frontend`, `packages/*`; `allowBuilds` allowlist for install scripts                 |
| Turborepo | 2.11.8                                                                                                                                                                                                                                             | `build/lint/typecheck/test` depend on `^build` (shared packages must build first)                            |
| Prettier  | ^3.5.3                                                                                                                                                                                                                                             | Root `.prettierrc.json`, enforced in CI (`format:check`)                                                     |
| ESLint    | 9.39.5 (flat config)                                                                                                                                                                                                                               | Shared presets in `packages/eslint-config` (`base`, `nest`, `next`), typescript-eslint 8, react-hooks plugin |
| Vitest    | 3.2.7                                                                                                                                                                                                                                              | Test runner in every package                                                                                 |

## 3. Workspace packages

| Package                      | Name                         | Role                                                                                      |
| ---------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------- |
| `backend/`                   | `@academy/api`               | NestJS REST API                                                                           |
| `frontend/`                  | `@academy/web`               | Next.js web app / PWA                                                                     |
| `packages/shared`            | `@academy/shared`            | Zod schemas + inferred DTO types, RBAC matrix, error codes, locales (compiled to `dist/`) |
| `packages/database`          | `@academy/database`          | Prisma schema & migrations, Prisma client factory, RLS transaction helpers                |
| `packages/eslint-config`     | `@academy/eslint-config`     | Lint presets                                                                              |
| `packages/typescript-config` | `@academy/typescript-config` | tsconfig presets (`base`, `nestjs`, `nextjs`, `library`)                                  |

## 4. Backend (`@academy/api`)

| Library                                  | Resolved       | Purpose                                                               |
| ---------------------------------------- | -------------- | --------------------------------------------------------------------- |
| @nestjs/core, /common, /platform-express | 11.2.7         | Framework (Express adapter)                                           |
| @nestjs/config                           | 4.0.4          | Config + Zod env validation (`src/config/env.validation.ts`)          |
| @nestjs/jwt                              | 12.0.3         | JWT signing                                                           |
| @nestjs/passport + passport-jwt          | 12.0.0 / 4.0.1 | JWT strategy (cookie or Bearer)                                       |
| @prisma/client                           | 6.19.3         | ORM client                                                            |
| zod                                      | 3.25.76        | Request validation (schemas from `@academy/shared`)                   |
| argon2                                   | 0.45.1         | Password hashing (Argon2id)                                           |
| ioredis                                  | 6.0.0          | Rate limiting / cache (in-memory fallback allowed outside production) |
| nodemailer                               | 10.2.1         | SMTP email; Gmail API, Resend and Brevo used via HTTP API (no SDK)    |
| cookie-parser                            | ^1.4.7         | Auth cookies                                                          |
| rxjs, reflect-metadata                   | —              | Nest requirements                                                     |

Conventions: feature modules under `src/modules/<domain>` (controller + service + module +
`*.test.ts`); constructor DI with explicit `@Inject(...)`; controllers parse `body: unknown`
with Zod schemas; global `/v1` prefix; unified error filter.

## 5. Frontend (`@academy/web`)

| Library                            | Resolved | Purpose                                                                 |
| ---------------------------------- | -------- | ----------------------------------------------------------------------- |
| next                               | 15.5.28  | App Router, all pages are client components (`'use client'`)            |
| react / react-dom                  | 19.3.1   | UI                                                                      |
| tailwindcss + @tailwindcss/postcss | 4.3.3    | Styling (v4 CSS-first, design tokens as CSS variables in `globals.css`) |
| lucide-react                       | 1.57.0   | Icons                                                                   |
| qrcode                             | 1.5.4    | Render player QR cards                                                  |
| jsqr                               | 1.4.0    | Decode QR from camera frames (scanner)                                  |
| fake-indexeddb (dev)               | ^6.2.6   | Tests for offline store                                                 |

No state-management library (React Context only), no data-fetching library (custom fetch
client), no form library, no component library (custom `components/ui`).

## 6. Database & infrastructure

| Component           | Version                                                                      | Notes                                                                          |
| ------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| PostgreSQL          | 16 (Docker images); embedded-postgres 18.4.0-beta.17 for local no-Docker dev | RLS (`FORCE ROW LEVEL SECURITY`), triggers, `SECURITY DEFINER` functions       |
| Prisma CLI          | 6.19.3                                                                       | 36 migrations in `packages/database/prisma/migrations`                         |
| Redis               | 7 (Docker)                                                                   | Rate limiting, metrics cache                                                   |
| Paymob              | Intention API v1 + unified checkout                                          | Online payments (card, wallet); HMAC-signed webhook; called with fetch, no SDK |
| Caddy 2             | `docker-compose.prod.yml`                                                    | TLS reverse proxy                                                              |
| nginx + cloudflared | `docker-compose.selfhost.yml`                                                | Self-host behind Cloudflare Tunnel                                             |
| Docker              | `Dockerfile` (API), `Dockerfile.web`, per-app Dockerfiles                    |                                                                                |

## 7. CI/CD

- `.github/workflows/ci.yml`: Postgres 16 + Redis services → install → Prisma validate /
  migrate deploy / migrate status / drift diff → SQL security tests (`packages/database/tests/*.sql`)
  → `format:check` → `lint` → `typecheck` → `test` → `build` → compose config check.
- `deploy.yml`, `release.yml`: deployment and release-branch synchronization
  (`scripts/sync-release-branches.js`).
- `render.yaml`: Render.com blueprint (staging option).

## 8. Common commands

```bash
pnpm install
docker compose up -d                 # Postgres 16 + Redis 7 on localhost
pnpm db:generate && pnpm db:migrate:deploy
pnpm dev                             # API :3001 (/v1), Web :3000
pnpm lint | pnpm typecheck | pnpm test | pnpm build
pnpm --filter @academy/database seed:demo
```
