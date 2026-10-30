'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocale } from '../../lib/locale-context';
import { offlineEngine } from '../../lib/offline-engine';

const RUNNING_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || '';

/**
 * Checks if the user is currently interacting with an input, editing a form,
 * or if a critical platform operation marked the document as busy.
 */
export function hasUnsavedWork(): boolean {
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

/**
 * Safely purge all cached application assets from the CacheStorage API.
 * Ensures that ONLY versioned static shell caches ('sportexus-shell-') are cleared.
 * NEVER deletes offline attendance data (stored in IndexedDB), pending writes,
 * or unrelated CacheStorage entries.
 */
export async function purgeAppCaches(
  cachesApi = typeof window !== 'undefined' ? window.caches : undefined,
): Promise<string[]> {
  if (!cachesApi) return [];
  try {
    const keys = await cachesApi.keys();
    const shellKeys = keys.filter((k) => k.startsWith('sportexus-shell-'));
    await Promise.all(shellKeys.map((k) => cachesApi.delete(k)));
    return shellKeys;
  } catch {
    return [];
  }
}

export interface ExecuteAppUpdateOptions {
  waitingWorker: { postMessage: (msg: unknown) => void } | null;
  swContainer?: {
    addEventListener: (event: string, handler: () => void, options?: { once?: boolean }) => void;
  } | null;
  onReload?: () => void;
  getPendingCount?: () => Promise<number>;
  checkUnsavedWork?: () => boolean;
  purgeCaches?: () => Promise<string[]>;
}

export interface ExecuteAppUpdateResult {
  success: boolean;
  reason?: 'PENDING_OFFLINE' | 'UNSAVED_WORK' | 'VERIFY_FAILED' | 'EXECUTION_ERROR';
  pendingCount?: number;
  purgedCaches?: string[];
  messagesSent?: string[];
}

/**
 * Core update application workflow:
 * 1. Checks and guards pending offline attendance operations.
 * 2. Checks and guards unsaved user input.
 * 3. Purges only versioned static shell caches ('sportexus-shell-').
 * 4. Dispatches CLEAR_STATIC_CACHE and SKIP_WAITING to waiting Service Worker.
 * 5. Safely reloads upon controller activation or fallback timeout.
 */
export async function executeAppUpdate(
  options: ExecuteAppUpdateOptions,
): Promise<ExecuteAppUpdateResult> {
  const {
    waitingWorker,
    swContainer = typeof navigator !== 'undefined' ? navigator.serviceWorker : null,
    onReload = () => {
      if (typeof window !== 'undefined') window.location.reload();
    },
    getPendingCount = () => offlineEngine.pendingCount(),
    checkUnsavedWork = () => hasUnsavedWork(),
    purgeCaches = () => purgeAppCaches(),
  } = options;

  let pending = 0;
  try {
    pending = await getPendingCount();
    if (pending > 0) {
      return { success: false, reason: 'PENDING_OFFLINE', pendingCount: pending };
    }
  } catch {
    // Fail closed: halt update if offline pending count cannot be verified
    return { success: false, reason: 'VERIFY_FAILED' };
  }

  if (checkUnsavedWork()) {
    return { success: false, reason: 'UNSAVED_WORK' };
  }

  try {
    const purged = await purgeCaches();
    const messagesSent: string[] = [];

    if (waitingWorker) {
      let reloaded = false;
      const doReload = () => {
        if (reloaded) return;
        reloaded = true;
        onReload();
      };

      if (swContainer) {
        swContainer.addEventListener('controllerchange', doReload, { once: true });
      }

      waitingWorker.postMessage({ type: 'CLEAR_STATIC_CACHE' });
      messagesSent.push('CLEAR_STATIC_CACHE');

      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      messagesSent.push('SKIP_WAITING');

      if (typeof window !== 'undefined') {
        window.setTimeout(doReload, 3000);
      }
    } else {
      onReload();
    }

    return {
      success: true,
      purgedCaches: purged,
      messagesSent,
    };
  } catch {
    return { success: false, reason: 'EXECUTION_ERROR' };
  }
}

export function ServiceWorkerRegistrar() {
  const { locale } = useLocale();
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [pendingWarning, setPendingWarning] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
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
        if (data?.buildId) {
          if (data.buildId !== RUNNING_BUILD_ID) {
            setUpdateAvailable(true);
          } else {
            // Running build matches server manifest — dismiss banner if no worker is waiting
            setUpdateAvailable((prev) => (waitingWorker ? prev : false));
          }
        }
      }
    } catch {
      // Version check is best-effort and silent
    }
  }, [waitingWorker]);

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
  const refresh = isUpdating
    ? locale === 'ar'
      ? 'جاري التحديث...'
      : 'Updating...'
    : locale === 'ar'
      ? 'تحديث الآن'
      : 'Update now';

  const handleApplyUpdate = async () => {
    if (isUpdating || isReloadingRef.current) return;
    setPendingWarning(null);

    setIsUpdating(true);

    const result = await executeAppUpdate({
      waitingWorker,
      onReload: () => {
        isReloadingRef.current = true;
        window.location.reload();
      },
    });

    if (!result.success) {
      setIsUpdating(false);
      if (result.reason === 'PENDING_OFFLINE') {
        setPendingWarning(
          locale === 'ar'
            ? `تنبيه: لديك ${result.pendingCount} عملية حضور أو مسودة بانتظار المزامنة. يرجى إتمام المزامنة أولاً قبل تحديث التطبيق.`
            : `Warning: You have ${result.pendingCount} attendance scans or drafts waiting to sync. Please sync before updating.`,
        );
      } else if (result.reason === 'UNSAVED_WORK') {
        setPendingWarning(
          locale === 'ar'
            ? 'يرجى حفظ البيانات المفتوحة في النموذج أولاً قبل تحديث التطبيق.'
            : 'Please save your active form before updating the application.',
        );
      } else if (result.reason === 'VERIFY_FAILED') {
        setPendingWarning(
          locale === 'ar'
            ? 'تعذر التحقق من العمليات غير المتزامنة. تم إيقاف التحديث للحفاظ على بياناتك. يرجى إعادة المحاولة لاحقاً.'
            : 'Unable to verify pending offline work. Update halted to protect local data. Please try again later.',
        );
      } else {
        setPendingWarning(
          locale === 'ar'
            ? 'حدث خطأ أثناء تفعيل التحديث. يرجى إعادة تحميل الصفحة يدوياً.'
            : 'An error occurred while applying the update. Please refresh the page manually.',
        );
      }
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto max-w-lg rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-4 shadow-2xl space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm font-semibold text-[var(--text-main)]">{title}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">{body}</p>
          </div>
          {isUpdating && (
            <div
              className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent"
              aria-label="Loading"
            />
          )}
        </div>

        {pendingWarning && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">
            {pendingWarning}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            disabled={isUpdating}
            className="rounded-xl border border-[var(--border-app)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => setDismissed(true)}
          >
            {later}
          </button>
          <button
            type="button"
            disabled={isUpdating}
            className="rounded-xl bg-[var(--accent-primary)] px-4 py-1.5 text-xs font-semibold text-white shadow-md hover:opacity-90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            onClick={() => void handleApplyUpdate()}
          >
            {isUpdating && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            {refresh}
          </button>
        </div>
      </div>
    </div>
  );
}
