# Sprint 0 Hardening — Engineering Gate

Status: In progress. Scope: foundation only, no business features.

## Verified from source inspection

- Monorepo with pnpm/Turborepo, Next.js web and NestJS API.
- CI declares formatting, lint, typecheck, tests and build.
- Prisma schema defines Tenant, Branch, TenantSport and AuditLog.
- AppModule currently registers configuration and health only.
- No committed Prisma migrations directory found at initial review.
- Docker Compose exposes development Postgres and Redis ports and uses development credentials.

## Required gates before Sprint 1

### Database

- [ ] Create and commit a reproducible initial Prisma migration.
- [ ] Run migration on a fresh PostgreSQL database in CI.
- [ ] Run prisma migrate status and validate schema in CI.
- [ ] Review cascade deletion on tenant-owned records; do not allow tenant deletion to erase audit evidence.
- [ ] Define explicit DB-level tenant isolation approach, including RLS, transaction-local tenant context and cross-tenant tests before adding tenant-owned business tables.
- [ ] Ensure migration role and application role have different privileges.

### Security

- [ ] Restrict local database and Redis port bindings to loopback, or document an equivalent safe isolation approach.
- [ ] Enforce environment validation for production secrets, URLs and allowed origins.
- [ ] Define immutable/auditable event retention: application convention alone is not append-only enforcement.
- [ ] Add dependency/security scanning and secret scanning.
- [ ] Ensure no production credentials are committed.

### Quality and operations

- [ ] Confirm pnpm install --frozen-lockfile succeeds.
- [ ] Confirm lint, typecheck, test and build pass; record GitHub Actions run URLs.
- [ ] Add a smoke test for API health and readiness.
- [ ] Define production migration/rollback, backup/restore and incident procedures.
- [ ] Document Node/pnpm/Prisma version compatibility and pin reproducibly.

## Exit criteria

Do not mark this sprint complete until all checks have evidence (test output, CI URL, migration, or documentation). Do not start auth or payment modules until critical blockers are closed.

## Working agreement

All code changes go through feature branches and pull requests. Never claim runtime tests passed unless actually executed. Keep main stable.
