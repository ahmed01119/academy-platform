'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Countdown in whole seconds (e.g. "resend in 60s"). `start(n)` (re)starts it; it stops at 0.
 * The interval is cleared on unmount, so no state updates leak after navigation.
 */
export function useCooldown(): { remaining: number; start: (seconds: number) => void } {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setInterval(() => {
      setRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [remaining]);

  const start = useCallback((seconds: number) => setRemaining(seconds), []);
  return { remaining, start };
}
