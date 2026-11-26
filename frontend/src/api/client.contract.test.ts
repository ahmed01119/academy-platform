import { describe, expect, it } from 'vitest';
import * as client from './client';

/**
 * Guards the public shape of the aggregated API client.
 * The list below is the exact inventory that existed before the client was split into
 * `@/lib/http` + `@/features/<domain>/api`. Removing or renaming a method breaks callers.
 */
const EXPECTED_API_SURFACE: Record<string, string[]> = {
  auth: 'register login logout refresh forgotPassword resetPassword verifyEmail resendVerification sendEmailCode verifyEmailCode getMe changePassword updateProfile'.split(
    ' ',
  ),
  tenancy:
    'getMyMemberships switchTenant listStaff updateCoachDelegation listBranches getProfile updateProfile inviteStaff listInvitations resendInvitation revokeInvitation revokeMembership acceptInvitation'.split(
      ' ',
    ),
  branches: 'list get create update getDeletionImpact archive'.split(' '),
  players:
    'list get create update getQrCard rotateQrCard revokeQrCard listJoinRequests reviewJoinRequest getDeletionImpact safeDelete'.split(
      ' ',
    ),
  enrollments: 'list create transfer'.split(' '),
  groups:
    'list get create update assignCoach removeCoach assignPlayer removePlayer createSchedule deleteSchedule getCalendar updateSchedule createScheduleException deleteScheduleException'.split(
      ' ',
    ),
  attendance:
    'listSessions getSession createSession closeSession generateQr checkInViaQr scanPlayerQr syncOfflineBatch recordAttendance bulkRecordAttendance correctAttendance getSessionEvents getReports'.split(
      ' ',
    ),
  platform:
    'getMetrics listAcademies getAcademyDeletionImpact archiveAcademy updateAcademyStatus requestSupportAccess listAuditLogs getSecurityEvents listUsers revokeUserSessions updateUserSecurityPolicy listSaaSPlans updateSaaSPlan updateTenantSubscription listAnnouncements createAnnouncement listAcademyApplications reviewAcademyApplication getStorageMetrics dryRunStorageMaintenance executeStorageMaintenance inviteSuperAdmin inviteUser updatePlatformAdminRole'.split(
      ' ',
    ),
  finance:
    'getTenantSubscription listPlayerPlans createPlayerPlan listPlayerSubscriptions getPlayerSubscription createPlayerSubscription recordPayment reverseTransaction getSessionCashierSummary recordSessionExpense approveSessionExpense rejectSessionExpense closeSessionCashier getDashboardMetrics'.split(
      ' ',
    ),
  evaluations:
    'listTemplates createTemplate createEvaluation listPlayerEvaluations getPlayerDevelopmentProfile listSessionEvaluations getRankings'.split(
      ' ',
    ),
  portal:
    'getPlayerProfile getMyPlayerQrCard getGuardianProfile redeemClaimToken generateClaimToken requestGuardianLink getGuardianLinkRequest decideGuardianLink listPublicAcademies submitPlayerJoinRequest listMyJoinRequests'.split(
      ' ',
    ),
  notifications: 'list getUnreadCount markRead markAllRead'.split(' '),
  payments:
    'listDues startOnlinePayment getOnlinePayment getPlatformSubscriptionQuote payPlatformSubscription getAcademyOnlineSummary listPayoutBalances listPayouts recordPayout'.split(
      ' ',
    ),
};

describe('api client public contract', () => {
  it('exposes exactly the expected domains', () => {
    expect(Object.keys(client.api).sort()).toEqual(Object.keys(EXPECTED_API_SURFACE).sort());
  });

  it.each(Object.entries(EXPECTED_API_SURFACE))('%s exposes every method', (domain, methods) => {
    const section = client.api[domain as keyof typeof client.api] as Record<string, unknown>;
    expect(Object.keys(section).sort()).toEqual([...methods].sort());
    methods.forEach((m) => expect(typeof section[m]).toBe('function'));
  });

  it('keeps the legacy named and default exports', () => {
    expect(client.apiClient).toBe(client.api);
    expect(client.default).toBe(client.api);
    for (const name of [
      'ApiError',
      'setActiveTenantIdHeader',
      'getActiveTenantIdHeader',
      'onAuthEvent',
      'executeSingleFlightTokenRefresh',
      'clearApiCache',
    ] as const) {
      expect(client[name]).toBeDefined();
    }
  });
});
