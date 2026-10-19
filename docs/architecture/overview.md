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

| Package                      | Responsibility                             |
| ---------------------------- | ------------------------------------------ |
| `@academy/web`               | Staff/admin UI                             |
| `@academy/api`               | HTTP API, domain modules, jobs producers   |
| `@academy/shared`            | Zod schemas, error model, shared constants |
| `@academy/database`          | Prisma schema, client factory              |
| `@academy/typescript-config` | Shared TS configs                          |
| `@academy/eslint-config`     | Shared ESLint configs                      |

## Shipped in Sprint 1

- Full Authentication (Argon2id hashing, secure JWT access + rotating refresh tokens with reuse family revocation, email verification, password reset)
- Multi-Tenancy & Tenant Switching (actor-scoped membership discovery, cookie/header persistence, revoked context auto-drop)
- Scoped Onboarding & Anti-Impersonation Boundaries (`provision_tenant_onboarding`, column-level runtime privilege enforcement)
- Secure Staff Invitations (`inviteStaff`, `acceptInvitation`, single-use verification)
- Attendance Session Foundation (sessions, records, idempotent recording, append-only corrections)
- Security Hardening (FORCE RLS on all tenant tables, append-only audit protection, production fail-closed Redis rate limiting)
- Interactive Verification UI (`/auth-test` page in Arabic RTL with live flow runner)

## Non-goals (Sprint 2 & Future Roadmap)

- Billing / subscriptions / Stripe & Paymob integration (Sprint 2)
- Comprehensive player CRM and advanced enrollment management (Sprint 2+)
- Mobile client (Flutter app)
- Parent/player public portal
