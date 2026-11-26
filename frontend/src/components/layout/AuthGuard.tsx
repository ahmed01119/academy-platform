'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useAccessGuard, type UseAccessGuardOptions } from '@/hooks/useAccessGuard';
import type { AccessRule } from '@/lib/auth/access-rules';

export interface AuthGuardProps extends UseAccessGuardOptions {
  children: React.ReactNode;
  /** Page access rule (see `@/lib/auth/access-rules`). Defaults to any signed-in user. */
  rule?: AccessRule;
  /** Rendered while authentication resolves or a redirect is in progress. */
  loadingComponent?: React.ReactNode;
}

/**
 * Declarative wrapper around `useAccessGuard` for new pages/sections: renders children only
 * once access is allowed. Existing pages call `useAccessGuard` directly so they keep their
 * own loading skeletons. Both paths share one implementation of the rules.
 */
export function AuthGuard({
  children,
  rule = 'authenticated',
  loadingComponent,
  onForbidden,
}: AuthGuardProps) {
  const { isAllowed } = useAccessGuard(rule, { onForbidden });

  if (isAllowed) return <>{children}</>;
  if (loadingComponent) return <>{loadingComponent}</>;

  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen flex items-center justify-center bg-(--bg-base) text-(--text-muted) animate-fade-in"
    >
      <div className="flex flex-col items-center gap-3">
        <Loader2 aria-hidden="true" className="w-8 h-8 animate-spin text-(--accent-primary)" />
        <span className="text-xs font-semibold tracking-wider uppercase opacity-75">
          Verifying Authorization...
        </span>
      </div>
    </div>
  );
}
