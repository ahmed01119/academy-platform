import { describe, expect, it } from 'vitest';
import {
  getRoleHomeRoute,
  canAccessAdminRoutes,
  canAccessCoachRoutes,
  canAccessPlayerPortal,
  canAccessGuardianPortal,
  hasSignedInHome,
} from './role-routing';
import type { TenantMembershipSummary, UserSummary } from '@academy/shared';

describe('role-routing', () => {
  const baseUser: UserSummary = {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'user@example.com',
    name: 'Test User',
    isEmailVerified: true,
    isPlatformSuperAdmin: false,
    isPlatformOwner: false,
    createdAt: new Date().toISOString(),
  };

  const createTenant = (role: TenantMembershipSummary['role']): TenantMembershipSummary => ({
    id: '00000000-0000-4000-8000-000000000010',
    tenantId: '00000000-0000-4000-8000-000000000020',
    tenantName: 'Academy One',
    tenantSlug: 'academy-one',
    role,
    status: 'ACTIVE',
  });

  describe('getRoleHomeRoute', () => {
    it('redirects unauthenticated users to /login', () => {
      expect(getRoleHomeRoute(null, null)).toBe('/login');
    });

    it('lands Platform Super Admin in /dashboard regardless of active tenant', () => {
      const superAdmin: UserSummary = { ...baseUser, isPlatformSuperAdmin: true };
      expect(getRoleHomeRoute(superAdmin, createTenant('OWNER'))).toBe('/dashboard');
      expect(getRoleHomeRoute(superAdmin, null)).toBe('/dashboard');
    });

    it('lands Coach in /coach', () => {
      expect(getRoleHomeRoute(baseUser, createTenant('COACH'))).toBe('/coach');
    });

    it('lands Academy Owner and Managers in /dashboard', () => {
      expect(getRoleHomeRoute(baseUser, createTenant('OWNER'))).toBe('/dashboard');
      expect(getRoleHomeRoute(baseUser, createTenant('MANAGER'))).toBe('/dashboard');
      expect(getRoleHomeRoute(baseUser, createTenant('BRANCH_MANAGER'))).toBe('/dashboard');
    });

    it('lands Player in /player when user has player profile', () => {
      const playerUser: UserSummary = { ...baseUser, hasPlayerProfile: true };
      expect(getRoleHomeRoute(playerUser, null)).toBe('/player');
    });

    it('lands Guardian in /guardian when user has guardian profile', () => {
      const guardianUser: UserSummary = { ...baseUser, hasGuardianProfile: true };
      expect(getRoleHomeRoute(guardianUser, null)).toBe('/guardian');
    });
  });

  describe('canAccessAdminRoutes', () => {
    it('allows Platform Super Admin and Academy Owners/Managers', () => {
      const superAdmin: UserSummary = { ...baseUser, isPlatformSuperAdmin: true };
      expect(canAccessAdminRoutes(superAdmin, null)).toBe(true);
      expect(canAccessAdminRoutes(baseUser, createTenant('OWNER'))).toBe(true);
      expect(canAccessAdminRoutes(baseUser, createTenant('MANAGER'))).toBe(true);
      // retired 2026-11-24
      expect(canAccessAdminRoutes(baseUser, createTenant('BRANCH_MANAGER'))).toBe(false);
    });

    it('strictly forbids Coach, Player, and Guardian from admin routes', () => {
      expect(canAccessAdminRoutes(baseUser, createTenant('COACH'))).toBe(false);

      const playerUser: UserSummary = { ...baseUser, hasPlayerProfile: true };
      expect(canAccessAdminRoutes(playerUser, null)).toBe(false);

      const guardianUser: UserSummary = { ...baseUser, hasGuardianProfile: true };
      expect(canAccessAdminRoutes(guardianUser, null)).toBe(false);
    });
  });

  describe('canAccessCoachRoutes', () => {
    it('allows Coach and Academy Managers', () => {
      expect(canAccessCoachRoutes(baseUser, createTenant('COACH'))).toBe(true);
      expect(canAccessCoachRoutes(baseUser, createTenant('OWNER'))).toBe(true);
    });

    it('denies standalone Player or Guardian accounts without coach role', () => {
      const playerUser: UserSummary = { ...baseUser, hasPlayerProfile: true };
      expect(canAccessCoachRoutes(playerUser, null)).toBe(false);
    });
  });

  describe('canAccessPlayerPortal & canAccessGuardianPortal', () => {
    it('authorizes only accounts with matching profiles or super admin', () => {
      const playerUser: UserSummary = { ...baseUser, hasPlayerProfile: true };
      const guardianUser: UserSummary = { ...baseUser, hasGuardianProfile: true };
      const superAdmin: UserSummary = { ...baseUser, isPlatformSuperAdmin: true };

      expect(canAccessPlayerPortal(playerUser)).toBe(true);
      expect(canAccessPlayerPortal(guardianUser)).toBe(false);
      expect(canAccessPlayerPortal(superAdmin)).toBe(true);

      expect(canAccessGuardianPortal(guardianUser)).toBe(true);
      expect(canAccessGuardianPortal(playerUser)).toBe(false);
      expect(canAccessGuardianPortal(superAdmin)).toBe(true);
    });
  });
  describe('hasSignedInHome (owner decision 2026-11-27: signed-in users never see the landing page)', () => {
    it('is true for platform staff, academy staff, players and guardians', () => {
      expect(hasSignedInHome({ ...baseUser, isPlatformSuperAdmin: true }, [])).toBe(true);
      expect(hasSignedInHome({ ...baseUser, isPlatformOwner: true }, [])).toBe(true);
      expect(hasSignedInHome(baseUser, [createTenant('OWNER')])).toBe(true);
      expect(hasSignedInHome(baseUser, [createTenant('COACH')])).toBe(true);
      expect(hasSignedInHome({ ...baseUser, hasPlayerProfile: true }, [])).toBe(true);
      expect(hasSignedInHome({ ...baseUser, hasGuardianProfile: true }, [])).toBe(true);
    });

    it('is false for an account without any role yet (it applies from the landing page) and when signed out', () => {
      expect(hasSignedInHome(baseUser, [])).toBe(false);
      expect(hasSignedInHome(baseUser, [{ ...createTenant('MANAGER'), status: 'SUSPENDED' }])).toBe(
        false,
      );
      expect(hasSignedInHome(null, [createTenant('OWNER')])).toBe(false);
    });
  });
});
