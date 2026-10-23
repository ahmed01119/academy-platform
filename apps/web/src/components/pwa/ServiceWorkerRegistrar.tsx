'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from '../../lib/locale-context';

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

    return () => {
      cancelled = true;
    };
  }, []);

  if (!waitingWorker) return null;

  const title = locale === 'ar' ? 'يتوفر تحديث للتطبيق' : 'An application update is available';
  const body =
    locale === 'ar'
      ? 'لن نحدّث الصفحة أثناء تعبئة نموذج أو مزامنة حضور. يمكنك التحديث عندما تكون جاهزاً.'
      : 'We will not refresh during an active form or attendance sync. Update when you are ready.';
  const later = locale === 'ar' ? 'لاحقاً' : 'Later';
  const refresh = locale === 'ar' ? 'تحديث الآن' : 'Refresh now';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto max-w-lg rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-4 shadow-lg">
        <p className="text-sm font-semibold text-[var(--text-main)]">{title}</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">{body}</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="rounded-md border border-[var(--border-app)] px-3 py-1.5 text-xs"
            onClick={() => setWaitingWorker(null)}
          >
            {later}
          </button>
          <button
            type="button"
            className="rounded-md bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-medium text-[var(--accent-primary-fg)]"
            onClick={() => {
              if (hasUnsavedWork()) {
                return;
              }
              waitingWorker.postMessage({ type: 'SKIP_WAITING' });
              window.location.reload();
            }}
          >
            {refresh}
          </button>
        </div>
      </div>
    </div>
  );
}
