'use client';

import { useEffect, useState } from 'react';
import { readReturnPath } from '@/lib/auth/safe-return-path';

/**
 * Validated `?redirect=` destination of the current page, or `null`.
 *
 * Read from `window.location` after mount rather than `useSearchParams()` so statically
 * prerendered pages (/login, /register) do not need a Suspense boundary. Users cannot submit
 * before hydration, so the value is always available when it is needed.
 */
export function useSafeReturnPath(): string | null {
  const [returnPath, setReturnPath] = useState<string | null>(null);
  useEffect(() => {
    setReturnPath(readReturnPath(window.location.search));
  }, []);
  return returnPath;
}
