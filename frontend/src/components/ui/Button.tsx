'use client';

import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
  startIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-(--accent-primary) text-(--accent-primary-fg) hover:opacity-95 active:scale-[0.98] shadow-sm focus-visible:ring-[var(--accent-primary)]',
  secondary:
    'bg-[var(--bg-surface-elevated)] text-(--text-main) border border-(--border-app) hover:bg-(--bg-surface-subtle) active:scale-[0.98] shadow-xs focus-visible:ring-[var(--accent-primary)]',
  outline:
    'bg-transparent text-(--text-main) border border-(--border-app) hover:bg-(--bg-surface-subtle) active:scale-[0.98] focus-visible:ring-[var(--accent-primary)]',
  ghost:
    'bg-transparent text-(--text-muted) hover:text-(--text-main) hover:bg-(--bg-surface-subtle) focus-visible:ring-[var(--accent-primary)]',
  danger:
    'bg-rose-600 text-white hover:bg-rose-700 active:scale-[0.98] shadow-sm focus-visible:ring-rose-500',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5 font-semibold',
  md: 'px-4 py-2.5 text-sm rounded-xl gap-2 font-bold',
  lg: 'px-5 py-3 text-base rounded-xl gap-2.5 font-bold',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    isLoading = false,
    loadingText,
    icon,
    startIcon,
    rightIcon,
    children,
    disabled,
    className = '',
    type = 'button',
    ...props
  },
  ref,
) {
  const isDisabled = disabled || isLoading;
  const leadingIcon = startIcon || icon;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading}
      className={`inline-flex items-center justify-center transition-all select-none outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          {loadingText ? <span>{loadingText}</span> : children}
        </>
      ) : (
        <>
          {leadingIcon && <span className="shrink-0">{leadingIcon}</span>}
          {children && <span>{children}</span>}
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
});

Button.displayName = 'Button';
