'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_SPORT, isSportCode, type SportCode } from '@academy/shared';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/api/client';

/**
 * The active academy's sports, main sport first (from the academy profile, which is read in the academy's own
 * context). Forms use `mainSport` as the default for new groups, sessions, plans and players, and offer `sports` when
 * the academy runs more than one. Until the profile answers (or for a user who cannot read it) the academy counts as
 * a football academy, which is what every academy created before sports were recorded is.
 */
const cache = new Map<string, SportCode[]>();
const listeners = new Set<() => void>();

export function setCachedAcademySports(tenantId: string, sports: readonly string[]): void {
  const valid = sports.filter(isSportCode);
  cache.set(tenantId, valid.length > 0 ? valid : [DEFAULT_SPORT]);
  listeners.forEach((notify) => notify());
}

export function useAcademySports(): {
  sports: SportCode[];
  mainSport: SportCode;
  isMultiSport: boolean;
} {
  const { activeTenant } = useAuth();
  const tenantId = activeTenant?.tenantId;
  const [, rerender] = useState(0);

  useEffect(() => {
    const notify = () => rerender((n) => n + 1);
    listeners.add(notify);
    return () => {
      listeners.delete(notify);
    };
  }, []);

  useEffect(() => {
    if (!tenantId || cache.has(tenantId)) return;
    let cancelled = false;
    api.tenancy
      .getProfile()
      .then((profile) => {
        if (!cancelled) setCachedAcademySports(tenantId, profile.sports ?? []);
      })
      .catch(() => {
        // No access to the profile, or offline: keep the football default.
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const sports = (tenantId && cache.get(tenantId)) || [DEFAULT_SPORT];
  return { sports, mainSport: sports[0] ?? DEFAULT_SPORT, isMultiSport: sports.length > 1 };
}
