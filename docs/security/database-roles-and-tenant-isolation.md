# Database roles and tenant isolation — security design

## Privilege separation (required before production)
The CI database owner `academy` is a development/migration identity. It must **not** be reused as the runtime application identity in production.

- **Migration role:** owns schema, executes reviewed migrations, never used by API requests.
- **Runtime role:** LOGIN with only CONNECT, USAGE on required schema, and narrowly scoped table/sequence privileges; no CREATE, ALTER, DROP, BYPASSRLS, superuser, or table ownership.
- **Read-only reporting role:** optional; only approved views, not blanket access to private tables.
- Provision roles using an infrastructure secret manager; do not commit credentials. Use separate `MIGRATION_DATABASE_URL` and `DATABASE_URL` (runtime) when wiring deployment.
- Revoke default privileges and grant access to new tables explicitly; test privilege boundaries in a disposable PostgreSQL instance.
- Prisma migrations must run with the migration role, not the API runtime role.

## Tenant isolation implementation contract
The existing schema provides tenant IDs and relationships, **not enforced row isolation**. Do not claim tenant isolation is complete.

Before exposing tenant-owned APIs:
1. Authenticate principal and verify active membership to a tenant on the server. Never accept a raw client-supplied tenant ID as authority.
2. Add tenant-scoped query repository/service methods and ensure every write and read includes the authorized tenant ID.
3. Implement PostgreSQL RLS on tenant-owned tables, including branches, tenant_sports and tenant-bound audit logs, with an explicit policy for platform-level audit events (null tenant ID).
4. Use a transaction-local setting such as `set_config('app.tenant_id', <verified UUID>, true)` inside a transaction. Apply `current_setting('app.tenant_id', true)` only in policies with safe null handling. Avoid session-global context in connection pools.
5. Force RLS where appropriate; test using the **unprivileged runtime role**, not table owner or superuser. A tenant-aware application DB role must not have BYPASSRLS.
6. For each tenant-owned table test SELECT/INSERT/UPDATE/DELETE from tenant A against tenant B data; include background jobs and tenant switching.
7. Audit logs: runtime should have INSERT and strictly limited SELECT, no UPDATE or DELETE; append-only trigger is defense in depth, not a substitute for privileges.
8. Test missing tenant context fails closed. Define explicit audited administrative access separately, with elevated capabilities and tightly controlled execution.

## Acceptance tests
- [ ] Migration identity can migrate; runtime identity cannot perform DDL.
- [ ] Runtime identity cannot UPDATE or DELETE audit logs.
- [ ] Tenant A cannot read or mutate tenant B records, including via direct SQL with runtime role.
- [ ] No tenant context results in no tenant data.
- [ ] Transaction context is reset between pooled requests.
- [ ] Tenant IDs on foreign-key relationships cannot be mismatched across tenants.
- [ ] All tests run in CI against real PostgreSQL, not mocks.

## Caution
Implement RLS and its policies in a reviewed migration only after role provisioning and tenant-context wiring are ready. Enabling RLS prematurely can break the existing app or provide false assurance if tests use the owner role.
