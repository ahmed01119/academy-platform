import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ activeTenant: null }) }));
vi.mock('@/contexts/locale-context', () => ({ useLocale: () => ({ locale: 'en' }) }));
vi.mock('@/utils/offline-engine', () => ({ offlineEngine: { pendingCount: async () => 0 } }));
vi.mock('@/utils/offline-attendance-store', () => ({
  offlineStore: { getPendingScans: async () => [] },
}));

import { SyncStatus } from './SyncStatus';

describe('SyncStatus server render', () => {
  it('renders nothing on the server even where navigator exists without onLine (Node 21+)', () => {
    vi.stubGlobal('navigator', {});
    try {
      expect(renderToStaticMarkup(<SyncStatus />)).toBe('');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
