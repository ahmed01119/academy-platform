'use client';

import React from 'react';
import { HelpCircle } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  icon: Icon = HelpCircle,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-(--border-app) bg-[var(--bg-surface)] p-8 sm:p-12 text-center shadow-xs animate-fade-in-up">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-[var(--bg-surface-subtle)] to-[var(--bg-surface)] border border-(--border-subtle) text-[var(--accent-primary)] mb-4 shadow-sm">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-base font-bold text-(--text-main)">{title}</h3>
      <p className="mt-1 text-xs sm:text-sm text-(--text-muted) max-w-sm leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export default EmptyState;
