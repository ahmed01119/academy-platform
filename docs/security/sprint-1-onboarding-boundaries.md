# Sprint 1 — secure onboarding boundaries (design gate)

Status: **NOT IMPLEMENTED**. Registration and invitation acceptance must not be considered production-ready until these gates pass under the actual restricted PostgreSQL runtime role.

## Observed blockers

1. `AuthService.register()` currently inserts into `tenants` using the ordinary Prisma transaction. The runtime role is deliberately denied `INSERT` on `tenants`. A mocked unit test cannot establish that this flow works with the real database.
2. `TenancyService.acceptInvitation()` looks up a token in `invitations` without a tenant context. The hardened RLS policy only allows invitation SELECT/UPDATE inside a tenant context. Setting `app.auth_context=invitation_lookup` does not grant access and must **never** be treated as an authorization boundary.
3. User-controlled PostgreSQL session settings (`app.tenant_id`, `app.actor_user_id`, `app.auth_context`) are not trusted identities if arbitrary SQL reaches the connection. RLS tests must cover role permissions and cross-tenant access, not only GUC values.

## Registration: required implementation

- Provision new tenants through a separate, narrowly authorized server-side provisioning boundary, **not** by granting `INSERT tenants` or `BYPASSRLS` to the regular API runtime role.
- Validate authenticated/verified identity as required by the product, normalized email and slug; enforce uniqueness using database constraints, not a preflight loop alone.
- Create user, tenant, initial branch, sport and OWNER membership atomically, with rollback on any failure. The provisioning credential/function must be inaccessible to ordinary tenant operations.
- Keep provisioning audit events within the same durable transaction or use a transactional outbox. Never report registration success before durable writes complete.
- Rate-limit registration and handle slug collisions without leaking other tenants' details.

## Invitations: required implementation

- Resolve a high-entropy, single-use, expiry-checked invitation token using a narrowly scoped server-side capability. Do not introduce an unrestricted `invitations` SELECT policy or a magic GUC bypass.
- Bind acceptance to the intended email identity. Existing accounts must authenticate; new accounts must complete email ownership verification before receiving active access.
- Consume invitation and create membership in one transaction with row locking or conditional update so concurrent attempts cannot both succeed. Recheck status/expiry in that transaction.
- Enforce tenant and branch composite foreign keys and role constraints. Invitation tokens must be hashed at rest, redacted from logs and rate-limited at redemption.
- Record acceptance audit durably, without exposing cross-tenant metadata in errors.

## CI acceptance tests (real PostgreSQL roles, not mocks)

1. Ordinary runtime role cannot create a tenant, bypass invitation RLS, or impersonate a different tenant through discovery flags.
2. Dedicated provisioning boundary creates exactly one tenant, initial branch, sport and OWNER membership; failed steps roll back all records.
3. Registration handles duplicate emails and concurrent duplicate slugs without partial tenants.
4. Unauthenticated invitation lookup reveals no arbitrary invitations; valid token only resolves the intended invitation through the scoped capability.
5. Existing-account acceptance requires matching authenticated email; unverified new-account claims cannot gain active tenant access.
6. Expired, reused, revoked and concurrently redeemed tokens fail; acceptance cannot attach a membership to a foreign branch.
7. All flows pass using the deployed least-privilege credentials and FORCE RLS, with no superuser connection in application request handling.

Until these tests pass, keep PR #2 in draft and do not deploy registration or invitation acceptance to production.
