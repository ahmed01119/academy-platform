# SPORTEXUS — Player Lifecycle, Membership & Transfer Verification (Phase 4)

## 1. Standardized Player Registration Architecture

### 1.1 Field Inventory & Validation
Both internal registration (`POST /players`) and public joining requests (`POST /players/join-requests`) capture standardized data points:
- **Identity:** First Name, Last Name, Gender (`MALE`, `FEMALE`), Date of Birth (`YYYY-MM-DD`), National ID / Iqama (with tenant collision check).
- **Medical & Emergency:** Emergency Contact Name, Emergency Contact Phone, Medical Notes (restricted to authorized roles with `PLAYERS_SENSITIVE_READ`).
- **Primary Guardian:** First Name, Last Name, Relationship (`FATHER`, `MOTHER`, `GUARDIAN`, `RELATIVE`, `OTHER`), Phone, Email, `isPrimary: true`.
- **Branch & Sport:** Initial active branch assignment with branch capacity enforcement (`branch.capacity`).

---

## 2. Player Joining Review Pipeline

- **Application Review:** Managed via `PlayerJoinRequestsTab` (`/players?tab=applications`).
- **Role Delegation:**
  - `OWNER`, `MANAGER`, and `BRANCH_MANAGER` have full review permissions.
  - `COACH` may review applications only when delegated via `TenantMembership.canReviewApplications = true`, scoped strictly to their assigned branch/group.
- **Atomic Approval Actions (`POST /players/registration-requests/:id/review`):**
  - **Approval:** Validates tenant subscription player limits, creates `Player` record, links primary `Guardian`, creates active `PlayerEnrollment` in assigned branch, adds to specified training group (`groupId`), and dispatches in-app confirmation notification.
  - **Rejection:** Sets application status to `REJECTED`, records review notes, and notifies applicant.
  - **More Info Requested:** Retains application in `MORE_INFO_REQUESTED` state with feedback for the applicant.

---

## 3. Branch Transfer Integrity

- **Endpoint:** `POST /enrollments/:id/transfer`
- **Integrity Controls:**
  - Validates that source enrollment is currently `ACTIVE`.
  - Enforces that player cannot be transferred to the same branch.
  - Enforces target branch status is `ACTIVE` and target branch has not exceeded maximum capacity (`branch.capacity`).
  - Closes source enrollment with status `COMPLETED` and records `endDate`.
  - Creates a new active enrollment in the target branch with `startDate`.
  - Preserves entire historical audit trail: all past attendance sessions, evaluation scores, and financial invoices remain linked to their original historical branches.

---

## 4. Safe Player Removal & Impact Reporting

- **Pre-Deletion Assessment (`GET /players/:id/deletion-impact`):**
  - Evaluates active branch enrollments, group memberships, historical attendance events, evaluation ratings, and financial transactions.
  - Returns detailed warnings and impact metrics prior to deletion confirmation.
- **Safe Soft-Delete (`DELETE /players/:id`):**
  - Requires `Permission.PLAYERS_DELETE` (restricted strictly to `OWNER` and `MANAGER`).
  - Sets player status to `INACTIVE`.
  - Automatically cancels active branch enrollments (`status: CANCELLED`, `endDate: now`).
  - Deactivates active group memberships (`status: INACTIVE`).
  - Revokes active QR membership cards (`qrCardRevokedAt: now`).
  - Preserves financial ledger integrity: all payment receipts, invoices, and attendance logs remain untouched for historical accounting and compliance.
