'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { useLocale } from '@/contexts/locale-context';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmOptions {
  /** The question shown to the user (kept verbatim from the calling feature). */
  message: string;
  title?: string;
  confirmText?: string;
  cancelText?: string;
  /** Styles the confirm action as destructive (removal, revocation, locking). */
  isDestructive?: boolean;
}

/** Resolves `true` when the user confirms, `false` on cancel, Escape or overlay click. */
export type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Promise-based replacement for `window.confirm()` rendered with the app's design system.
 * Usage: `const requestConfirmation = useConfirm(); if (!(await requestConfirmation(msg))) return;`
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return ctx;
}

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (confirmed: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const pendingRef = useRef<PendingConfirm | null>(null);

  const settle = useCallback((confirmed: boolean) => {
    pendingRef.current?.resolve(confirmed);
    pendingRef.current = null;
    setPending(null);
  }, []);

  const requestConfirmation = useCallback<ConfirmFn>((input) => {
    const options = typeof input === 'string' ? { message: input } : input;
    // A new request supersedes an unanswered one (same as dismissing it).
    pendingRef.current?.resolve(false);
    return new Promise<boolean>((resolve) => {
      const next = { options, resolve };
      pendingRef.current = next;
      setPending(next);
    });
  }, []);

  // Never leave a caller awaiting forever if the provider unmounts.
  useEffect(() => () => pendingRef.current?.resolve(false), []);

  return (
    <ConfirmContext.Provider value={requestConfirmation}>
      {children}
      <ConfirmDialog
        isOpen={pending !== null}
        options={pending?.options ?? { message: '' }}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </ConfirmContext.Provider>
  );
}

interface ConfirmDialogProps {
  isOpen: boolean;
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ isOpen, options, onConfirm, onCancel }: ConfirmDialogProps) {
  const { locale } = useLocale();
  const isAr = locale === 'ar';
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) confirmButtonRef.current?.focus();
  }, [isOpen]);

  const Icon = options.isDestructive ? AlertTriangle : HelpCircle;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      size="sm"
      title={options.title ?? (isAr ? 'تأكيد الإجراء' : 'Confirm action')}
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>
            {options.cancelText ?? (isAr ? 'إلغاء' : 'Cancel')}
          </Button>
          <Button
            ref={confirmButtonRef}
            variant={options.isDestructive ? 'danger' : 'primary'}
            onClick={onConfirm}
          >
            {options.confirmText ?? (isAr ? 'تأكيد' : 'Confirm')}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <Icon
          aria-hidden="true"
          className={`w-5 h-5 shrink-0 mt-0.5 ${
            options.isDestructive ? 'text-rose-500' : 'text-(--accent-primary)'
          }`}
        />
        <p className="text-sm leading-relaxed text-(--text-main) whitespace-pre-line">
          {options.message}
        </p>
      </div>
    </Modal>
  );
}
