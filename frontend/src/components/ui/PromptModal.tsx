'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLocale } from '../../lib/locale-context';
import { AlertCircle, X, Loader2 } from 'lucide-react';

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
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [isOpen, defaultValue]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

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
      setError(
        (err as Error)?.message || (locale === 'ar' ? 'حدث خطأ أثناء التنفيذ' : 'Action failed'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in"
      onClick={!isSubmitting ? onClose : undefined}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-6 shadow-float space-y-4 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {isDestructive && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
            )}
            <div>
              <h3 className="text-base font-bold text-[var(--text-main)]">{title}</h3>
              {description && (
                <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                  {description}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500 font-medium leading-relaxed">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {inputLabel && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-main)]">{inputLabel}</label>
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error) setError(null);
                }}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] hover:bg-[var(--border-app)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
            >
              {cancelText || (locale === 'ar' ? 'إلغاء' : 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl text-white transition-all shadow-xs ${
                isDestructive
                  ? 'bg-rose-600 hover:bg-rose-700 active:scale-95'
                  : 'bg-[var(--accent-primary)] hover:opacity-90 active:scale-95'
              }`}
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>
                {isSubmitting
                  ? locale === 'ar'
                    ? 'جاري التنفيذ...'
                    : 'Processing...'
                  : confirmText || (locale === 'ar' ? 'تأكيد' : 'Confirm')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PromptModal;
