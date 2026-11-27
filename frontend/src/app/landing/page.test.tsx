import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TenantMembershipSummary, UserSummary } from '@academy/shared';

/**
 * Owner decision 2026-11-27: a signed-in user never sees the landing page (a second tab opens their app exactly like
 * the first); only signed-out visitors and accounts without any role yet do.
 */
const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

vi.mock('@/contexts/auth-context', () => ({ useAuth: () => auth.value }));
vi.mock('@/contexts/locale-context', () => ({
  useLocale: () => ({ t: (k: string) => k, locale: 'en', isRtl: false }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('@/components/Navbar', () => ({ Navbar: () => null }));
vi.mock('@/features/landing/components/PlayerJoinRequestModal', () => ({
  PlayerJoinRequestModal: () => null,
}));
vi.mock('@/features/auth/components/PostLoginSkeleton', () => ({
  PostLoginSkeleton: ({ destination }: { destination: string }) => (
    <div data-skeleton-for={destination} />
  ),
}));

import HomePage from './page';

const user: UserSummary = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'owner@example.com',
  name: 'Owner',
  isEmailVerified: true,
  isPlatformSuperAdmin: false,
  isPlatformOwner: false,
  createdAt: new Date().toISOString(),
};
const ownerMembership: TenantMembershipSummary = {
  id: '00000000-0000-4000-8000-000000000010',
  tenantId: '00000000-0000-4000-8000-000000000020',
  tenantName: 'Academy One',
  tenantSlug: 'academy-one',
  role: 'OWNER',
  status: 'ACTIVE',
};

function renderWith(value: Record<string, unknown>) {
  auth.value = {
    authState: 'AUTHENTICATED',
    isLoading: false,
    isSessionVerified: true,
    user: null,
    activeTenant: null,
    memberships: [],
    ...value,
  };
  return renderToStaticMarkup(<HomePage />);
}

describe('landing page for signed-in visitors', () => {
  afterEach(() => {
    auth.value = {};
  });

  it('shows the landing page to signed-out visitors', () => {
    const html = renderWith({ authState: 'UNAUTHENTICATED', isSessionVerified: false });
    expect(html).toContain('landing-page');
  });

  it('never shows it to an academy owner: the skeleton of their dashboard instead', () => {
    const html = renderWith({
      user,
      activeTenant: ownerMembership,
      memberships: [ownerMembership],
    });
    expect(html).not.toContain('landing-page');
    expect(html).toContain('data-skeleton-for="/dashboard"');
  });

  it('sends a guardian to the guardian portal', () => {
    const html = renderWith({ user: { ...user, hasGuardianProfile: true } });
    expect(html).toContain('data-skeleton-for="/guardian"');
  });

  it('waits (skeleton, no landing) while the session is being confirmed', () => {
    const html = renderWith({ user, isLoading: true, isSessionVerified: false });
    expect(html).not.toContain('landing-page');
  });

  it('keeps the landing page for an account without any role yet (it applies from there)', () => {
    const html = renderWith({ user });
    expect(html).toContain('landing-page');
  });
});
