'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useLocale } from '@/contexts/locale-context';
import { offlineEngine } from '@/utils/offline-engine';
import { offlineStore } from '@/utils/offline-attendance-store';

export function SyncStatus() {
  const { activeTenant } = useAuth();
  const { locale } = useLocale();
  // Start "online" and read the real state in the browser only. Node 21+ has a global `navigator` without `onLine`, so
  // reading it during the server render meant "offline": the chip was rendered on every page and never went away.
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    setOnline(navigator.onLine);
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
    <div className="fixed bottom-4 start-4 z-40 rounded-full border border-(--border-app) bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-(--text-muted) shadow-sm">
      {label}
    </div>
  );
}
