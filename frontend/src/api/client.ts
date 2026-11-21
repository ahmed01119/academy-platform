/**
 * Aggregated API client.
 *
 * Transport concerns live in `@/lib/http`; endpoint definitions live next to their
 * feature in `@/features/<domain>/api`. This module composes them into the `api`
 * object the application has always used, so the public contract is unchanged.
 */
import { attendanceApi } from '@/features/attendance/api';
import { authApi } from '@/features/auth/api';
import { branchesApi } from '@/features/branches/api';
import { enrollmentsApi } from '@/features/enrollments/api';
import { evaluationsApi } from '@/features/evaluations/api';
import { financeApi } from '@/features/finance/api';
import { groupsApi } from '@/features/groups/api';
import { notificationsApi } from '@/features/notifications/api';
import { platformApi } from '@/features/platform/api';
import { playersApi } from '@/features/players/api';
import { paymentsApi } from '@/features/payments/api';
import { portalApi } from '@/features/portal/api';
import { tenancyApi } from '@/features/tenancy/api';

export {
  ApiError,
  getErrorMessage,
  setActiveTenantIdHeader,
  getActiveTenantIdHeader,
  onAuthEvent,
  executeSingleFlightTokenRefresh,
  clearApiCache,
  type AuthEventType,
} from '@/lib/http';

export const api = {
  auth: authApi,
  tenancy: tenancyApi,
  branches: branchesApi,
  players: playersApi,
  enrollments: enrollmentsApi,
  groups: groupsApi,
  attendance: attendanceApi,
  platform: platformApi,
  finance: financeApi,
  evaluations: evaluationsApi,
  portal: portalApi,
  payments: paymentsApi,
  notifications: notificationsApi,
};

export const apiClient = api;
export default api;
