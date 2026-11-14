import { describe, expect, it } from 'vitest';
import type { TenantMembershipSummary, TenantRole, UserSummary } from '@academy/shared';
import { canAccessAdminRoutes, canAccessCoachRoutes, getRoleHomeRoute } from '@/utils/role-routing';
import { resolveAccess, type AccessRule, type AccessState } from './access-rules';

// ─── Fixtures ────────────────────────────────────────────────────────────────
const baseUser: UserSummary = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'user@example.com',
  name: 'Test User',
  isEmailVerified: true,
  isPlatformSuperAdmin: false,
  isPlatformOwner: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const USERS: Record<string, UserSummary | null> = {
  signedOut: null,
  staff: baseUser,
  superAdmin: { ...baseUser, isPlatformSuperAdmin: true },
  platformOwner: { ...baseUser, isPlatformOwner: true },
  player: { ...baseUser, hasPlayerProfile: true },
  guardian: { ...baseUser, hasGuardianProfile: true },
};

const ROLES: TenantRole[] = [
  'OWNER',
  'MANAGER',
  'BRANCH_MANAGER',
  'RECEPTIONIST',
  'COACH',
  'ACCOUNTANT',
  'VIEWER',
];

const tenant = (
  role: TenantRole,
  status: TenantMembershipSummary['status'] = 'ACTIVE',
): TenantMembershipSummary => ({
  id: '00000000-0000-4000-8000-000000000010',
  tenantId: '00000000-0000-4000-8000-000000000020',
  tenantName: 'Academy One',
  tenantSlug: 'academy-one',
  role,
  status,
});

const TENANTS: Array<TenantMembershipSummary | null> = [
  null,
  ...ROLES.map((r) => tenant(r)),
  tenant('OWNER', 'SUSPENDED'),
  tenant('COACH', 'SUSPENDED'),
];

// ─── Reference: the inline page logic, copied verbatim before the refactor ───────────
// Returns the route a page pushed to, or null when it stayed. `isLoading` → never pushes.
type Legacy = (s: AccessState) => string | null;

const LEGACY: Record<AccessRule, Legacy> = {
  // account, attendance, attendance/sessions/[id], finance, groups/[id], players/[id],
  // players/new, coach, guardian, player
  authenticated: ({ isLoading, user }) => (!isLoading && !user ? '/login' : null),

  // attendance/reports, branches, dashboard, players, settings
  admin: ({ isLoading, user, activeTenant }) => {
    if (!isLoading) {
      if (!user) return '/login';
      if (!canAccessAdminRoutes(user, activeTenant)) return getRoleHomeRoute(user, activeTenant);
    }
    return null;
  },

  // groups, sessions
  'admin-or-coach': ({ isLoading, user, activeTenant }) => {
    if (!isLoading) {
      if (!user) return '/login';
      if (!canAccessAdminRoutes(user, activeTenant) && !canAccessCoachRoutes(user, activeTenant)) {
        return getRoleHomeRoute(user, activeTenant);
      }
    }
    return null;
  },

  // attendance/quick, attendance/scanner
  'no-coach': ({ isLoading, user, activeTenant }) => {
    if (!isLoading) {
      if (!user) return '/login';
      if (activeTenant?.role === 'COACH') return '/attendance';
    }
    return null;
  },

  // platform
  'platform-staff': ({ isLoading, user }) => {
    const isPlatformStaff = Boolean(user?.isPlatformSuperAdmin || user?.isPlatformOwner);
    return !isLoading && !isPlatformStaff ? '/dashboard' : null;
  },
};

const RULES = Object.keys(LEGACY) as AccessRule[];

function decisionTarget(rule: AccessRule, state: AccessState): string | null {
  const d = resolveAccess(rule, state);
  return d.status === 'redirect' ? d.to : null;
}

// ─── Equivalence over the full matrix ────────────────────────────────────────────
describe('resolveAccess ≡ legacy inline page guards', () => {
  for (const rule of RULES) {
    it(`${rule}: identical redirect for every user × membership × loading state`, () => {
      let checked = 0;
      for (const [userName, user] of Object.entries(USERS)) {
        for (const activeTenant of TENANTS) {
          for (const isLoading of [true, false]) {
            const state = { user, activeTenant, isLoading };
            const label = `${userName}/${activeTenant?.role ?? 'none'}/${activeTenant?.status ?? '-'}/loading=${isLoading}`;
            expect(decisionTarget(rule, state), label).toBe(LEGACY[rule](state));
            checked++;
          }
        }
      }
      expect(checked).toBe(Object.keys(USERS).length * TENANTS.length * 2);
    });
  }
});

// ─── Readable expectations for the important cases ────────────────────────────────
describe('resolveAccess behaviour', () => {
  const at = (rule: AccessRule, user: UserSummary | null, t: TenantMembershipSummary | null) =>
    resolveAccess(rule, { user, activeTenant: t, isLoading: false });

  it('never redirects while authentication is loading (no premature redirect)', () => {
    for (const rule of RULES) {
      expect(resolveAccess(rule, { user: null, activeTenant: null, isLoading: true })).toEqual({
        status: 'pending',
      });
    }
  });

  it('sends signed-out users to /login on every staff rule', () => {
    for (const rule of ['authenticated', 'admin', 'admin-or-coach', 'no-coach'] as const) {
      expect(at(rule, null, null)).toEqual({
        status: 'redirect',
        to: '/login',
        reason: 'unauthenticated',
      });
    }
  });

  it('admin: allows OWNER/MANAGER/BRANCH_MANAGER/ACCOUNTANT/RECEPTIONIST and super admins', () => {
    for (const role of [
      'OWNER',
      'MANAGER',
      'BRANCH_MANAGER',
      'ACCOUNTANT',
      'RECEPTIONIST',
    ] as const) {
      expect(at('admin', USERS.staff, tenant(role)).status).toBe('allowed');
    }
    expect(at('admin', USERS.superAdmin, null).status).toBe('allowed');
  });

  it('admin: sends COACH to /coach, players to /player, guardians to /guardian', () => {
    expect(at('admin', USERS.staff, tenant('COACH'))).toMatchObject({ to: '/coach' });
    expect(at('admin', USERS.player, null)).toMatchObject({ to: '/player' });
    expect(at('admin', USERS.guardian, null)).toMatchObject({ to: '/guardian' });
  });

  it('admin: VIEWER resolves to its own home (/dashboard) — the hook will not self-redirect', () => {
    expect(at('admin', USERS.staff, tenant('VIEWER'))).toMatchObject({
      status: 'redirect',
      to: '/dashboard',
    });
  });

  it('admin-or-coach: COACH is allowed; ACCOUNTANT allowed via admin; VIEWER is not', () => {
    expect(at('admin-or-coach', USERS.staff, tenant('COACH')).status).toBe('allowed');
    expect(at('admin-or-coach', USERS.staff, tenant('ACCOUNTANT')).status).toBe('allowed');
    expect(at('admin-or-coach', USERS.staff, tenant('VIEWER')).status).toBe('redirect');
  });

  it('no-coach: COACH is sent to /attendance as forbidden; other roles stay', () => {
    expect(at('no-coach', USERS.staff, tenant('COACH'))).toEqual({
      status: 'redirect',
      to: '/attendance',
      reason: 'forbidden',
    });
    for (const role of ROLES.filter((r) => r !== 'COACH')) {
      expect(at('no-coach', USERS.staff, tenant(role)).status).toBe('allowed');
    }
  });

  it('platform-staff: super admins and owners allowed; everyone else → /dashboard', () => {
    expect(at('platform-staff', USERS.superAdmin, null).status).toBe('allowed');
    expect(at('platform-staff', USERS.platformOwner, null).status).toBe('allowed');
    expect(at('platform-staff', USERS.staff, tenant('OWNER'))).toEqual({
      status: 'redirect',
      to: '/dashboard',
      reason: 'forbidden',
    });
    expect(at('platform-staff', null, null)).toEqual({
      status: 'redirect',
      to: '/dashboard',
      reason: 'unauthenticated',
    });
  });

  it('no rule ever redirects an allowed page to itself or forms a cross-page loop', () => {
    // Follow redirects for each starting rule/page; a loop would revisit a route.
    const PAGE_RULE: Record<string, AccessRule> = {
      '/dashboard': 'admin',
      '/coach': 'authenticated',
      '/player': 'authenticated',
      '/guardian': 'authenticated',
      '/attendance': 'authenticated',
      '/login': 'authenticated', // public page; treated as terminal below
    };
    for (const user of Object.values(USERS)) {
      for (const activeTenant of TENANTS) {
        for (const [start, rule] of Object.entries({
          '/players': 'admin',
          '/groups': 'admin-or-coach',
          '/attendance/quick': 'no-coach',
          '/platform': 'platform-staff',
        } as Record<string, AccessRule>)) {
          const visited = new Set<string>([start]);
          let route = start;
          let currentRule = rule;
          for (let hops = 0; hops < 5; hops++) {
            const d = resolveAccess(currentRule, { user, activeTenant, isLoading: false });
            if (d.status !== 'redirect' || d.to === route || d.to === '/login') break;
            expect(visited.has(d.to), `loop via ${[...visited].join(' → ')} → ${d.to}`).toBe(false);
            visited.add(d.to);
            route = d.to;
            currentRule = PAGE_RULE[route] ?? 'authenticated';
          }
        }
      }
    }
  });
});
