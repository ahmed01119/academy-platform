# Architecture Overview

## Product

Multi-tenant, multi-branch, multi-sport academy management SaaS. Launch focus: football academies in Egypt, with Arabic RTL and English LTR. Future clients include Flutter mobile.

## System shape

```
┌────────────────────┐     ┌──────────────────────────────┐
│  apps/web (Next.js)│────▶│  apps/api (NestJS monolith)  │
└────────────────────┘     │  domain modules + /v1 REST   │
                           └──────────────┬───────────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
            PostgreSQL              Redis / BullMQ         Object storage
            (Prisma)                (jobs/cache)           (later)
```

## Packages

| Package | Responsibility |
|---------|----------------|
| `@academy/web` | Staff/admin UI |
| `@academy/api` | HTTP API, domain modules, jobs producers |
| `@academy/shared` | Zod schemas, error model, shared constants |
| `@academy/database` | Prisma schema, client factory |
| `@academy/typescript-config` | Shared TS configs |
| `@academy/eslint-config` | Shared ESLint configs |

## Non-goals (Sprint 0)

- Authentication / authorization implementation
- Billing / payments
- Enrollment, attendance, or player CRM features
- Flutter app

## Open product questions

See `docs/architecture/open-requirements.md`.
