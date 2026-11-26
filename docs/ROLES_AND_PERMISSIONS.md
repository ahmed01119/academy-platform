# Sportexus — Roles and What Each One Can Do

Plain-language guide to every role on the platform: who holds it, how they get it, what they see and what they may
do. The exact permission keys are in [`security/ROLE_PERMISSION_MATRIX.md`](security/ROLE_PERMISSION_MATRIX.md), which
the code follows (a test fails if they differ). Business rules behind each action are in
[`BUSINESS_LOGIC.md`](BUSINESS_LOGIC.md). Owner decisions: 2026-11-16 (matrix), 2026-11-24 (three academy roles, money
is the owner's, coaches see only their groups) and 2026-11-25 (guardians follow timetable changes).

Every rule below is enforced by the API (guards and database row-level security). The web app hides what a role cannot
use, but hiding is never the protection.

---

## 1. Overview

| Level    | Role                 | In one sentence                                                                 |
| -------- | -------------------- | ------------------------------------------------------------------------------- |
| Platform | Platform owner       | Runs Sportexus itself: academies, plans, platform admins, security.             |
| Platform | Platform super admin | Day-to-day platform administration, delegated by the owner.                     |
| Academy  | Owner (OWNER)        | Responsible for everything in the academy, and the only one who handles money.  |
| Academy  | Admin (MANAGER)      | Runs the sporting side: branches, groups, players, sessions, attendance, staff. |
| Academy  | Coach (COACH)        | Sees and runs only the groups they coach: attendance and evaluations.           |
| End user | Player               | Sees their own sessions, academy, branch, attendance and evaluations.           |
| End user | Guardian (parent)    | Sees only their own children: sessions, attendance, progress, coach feedback.   |

One account can hold several of these at once (for example an owner of one academy who is also a guardian at another).
Academy roles are per academy: the role applies in the academy chosen in the top bar.

Retired roles: BRANCH_MANAGER, RECEPTIONIST and ACCOUNTANT were converted to Admin, and VIEWER was removed, on
2026-11-24. They still exist in the database type but grant nothing and cannot be given to anyone.

---

## 2. Platform roles

### 2.1 Platform owner (and co-owners)

- **Who**: the people who run Sportexus. The first owner is created from the server (`scripts/create-superadmin.js`);
  further co-owners are invited by an owner. Co-owners have exactly the same powers.
- **Can**: everything a super admin can, plus invite or remove platform admins and co-owners, change platform plans and
  prices, run storage maintenance, and use emergency support access to an academy.
- **Safeguards**: the last active platform owner can never be suspended or removed.

### 2.2 Platform super admin

- **Who**: invited by a platform owner.
- **Can**: review academy applications (approve with a plan, reject, or ask for more details), suspend or reactivate
  academies, change academy subscriptions, see platform metrics, audit and security logs, and open support access.
- **Cannot**: invite or promote other platform admins, or change a platform owner's account.
- **Notified when**: a new academy applies; an applicant answers a "more details" request.

---

## 3. Academy roles

### 3.1 Owner (OWNER) — المالك

The person whose academy application was approved (or another owner they invited). **Responsible for everything in the
academy, and the only role that touches money.**

| Area                      | What the owner can do                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| Academy profile           | Edit name, logo, sports, currency, contact details (`tenant.update`, owner only).                       |
| Money and treasury        | Everything on the finance page: subscriptions and plans, record payments and receipts, refunds, session |
|                           | expenses (recorded and approved at once), close a session's cashier, financial reports.                 |
| Staff                     | Invite owners, admins and coaches; suspend or remove them; allow a coach to review join requests.       |
| Everything the admin does | Branches, groups, timetable, players, join requests, sessions, attendance, evaluations (see 3.2).       |
| Sensitive player data     | See and edit national ID and medical notes.                                                             |

- **Pages**: dashboard, players, groups, evaluations, sessions, QR scanner, attendance reports, branches, finance,
  settings.
- **Notified when**: a new join request arrives; a guardian links to one of the academy's players.

### 3.2 Admin (MANAGER) — الإداري

Invited by the owner (or another admin). **Runs the academy day to day, without money.**

| Area                  | What the admin can do                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| Branches              | Create, edit and archive branches.                                                                         |
| Groups and timetable  | Create groups, assign coaches and players, set the fixed weekly slots, cancel or move one session, add an  |
|                       | extra session, undo a change, change a weekly slot (coach, players and guardians are notified).            |
| Players               | Register players, edit them (same fields as the enrollment form), transfer between branches, archive,      |
|                       | hand guardians a link code. Sees national ID and medical notes.                                            |
| Join requests         | Review requests from the landing page / portal: approve (choosing branch and group), reject, ask for more. |
| Sessions & attendance | Open sessions, mark and correct attendance, close sessions, scan QR cards, attendance reports.             |
| Evaluations           | Create evaluation templates and evaluate players.                                                          |
| Staff                 | Invite and manage admins and coaches (cannot make someone an owner).                                       |

- **Cannot**: anything with money (finance page, payments, refunds, session expenses, cashier), or edit the academy
  profile.
- **Pages**: dashboard, players, groups, evaluations, sessions, QR scanner, attendance reports, branches, settings
  (staff part).
- **Notified when**: a join request arrives; a guardian links to a player.

### 3.3 Coach (COACH) — المدرب

Invited by the owner or an admin, attached to one branch. **Works only with the groups they coach.**

| Area          | What the coach can do                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| Own groups    | See the groups they coach, their members and their timetable with every change (read only).           |
| Sessions      | See the sessions of their groups (or sessions they lead) and mark attendance for them.                |
| Players       | See the active players of their groups only. Other players, groups and sessions do not exist for them |
|               | (the API answers "not found").                                                                        |
| Evaluations   | Evaluate their players and write comments / feedback, which guardians and players see when published. |
| Join requests | Only if the owner or admin turned on "can review applications" for that coach.                        |

- **Cannot**: create or change groups, timetables, players or branches; correct or close attendance; see national ID or
  medical notes; anything with money (coaches no longer claim session expenses).
- **Pages**: coach workspace, players (own), groups (own), evaluations, sessions (own), QR scanner.
- **Notified when**: a session of their group is cancelled, moved or added, or the weekly time changes.

---

## 4. End users (portals)

### 4.1 Player — اللاعب

- **How**: joins from the landing page or the portal ("join as a player"; the e-mail is confirmed with a code); the
  account opens after the academy approves. Or staff add the player and hand over a link code.
- **Sees**: their academy, branch and group, their upcoming sessions from the timetable (cancelled, moved and extra
  sessions are marked with the reason), attendance summary, published evaluations, their QR membership card.
- **Can**: approve or decline a guardian who asks to be linked to them (e-mail link); send join requests.
- **Cannot**: see other players or any academy administration.
- **Notified when**: a session of their group is cancelled, moved or added, or the weekly time changes; their join
  request is decided.

### 4.2 Guardian (parent) — ولي الأمر

- **How**, three ways:
  1. registers the child from the landing page ("register my child"): linked when the academy approves;
  2. the child already has a player account: the guardian types the child's e-mail and their own phone; the phone must
     match the guardian the academy registered and the child must approve from an e-mail;
  3. the academy hands over a one-time link code (7 days) from the player's profile.
- **Sees**: only their own children: upcoming sessions with every change, attendance rate, latest score, published coach
  feedback. Can switch between children.
- **Cannot**: see other players or any academy administration, or change their child's data.
- **Notified when**: a session of a child's group is cancelled, moved or added, or the weekly time changes; a link
  request is approved or declined; a join request is decided.

---

## 5. Who can do what (by task)

| Task                                           | Owner | Admin |   Coach    | Player | Guardian |
| ---------------------------------------------- | :---: | :---: | :--------: | :----: | :------: |
| Edit the academy profile                       |  ✅   |  ❌   |     ❌     |   ❌   |    ❌    |
| Payments, refunds, subscriptions, finance page |  ✅   |  ❌   |     ❌     |   ❌   |    ❌    |
| Session expenses and cashier                   |  ✅   |  ❌   |     ❌     |   ❌   |    ❌    |
| Invite / manage staff                          |  ✅   |  ✅   |     ❌     |   ❌   |    ❌    |
| Branches                                       |  ✅   |  ✅   | view only  |   ❌   |    ❌    |
| Groups and coaches/players in them             |  ✅   |  ✅   | own (view) |   ❌   |    ❌    |
| Fixed timetable and one-off changes            |  ✅   |  ✅   | own (view) |  own   | children |
| Register / edit / archive players              |  ✅   |  ✅   |     ❌     |   ❌   |    ❌    |
| National ID and medical notes                  |  ✅   |  ✅   |     ❌     |   ❌   |    ❌    |
| Review join requests                           |  ✅   |  ✅   | if allowed |   ❌   |    ❌    |
| Mark attendance                                |  ✅   |  ✅   |    own     |   ❌   |    ❌    |
| Correct / close attendance, attendance reports |  ✅   |  ✅   |     ❌     |   ❌   |    ❌    |
| Evaluate players / write feedback              |  ✅   |  ✅   |    own     |   ❌   |    ❌    |
| Evaluation templates                           |  ✅   |  ✅   |     ❌     |   ❌   |    ❌    |
| Link code for a guardian                       |  ✅   |  ✅   |     ❌     |   ❌   |    ❌    |
| Approve a guardian link                        |   —   |   —   |     —      |  own   |    —     |

"Own" means: only the groups they coach (coach), only themselves (player), only their children (guardian).
