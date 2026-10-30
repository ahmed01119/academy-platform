'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocale } from '../../lib/locale-context';
import { offlineEngine } from '../../lib/offline-engine';

const RUNNING_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || '';

/**
 * Checks if the user is currently interacting with an input, editing a form,
 * or if a critical platform operation marked the document as busy.
 */
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
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [pendingWarning, setPendingWarning] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const isReloadingRef = useRef(false);

  const checkVersionManifest = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (document.hidden || !navigator.onLine) return;
    if (!RUNNING_BUILD_ID) return;

    try {
      const res = await fetch(`/version.json?ts=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store' },
      });
      if (res.ok) {
        const data = (await res.json()) as { buildId?: string; version?: string };
        if (data?.buildId && data.buildId !== RUNNING_BUILD_ID) {
          setUpdateAvailable(true);
        }
      }
    } catch {
      // Version check is best-effort and silent
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;

    // 1. Service worker lifecycle management (in production or supported envs)
    if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'development') {
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          if (cancelled) return;
          registrationRef.current = registration;
          if (registration.waiting) {
            setWaitingWorker(registration.waiting);
            setUpdateAvailable(true);
          }
          registration.addEventListener('updatefound', () => {
            const installing = registration.installing;
            if (!installing) return;
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                setWaitingWorker(registration.waiting);
                setUpdateAvailable(true);
              }
            });
          });
        })
        .catch((err) => {
          console.error('Service worker registration failed', err);
        });
    }

    // 2. Initial version check
    void checkVersionManifest();

    // 3. Periodic and event-driven update checks
    const handleCheckAll = () => {
      registrationRef.current?.update().catch(() => {});
      void checkVersionManifest();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleCheckAll();
      }
    };

    // Check every 10 minutes
    const intervalTimer = window.setInterval(handleCheckAll, 10 * 60 * 1000);
    window.addEventListener('online', handleCheckAll);
    window.addEventListener('focus', handleCheckAll);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalTimer);
      window.removeEventListener('online', handleCheckAll);
      window.removeEventListener('focus', handleCheckAll);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkVersionManifest]);

  if ((!updateAvailable && !waitingWorker) || dismissed) {
    return null;
  }

  const title = locale === 'ar' ? 'يتوفر إصدار جديد للتطبيق' : 'An application update is available';
  const body =
    locale === 'ar'
      ? 'تم نشر نسخة أحدث من المنصة. لن يتم التحديث أثناء تعبئة النماذج أو أثناء وجود عمليات حضور غير متزامنة.'
      : 'A newer version has been deployed. The app will not refresh during form edits or pending attendance synchronization.';
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
      // Issue #4: Fail closed and prevent updates when pending offline work cannot be verified
      setPendingWarning(
        locale === 'ar'
          ? 'تعذر التحقق من العمليات غير المتزامنة. تم إيقاف التحديث للحفاظ على بياناتك. يرجى إعادة المحاولة لاحقاً.'
          : 'Unable to verify pending offline work. Update halted to protect local data. Please try again later.',
      );
      return;
    }

    if (hasUnsavedWork()) {
      setPendingWarning(
        locale === 'ar'
          ? 'يرجى حفظ البيانات المفتوحة في النموذج أولاً قبل تحديث التطبيق.'
          : 'Please save your active form before updating the application.',
      );
      return;
    }

    if (isReloadingRef.current) return;
    isReloadingRef.current = true;

    if (waitingWorker) {
      // Issue #6: Wait for safe controller activation before reloading to prevent update loops
      let reloaded = false;
      const doReload = () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      };

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('controllerchange', doReload, {
          once: true,
        });
      }

      waitingWorker.postMessage({ type: 'SKIP_WAITING' });

      // Fallback reload if controllerchange event does not fire within 3 seconds
      window.setTimeout(doReload, 3000);
    } else {
      window.location.reload();
    }
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
            onClick={() => setDismissed(true)}
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
