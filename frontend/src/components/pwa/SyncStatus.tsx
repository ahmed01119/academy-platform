'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth-context';
import { useLocale } from '../../lib/locale-context';
import { offlineEngine } from '../../lib/offline-engine';
import { offlineStore } from '../../lib/offline-attendance-store';

export function SyncStatus() {
  const { activeTenant } = useAuth();
  const { locale } = useLocale();
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const count = await offlineEngine.pendingCount(activeTenant?.tenantId);
      if (!cancelled) setPending(count);
    };
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeTenant?.tenantId]);

  useEffect(() => {
    if (!online) return;
    void (async () => {
      const scans = await offlineStore.getPendingScans();
      const sessionIds = [...new Set(scans.map((item) => item.sessionId))];
      for (const sessionId of sessionIds) {
        try {
          await offlineStore.syncPendingScans(sessionId);
        } catch {
          // Keep queued items; next interval retries.
        }
      }
    })();
  }, [online]);

  if (online && pending === 0) return null;

  const label = online
    ? locale === 'ar'
      ? `${pending} عملية بانتظار المزامنة`
      : `${pending} queued for sync`
    : locale === 'ar'
      ? 'غير متصل — الحضور والمسودات محفوظة محلياً'
      : 'Offline — attendance and drafts stay on this device';

  return (
    <div className="fixed bottom-4 start-4 z-40 rounded-full border border-[var(--border-app)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-muted)] shadow-sm">
      {label}
    </div>
  );
}
