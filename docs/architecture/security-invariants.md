# Security & Multi-Tenancy Invariants

Normative rules for all future modules. Violations are release blockers.

## Tenancy

1. **INV-T1:** Every tenant-owned persistent entity includes `tenant_id`.
2. **INV-T2:** Application services accept an explicit `TenantContext`; they do not read tenant from mutable globals.
3. **INV-T3:** Client-provided tenant identifiers are never authoritative; membership is verified server-side.
4. **INV-T4:** `branch_id`, when present, must belong to the same `tenant_id`.
5. **INV-T5:** Jobs, cron, and webhooks rehydrate tenant context before touching tenant data.

## Authentication & authorization (future modules)

6. **INV-A1:** Unauthenticated routes are explicitly allowlisted (health, public marketing).
7. **INV-A2:** Authorization checks use server-side roles/permissions, not UI hiding.
8. **INV-A3:** No "mock auth" or hard-coded admin bypass in production builds.
9. **INV-A4:** Privilege elevation is audited.

## Children's data & privacy

10. **INV-P1:** Minors' PII is minimized; access is need-to-know and logged.
11. **INV-P2:** Exports and bulk downloads of child data require elevated permission and audit events.
12. **INV-P3:** Secrets, credentials, and payment PAN/CVV are never written to `audit_logs` or application logs.
13. **INV-P4:** Soft delete does not remove audit evidence required for compliance.

## Financial integrity (future modules)

14. **INV-F1:** Money is stored as integer minor units + currency code; no floating point balances.
15. **INV-F2:** Ledger entries are append-only; corrections are compensating entries.
16. **INV-F3:** Financial mutations are transactional and idempotent under retries.

## Platform hygiene

17. **INV-H1:** Secrets only via environment / secret manager; never committed.
18. **INV-H2:** Dependencies are pinned via lockfile; CI uses `--frozen-lockfile`.
19. **INV-H3:** Error responses use stable `ErrorCode` values without leaking internals.
