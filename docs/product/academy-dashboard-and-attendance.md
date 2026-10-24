# Academy operations UX and attendance blueprint

Status: product specification, not a claim that these features are implemented.
Reference: user-provided Arabic football academy dashboard collage (October 2026).

## Design direction

Arabic-first RTL, English LTR-ready, responsive for desktop, tablet, and
mobile. Football is the first sport, not a hard-coded platform limitation.
Keep the navy sidebar/top bar, high-contrast KPI cards, welcoming academy
banner, simple player list, quick attendance entry, subscription status,
payment entry, and manager reports. Do not replicate the reference verbatim.
Use accessible contrast, keyboard navigation, touch targets at least 44px,
loading/empty/error states, and explicit date/timezone/currency formatting.

## Navigation by permission

- Manager: overview, branches, groups, players, sessions, attendance,
  subscriptions, payments, coaches, reports, settings, audit history.
- Reception: player search/check-in, subscriptions and receipts, permitted
  corrections. No cross-branch access without explicit permission.
- Coach: assigned sessions and group roster, attendance, notes; no payment
  administration.
- Platform admin: isolated tenant provisioning and platform operations;
  cannot silently impersonate academy staff.

Overview cards: players, today's expected/checked-in count, unpaid/expiring
subscriptions, today's collected payments. Every KPI must define its branch,
timezone, date range, and authorization scope. No invented live figures.

## Attendance: primary workflow

1. Receptionist selects today's session or scans a short-lived signed QR
   belonging to a specific session; search player by name, member number,
   or phone (permission-limited). Coach opens assigned group/session.
2. Show roster with current state, payment eligibility separately, and
   large one-tap actions. States: UNMARKED, PRESENT, LATE, ABSENT, EXCUSED.
   Attendance never silently triggers a payment or subscription renewal.
3. Mark individual or bulk-mark all present; bulk action displays affected
   count and requires confirmation. Remaining UNMARKED are not auto-absent
   until a deliberate session close policy.
4. Offline mode is a future capability, not part of MVP: show connection
   state and disable writes rather than imply that an uncommitted action
   succeeded. Server acknowledges each mutation.
5. Corrections require role permission, reason, actor, timestamp and
   original/new status in immutable audit events. Past closed sessions
   require elevated permission and are never overwritten silently.
6. Check-in UI shows duplicate attempts as 'already recorded', with no
   extra attendance record. Wrong session, branch, sport, or unenrolled
   player fails closed with a useful Arabic error.
7. End of session: show totals and unmarked list; manager/coach confirms
   closure. Reports distinguish attendance rate from enrollment and
   show who made corrections.

## Data design (implement after Auth/Tenancy and Players)

- TrainingGroup: tenantId, branchId, sportId, coach assignment.
- GroupEnrollment: tenantId, groupId, playerId, effective date range.
- TrainingSession: tenantId, branchId, groupId, startsAt, endsAt, timezone,
  state (SCHEDULED, OPEN, CLOSED, CANCELLED).
- AttendanceRecord: tenantId, sessionId, playerId, status, recordedBy,
  recordedAt, version, optional reason. Unique (tenantId, sessionId, playerId).
- AttendanceEvent: append-only tenantId, recordId, actorId, before/after,
  reason, eventAt, requestId. No mutable audit history.
- Attendance mutation idempotency key scoped by tenant/actor/operation.
  Enforce authorization, membership, group enrollment, session status,
  and RLS inside one DB transaction. Use optimistic concurrency/version
  checks and explicit conflict responses.

Do not store raw QR tokens or personal details in audit metadata.
QR codes must be signed, short-lived, session-scoped, and verified server-side;
a QR alone must not grant authorization.

## Implementation order

1. Complete Sprint 0 CI, runtime DB role provisioning, and transaction tests.
2. Sprint 1: verified identity, tenant/branch memberships, roles and guards.
3. Sprint 2: player/group/enrollment/coach data and responsive RTL shell.
4. Sprint 3: sessions and attendance API with uniqueness, RLS, idempotency,
   correction audit trail, concurrent-write tests and real quick-check-in UI.
5. Sprint 4: subscription/payment workflows (separate ledger, no hidden
   coupling to attendance).
6. Sprint 5: scoped dashboard KPIs and exports.
7. Sprint 6: usability tests at reception, performance and accessibility,
   security tests, and limited academy pilot.

Acceptance targets: check-in needs one deliberate action after finding a
player; a receptionist can find a player in seconds on mobile; duplicate
submissions are safe; cross-tenant/branch actions are rejected; all corrections
are attributable; manager sees session totals without fabricated values.
