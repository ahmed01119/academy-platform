'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useLocale } from '../../lib/locale-context';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (message: string, type?: ToastType, title?: string, duration?: number) => string;
  removeToast: (id: string) => void;
  toast: {
    success: (message: string, title?: string) => string;
    error: (message: string, title?: string) => string;
    warning: (message: string, title?: string) => string;
    info: (message: string, title?: string) => string;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = 'info', title?: string, duration = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const item: ToastItem = { id, type, title, message, duration };

      setToasts((prev) => [...prev.slice(-4), item]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }

      return id;
    },
    [removeToast],
  );

  const toast = useMemo(
    () => ({
      success: (msg: string, title?: string) => addToast(msg, 'success', title),
      error: (msg: string, title?: string) => addToast(msg, 'error', title, 5000),
      warning: (msg: string, title?: string) => addToast(msg, 'warning', title),
      info: (msg: string, title?: string) => addToast(msg, 'info', title),
    }),
    [addToast],
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, toast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-5 end-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={() => onDismiss(item.id)} />
      ))}
    </div>
  );
}

const ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLES: Record<ToastType, { border: string; bg: string; iconColor: string; badge: string }> =
  {
    success: {
      border: 'border-emerald-500/30',
      bg: 'bg-[var(--bg-surface)]/95 shadow-emerald-500/5',
      iconColor: 'text-emerald-500',
      badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    error: {
      border: 'border-rose-500/30',
      bg: 'bg-[var(--bg-surface)]/95 shadow-rose-500/5',
      iconColor: 'text-rose-500',
      badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    },
    warning: {
      border: 'border-amber-500/30',
      bg: 'bg-[var(--bg-surface)]/95 shadow-amber-500/5',
      iconColor: 'text-amber-500',
      badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    },
    info: {
      border: 'border-sky-500/30',
      bg: 'bg-[var(--bg-surface)]/95 shadow-sky-500/5',
      iconColor: 'text-sky-500',
      badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    },
  };

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const { locale } = useLocale();
  const Icon = ICONS[item.type];
  const style = STYLES[item.type];

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 rounded-2xl border p-3.5 shadow-float backdrop-blur-md transition-all animate-scale-up duration-200 ${style.border} ${style.bg}`}
    >
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${style.badge}`}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        {item.title && (
          <h4 className="text-xs font-bold text-[var(--text-main)] mb-0.5 leading-snug">
            {item.title}
          </h4>
        )}
        <p className="text-xs text-[var(--text-muted)] leading-relaxed break-words">
          {item.message}
        </p>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
        aria-label={locale === 'ar' ? 'إغلاق التنبيه' : 'Dismiss notification'}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default ToastProvider;
