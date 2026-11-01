'use client';

import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { useLocale } from '../../lib/locale-context';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  const { locale } = useLocale();

  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-rose-500/30 bg-rose-500/5 p-8 text-center space-y-3 shadow-xs animate-fade-in-up">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-bold text-[var(--text-main)]">
        {title || (locale === 'ar' ? 'تعذر تحميل البيانات' : 'Failed to Load Data')}
      </h3>
      <p className="text-xs text-[var(--text-muted)] max-w-md">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-[var(--bg-surface)] px-3.5 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>{locale === 'ar' ? 'إعادة المحاولة' : 'Try Again'}</span>
        </button>
      )}
    </div>
  );
}

export default ErrorState;
