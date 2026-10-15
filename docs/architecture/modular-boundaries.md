# Modular Boundaries

## NestJS module layout (target)

```
apps/api/src/
  config/                 # env + typed config only
  modules/
    health/               # liveness/readiness
    identity/             # future: users, sessions, RBAC
    tenancy/              # future: tenants, branches
    people/               # future: players, guardians (child data)
    programs/             # future: squads, schedules
    attendance/           # future
    billing/              # future: invoices, ledger
    notifications/        # future
  common/                 # cross-cutting filters, guards, interceptors
```

## Dependency rules

1. `modules/*` may depend on `config`, `common`, `@academy/shared`, `@academy/database`.
2. Domain modules must not import another domain module's internal folders.
3. Cross-domain collaboration goes through:
   - shared application services exported via the module's public API, or
   - domain events (in-process first; queue later).
4. `apps/web` talks to the API over HTTP only — no direct DB access.
5. Prisma models are not leaked as HTTP DTOs; map to Zod-validated contracts.

## Sprint 0 reality

Only `health` and `config` exist. Boundaries above are the contract for upcoming sprints.
