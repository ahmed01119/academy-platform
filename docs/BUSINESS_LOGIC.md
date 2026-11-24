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

Permissions are a static map (`ROLE_PERMISSIONS`) that equals `docs/security/ROLE_PERMISSION_MATRIX.md` (owner decision
2026-11-16; a test fails on any difference). The table below is the pre-2026-11-16 code version, kept for history; the
matrix document is authoritative. Narrower rules: a COACH marks attendance and claims expenses only for sessions they are
assigned to; `session_cashier.close` (owner, manager, branch manager, accountant) closes a cashier once (K8).

Pre-2026-11-16 code:

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

> Superseded on 2026-11-16: `docs/security/ROLE_PERMISSION_MATRIX.md` is now the code. It differed from this table in 18 cells
> (e.g. it grants COACH `attendance.mark`, MANAGER `players.delete`, VIEWER `evaluations.read`).
> See DEVELOPMENT_STATUS.md → Open questions.

### 1.3 Scoping rules

- **Branch-scoped roles**: BRANCH_MANAGER, RECEPTIONIST, COACH. They **must** have `membership.branchId`
  (else 403 `BRANCH_REQUIRED`); every request is pinned to that branch and an `x-branch-id` for another branch is rejected.
  Services repeat the check ("Access restricted to your assigned branch").
- OWNER / MANAGER / ACCOUNTANT / VIEWER are academy-wide; they may narrow with `x-branch-id`.
- Membership must be `ACTIVE`; `INVITED`, `SUSPENDED`, `REVOKED` are rejected with specific codes.
- **Suspended academy** (K3): every request of its members is refused (`ACADEMY_SUSPENDED`), its memberships are left out
  at login, and its players' and children's records are hidden from the portals, until the platform reactivates it.
- **Currency** (K4): every amount of an academy is recorded and shown in the academy's own currency (`tenants.currency`).
- **Forced password change**: while a platform administrator requires it (`must_reset_password`), the user can only open
  the account page and change the password; the flag clears itself when the password changes.
- **Account links**: only the account holder (claim code) or a join-request reviewer of the academy (approved request)
  can link an account to a player or guardian record; other staff cannot.
- The OWNER membership cannot be revoked.

### 1.4 Player & guardian (portal users)

- Have no tenant role. A user is a **player** if a `Player.userId` points to them and a **guardian** if any `Guardian.userId` does.
- Portal shows only their own linked data and **published** evaluations; private coach notes are not exposed.
- Linking happens through (a) join-request approval (K6: a PLAYER request links `Player.userId`, a GUARDIAN request
  creates the child's `Guardian` record with `userId`) or
  (b) a **claim token** generated by staff (`players.update`) and redeemed by the logged-in user. A player **or guardian** profile already linked to another account cannot be claimed
  (guardians protected since Phase 3A.2). Codes are `ACAD-` + 10 Crockford base-32 characters, valid 7 days, single use,
  stored only as a SHA-256 hash, case-insensitive; the academy must be ACTIVE; at most 10 attempts per account per hour.

---

## 2. Core workflows

### 2.1 Academy registration & approval

1. `POST /auth/register` (public): validates password policy (8–128 chars, upper, lower, digit, symbol).
   Email must be unused (409 `EMAIL_ALREADY_EXISTS`). Slug = provided or slugified name; made unique by
   suffixing `-1`, `-2`… against existing tenants and PENDING_REVIEW / MORE_INFO_REQUESTED / APPROVED applications (B3).
2. Creates `User` (unverified) + `AcademyApplication(PENDING_REVIEW)` in one transaction. **No session is issued.**
   The chosen sport is kept on the application and becomes the academy's main sport on approval (`tenant_sports`,
   written after `platform_approve_academy_application`). The owner edits the academy's sports in settings (first = main
   sport); new groups, plans and players default to the main sport, a session takes its group's sport. An academy with no
   recorded sport is a football academy.
3. Notifies all non-suspended platform staff in-app; emails the applicant (Arabic); audit `ACADEMY_APPLICATION_SUBMITTED`.
4. Login while pending → 401 `ACADEMY_PENDING_APPROVAL`; rejected → `ACADEMY_REJECTED`.
5. Platform review (`PATCH|POST /platform/applications/:id/review`) with status `APPROVED | REJECTED | MORE_INFO_REQUESTED`:
   - An already-APPROVED application cannot be reviewed again; a **REJECTED application cannot be approved** (B7).
   - **APPROVED** → creates Tenant (ACTIVE, EGP, Africa/Cairo) + branch `MAIN` ("الفرع الرئيسي") + OWNER membership
     - `TenantSubscription` (plan = `initialPlanCode` if active else STARTER, MONTHLY, renewal +1 month,
       negotiatedPrice = plan monthly price).
   - Each outcome sends an in-app notification and an email to the applicant.
   - The former anonymous entry `POST /platform/applications/public` was **retired** (S5, 2026-11-15): it filed applications under existing accounts by email, which let anyone block a portal user's sign-in. Registration happens only through `/auth/register`.

### 2.2 Authentication & session

- **Client IP** (used by every IP-based limit and audit entry): attested by the web proxy (S1, see
  SYSTEM_ARCHITECTURE §5); client-supplied `X-Forwarded-For` is never trusted on its own. IPv6 limits apply per /64.
- **Login**: rate limit 5 attempts / 15 min per (IP, email) in Redis; constant-time dummy hash when user is missing;
  generic `INVALID_CREDENTIALS`; suspended users rejected; failures audited.
  Memberships are discovered only after password verification. Active tenant = requested id if valid, else first ACTIVE membership.
- **Tokens**: access JWT (`JWT_EXPIRES_IN`, default 15 m) carries `sub, email, tenantId, role, branchId, platform flags`.
  Refresh token = 40 random bytes, stored SHA-256 hashed, `familyId` for rotation.
- **Session version** (K13b): `users.session_version` is stamped into each access token (`sv`) and refresh token.
  Password reset, password change, platform "revoke sessions" and user suspension increment it, so every access
  token and refresh token issued before is refused at once (access tokens no longer live out their 15 minutes).
- **Refresh**: each use revokes the old token and issues a new one in the same family. Re-use of a revoked token, or
  a lost race, **revokes the whole family** (theft detection). A refresh token whose session version is stale is
  refused as "session ended", not treated as theft. Rotation locks the user row (`FOR SHARE`), so it can never race a
  password change into a token for the new version.
- **Logout**: revokes the refresh-token family.
- **Forgot password** (K1): limits 10 / hour per IP; per email a 60 s cooldown (5 min after 3 requests in an hour);
  3 / 15 min per (IP, email). The limits apply whether or not the address is registered. Each request issues a
  6-digit code and a 256-bit link token (crypto RNG), both stored only as SHA-256 hashes, valid 5 minutes, single use.
  The email carries the code and a link with the token in the URL fragment (never sent to servers or logs). A new
  request replaces the previous code and link. Response is always neutral; in `development` it includes `debugOtp`.
- **Reset password** (K1): `{ token, newPassword, email? }`. A 6-digit code is accepted only **with its email**; the
  link token alone is enough. 5 wrong codes cancel the code; 10 failed codes per account in 24 h suspend code entry
  (the emailed link still works, so guessing cannot lock the owner out). 30 attempts / 15 min per IP. Every failure
  returns the same "invalid or expired" error. Token consumption, the password update and the session-version bump
  happen in one database statement; then all refresh tokens are revoked and a "password changed" email is sent.
- **Email verification**: 24 h token, resend limited to 3 / 15 min.
- **Platform privileges** (Phase 3A.2, enforced in the database too): only a platform owner grants or removes platform
  admin/owner status or invites platform admins; another owner's security policy or sessions need an owner; the last
  active owner can never be demoted or suspended; a demotion or suspension ends the user's sessions. A suspended
  platform admin has no platform-admin data access.
- **Change password** (authenticated): current password required; new must differ; email notification. Ends every
  other session (K13): session version bumped, refresh tokens revoked; the caller receives fresh cookies.
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

### 2.4b The three kinds of applicant (K6, owner decision 2026-11-16)

| Applicant              | Request                                     | Reviewed by | Pending until | After approval                                              |
| ---------------------- | ------------------------------------------- | ----------- | ------------- | ----------------------------------------------------------- |
| COACH / academy owner  | academy application (`POST /auth/register`) | platform    | approved      | OWNER membership of the new academy                         |
| PLAYER (for themself)  | join request, `requesterType: PLAYER`       | academy     | approved      | account linked to the player record → `/player`             |
| GUARDIAN (for a child) | join request, `requesterType: GUARDIAN`     | academy     | approved      | account linked to the child's guardian record → `/guardian` |

- Every applicant has an account. Not signed in: the form asks for a password and the account is created together with
  the request (one transaction). Signed in: the request is linked to the current account. An e-mail that already has
  an account must sign in first (409), so nobody can attach requests to someone else's account.
- **Login gating** (`AuthService.assertApplicantMayLogIn`): an account with nothing else (no platform role, no active
  membership, no player/guardian link) cannot sign in while its latest application or join request is pending
  (`ACADEMY_PENDING_APPROVAL`, `PLAYER_PENDING_APPROVAL`, `GUARDIAN_PENDING_APPROVAL`), needs more information
  (`JOIN_MORE_INFO_REQUESTED`) or was rejected (`ACADEMY_REJECTED`, `PLAYER_REJECTED`, `GUARDIAN_REJECTED`). These codes are
  returned only after the password is verified; the login page shows a message per code.
- A player or guardian who already uses the portal **keeps signing in** while a new request (another child, another
  academy) is pending; the portal lists their requests and statuses (`GET /portal/my-join-requests`).
- An account holds at most one player profile (unique `players.user_id`): a PLAYER request from an account that has one is
  refused (`PLAYER_PROFILE_EXISTS`); the same account may still apply as GUARDIAN for a child.
- The same account cannot have two pending requests for the same player name at the same academy.
- New applicant accounts from the public form: at most 10 per IP and hour.

### 2.5 Player join requests

1. `POST /portal/player-join-requests` (anonymous or signed in, see 2.4b) with academy id, requester type, player name,
   contact email/phone, optional DOB and guardian name (required for GUARDIAN) → `PENDING_REVIEW`.
   The academy must be **ACTIVE** (B1; otherwise 404); at most **5 pending requests per academy and contact e-mail** (B2);
   OWNER, MANAGER and BRANCH_MANAGER members are notified. The requester type cannot be changed after submission.
2. Reviewers: `player.application.review` holders; a COACH only if delegated, and only for their own branch.
3. An APPROVED request cannot be reviewed again.
4. **APPROVED** (single transaction):
   - Enforces SaaS plan `maxPlayers` (count of ACTIVE players) — the only place a plan limit is enforced.
   - Splits name into first/last. Reuses an existing player only when it is certainly the same person: the applicant's
     own player profile (PLAYER), or a child of the same name this guardian is already linked to (GUARDIAN). Requests
     without an applicant (made before K6) keep the old **identical first+last name** match (K9, open). Otherwise creates one
     (defaults when unknown: gender MALE, DOB 2012-01-01, emergency contact = guardian name / phone or placeholders).
   - PLAYER request: the new player record gets `userId` = applicant. GUARDIAN request: a guardian record with `userId` =
     applicant (primary when the child has none). Otherwise a contact-only primary Guardian (if guardian name + phone).
   - Creates the branch Enrollment (`branchId` from review → reviewer's branch → first ACTIVE branch),
     and Group membership (if `groupId`).
   - After the commit: notifies the applicant (link `/player` or `/guardian`) and e-mails the contact address.
5. REJECTED / MORE_INFO_REQUESTED: status + notes, notification and e-mail (a pending applicant cannot sign in, so the
   e-mail is how they learn the outcome). User-supplied values in e-mails are HTML-escaped.

- **Confirmed e-mail for new accounts (2026-11-22)**: an academy application or a join request that creates an
  account is accepted only after the applicant confirms the sign-in e-mail with a 6-digit code (10 minutes, 5
  attempts). The account is stored as e-mail-verified. The optional guardian e-mail of a player request is not
  confirmed by code (its owner is not filling the form) but must be on a domain that receives mail.
- **Answering "more details" (2026-11-24)**: when the platform asks an academy applicant for more details, the e-mail
  has a button to a reply page (signed link, valid 14 days, only for that request, usable once). The applicant writes
  an answer and may correct governorate and phone; the application returns to PENDING_REVIEW, every platform admin is
  notified, and the answer is shown in the platform console's review window. A newer request replaces the old link.
- **Linking a guardian to a player (2026-11-24)**, three ways:
  1. the guardian registers the child (GUARDIAN join request): linked on approval (unchanged);
  2. the child has a player account: the guardian (signed in) types the child's sign-in e-mail and their own phone. The
     link needs the academy's record (the phone's last 10 digits must match a guardian the academy registered for that
     player, not yet linked) AND the child's consent (approve / decline from an e-mail to the child, link valid 7 days,
     usable once). The form answers the same whether or not anything matched. On approval the academy's owner and
     managers are notified and an audit entry is written;
  3. staff hand the guardian a one-time link code (7 days) from the guardian card of the player profile; the guardian
     enters it in the guardian portal (for children without an account).
- **Review notes in every review e-mail (2026-11-24)**: approval, rejection and "more details" e-mails show the
  reviewer's notes.
- **Join request e-mails (2026-11-22)**: the applicant gets an e-mail when the request is received and when the
  academy approves, rejects or asks for more information (with the academy's notes); same for academy applications.
- **E-mails in a PLAYER request (2026-11-22)**: `contactEmail` is the player's own sign-in e-mail; the guardian's
  e-mail is separate and optional (`guardianEmail`, must differ) and goes on the guardian record at approval. In a
  GUARDIAN request `contactEmail` is the guardian's sign-in.
- The landing page offers two separate entry points: "join as a player" and "register my child (guardian)".

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
  (given or `REC-<yyyymmdd>-<8 random characters>`, unique per academy); applies the amount to the given subscription or the player's latest one:
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

### 2.10b Online payments (phase A, 2026-11-22)

- A player, or a guardian for their children, sees **dues**: subscriptions with an outstanding balance > 0, not
  EXEMPT/PAUSED/EXPIRED, in an ACTIVE academy.
- **Pay now** pays the **whole outstanding balance** of one subscription by card or wallet (Paymob hosted checkout).
  Only the subscription's player or one of their guardians can start it; the currency must match.
- The money goes to the **platform's merchant account**; the platform owner transfers each academy its share later
  (recorded in `academy_payouts`).
- A payment counts only when Paymob's **signed** confirmation arrives (never from the return URL). It is then recorded
  exactly like a cashier payment (method ONLINE, receipt number, receipt email to the guardian), and only once.
- A declined or abandoned payment changes nothing in the balance.
- Refunds are made in Paymob; reversing the ledger entry in the platform does not refund the card.
- **Platform subscription (phase B)**: only the academy **owner** pays it online, one billing cycle per payment. Price =
  monthly price (negotiated, else the plan's) times the cycle's months (1/3/6/12); an annual cycle on the list price uses
  the plan's yearly price when set. After Paymob's signed confirmation the subscription becomes ACTIVE, the renewal date
  moves forward one cycle from the later of today and the current renewal date, and a PAID invoice is issued.
- **Payouts**: the platform owes each academy what its families paid online minus what was transferred. Platform staff
  see the balances; only the **platform owner** records a transfer, never more than the balance. The academy sees its
  own collections, transfers and the amount still held by the platform.

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
- **Storage maintenance**: dry-run, then execute purge of expired/revoked refresh tokens. Audit logs are append-only and
  are **retained**; aged operational logs are only counted until a retention policy is decided (K5, open question 13).

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
