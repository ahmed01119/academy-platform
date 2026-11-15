# Business Logic

> Source of truth: backend services in `backend/src/modules/*` and
> `packages/shared/src/constants/roles-permissions.ts` (2026-11-14).
> Rules here describe **current behavior**. Behavior that looks unintended is listed in
> [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md) (Known issues / Open questions) — it is
> **not** silently "corrected" here.

---

## 1. Actors and authority

### 1.1 Platform level (flags on `users`)

| Actor                                             | Authority                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Platform Owner** (`isPlatformOwner`)            | Everything a Super Admin can do **plus**: archive/permanently delete academies, view deletion impact, invite Super Admins, change platform-admin roles, modify another Owner's security policy. The last active Owner cannot be suspended.                                                             |
| **Platform Super Admin** (`isPlatformSuperAdmin`) | Platform console: metrics, list academies, change academy status & SaaS subscription, support access record, users (revoke sessions, suspend, force password reset), SaaS plans, announcements, audit logs, security events, review academy applications, invite users, storage metrics & maintenance. |

`PlatformSuperAdminGuard` admits **Owner OR Super Admin**; both flags are re-read from the DB on each request.

### 1.2 Academy (tenant) roles — `TenantRole`

Permissions are a static map (`ROLE_PERMISSIONS`). Current code:

| Permission                           | OWNER | MANAGER | BRANCH_MGR | RECEPTION | COACH | ACCOUNTANT | VIEWER |
| ------------------------------------ | :---: | :-----: | :--------: | :-------: | :---: | :--------: | :----: |
| tenant.update                        |  ✅   |         |            |           |       |            |        |
| branches.manage                      |  ✅   |   ✅    |            |           |       |            |        |
| branches.read                        |  ✅   |   ✅    |     ✅     |    ✅     |  ✅   |     ✅     |   ✅   |
| staff.manage                         |  ✅   |   ✅    |            |           |       |            |        |
| staff.read                           |  ✅   |   ✅    |     ✅     |           |       |            |        |
| players.read                         |  ✅   |   ✅    |     ✅     |    ✅     |  ✅   |     ✅     |   ✅   |
| players.create / players.update      |  ✅   |   ✅    |     ✅     |    ✅     |       |            |        |
| players.delete                       |  ✅   |         |            |           |       |            |        |
| players.sensitive.read               |  ✅   |   ✅    |     ✅     |           |       |            |        |
| player.application.review            |  ✅   |   ✅    |     ✅     |           |  ✅*  |            |        |
| attendance.read                      |  ✅   |   ✅    |     ✅     |    ✅     |  ✅   |            |   ✅   |
| attendance.mark / attendance.correct |  ✅   |   ✅    |     ✅     |    ✅     |       |            |        |
| attendance.close                     |  ✅   |   ✅    |     ✅     |           |       |            |        |
| payments.read / payments.create      |  ✅   |   ✅    |     ✅     |    ✅     |       |     ✅     |        |
| payments.refund                      |  ✅   |   ✅    |            |           |       |     ✅     |        |
| session_expenses.read                |  ✅   |   ✅    |     ✅     |    ✅     |  ✅   |     ✅     |   ✅   |
| session_expenses.create              |  ✅   |   ✅    |     ✅     |           |  ✅   |     ✅     |        |
| session_expenses.approve             |  ✅   |   ✅    |     ✅     |           |       |     ✅     |        |
| reports.read                         |  ✅   |   ✅    |     ✅     |           |       |     ✅     |   ✅   |
| groups.read / sessions.read          |  ✅   |   ✅    |     ✅     |    ✅     |  ✅   |     ✅     |   ✅   |
| groups.manage / sessions.manage      |  ✅   |   ✅    |     ✅     |           |       |            |        |
| evaluations.read                     |  ✅   |   ✅    |     ✅     |           |  ✅   |            |        |
| evaluations.create                   |  ✅   |   ✅    |     ✅     |           |  ✅   |            |        |
| evaluations.manage                   |  ✅   |   ✅    |            |           |       |            |        |

\* COACH only when the membership has `canReviewApplications = true` (set by staff with `staff.manage`).
`platform.manage` exists in the enum but is assigned to no tenant role.

> ⚠️ `docs/security/ROLE_PERMISSION_MATRIX.md` disagrees with this table in 18 cells
> (e.g. it grants COACH `attendance.mark`, MANAGER `players.delete`, VIEWER `evaluations.read`).
> See DEVELOPMENT_STATUS.md → Open questions.

### 1.3 Scoping rules

- **Branch-scoped roles**: BRANCH_MANAGER, RECEPTIONIST, COACH. They **must** have `membership.branchId`
  (else 403 `BRANCH_REQUIRED`); every request is pinned to that branch and an `x-branch-id` for another branch is rejected.
  Services repeat the check ("Access restricted to your assigned branch").
- OWNER / MANAGER / ACCOUNTANT / VIEWER are academy-wide; they may narrow with `x-branch-id`.
- Membership must be `ACTIVE`; `INVITED`, `SUSPENDED`, `REVOKED` are rejected with specific codes.
- The OWNER membership cannot be revoked.

### 1.4 Player & guardian (portal users)

- Have no tenant role. A user is a **player** if a `Player.userId` points to them and a **guardian** if any `Guardian.userId` does.
- Portal shows only their own linked data and **published** evaluations; private coach notes are not exposed.
- Linking happens through (a) join-request approval (player linked to the applicant user) or
  (b) a **claim token** generated by staff (`players.update`) and redeemed by the logged-in user. A player profile already linked to another account cannot be claimed.

---

## 2. Core workflows

### 2.1 Academy registration & approval

1. `POST /auth/register` (public): validates password policy (8–128 chars, upper, lower, digit, symbol).
   Email must be unused (409 `EMAIL_ALREADY_EXISTS`). Slug = provided or slugified name; made unique by
   suffixing `-1`, `-2`… against existing tenants and PENDING/APPROVED applications.
2. Creates `User` (unverified) + `AcademyApplication(PENDING_REVIEW)` in one transaction. **No session is issued.**
   Non-football sport input is stored as FOOTBALL with a note `Sport: <value>`.
3. Notifies all non-suspended platform staff in-app; emails the applicant (Arabic); audit `ACADEMY_APPLICATION_SUBMITTED`.
4. Login while pending → 401 `ACADEMY_PENDING_APPROVAL`; rejected → `ACADEMY_REJECTED`.
5. Platform review (`PATCH|POST /platform/applications/:id/review`) with status `APPROVED | REJECTED | MORE_INFO_REQUESTED`:
   - An already-APPROVED application cannot be reviewed again.
   - **APPROVED** → creates Tenant (ACTIVE, EGP, Africa/Cairo) + branch `MAIN` ("الفرع الرئيسي") + OWNER membership
     - `TenantSubscription` (plan = `initialPlanCode` if active else STARTER, MONTHLY, renewal +1 month,
       negotiatedPrice = plan monthly price).
   - Each outcome sends an in-app notification and an email to the applicant.
   - Alternative public entry: `POST /platform/applications/public`.

### 2.2 Authentication & session

- **Login**: rate limit 5 attempts / 15 min per (IP, email) in Redis; constant-time dummy hash when user is missing;
  generic `INVALID_CREDENTIALS`; suspended users rejected; failures audited.
  Memberships are discovered only after password verification. Active tenant = requested id if valid, else first ACTIVE membership.
- **Tokens**: access JWT (`JWT_EXPIRES_IN`, default 15 m) carries `sub, email, tenantId, role, branchId, platform flags`.
  Refresh token = 40 random bytes, stored SHA-256 hashed, `familyId` for rotation.
- **Refresh**: each use revokes the old token and issues a new one in the same family. Re-use of a revoked token, or
  a lost race, **revokes the whole family** (theft detection).
- **Logout**: revokes the refresh-token family.
- **Forgot password**: 60 s cooldown per email, 3 requests / 15 min per (IP, email); 6-digit OTP (crypto RNG),
  stored hashed, 5-minute expiry, emailed (link + code). Response is always neutral; in `development` it includes `debugOtp`.
- **Reset password**: submits `{ token, newPassword }` (token = OTP or link token); on success **all refresh tokens of the user are revoked**
  and a "password changed" email is sent.
- **Email verification**: 24 h token, resend limited to 3 / 15 min.
- **Change password** (authenticated): current password required; new must differ; email notification. (Does not revoke other sessions.)
- **Tenant switch**: `POST /tenants/switch` requires an ACTIVE membership in the target tenant.

### 2.3 Staff invitation

1. Staff with `staff.manage` invites `{email, role, branchId?}`. Rejected if the email is already an ACTIVE member
   or has a non-expired PENDING invitation. Branch must belong to the tenant.
2. Token: 32 random bytes, stored hashed, **7-day** expiry; email link `/auth/accept-invite?token=…`.
3. Accept: the user must be signed in with a **verified** account whose email matches the invitation; redemption is done by a DB function.
4. Resend (not for accepted invitations), revoke (not for accepted invitations), revoke membership (not OWNER).
5. Coach delegation: toggle `canReviewApplications` — only on COACH memberships.

### 2.4 Player lifecycle

- **Create** (`players.create`): branch-scoped users can only create in their branch; branch must be ACTIVE and below
  `capacity`; recording `medicalNotes` requires `players.sensitive.read`; `nationalId` unique per academy.
  Player gets a membership number and a QR card code.
- **Read**: branch-scoped users may only open players actively enrolled in their branch. Without
  `players.sensitive.read`, `nationalId` and `medicalNotes` are returned as `null` by **every** player endpoint
  (list, detail, create and update responses), and the roster search does not match on national ID
  (`backend/src/modules/players/player-sensitive-data.ts`).
- **Initial enrollment start date**: `POST /players` accepts optional `initialEnrollmentStartDate`
  (YYYY-MM-DD, real calendar date); omitted → the enrollment starts today.
- **Update**: same branch rules as create. Without `players.sensitive.read`, any `nationalId` or `medicalNotes` in the
  body is rejected with 403 (regardless of value). Creating a player with a national ID is allowed for these roles.
- **Duplicate national ID** (unique per academy, enforced by the `unique_player_national_id_per_tenant` partial index):
  permitted roles get `409` "A player with this National ID is already registered in this academy"; other roles get a
  generic `400 VALIDATION_FAILED` that does not confirm the ID exists.
- **QR card**: get / rotate (new code, old one invalid) / revoke; revoked cards are refused at scan time.
- **Delete** (`players.delete`): `deletion-impact` previews linked records; `DELETE` performs a **safe archive**
  ("history preserved"), not a hard delete — active enrollments become CANCELLED and active group
  memberships INACTIVE; financial and attendance history is kept.

### 2.5 Player join requests

1. Public `POST /portal/player-join-requests` with academy id, player name, contact email/phone, optional DOB and guardian name → `PENDING_REVIEW`.
2. Reviewers: `player.application.review` holders; a COACH only if delegated, and only for their own branch.
3. An APPROVED request cannot be reviewed again.
4. **APPROVED** (single transaction):
   - Enforces SaaS plan `maxPlayers` (count of ACTIVE players) — the only place a plan limit is enforced.
   - Splits name into first/last; reuses an existing player matched by applicant user **or identical first+last name**, else creates one
     (defaults when unknown: gender MALE, DOB 2012-01-01, emergency contact = guardian name / phone or placeholders).
   - Creates primary Guardian (if guardian name + phone), branch Enrollment (`branchId` from review → reviewer's branch → first ACTIVE branch),
     and Group membership (if `groupId`).
   - Notifies the applicant user (if linked) and emails the contact address.
5. REJECTED / MORE_INFO_REQUESTED: status + notes, notification/email.

### 2.6 Enrollments

- One active enrollment per player: creating a second → "Use branch transfer instead".
- Only ACTIVE players can be enrolled/transferred; target branch must be ACTIVE and below capacity.
- Transfer: only ACTIVE enrollments; branch-scoped users cannot transfer players from another branch; target ≠ current branch.

### 2.7 Training groups

- Belong to one branch; capacity cannot be reduced below the current active member count.
- Coach assignment: coach must be an ACTIVE member of the academy and, if branch-bound, of the same branch; no duplicates.
- Player assignment: group ACTIVE and below capacity; player ACTIVE and actively enrolled in the group's branch; no duplicate active membership.
- Schedules: weekly (`dayOfWeek`, `startTime < endTime`, optional location).

### 2.8 Attendance

- **Session creation** (`attendance.mark`): branch ACTIVE and in scope; group (optional) ACTIVE and in the same branch. Status `SCHEDULED → IN_PROGRESS → CLOSED`.
- **Coaches cannot record attendance** — explicit product rule enforced in `validateCoachSessionAccess` (manual, bulk, QR).
- Attendance cannot be recorded for sessions more than **24 h in the future**.
- Marking requires the player to have an **ACTIVE enrollment in the session's branch**.
- **Optimistic concurrency**: records carry `version`; mismatched `expectedVersion` → `CONCURRENCY_CONFLICT`.
- **Idempotency**: mutation `idempotencyKey` unique per tenant; replays return the stored response.
- Every change appends an `AttendanceEvent` (source MANUAL / QR_CHECKIN / BULK_MARK / SYSTEM).
- **Closed sessions** reject marking, QR generation, scans and offline sync — changes go through **corrections**:
  `attendance.correct`, reason ≥ 3 chars, version-checked, stored in append-only `attendance_corrections`.
- **Session QR** (`/qr` then `/checkin-qr`): time-limited secret; expired / invalid tokens rejected.
- **Player-card scan** (`/scan-player-qr`): card must exist, not revoked, player ACTIVE and enrolled in the branch;
  duplicate check-in reported; status PRESENT or LATE using `computeLateness`:
  late if check-in (in tenant timezone) is more than `tenant.latenessGraceMinutes` (default 15) after `startTime`.
- **Offline sync**: device batches with observed times, flagged `isOfflineSync`.
- **Reports** (`reports.read`): aggregated attendance statistics.

### 2.9 Evaluations

- `overallScore` = average of technical, tactical, physical, behavioral scores (2 decimals).
- `isPublished` defaults to true; only published evaluations reach portals; `privateCoachNotes` stay internal.
- Templates (`evaluations.manage`) hold criteria JSON per sport/age category.
- Development profile and rankings aggregate evaluations per player/tenant.

### 2.10 Academy finance

- **Plans**: per branch (optional), billing period MONTHLY/QUARTERLY/ANNUAL/PER_SESSION, fee, currency (default EGP).
- **Player subscription**: net fee = max(0, fee − discount); status starts **ACTIVE if net fee = 0 else OVERDUE**.
- **Collect payment** (`payments.create`): creates a COMPLETED `MEMBERSHIP_FEE` transaction with receipt number
  (given or `REC-<year>-<4 random digits>`); applies the amount to the given subscription or the player's latest one:
  `paid += amount`, `outstanding = max(0, outstanding − amount)`, status `ACTIVE` if nothing outstanding else `PARTIAL`.
  Emails a receipt to the player's primary guardian with an email.
- **Reverse** (`payments.refund`): reason required; never deletes; sets REVERSED with who/when; a reversed transaction cannot be reversed again;
  for membership fees, restores outstanding/paid and recomputes status (`PARTIAL` / `OVERDUE` / `ACTIVE`).
- **Session expense** (`session_expenses.create`): amount > 0 (rounded to 2 dp); session branch must match; branch-scoped users only for their branch;
  roles other than OWNER/MANAGER/ACCOUNTANT must be assigned to the session (session coach or group coach);
  idempotency key + 60-second duplicate guard. Created as PENDING.
- **Approve / reject** (`session_expenses.approve`): **separation of duties** — an approver cannot approve their own expense;
  already-approved/rejected/reversed expenses are refused accordingly.
- **Cashier summary**: per session — attendees/absent/late, active/overdue subscribers, cash vs electronic collected,
  expenses, net cash movement. Non-assigned coaches cannot view it.
- **Cashier close**: upserts one `SessionCashierClosing` per session (re-closing overwrites), marked reconciled; audited.
- **Dashboard**: academy financial metrics (optional branch filter).

### 2.11 Branches & academy settings

- Branch code unique per academy; branch manager must be an ACTIVE member.
- `DELETE /branches/:id` = **archive** (status INACTIVE) with history preserved; `deletion-impact` previews counts.
- Academy profile (`tenant.update`): name, contact, currency, timezone, logo, lateness grace, etc.

### 2.12 Platform governance

- **Academy status**: ACTIVE / SUSPENDED; SUSPENDED also suspends the tenant subscription; re-activation restores it.
- **Archive/delete** (Owner only, confirmation slug must equal tenant slug): permanent delete only when the academy has
  **no players, attendance events or financial transactions**; otherwise it is suspended and all members' refresh tokens are revoked.
- **Support access**: records an audited 1-hour READ_ONLY_SUPPORT grant (an audit entry; no impersonation token is issued).
- **User security policy**: suspend / force password reset / platform flags; protections for Owners (above).
- **Storage maintenance**: dry-run, then execute purge of expired/revoked refresh tokens and old non-financial audit logs.

### 2.13 Notifications, email, audit

- Notifications are per user (optionally per tenant) with `href` deep links; read/unread; mark-all.
- Emails: application received/approved/rejected/more-info, password reset & changed, email verification,
  staff invite, platform admin invite, enrollment welcome, payment receipt, subscription alert. Retried up to 3 times. Mostly Arabic by default.
- Audit: `AuditService.logEvent` on security and business actions; table is append-only at DB level.

---

## 3. System-wide constraints

1. **Tenant isolation is defense-in-depth**: guard (membership) → service filters (`tenantId`) → PostgreSQL RLS (transaction-local settings).
   Tenant IDs used for queries must come from `TenantGuard`, never directly from the request body.
2. **Nothing financial or attendance-related is hard-deleted**: reversals, corrections, archives.
3. **Optimistic locking + idempotency** on attendance writes; idempotency on expenses.
4. **Neutral responses** on forgot-password / resend-verification (no account enumeration).
5. **Production config is fail-closed**: secure cookies, non-default JWT secret, no wildcard CORS, Redis required
   (unless explicitly allowed in-memory), non-admin DB role.
6. **UI restrictions are not security**: all authorization is enforced by the API.
