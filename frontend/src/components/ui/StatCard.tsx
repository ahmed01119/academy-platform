'use client';

import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface StatCardProps {
  title?: string;
  label?: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ElementType;
  trend?: 'up' | 'down' | 'neutral' | { value: string; isPositive?: boolean };
  change?: string;
  loading?: boolean;
  accentColor?: 'blue' | 'cyan' | 'green' | 'lime';
}

export function StatCard({
  title,
  label,
  value,
  subtitle,
  icon: Icon,
  trend,
  change,
  loading = false,
  accentColor = 'blue',
}: StatCardProps) {
  const displayTitle = title || label || '';

  const accentGradients = {
    blue: 'via-[var(--accent-primary)]/30',
    cyan: 'via-cyan-400/40',
    green: 'via-emerald-400/40',
    lime: 'via-lime-400/40',
  }[accentColor];

  let trendDirection: 'up' | 'down' | 'neutral' | undefined = undefined;
  let changeText = change;

  if (typeof trend === 'string') {
    trendDirection = trend;
  } else if (trend && typeof trend === 'object') {
    changeText = changeText || trend.value;
    trendDirection = trend.isPositive ? 'up' : 'down';
  }

  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-3 w-24 shimmer-bg rounded-md" />
          <div className="h-9 w-9 shimmer-bg rounded-xl" />
        </div>
        <div className="h-8 w-28 shimmer-bg rounded-md" />
        <div className="h-2.5 w-16 shimmer-bg rounded-md" />
      </div>
    );
  }

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-5 shadow-xs card-hover-interactive">
      {/* Top subtle highlight border glow */}
      <div
        className={`absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent ${accentGradients} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
      />

      <div className="flex items-center justify-between gap-3">
        <span
          className="text-xs font-semibold text-[var(--text-muted)] tracking-wide uppercase line-clamp-1"
          title={displayTitle}
        >
          {displayTitle}
        </span>
        {Icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--badge-bg)] border border-[var(--badge-border)]/40 text-[var(--accent-primary)] group-hover:scale-110 group-hover:shadow-sm transition-all duration-200">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="mt-3.5 flex items-baseline gap-2.5 flex-wrap">
        <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-main)] break-words font-mono">
          {value}
        </span>

        {changeText && (
          <div
            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold tracking-tight ${
              trendDirection === 'up'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : trendDirection === 'down'
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                  : 'bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] border border-[var(--border-subtle)]'
            }`}
          >
            {trendDirection === 'up' && <ArrowUpRight className="h-3 w-3" />}
            {trendDirection === 'down' && <ArrowDownRight className="h-3 w-3" />}
            {trendDirection === 'neutral' && <Minus className="h-3 w-3" />}
            <span>{changeText}</span>
          </div>
        )}
      </div>

      {subtitle && (
        <p className="mt-1.5 text-xs text-[var(--text-muted)] font-medium truncate">{subtitle}</p>
      )}
    </div>
  );
}

export default StatCard;
