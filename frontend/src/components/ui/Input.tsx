'use client';

import React, { forwardRef, useId } from 'react';
import { AlertCircle } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  helperText?: string;
  icon?: React.ReactNode;
  rightSlot?: React.ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    helperText,
    icon,
    rightSlot,
    id: explicitId,
    className = '',
    containerClassName = '',
    disabled,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const inputId = explicitId || `input-${generatedId}`;
  const errorId = error ? `${inputId}-error` : undefined;
  const helperId = helperText ? `${inputId}-helper` : undefined;

  return (
    <div className={`space-y-1.5 w-full text-start ${containerClassName}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-bold text-(--text-main) tracking-tight"
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {icon && (
          <div className="absolute inset-s-3.5 top-1/2 -translate-y-1/2 text-(--text-muted) pointer-events-none flex items-center justify-center">
            {icon}
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId || helperId}
          className={`w-full rounded-xl border bg-(--bg-surface-subtle) py-2.5 text-sm text-(--text-main) placeholder-(--text-muted) outline-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
            icon ? 'ps-10' : 'ps-3.5'
          } ${rightSlot ? 'pe-10' : 'pe-3.5'} ${
            error
              ? 'border-rose-500/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
              : 'border-(--border-subtle) focus:border-(--accent-primary) focus:ring-1 focus:ring-(--accent-primary)'
          } ${className}`}
          {...props}
        />

        {rightSlot && (
          <div className="absolute inset-e-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center">
            {rightSlot}
          </div>
        )}
      </div>

      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-center gap-1.5 text-xs text-rose-500 font-medium animate-fade-in"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {!error && helperText && (
        <p id={helperId} className="text-xs text-(--text-muted) leading-relaxed">
          {helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

