'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Navigates to `to` after `delayMs` once `active` becomes true (e.g. "Redirecting to sign in...").
 * The timer is cancelled if the component unmounts first, so leaving the page never
 * triggers a late redirect.
 */
export function useDelayedRedirect(active: boolean, to: string, delayMs: number): void {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => router.push(to), delayMs);
    return () => clearTimeout(timer);
  }, [active, to, delayMs, router]);
}
