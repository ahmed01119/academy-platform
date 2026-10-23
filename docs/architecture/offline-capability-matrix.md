# Offline Capability Matrix

Local data is tenant-scoped, never includes JWTs or payment credentials, and is purged on logout.

| Workflow | Offline | Notes |
|----------|---------|-------|
| App shell / install PWA | Yes | Cached static assets + `/offline` fallback only |
| Login / register / MFA | No | Requires live auth |
| Tenant switch | No | Membership verified server-side |
| QR attendance scan | Yes | IndexedDB queue + `operationId` idempotency |
| Attendance sync | When online | Batch endpoint; failed items stay queued |
| Evaluation **draft** | Yes | Local only until coach submits |
| Evaluation **publish** | No | Server confirmation required |
| Finance, invoices, expenses | No | Explicit online-only |
| Player medical / PII export | No | Never cached in SW |
| Super Admin | No | Platform-wide data must not sit in shared caches |

## Sync guarantees

- Mutations carry idempotency keys (`operationId` / draft id).
- Sync is driven by `online` events, visibility, and a timer — **not** Background Sync alone.
- Conflict policy for attendance: server roster + idempotent check-in wins; duplicate `operationId` is treated as already applied.
- Evaluation drafts never overwrite a published server evaluation automatically.

## What we do not promise

- Instant updates on every open tab or offline device.
- Unlimited IndexedDB (browsers can evict storage).
- Offline finance accuracy.
