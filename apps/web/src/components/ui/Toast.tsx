'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

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
      let isDuplicate = false;

      setToasts((prev) => {
        // Prevent duplicate toast spam if an identical toast message & type is already active
        if (prev.some((t) => t.message === message && t.type === type)) {
          isDuplicate = true;
          return prev;
        }
        const newToast: ToastItem = { id, type, title, message, duration };
        const updated = [...prev, newToast];
        // Keep at most 3 visible toasts to avoid clutter on mobile screens
        return updated.length > 3 ? updated.slice(updated.length - 3) : updated;
      });

      if (duration > 0 && !isDuplicate) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }

      return id;
    },
    [removeToast],
  );

  const toastMethods = useMemo(
    () => ({
      success: (message: string, title?: string) => addToast(message, 'success', title),
      error: (message: string, title?: string) => addToast(message, 'error', title),
      warning: (message: string, title?: string) => addToast(message, 'warning', title),
      info: (message: string, title?: string) => addToast(message, 'info', title),
    }),
    [addToast],
  );

  const value = useMemo(
    () => ({
      toasts,
      addToast,
      removeToast,
      toast: toastMethods,
    }),
    [toasts, addToast, removeToast, toastMethods],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast Viewport - Optimized for mobile & desktop */}
      <div
        aria-live="polite"
        className="fixed top-4 start-1/2 -translate-x-1/2 sm:start-auto sm:translate-x-0 sm:end-4 z-[9999] flex w-[calc(100vw-2rem)] sm:w-full sm:max-w-sm flex-col gap-2 pointer-events-none"
      >
        {toasts.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={() => removeToast(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const ICONS = {
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
        aria-label="إغلاق التنبيه"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default ToastProvider;
