# Production database role boundary

The API must use a dedicated PostgreSQL **LOGIN** role without SUPERUSER,
BYPASSRLS, CREATEDB, CREATEROLE, or ownership of application tables. A
separate migration/provisioning identity applies schema migrations and creates
tenants. Never reuse the migration URL as the API's DATABASE_URL.

The API configuration rejects missing database URLs, non-PostgreSQL URLs, and
known privileged usernames in production. **This is a guardrail, not a
privilege verification:** arbitrary usernames may still have excessive grants.
Provision roles independently, audit grants, and validate effective privileges
in deployment checks.

The CI-only `academy_runtime_ci` role uses NOLOGIN and is tested with SET
ROLE. It is **not** a deployable production account. Provision a dedicated
LOGIN role with a secret from your secrets manager and grant only required
table permissions. Verify it is not the table owner and cannot SET ROLE into
an elevated identity.

For tenant-owned operations, authenticate the caller, authorize their active
membership in the requested tenant on the server, then pass that verified ID
to `withTenantTransaction`. All tenant-owned queries must use its transaction
client, not a separate global Prisma client. PostgreSQL RLS uses the
transaction-local `app.tenant_id` setting and fails closed when unset.

Do not accept an `X-Tenant-Id` header as authorization by itself. Tenant
membership and authentication are not implemented in Sprint 0, so production
tenant endpoints must not be exposed yet.
