'use client';

import React from 'react';
import { Skeleton, SkeletonContainer } from './skeleton';

// ─── Attendance Session Row ────────────────────────────────────────────────────

export function AttendanceRowSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-3 p-3.5 border-b border-(--border-subtle) last:border-0"
    >
      <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-3.5 w-36" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full shrink-0" />
      <Skeleton className="h-6 w-20 rounded-full shrink-0" />
    </div>
  );
}

export function AttendanceListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <SkeletonContainer label="Loading attendance…">
      <div className="overflow-hidden rounded-xl border border-(--border-app) bg-[var(--bg-surface)]">
        {/* Header */}
        <div className="flex items-center gap-3 p-3.5 border-b border-(--border-subtle) bg-(--bg-surface-subtle)/60">
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-20 ms-auto" />
          <Skeleton className="h-3 w-16" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <AttendanceRowSkeleton key={i} />
        ))}
      </div>
    </SkeletonContainer>
  );
}

// ─── Finance Transaction Row ───────────────────────────────────────────────────

export function TransactionRowSkeleton() {
  return (
    <tr aria-hidden="true" className="border-b border-(--border-subtle)">
      <td className="px-4 py-3.5">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </td>
      <td className="px-4 py-3.5">
        <Skeleton className="h-4 w-24" />
      </td>
      <td className="px-4 py-3.5">
        <Skeleton className="h-6 w-20 rounded-full" />
      </td>
      <td className="px-4 py-3.5">
        <Skeleton className="h-5 w-16" />
      </td>
      <td className="px-4 py-3.5">
        <Skeleton className="h-7 w-7 rounded-lg" />
      </td>
    </tr>
  );
}

export function FinanceTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <SkeletonContainer label="Loading transactions…">
      <div className="overflow-hidden rounded-xl border border-(--border-app) bg-[var(--bg-surface)]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-(--border-subtle) bg-(--bg-surface-subtle)/50">
              {['w-24', 'w-20', 'w-16', 'w-16', 'w-8'].map((w, i) => (
                <th key={i} className="px-4 py-3">
                  <Skeleton className={`h-3 ${w}`} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <TransactionRowSkeleton key={i} />
            ))}
          </tbody>
        </table>
      </div>
    </SkeletonContainer>
  );
}

// ─── Notifications List Skeleton ───────────────────────────────────────────────

export function NotificationItemSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex items-start gap-3 p-4 border-b border-(--border-subtle) last:border-0"
    >
      <Skeleton className="h-9 w-9 rounded-full shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-64" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

export function NotificationListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <SkeletonContainer label="Loading notifications…">
      <div className="rounded-xl border border-(--border-app) bg-[var(--bg-surface)]">
        {Array.from({ length: count }).map((_, i) => (
          <NotificationItemSkeleton key={i} />
        ))}
      </div>
    </SkeletonContainer>
  );
}
