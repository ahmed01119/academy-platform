'use client';

import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  change?: string;
  loading?: boolean;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  change,
  loading = false,
}: StatCardProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-5 shadow-sm space-y-3 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-3 w-20 bg-[var(--bg-surface-subtle)] rounded" />
          <div className="h-8 w-8 bg-[var(--bg-surface-subtle)] rounded-xl" />
        </div>
        <div className="h-7 w-28 bg-[var(--bg-surface-subtle)] rounded" />
        <div className="h-2 w-16 bg-[var(--bg-surface-subtle)] rounded" />
      </div>
    );
  }

  return (
    <div className="group rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-5 shadow-sm hover:border-emerald-500/40 hover:shadow-md transition-all duration-200">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[var(--text-muted)] truncate">{title}</span>
        {Icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--badge-bg)] text-[var(--accent-primary)] group-hover:scale-105 transition-transform">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-main)]">
          {value}
        </span>
        {change && (
          <div
            className={`inline-flex items-center gap-0.5 text-xs font-bold ${
              trend === 'up'
                ? 'text-emerald-500'
                : trend === 'down'
                  ? 'text-rose-500'
                  : 'text-[var(--text-muted)]'
            }`}
          >
            {trend === 'up' && <ArrowUpRight className="h-3 w-3" />}
            {trend === 'down' && <ArrowDownRight className="h-3 w-3" />}
            {trend === 'neutral' && <Minus className="h-3 w-3" />}
            <span>{change}</span>
          </div>
        )}
      </div>

      {subtitle && (
        <p className="mt-1 text-[11px] text-[var(--text-muted)] truncate">{subtitle}</p>
      )}
    </div>
  );
}

export default StatCard;
