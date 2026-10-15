# Multi-Tenancy Design

## Definitions

- **Tenant:** Paying organization (academy) — root isolation boundary.
- **Branch:** Operational unit under a tenant (usually a location).
- **Actor:** Authenticated user principal acting within a tenant (and optionally a branch).

## Isolation strategy

1. Shared PostgreSQL database.
2. Every tenant-owned row carries `tenant_id` (UUID).
3. Branch-owned rows carry both `tenant_id` and `branch_id`.
4. Request context must include `tenantId` and `actorUserId` (see `@academy/shared` `TenantContextSchema`).
5. Cross-tenant access is forbidden except for explicitly audited platform-admin operations.

## Invariants (must never be violated)

See `security-invariants.md` for the normative list. Summary:

- No tenant-owned query without tenant predicate.
- No trust of client-supplied `tenantId` without server-side membership verification (once auth exists).
- Soft-deleted or archived data remains tenant-scoped.
- Background jobs carry tenant context explicitly; never infer from ambient globals.

## Branch rules

- Branch IDs are unique globally (UUID) but always validated as belonging to the active tenant.
- Listing endpoints default to the actor's allowed branches; "all branches" requires explicit permission.

## Future escape hatches

If residency or hard isolation mandates appear, evaluate:

1. Schema-per-tenant in the same cluster.
2. Database-per-tenant for regulated customers only.

These are **not** Sprint 0 work.
