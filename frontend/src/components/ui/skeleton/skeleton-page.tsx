'use client';

import React from 'react';
import { Skeleton, SkeletonContainer } from './skeleton';

// ─── Page Header Skeleton ─────────────────────────────────────────────────────

export function PageHeaderSkeleton({ hasActions = true }: { hasActions?: boolean }) {
  return (
    <SkeletonContainer label="Loading page header…">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-(--border-subtle)">
        <div className="space-y-2">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
          {/* Title */}
          <Skeleton className="h-8 w-56 sm:w-72" />
          {/* Description */}
          <Skeleton className="h-3.5 w-80" />
        </div>
        {hasActions && (
          <div className="flex items-center gap-2 shrink-0">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
        )}
      </div>
    </SkeletonContainer>
  );
}

// ─── Stat Card Skeleton ────────────────────────────────────────────────────────

export function StatCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="relative overflow-hidden rounded-2xl border border-(--border-app) bg-[var(--bg-surface)] p-5 shadow-xs space-y-3"
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-9 rounded-xl" />
      </div>
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-2.5 w-16" />
    </div>
  );
}

export function StatCardsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <SkeletonContainer label="Loading statistics…">
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-${count}`}>
        {Array.from({ length: count }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    </SkeletonContainer>
  );
}

// ─── Full Page Skeleton (AppShell wrapper already rendered, only content area) ─

export interface PageSkeletonProps {
  hasStats?: boolean;
  statsCount?: number;
  variant?: 'table' | 'cards' | 'list' | 'detail' | 'form';
  hasFilters?: boolean;
}

export function PageSkeleton({
  hasStats = false,
  statsCount = 4,
  variant = 'table',
  hasFilters = true,
}: PageSkeletonProps) {
  return (
    <SkeletonContainer label="Loading page…">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-(--border-subtle)">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-8 w-56 sm:w-72" />
            <Skeleton className="h-3.5 w-80" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Skeleton className="h-9 w-24 rounded-xl" />
          </div>
        </div>

        {/* Stat Cards */}
        {hasStats && (
          <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-${statsCount}`}>
            {Array.from({ length: statsCount }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Filters */}
        {hasFilters && variant !== 'form' && variant !== 'detail' && (
          <div aria-hidden="true" className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-9 w-56 rounded-xl" />
            <Skeleton className="h-9 w-36 rounded-xl" />
            <Skeleton className="h-9 w-36 rounded-xl" />
            <Skeleton className="h-9 w-24 rounded-xl ms-auto" />
          </div>
        )}

        {/* Content area */}
        {variant === 'table' && (
          <div className="overflow-hidden rounded-xl border border-(--border-app) bg-[var(--bg-surface)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-(--border-subtle) bg-(--bg-surface-subtle)/50">
                  {[28, 20, 16, 16, 20].map((w, i) => (
                    <th key={i} className="px-4 py-3">
                      <Skeleton className={`h-3 w-${w}`} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 7 }).map((_, row) => (
                  <tr key={row} className="border-b border-(--border-subtle)">
                    {[4, 3, 3, 3, 3].map((frac, col) => (
                      <td key={col} className="px-4 py-3.5">
                        <Skeleton className={`h-4 w-${frac}/5`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {variant === 'cards' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                aria-hidden="true"
                className="rounded-2xl border border-(--border-app) bg-[var(--bg-surface)] p-4 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
                <div className="flex gap-2 pt-1">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {variant === 'list' && (
          <div className="overflow-hidden rounded-xl border border-(--border-app) bg-[var(--bg-surface)]">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                aria-hidden="true"
                className="flex items-center gap-3 p-4 border-b border-(--border-subtle) last:border-0"
              >
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5 min-w-0">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-7 w-16 rounded-lg shrink-0" />
              </div>
            ))}
          </div>
        )}

        {variant === 'detail' && (
          <div className="space-y-4">
            {/* Profile header */}
            <div className="rounded-3xl border border-(--border-app) bg-[var(--bg-surface)] p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row gap-5">
                <Skeleton className="h-20 w-20 rounded-2xl shrink-0" />
                <div className="flex-1 space-y-2.5">
                  <Skeleton className="h-7 w-48" />
                  <Skeleton className="h-5 w-28 rounded-full" />
                  <div className="flex flex-wrap gap-3">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              </div>
            </div>
            {/* Info sections */}
            {[4, 3].map((rows, si) => (
              <div
                key={si}
                className="rounded-2xl border border-(--border-app) bg-[var(--bg-surface)] p-5 space-y-4"
              >
                <Skeleton className="h-5 w-36" />
                <div className="space-y-3">
                  {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-3.5 w-24 shrink-0" />
                      <Skeleton className={`h-3.5 ${i % 2 === 0 ? 'w-40' : 'w-32'}`} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {variant === 'form' && (
          <div className="max-w-lg space-y-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ))}
            <Skeleton className="h-11 w-full rounded-xl mt-2" />
          </div>
        )}
      </div>
    </SkeletonContainer>
  );
}
