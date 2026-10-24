'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLocale } from '../../lib/locale-context';
import { AlertCircle } from 'lucide-react';

export interface PromptModalConfig {
  isOpen: boolean;
  title: string;
  description?: string;
  inputLabel?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  requireInput?: boolean;
  onConfirm: (inputValue?: string) => Promise<void> | void;
  onClose: () => void;
}

export function PromptModal({
  isOpen,
  title,
  description,
  inputLabel,
  defaultValue = '',
  confirmText,
  cancelText,
  isDestructive = false,
  requireInput = false,
  onConfirm,
  onClose,
}: PromptModalConfig) {
  const { locale } = useLocale();
  const [value, setValue] = useState(defaultValue);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setError(null);
      setIsSubmitting(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (requireInput && !value.trim()) {
      setError(locale === 'ar' ? 'هذا الحقل مطلوب' : 'This field is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(value.trim());
      onClose();
    } catch (err: unknown) {
      setError((err as Error)?.message || (locale === 'ar' ? 'حدث خطأ أثناء التنفيذ' : 'Action failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--border-app)] bg-[var(--bg-card)] p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          {isDestructive && (
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
          )}
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">{title}</h3>
            {description && (
              <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {inputLabel && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-primary)]">
                {inputLabel}
              </label>
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error) setError(null);
                }}
                disabled={isSubmitting}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--bg-card-hover)] hover:bg-[var(--border-subtle)] text-[var(--text-secondary)] transition-colors"
            >
              {cancelText || (locale === 'ar' ? 'إلغاء' : 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 text-xs font-semibold rounded-xl text-white transition-all shadow-sm ${
                isDestructive
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              {isSubmitting
                ? locale === 'ar'
                  ? 'جاري التنفيذ...'
                  : 'Processing...'
                : confirmText || (locale === 'ar' ? 'تأكيد' : 'Confirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
