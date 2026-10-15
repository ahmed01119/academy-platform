# ADR-002: Shared-Database Multi-Tenancy with Row-Level Isolation

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Architecture, Security

## Context

The platform must isolate academy organizations (tenants) and support multi-branch operations. Schema-per-tenant and database-per-tenant improve hard isolation but raise migration, connection, and ops cost early.

## Decision

Use a **shared PostgreSQL database** with:

- Mandatory `tenant_id` on all tenant-owned tables.
- Application-enforced tenant context on every request.
- Branch scoping via `branch_id` where data is branch-local.
- Defense in depth: Prisma middleware / query helpers that reject queries missing tenant predicates (to be implemented with auth).

Platform-level tables (e.g. global feature flags) may omit `tenant_id` and must be explicitly documented.

## Consequences

### Positive

- Single migration stream and simpler backups for launch.
- Efficient cross-tenant platform operations (with strict RBAC).

### Negative / Risks

- A missing `WHERE tenant_id = ?` is a critical security bug.
- Noisy-neighbor resource contention is possible.

### Follow-ups

- Implement tenant-scoped Prisma extension before any business CRUD.
- Evaluate schema-per-tenant only if compliance/data residency requires it.

## Alternatives Considered

| Option              | Why not chosen                                       |
| ------------------- | ---------------------------------------------------- |
| Database-per-tenant | High ops cost at early stage                         |
| Schema-per-tenant   | Migration complexity; revisit for residency mandates |
