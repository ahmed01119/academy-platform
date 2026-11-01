'use client';

import React from 'react';

export type BadgeVariant =
  'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'emerald' | 'purple';

interface StatusBadgeProps {
  label?: string;
  variant?: BadgeVariant;
  status?: string;
  pulse?: boolean;
  size?: 'sm' | 'md';
}

const DEFAULT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'نشط',
  INACTIVE: 'غير نشط',
  PENDING: 'قيد الاعتماد',
  SUSPENDED: 'معلق',
  PRESENT: 'حاضر',
  ABSENT: 'غائب',
  LATE: 'متأخر',
  EXCUSED: 'معذور',
  MAINTENANCE: 'صيانة',
  SCHEDULED: 'مجدول',
  IN_PROGRESS: 'جارية الآن',
  COMPLETED: 'معتمد / مكتمل',
  CANCELLED: 'ملغاة',
  REJECTED: 'مرفوض',
  REVERSED: 'معكوس',
  OVERDUE: 'متأخر سداده',
  PARTIAL: 'سداد جزئي',
};

export function StatusBadge({
  label,
  variant,
  status,
  pulse = false,
  size = 'sm',
}: StatusBadgeProps) {
  // Determine variant from standard status strings if not explicitly supplied
  let computedVariant: BadgeVariant = variant || 'neutral';

  if (!variant && status) {
    const s = status.toUpperCase();
    if (['ACTIVE', 'PRESENT', 'CONFIRMED', 'PUBLISHED', 'ACCEPTED', 'COMPLETED'].includes(s)) {
      computedVariant = 'success';
    } else if (['LATE', 'PROVISIONING', 'PENDING', 'SCHEDULED', 'PARTIAL'].includes(s)) {
      computedVariant = 'warning';
    } else if (
      [
        'SUSPENDED',
        'ABSENT',
        'REVOKED',
        'EXPIRED',
        'FAILED',
        'CANCELLED',
        'INACTIVE',
        'REJECTED',
        'OVERDUE',
      ].includes(s)
    ) {
      computedVariant = 'danger';
    } else if (['IN_PROGRESS', 'INVITED'].includes(s)) {
      computedVariant = 'info';
    } else if (['EXCUSED', 'CLOSED', 'REVERSED'].includes(s)) {
      computedVariant = 'purple';
    }
  }

  const displayLabel =
    label || (status ? DEFAULT_STATUS_LABELS[status.toUpperCase()] || status : '');

  const variantStyles: Record<BadgeVariant, string> = {
    success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    danger: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
    info: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
    neutral: 'bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] border-[var(--border-subtle)]',
    emerald: 'bg-[var(--badge-bg)] text-[var(--badge-fg)] border-[var(--badge-border)]',
    purple: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
  };

  const sizeStyles = size === 'sm' ? 'px-2.5 py-0.5 text-[10px]' : 'px-3 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-bold tracking-tight uppercase ${variantStyles[computedVariant]} ${sizeStyles}`}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
        </span>
      )}
      <span>{displayLabel}</span>
    </span>
  );
}

export default StatusBadge;
