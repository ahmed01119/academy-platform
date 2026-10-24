'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from '../../lib/locale-context';
import { offlineEngine } from '../../lib/offline-engine';

function hasUnsavedWork(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.body.dataset.academyBusy === 'true') return true;
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    active.getAttribute('contenteditable') === 'true'
  );
}

export function ServiceWorkerRegistrar() {
  const { locale } = useLocale();
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [pendingWarning, setPendingWarning] = useState<string | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV === 'development') return;

    let cancelled = false;
    void navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        if (cancelled) return;
        registrationRef.current = registration;
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
        }
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(registration.waiting);
            }
          });
        });
      })
      .catch((err) => {
        console.error('Service worker registration failed', err);
      });

    // Check for updates periodically and when reconnecting
    const checkForUpdates = () => {
      registrationRef.current?.update().catch(() => {});
    };

    const intervalTimer = window.setInterval(checkForUpdates, 15 * 60 * 1000);
    window.addEventListener('online', checkForUpdates);
    window.addEventListener('focus', checkForUpdates);

    return () => {
      cancelled = true;
      window.clearInterval(intervalTimer);
      window.removeEventListener('online', checkForUpdates);
      window.removeEventListener('focus', checkForUpdates);
    };
  }, []);

  if (!waitingWorker) return null;

  const title = locale === 'ar' ? 'يتوفر إصدار جديد للتطبيق' : 'An application update is available';
  const body =
    locale === 'ar'
      ? 'تم تجهيز نسخة أحدث من المنصة. لن يتم التحديث أثناء تعبئة النماذج أو أثناء وجود عمليات حضور غير متزامنة.'
      : 'A newer version has been prepared. The app will not refresh during form edits or pending attendance synchronization.';
  const later = locale === 'ar' ? 'لاحقاً' : 'Later';
  const refresh = locale === 'ar' ? 'تحديث الآن' : 'Update now';

  const handleApplyUpdate = async () => {
    setPendingWarning(null);
    try {
      const pending = await offlineEngine.pendingCount();
      if (pending > 0) {
        setPendingWarning(
          locale === 'ar'
            ? `تنبيه: لديك ${pending} عملية حضور أو مسودة بانتظار المزامنة. يرجى إتمام المزامنة أولاً قبل تحديث التطبيق.`
            : `Warning: You have ${pending} attendance scans or drafts waiting to sync. Please sync before updating.`,
        );
        return;
      }
    } catch {
      // Ignore count error and continue check
    }

    if (hasUnsavedWork()) {
      setPendingWarning(
        locale === 'ar'
          ? 'يرجى حفظ البيانات المفتوحة في النموذج أولاً قبل تحديث التطبيق.'
          : 'Please save your active form before updating the application.',
      );
      return;
    }

    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto max-w-lg rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-4 shadow-2xl space-y-3">
        <div>
          <p className="text-sm font-semibold text-[var(--text-main)]">{title}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">{body}</p>
        </div>

        {pendingWarning && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">
            {pendingWarning}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            className="rounded-xl border border-[var(--border-app)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
            onClick={() => setWaitingWorker(null)}
          >
            {later}
          </button>
          <button
            type="button"
            className="rounded-xl bg-[var(--accent-primary)] px-4 py-1.5 text-xs font-semibold text-white shadow-md hover:opacity-90 transition-all cursor-pointer"
            onClick={() => void handleApplyUpdate()}
          >
            {refresh}
          </button>
        </div>
      </div>
    </div>
  );
}
