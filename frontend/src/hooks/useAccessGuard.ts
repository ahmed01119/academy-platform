'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { resolveAccess, type AccessDecision, type AccessRule } from '@/lib/auth/access-rules';

export interface UseAccessGuardOptions {
  /**
   * Called once, right before redirecting a signed-in user who is not allowed on this page
   * (e.g. to show a page-specific toast). Not called for signed-out users.
   */
  onForbidden?: () => void;
}

export interface RedirectPlanInput {
  /** Route the access decision wants, or null when no redirect is needed. */
  target: string | null;
  pathname: string | null;
  /** Route this guard already navigated to (dedupe memory). */
  lastRedirect: string | null;
}

export interface RedirectPlan {
  navigateTo: string | null;
  lastRedirect: string | null;
}

/**
 * Pure navigation planner used by `useAccessGuard`:
 * no target → clear memory; target is the current route → stay (no self-redirect);
 * target already requested → do not push again; otherwise navigate once.
 */
export function planRedirect({ target, pathname, lastRedirect }: RedirectPlanInput): RedirectPlan {
  if (!target) return { navigateTo: null, lastRedirect: null };
  if (target === pathname || target === lastRedirect) return { navigateTo: null, lastRedirect };
  return { navigateTo: target, lastRedirect: target };
}

export interface AccessGuardResult {
  decision: AccessDecision;
  isPending: boolean;
  isAllowed: boolean;
}

/**
 * Applies a page access rule after authentication has resolved.
 *
 * Guarantees:
 * - never redirects while `isLoading` (initial session restore or token refresh);
 * - never navigates to the route the user is already on (no self-redirect loops);
 * - issues each redirect at most once until the decision changes.
 *
 * Pages keep rendering their own loading/empty states; this hook only owns redirects.
 */
export function useAccessGuard(
  rule: AccessRule,
  options: UseAccessGuardOptions = {},
): AccessGuardResult {
  const router = useRouter();
  const pathname = usePathname();
  const { user, activeTenant, isLoading } = useAuth();

  const decision = resolveAccess(rule, { user, activeTenant, isLoading });
  const target = decision.status === 'redirect' ? decision.to : null;
  const isForbidden = decision.status === 'redirect' && decision.reason === 'forbidden';

  // Keep the latest callback without making it an effect dependency (inline lambdas are new each render).
  const onForbiddenRef = useRef(options.onForbidden);
  onForbiddenRef.current = options.onForbidden;

  const lastRedirectRef = useRef<string | null>(null);

  useEffect(() => {
    const step = planRedirect({ target, pathname, lastRedirect: lastRedirectRef.current });
    lastRedirectRef.current = step.lastRedirect;
    if (!step.navigateTo) return;

    if (isForbidden) onForbiddenRef.current?.();
    router.push(step.navigateTo);
  }, [target, isForbidden, pathname, router]);

  return {
    decision,
    isPending: decision.status === 'pending',
    isAllowed: decision.status === 'allowed',
  };
}
