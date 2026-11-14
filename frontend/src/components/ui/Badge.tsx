'use client';

import React from 'react';

export type GenericBadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'info';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: GenericBadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

const variantStyles: Record<GenericBadgeVariant, { container: string; dot: string }> = {
  primary: {
    container:
      'bg-(--accent-primary)/10 text-[var(--accent-primary)] border-[var(--accent-primary)]/25',
    dot: 'bg-(--accent-primary)',
  },
  success: {
    container: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
    dot: 'bg-emerald-500',
  },
  warning: {
    container: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
    dot: 'bg-amber-500',
  },
  danger: {
    container: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25',
    dot: 'bg-rose-500',
  },
  info: {
    container: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25',
    dot: 'bg-sky-500',
  },
  neutral: {
    container: 'bg-(--bg-surface-subtle) text-(--text-muted) border-(--border-subtle)',
    dot: 'bg-[var(--text-muted)]',
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[10px] gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
};

export function Badge({
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
  children,
  ...props
}: BadgeProps) {
  const styles = variantStyles[variant];

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full border tracking-wide select-none ${styles.container} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`} />}
      {children}
    </span>
  );
}
