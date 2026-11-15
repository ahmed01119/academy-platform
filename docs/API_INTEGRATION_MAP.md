# API Integration Map

> Generated on 2026-11-15 from the source code. Frontend methods come from `features/*/api.ts` (TypeScript AST); backend
> routes come from the controller decorators. Regenerate after any API or page change.
>
> "Backend access" is the controller-level requirement, using permission names from `@academy/shared` `Permission`.
> Service-level rules (branch scoping, `players.sensitive.read` masking) are not shown.

## Summary

| Measure                                 | Count                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------- |
| Frontend API methods                    | 123                                                                    |
| Backend routes                          | 132                                                                    |
| Frontend calls with no backend route    | 0                                                                      |
| Frontend methods not called by any page | 19 (listed below)                                                      |
| Backend routes with no frontend method  | 9: health checks, the refresh call made by the HTTP core, alias routes |

## Integration gaps

### Backend features with no reachable UI

| Area        | Backend endpoint                                                                      | Missing in the UI                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Staff       | `POST /tenants/memberships/:id/revoke`                                                | Revoking a staff member's access                                                                                                             |
| Branches    | `DELETE /branches/:id`, `GET /branches/:id/deletion-impact`                           | Archiving a branch, with its impact report                                                                                                   |
| Groups      | `PATCH /groups/:id`                                                                   | Editing a training group                                                                                                                     |
| Enrollments | `GET /enrollments`, `POST /enrollments`                                               | Enrollment history; adding a second enrollment. Only the enrollment created with a new player, and transfers, exist.                         |
| Attendance  | `POST /attendance/corrections`                                                        | Correcting a recorded attendance entry                                                                                                       |
| Evaluations | `POST /evaluations/templates`, `GET /evaluations/session/:id`                         | Creating evaluation templates; listing evaluations per session                                                                               |
| Finance     | `GET /finance/player-subscriptions/player/:id`                                        | A player's subscription detail                                                                                                               |
| Portal      | `POST /portal/claim-token`                                                            | Generating account-claim codes. Staff can't create them, so the player/guardian "claim account" flow (`POST /portal/claim`) can never start. |
| Platform    | `POST /platform/academies/:id/archive`, `GET /platform/academies/:id/deletion-impact` | Archiving an academy                                                                                                                         |
| Platform    | `GET /platform/announcements`, `POST /platform/announcements`                         | Announcements console                                                                                                                        |

Each gap needs a product decision: build the UI, or retire the endpoint. **Nothing is removed or retired without owner
approval.**

### Recommendations (2026-11-15, awaiting owner decisions)

Phase 5 builds approved screens on the shared data-loading and error states from Phase 4B.

| #   | Feature                                            | Backend access                                   | Recommendation                                                                                                                                                                                                                              | Priority | Notes                                                                                                                                       |
| --- | -------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Revoke staff access                                | `staff.manage`                                   | **Build**: a "Revoke access" action on the Settings › Staff list, with a confirmation dialog                                                                                                                                                | High     | Staff can be invited but never removed. Offboarding is a security need.                                                                     |
| 2   | Portal claim codes                                 | `players.update`                                 | **Build**: "Generate portal access code" on the player and guardian profiles                                                                                                                                                                | High     | Without it, `POST /portal/claim` can never be used, so the player and guardian portals are unreachable for existing records. Related to K6. |
| 3   | Attendance correction                              | `attendance.correct`                             | **Build**: "Correct" on records of a closed session, with a required reason                                                                                                                                                                 | High     | After a session closes this is the only way to fix a record; corrections are audited.                                                       |
| 4   | Edit training group                                | `groups.manage`                                  | **Build**: an edit dialog on the group detail page (name, capacity, age category, status)                                                                                                                                                   | Medium   | Groups currently cannot be renamed or resized.                                                                                              |
| 5   | Archive branch, with impact report                 | `branches.manage`                                | **Build**: an archive action on the branches page that shows the impact report first, like player archive                                                                                                                                   | Medium   | Destructive; the backend already computes the impact.                                                                                       |
| 6   | Enrollment history / extra enrollment              | `players.read` (list), `players.create` (create) | **Build (read)**: show enrollment history on the player profile. **Decide (write)**: are a second sport or a parallel branch allowed?                                                                                                       | Medium   | The write side is a business rule.                                                                                                          |
| 7   | Evaluation templates                               | `evaluations.manage`                             | **Build**: template management under Evaluations for managers                                                                                                                                                                               | Medium   | Needed to customise criteria per academy.                                                                                                   |
| 8   | Archive academy, with impact report                | platform admin                                   | **Build**: an owner-only action in the platform console, behind a typed confirmation                                                                                                                                                        | Medium   | Highly destructive; the existing impact endpoint supports a safe flow.                                                                      |
| 9   | Player subscription detail                         | `payments.read`                                  | **Build**: a "Subscription" panel on the player profile                                                                                                                                                                                     | Low      | Finance currently shows lists only.                                                                                                         |
| 10  | Session evaluations list                           | `evaluations.read`                               | **Build**: an evaluations tab on the session page                                                                                                                                                                                           | Low      |                                                                                                                                             |
| 11  | Platform announcements                             | platform admin                                   | **Decide**: announcements are stored but **never delivered**. No notification is created and no screen shows them. Either build the console _and_ delivery (a banner or notification for the targeted academies), or retire both endpoints. | Decision | A console alone would publish messages nobody sees.                                                                                         |
| 12  | `tenancy.getMyMemberships`, `tenancy.listBranches` | signed in / tenant member                        | **Keep** the endpoints; drop the unused frontend wrappers when the tenancy feature is refactored (Phase 4C)                                                                                                                                 | Low      | The auth context gets memberships through `/auth/me`.                                                                                       |
| 13  | `platform.submitAcademyApplication`                | public                                           | **Decide**: registration uses `/auth/register`. Confirm whether a separate public application form is still wanted.                                                                                                                         | Low      |                                                                                                                                             |

### Frontend methods not called by any page

`attendance.correctAttendance`, `branches.get`, `branches.getDeletionImpact`, `branches.archive`, `enrollments.list`, `enrollments.create`, `evaluations.createTemplate`, `evaluations.listSessionEvaluations`, `finance.getPlayerSubscription`, `groups.update`, `platform.getAcademyDeletionImpact`, `platform.archiveAcademy`, `platform.listAnnouncements`, `platform.createAnnouncement`, `platform.submitAcademyApplication`, `portal.generateClaimToken`, `tenancy.getMyMemberships`, `tenancy.listBranches`, `tenancy.revokeMembership`

### Backend routes with no frontend method

`GET /health`, `GET /health/ready`, `GET /platform/storage/stats`, `GET /players/join-requests`, `PATCH /platform/applications/:id/review`, `PATCH /players/join-requests/:id/review`, `PATCH /players/registration-requests/:id/review`, `POST /auth/refresh`, `POST /players/join-requests/:id/review`

## Endpoint map

### attendance

| Frontend call                     | HTTP | Endpoint (`/v1`)                          | Backend access       | Used by                                                                                                     |
| --------------------------------- | ---- | ----------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------- |
| `attendance.listSessions`         | GET  | `/attendance/sessions`                    | `attendance.read`    | /attendance, /attendance/quick, /attendance/scanner, /coach, /dashboard, /sessions, utils/offline-engine.ts |
| `attendance.getSession`           | GET  | `/attendance/sessions/:id`                | `attendance.read`    | /attendance/quick, /attendance/scanner, /attendance/sessions/[id], utils/offline-engine.ts                  |
| `attendance.createSession`        | POST | `/attendance/sessions`                    | `attendance.mark`    | /sessions                                                                                                   |
| `attendance.closeSession`         | POST | `/attendance/sessions/:id/close`          | `attendance.close`   | /attendance/sessions/[id], /sessions                                                                        |
| `attendance.generateQr`           | POST | `/attendance/sessions/:id/qr`             | `attendance.mark`    | /attendance/sessions/[id]                                                                                   |
| `attendance.checkInViaQr`         | POST | `/attendance/sessions/:id/checkin-qr`     | `attendance.mark`    | features/attendance/components/QrCheckInSimulator.tsx                                                       |
| `attendance.scanPlayerQr`         | POST | `/attendance/sessions/:id/scan-player-qr` | `attendance.mark`    | /attendance/scanner                                                                                         |
| `attendance.syncOfflineBatch`     | POST | `/attendance/sessions/:id/offline-sync`   | `attendance.mark`    | utils/offline-attendance-store.ts                                                                           |
| `attendance.recordAttendance`     | POST | `/attendance/records`                     | `attendance.mark`    | /attendance/quick, /attendance/sessions/[id]                                                                |
| `attendance.bulkRecordAttendance` | POST | `/attendance/records/bulk`                | `attendance.mark`    | /attendance/quick, /attendance/sessions/[id]                                                                |
| `attendance.correctAttendance`    | POST | `/attendance/corrections`                 | `attendance.correct` | _not called_                                                                                                |
| `attendance.getSessionEvents`     | GET  | `/attendance/sessions/:id/events`         | `attendance.read`    | /attendance/sessions/[id]                                                                                   |
| `attendance.getReports`           | GET  | `/attendance/reports`                     | `reports.read`       | /attendance/reports                                                                                         |

### auth

| Frontend call             | HTTP  | Endpoint (`/v1`)            | Backend access | Used by                                       |
| ------------------------- | ----- | --------------------------- | -------------- | --------------------------------------------- |
| `auth.register`           | POST  | `/auth/register`            | public         | contexts/auth-context.tsx                     |
| `auth.login`              | POST  | `/auth/login`               | public         | /auth-test, contexts/auth-context.tsx         |
| `auth.logout`             | POST  | `/auth/logout`              | public         | contexts/auth-context.tsx                     |
| `auth.forgotPassword`     | POST  | `/auth/forgot-password`     | public         | /auth-test, /forgot-password                  |
| `auth.resetPassword`      | POST  | `/auth/reset-password`      | public         | /auth-test, /forgot-password, /reset-password |
| `auth.verifyEmail`        | POST  | `/auth/verify-email`        | public         | /auth-test, /verify-email                     |
| `auth.resendVerification` | POST  | `/auth/resend-verification` | public         | /auth-test, /verify-email                     |
| `auth.getMe`              | GET   | `/auth/me`                  | signed in      | /auth-test, contexts/auth-context.tsx         |
| `auth.changePassword`     | POST  | `/auth/change-password`     | signed in      | /account                                      |
| `auth.updateProfile`      | PATCH | `/auth/profile`             | signed in      | /account                                      |

### branches

| Frontend call                | HTTP   | Endpoint (`/v1`)                | Backend access    | Used by                                                                                                                                                                                                            |
| ---------------------------- | ------ | ------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `branches.list`              | GET    | `/branches`                     | `branches.read`   | /attendance/reports, /branches, /dashboard, /groups, /players/new, /sessions, components/dashboard/PlayerJoinRequestsTab.tsx, features/players/hooks/usePlayerProfile.ts, features/players/hooks/usePlayersList.ts |
| `branches.get`               | GET    | `/branches/:id`                 | `branches.read`   | _not called_                                                                                                                                                                                                       |
| `branches.create`            | POST   | `/branches`                     | `branches.manage` | /branches                                                                                                                                                                                                          |
| `branches.update`            | PATCH  | `/branches/:id`                 | `branches.manage` | /branches                                                                                                                                                                                                          |
| `branches.getDeletionImpact` | GET    | `/branches/:id/deletion-impact` | `branches.manage` | _not called_                                                                                                                                                                                                       |
| `branches.archive`           | DELETE | `/branches/:id`                 | `branches.manage` | _not called_                                                                                                                                                                                                       |

### enrollments

| Frontend call          | HTTP | Endpoint (`/v1`)            | Backend access   | Used by                                    |
| ---------------------- | ---- | --------------------------- | ---------------- | ------------------------------------------ |
| `enrollments.list`     | GET  | `/enrollments`              | `players.read`   | _not called_                               |
| `enrollments.create`   | POST | `/enrollments`              | `players.create` | _not called_                               |
| `enrollments.transfer` | POST | `/enrollments/:id/transfer` | `players.update` | features/players/hooks/usePlayerProfile.ts |

### evaluations

| Frontend call                             | HTTP | Endpoint (`/v1`)                  | Backend access       | Used by                  |
| ----------------------------------------- | ---- | --------------------------------- | -------------------- | ------------------------ |
| `evaluations.listTemplates`               | GET  | `/evaluations/templates`          | `evaluations.read`   | /evaluations             |
| `evaluations.createTemplate`              | POST | `/evaluations/templates`          | `evaluations.manage` | _not called_             |
| `evaluations.createEvaluation`            | POST | `/evaluations`                    | `evaluations.create` | /evaluations             |
| `evaluations.listPlayerEvaluations`       | GET  | `/evaluations/player/:id`         | `evaluations.read`   | /guardian                |
| `evaluations.getPlayerDevelopmentProfile` | GET  | `/evaluations/player/:id/profile` | `evaluations.read`   | /evaluations/player/[id] |
| `evaluations.listSessionEvaluations`      | GET  | `/evaluations/session/:id`        | `evaluations.read`   | _not called_             |
| `evaluations.getRankings`                 | GET  | `/evaluations/rankings`           | `evaluations.read`   | /evaluations             |

### finance

| Frontend call                      | HTTP | Endpoint (`/v1`)                           | Backend access             | Used by                                                                                    |
| ---------------------------------- | ---- | ------------------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------ |
| `finance.getTenantSubscription`    | GET  | `/finance/subscription`                    | `payments.read`            | /finance                                                                                   |
| `finance.listPlayerPlans`          | GET  | `/finance/player-plans`                    | `payments.read`            | /finance                                                                                   |
| `finance.createPlayerPlan`         | POST | `/finance/player-plans`                    | `payments.create`          | components/finance/CreatePlanModal.tsx                                                     |
| `finance.listPlayerSubscriptions`  | GET  | `/finance/player-subscriptions`            | `payments.read`            | /finance                                                                                   |
| `finance.getPlayerSubscription`    | GET  | `/finance/player-subscriptions/player/:id` | `payments.read`            | _not called_                                                                               |
| `finance.createPlayerSubscription` | POST | `/finance/player-subscriptions`            | `payments.create`          | components/finance/CreateSubscriptionModal.tsx                                             |
| `finance.recordPayment`            | POST | `/finance/payments/collect`                | `payments.create`          | /attendance/scanner, /attendance/sessions/[id], components/finance/CollectPaymentModal.tsx |
| `finance.reverseTransaction`       | POST | `/finance/transactions/:id/reverse`        | `payments.refund`          | components/finance/ReversalModal.tsx                                                       |
| `finance.getSessionCashierSummary` | GET  | `/finance/sessions/:id/cashier`            | `session.expenses.read`    | /attendance/sessions/[id]                                                                  |
| `finance.recordSessionExpense`     | POST | `/finance/sessions/:id/expense`            | `session.expenses.create`  | /attendance/sessions/[id]                                                                  |
| `finance.approveSessionExpense`    | POST | `/finance/expenses/:id/approve`            | `session.expenses.approve` | /attendance/sessions/[id]                                                                  |
| `finance.rejectSessionExpense`     | POST | `/finance/expenses/:id/reject`             | `session.expenses.approve` | /attendance/sessions/[id]                                                                  |
| `finance.closeSessionCashier`      | POST | `/finance/sessions/:id/close`              | `session.expenses.read`    | /attendance/sessions/[id]                                                                  |
| `finance.getDashboardMetrics`      | GET  | `/finance/dashboard`                       | `payments.read`            | /finance                                                                                   |

### groups

| Frontend call           | HTTP   | Endpoint (`/v1`)            | Backend access  | Used by                                                                                                                   |
| ----------------------- | ------ | --------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `groups.list`           | GET    | `/groups`                   | `groups.read`   | /attendance/reports, /coach, /dashboard, /evaluations, /groups, /sessions, components/dashboard/PlayerJoinRequestsTab.tsx |
| `groups.get`            | GET    | `/groups/:id`               | `groups.read`   | /groups/[id]                                                                                                              |
| `groups.create`         | POST   | `/groups`                   | `groups.manage` | /groups                                                                                                                   |
| `groups.update`         | PATCH  | `/groups/:id`               | `groups.manage` | _not called_                                                                                                              |
| `groups.assignCoach`    | POST   | `/groups/:id/coaches`       | `groups.manage` | /groups/[id]                                                                                                              |
| `groups.removeCoach`    | DELETE | `/groups/:id/coaches/:id`   | `groups.manage` | /groups/[id]                                                                                                              |
| `groups.assignPlayer`   | POST   | `/groups/:id/members`       | `groups.manage` | /groups/[id]                                                                                                              |
| `groups.removePlayer`   | DELETE | `/groups/:id/members/:id`   | `groups.manage` | /groups/[id]                                                                                                              |
| `groups.createSchedule` | POST   | `/groups/:id/schedules`     | `groups.manage` | /groups/[id]                                                                                                              |
| `groups.deleteSchedule` | DELETE | `/groups/:id/schedules/:id` | `groups.manage` | /groups/[id]                                                                                                              |

### notifications

| Frontend call                  | HTTP  | Endpoint (`/v1`)               | Backend access | Used by                      |
| ------------------------------ | ----- | ------------------------------ | -------------- | ---------------------------- |
| `notifications.list`           | GET   | `/notifications`               | signed in      | components/layout/Topbar.tsx |
| `notifications.getUnreadCount` | GET   | `/notifications/unread-count`  | signed in      | components/layout/Topbar.tsx |
| `notifications.markRead`       | PATCH | `/notifications/:id/read`      | signed in      | components/layout/Topbar.tsx |
| `notifications.markAllRead`    | POST  | `/notifications/mark-all-read` | signed in      | components/layout/Topbar.tsx |

### platform

| Frontend call                        | HTTP  | Endpoint (`/v1`)                          | Backend access | Used by                                                                              |
| ------------------------------------ | ----- | ----------------------------------------- | -------------- | ------------------------------------------------------------------------------------ |
| `platform.getMetrics`                | GET   | `/platform/metrics`                       | platform admin | /dashboard, /platform                                                                |
| `platform.listAcademies`             | GET   | `/platform/academies`                     | platform admin | /dashboard, /platform                                                                |
| `platform.getAcademyDeletionImpact`  | GET   | `/platform/academies/:id/deletion-impact` | platform admin | _not called_                                                                         |
| `platform.archiveAcademy`            | POST  | `/platform/academies/:id/archive`         | platform admin | _not called_                                                                         |
| `platform.updateAcademyStatus`       | PATCH | `/platform/academies/:id/status`          | platform admin | /platform                                                                            |
| `platform.requestSupportAccess`      | POST  | `/platform/academies/:id/support-access`  | platform admin | /platform                                                                            |
| `platform.listAuditLogs`             | GET   | `/platform/audit-logs`                    | platform admin | /platform                                                                            |
| `platform.getSecurityEvents`         | GET   | `/platform/security-events`               | platform admin | /platform                                                                            |
| `platform.listUsers`                 | GET   | `/platform/users`                         | platform admin | /platform, components/platform/CoOwnerTab.tsx                                        |
| `platform.revokeUserSessions`        | POST  | `/platform/users/:id/revoke-sessions`     | platform admin | /platform, components/platform/CoOwnerTab.tsx, components/platform/GovernanceTab.tsx |
| `platform.updateUserSecurityPolicy`  | PATCH | `/platform/users/:id/security-policy`     | platform admin | /platform, components/platform/GovernanceTab.tsx                                     |
| `platform.listSaaSPlans`             | GET   | `/platform/saas-plans`                    | platform admin | /platform                                                                            |
| `platform.updateSaaSPlan`            | PATCH | `/platform/saas-plans/:id`                | platform admin | components/platform/PlatformPlansTab.tsx                                             |
| `platform.updateTenantSubscription`  | PATCH | `/platform/academies/:id/subscription`    | platform admin | /platform                                                                            |
| `platform.listAnnouncements`         | GET   | `/platform/announcements`                 | platform admin | _not called_                                                                         |
| `platform.createAnnouncement`        | POST  | `/platform/announcements`                 | platform admin | _not called_                                                                         |
| `platform.submitAcademyApplication`  | POST  | `/platform/applications/public`           | public         | _not called_                                                                         |
| `platform.listAcademyApplications`   | GET   | `/platform/applications`                  | platform admin | /dashboard, /platform                                                                |
| `platform.reviewAcademyApplication`  | POST  | `/platform/applications/:id/review`       | platform admin | components/platform/ApplicationsTab.tsx                                              |
| `platform.getStorageMetrics`         | GET   | `/platform/storage/metrics`               | platform admin | components/platform/StorageTab.tsx                                                   |
| `platform.dryRunStorageMaintenance`  | POST  | `/platform/storage/maintenance/dry-run`   | platform admin | components/platform/StorageTab.tsx                                                   |
| `platform.executeStorageMaintenance` | POST  | `/platform/storage/maintenance/execute`   | platform admin | components/platform/StorageTab.tsx                                                   |
| `platform.inviteSuperAdmin`          | POST  | `/platform/super-admin/invite`            | platform admin | components/platform/CoOwnerTab.tsx, components/platform/GovernanceTab.tsx            |
| `platform.inviteUser`                | POST  | `/platform/users/invite`                  | platform admin | components/platform/GovernanceTab.tsx                                                |
| `platform.updatePlatformAdminRole`   | PATCH | `/platform/super-admin/:id/role`          | platform admin | components/platform/CoOwnerTab.tsx                                                   |

### players

| Frontend call               | HTTP   | Endpoint (`/v1`)                            | Backend access              | Used by                                                                                                                                                         |
| --------------------------- | ------ | ------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `players.list`              | GET    | `/players`                                  | `players.read`              | /dashboard, /evaluations, /groups/[id], components/CommandPalette.tsx, components/finance/CreateSubscriptionModal.tsx, features/players/hooks/usePlayersList.ts |
| `players.get`               | GET    | `/players/:id`                              | `players.read`              | features/players/hooks/usePlayerProfile.ts                                                                                                                      |
| `players.create`            | POST   | `/players`                                  | `players.create`            | /players/new                                                                                                                                                    |
| `players.update`            | PATCH  | `/players/:id`                              | `players.update`            | features/players/hooks/usePlayerProfile.ts                                                                                                                      |
| `players.getQrCard`         | GET    | `/players/:id/qr-card`                      | `players.read`              | features/players/hooks/usePlayerProfile.ts                                                                                                                      |
| `players.rotateQrCard`      | POST   | `/players/:id/qr-card/rotate`               | `players.update`            | components/player-qr-card.tsx                                                                                                                                   |
| `players.revokeQrCard`      | POST   | `/players/:id/qr-card/revoke`               | `players.update`            | components/player-qr-card.tsx                                                                                                                                   |
| `players.listJoinRequests`  | GET    | `/players/registration-requests`            | `players.read`              | components/dashboard/PlayerJoinRequestsTab.tsx                                                                                                                  |
| `players.reviewJoinRequest` | POST   | `/players/registration-requests/:id/review` | `player.application.review` | components/dashboard/PlayerJoinRequestsTab.tsx                                                                                                                  |
| `players.getDeletionImpact` | GET    | `/players/:id/deletion-impact`              | `players.read`              | features/players/hooks/usePlayerProfile.ts                                                                                                                      |
| `players.safeDelete`        | DELETE | `/players/:id`                              | `players.delete`            | features/players/hooks/usePlayerProfile.ts                                                                                                                      |

### portal

| Frontend call                    | HTTP | Endpoint (`/v1`)               | Backend access   | Used by                                                |
| -------------------------------- | ---- | ------------------------------ | ---------------- | ------------------------------------------------------ |
| `portal.getPlayerProfile`        | GET  | `/portal/player/me`            | signed in        | /player                                                |
| `portal.getMyPlayerQrCard`       | GET  | `/portal/player/qr-card`       | signed in        | /player                                                |
| `portal.getGuardianProfile`      | GET  | `/portal/guardian/me`          | signed in        | /guardian                                              |
| `portal.redeemClaimToken`        | POST | `/portal/claim`                | signed in        | /guardian, /player                                     |
| `portal.generateClaimToken`      | POST | `/portal/claim-token`          | `players.update` | _not called_                                           |
| `portal.listPublicAcademies`     | GET  | `/portal/academies`            | public           | features/landing/components/PlayerJoinRequestModal.tsx |
| `portal.submitPlayerJoinRequest` | POST | `/portal/player-join-requests` | public           | features/landing/components/PlayerJoinRequestModal.tsx |

### tenancy

| Frontend call                   | HTTP   | Endpoint (`/v1`)                            | Backend access  | Used by                                        |
| ------------------------------- | ------ | ------------------------------------------- | --------------- | ---------------------------------------------- |
| `tenancy.getMyMemberships`      | GET    | `/tenants/my-memberships`                   | signed in       | _not called_                                   |
| `tenancy.switchTenant`          | POST   | `/tenants/switch`                           | signed in       | /auth-test, contexts/auth-context.tsx          |
| `tenancy.listStaff`             | GET    | `/tenants/staff`                            | `staff.read`    | /dashboard, /groups/[id], /sessions, /settings |
| `tenancy.updateCoachDelegation` | PATCH  | `/tenants/memberships/:id/coach-delegation` | `staff.manage`  | /settings                                      |
| `tenancy.listBranches`          | GET    | `/tenants/branches`                         | tenant member   | _not called_                                   |
| `tenancy.getProfile`            | GET    | `/tenants/profile`                          | tenant member   | /settings                                      |
| `tenancy.updateProfile`         | PATCH  | `/tenants/profile`                          | `tenant.update` | /settings                                      |
| `tenancy.inviteStaff`           | POST   | `/tenants/invitations`                      | `staff.manage`  | /settings                                      |
| `tenancy.listInvitations`       | GET    | `/tenants/invitations`                      | `staff.read`    | /settings                                      |
| `tenancy.resendInvitation`      | POST   | `/tenants/invitations/:id/resend`           | `staff.manage`  | /settings                                      |
| `tenancy.revokeInvitation`      | DELETE | `/tenants/invitations/:id`                  | `staff.manage`  | /settings                                      |
| `tenancy.revokeMembership`      | POST   | `/tenants/memberships/:id/revoke`           | `staff.manage`  | _not called_                                   |
| `tenancy.acceptInvitation`      | POST   | `/tenants/invitations/accept`               | signed in       | /accept-invite                                 |
