# Initial Database Design Proposal

## Goals

- Establish tenancy, branching, sport enablement, and audit primitives.
- Keep financial and identity schemas out until requirements are closed.
- Prefer UUID primary keys, timestamptz, and explicit status enums.

## Entities (Sprint 0 schema)

### `tenants`

| Column                  | Type        | Notes                                 |
| ----------------------- | ----------- | ------------------------------------- |
| id                      | uuid PK     |                                       |
| slug                    | text unique | Lowercase; app-enforced               |
| name                    | text        | Display name                          |
| status                  | enum        | `PROVISIONING`, `ACTIVE`, `SUSPENDED` |
| currency                | char(3)     | Default `EGP`                         |
| timezone                | text        | Default `Africa/Cairo`                |
| created_at / updated_at | timestamptz |                                       |

### `branches`

| Column                  | Type        | Notes                 |
| ----------------------- | ----------- | --------------------- |
| id                      | uuid PK     |                       |
| tenant_id               | uuid FK     | Cascade delete        |
| code                    | text        | Unique per tenant     |
| name                    | text        |                       |
| status                  | enum        | `ACTIVE`, `INACTIVE`  |
| city                    | text?       | Non-PII location hint |
| country                 | char(2)     | Default `EG`          |
| created_at / updated_at | timestamptz |                       |

### `tenant_sports`

Maps enabled sports per tenant. Launch sport: `FOOTBALL`.

### `audit_logs`

Append-only operational audit. Nullable `tenant_id` allows platform-level events. **Never** store secrets or payment credentials in `metadata`.

## Planned (not in Sprint 0 schema)

- Identity: users, memberships, roles, sessions, MFA
- People: players (minors), guardians, consent records
- Programs: seasons, squads, enrollments
- Attendance & performance events
- Billing: accounts, invoices, ledger entries, payment attempts
- Notifications outbox

## Indexing principles

- Always index `tenant_id` on tenant-owned tables.
- Composite unique keys include `tenant_id` where business uniqueness is tenant-scoped.
- Audit queries indexed by `(tenant_id, created_at)` and `(resource_type, resource_id)`.

## Migration policy

- Prisma Migrate is the only schema change path.
- Destructive changes require an ADR and expand/contract rollout notes.
- No silent data backfills in the same migration as breaking renames.

## Verification (after Docker is up)

```bash
pnpm db:generate
cp packages/database/.env.example packages/database/.env
pnpm db:migrate:dev -- --name sprint0_foundation
```
