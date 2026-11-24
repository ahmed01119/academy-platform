# SPORTEXUS — Comprehensive Role & Permission Matrix (RBAC / ABAC)

## 1. Platform Governance Roles & Authority

Sportexus differentiates between **Platform Governance** (multi-tenant administration) and **Tenant Operations** (academy workspace administration).

### 1.1 Platform-Level Roles

| Role                     | Database Identity                                                  | Description                                                                       | Key Capabilities                                                                                                             | Safeguards                                                                                        |
| ------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Platform Owner**       | `User.isPlatformOwner = true`, `User.isPlatformSuperAdmin = true`  | Primary platform administrator and platform co-owners. Complete system authority. | Tenant provisioning, plan management, system audits, super-admin invitations, storage maintenance, emergency support access. | System prohibits deleting or suspending the last active Platform Owner.                           |
| **Platform Co-Owner**    | `User.isPlatformOwner = true`, `User.isPlatformSuperAdmin = true`  | Co-owner with 100% operational and governance parity with the primary owner.      | Full parity with Platform Owner across all endpoints, guard validations, and tenant operations.                              | Cannot be demoted or suspended except by a fellow Platform Owner. Last active owner is protected. |
| **Platform Super Admin** | `User.isPlatformSuperAdmin = true`, `User.isPlatformOwner = false` | Delegated platform administrator.                                                 | Academy approvals/suspensions, subscription modifications, support session initiation, platform metrics viewing.             | Cannot invite/promote other super admins or modify Platform Owner accounts.                       |

---

## 2. Tenant-Level Roles & Permissions Matrix

Within an academy workspace (`Tenant`), permissions are evaluated dynamically using `PermissionsGuard` based on the active `TenantMembership`.

Owner decision 2026-11-24: an academy has three staff roles. **OWNER** is responsible for everything, money and the
treasury included. **MANAGER** is the admin: branches, groups, players, sessions, attendance, evaluations and staff, with
no money at all. **COACH** sees only their own groups, those groups' sessions and players, marks attendance and writes
evaluations. BRANCH_MANAGER, RECEPTIONIST and ACCOUNTANT were converted to MANAGER and VIEWER was retired (migration
`20261124110000_simplify_tenant_roles`); the values remain in the database enum but grant nothing and cannot be assigned.
Players and guardians are not academy staff: they use the player and guardian portals (own sessions, academy and branch;
own children and their progress).

| Permission Key              | Description                               | OWNER | MANAGER |   COACH    |
| --------------------------- | ----------------------------------------- | :---: | :-----: | :--------: |
| `tenant.update`             | Edit academy profile, branding, sports    |  ✅   |   ❌    |     ❌     |
| `branches.manage`           | Create, edit, and delete branches         |  ✅   |   ✅    |     ❌     |
| `branches.read`             | View branch information                   |  ✅   |   ✅    |     ✅     |
| `staff.manage`              | Invite, assign, and manage staff roles    |  ✅   |   ✅    |     ❌     |
| `staff.read`                | View staff directories and assignments    |  ✅   |   ✅    |     ✅     |
| `players.create`            | Register new players in academy           |  ✅   |   ✅    |     ❌     |
| `players.read`              | View player rosters                       |  ✅   |   ✅    |     ✅     |
| `players.update`            | Edit player information and records       |  ✅   |   ✅    |     ❌     |
| `players.delete`            | Safe removal or transfer of players       |  ✅   |   ✅    |     ❌     |
| `players.sensitive.read`    | Access medical and emergency records      |  ✅   |   ✅    |     ❌     |
| `player.application.review` | Review public player join requests        |  ✅   |   ✅    | Delegated* |
| `attendance.read`           | View training attendance records          |  ✅   |   ✅    |     ✅     |
| `attendance.mark`           | Mark attendance for training sessions     |  ✅   |   ✅    |     ✅     |
| `attendance.correct`        | Correct past attendance within window     |  ✅   |   ✅    |     ❌     |
| `attendance.close`          | Finalize and lock attendance session      |  ✅   |   ✅    |     ❌     |
| `payments.read`             | View player invoices and payments         |  ✅   |   ❌    |     ❌     |
| `payments.create`           | Record subscription payments and receipts |  ✅   |   ❌    |     ❌     |
| `payments.refund`           | Process refunds and void receipts         |  ✅   |   ❌    |     ❌     |
| `session_expenses.read`     | View coach session allowances             |  ✅   |   ❌    |     ❌     |
| `session_expenses.create`   | Submit session expense claims             |  ✅   |   ❌    |     ❌     |
| `session_expenses.approve`  | Approve and disburse session payouts      |  ✅   |   ❌    |     ❌     |
| `session_cashier.close`     | Close (reconcile) a session cashier once  |  ✅   |   ❌    |     ❌     |
| `reports.read`              | View attendance and operational reports   |  ✅   |   ✅    |     ❌     |
| `groups.read`               | View squads, rosters, and age categories  |  ✅   |   ✅    |     ✅     |
| `groups.manage`             | Create squads, assign coaches/players     |  ✅   |   ✅    |     ❌     |
| `sessions.read`             | View training calendar and schedules      |  ✅   |   ✅    |     ✅     |
| `sessions.manage`           | Schedule or cancel training sessions      |  ✅   |   ✅    |     ❌     |
| `evaluations.read`          | View player skill ratings and tests       |  ✅   |   ✅    |     ✅     |
| `evaluations.create`        | Score skill tests and evaluations         |  ✅   |   ✅    |     ✅     |
| `evaluations.manage`        | Define evaluation criteria and templates  |  ✅   |   ✅    |     ❌     |

_\*Note: Coaches may only review player applications if explicitly granted `canReviewApplications: true` on their `TenantMembership`._

COACH rows are limited to the coach's own groups (their sessions and active players; `common/coach-scope.ts`), and
`attendance.mark` to the sessions the coach is assigned to (session coach or group coach).
This table is the source of truth (owner decisions 2026-11-16 and 2026-11-24); `packages/shared/src/constants/roles-permissions.test.ts`
parses it and fails if `ROLE_PERMISSIONS` differs in any cell.

---

## 3. Platform Co-Owner Parity Verification

1. **Guard Parity (`PlatformOwnerGuard`):**
   - Validates that `User.isPlatformOwner === true`.
   - Both Primary Platform Owner and Platform Co-Owners pass this gate with 100% equivalence.
2. **Access Parity (`PlatformSuperAdminGuard`):**
   - Automatically satisfies `isPlatformSuperAdmin` requirements if `isPlatformOwner === true`.
3. **Session Revocation & Deletion Parity:**
   - Both owners and co-owners can manage lower-tiered staff, review tenant registrations, execute storage cleanups, and manage subscription pricing.
   - Self-preservation and last-owner protection prevents accidental lockout of the platform.
