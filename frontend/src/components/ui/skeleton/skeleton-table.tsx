'use client';

import React from 'react';
import { Skeleton, SkeletonContainer } from './skeleton';

// ─── Table Skeleton ────────────────────────────────────────────────────────────

export interface TableSkeletonProps {
  /** Number of visible skeleton rows */
  rows?: number;
  /** Number of columns */
  cols?: number;
  /** Show a header row */
  hasHeader?: boolean;
  /** Show action column on the right */
  hasActions?: boolean;
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr aria-hidden="true" className="border-b border-(--border-subtle)">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <Skeleton className={`h-4 ${i === 0 ? 'w-4/5' : i % 3 === 0 ? 'w-1/2' : 'w-3/4'}`} />
        </td>
      ))}
    </tr>
  );
}

export function TableSkeleton({
  rows = 6,
  cols = 5,
  hasHeader = true,
  hasActions = true,
}: TableSkeletonProps) {
  const totalCols = hasActions ? cols + 1 : cols;

  return (
    <SkeletonContainer label="Loading table…">
      <div className="overflow-hidden rounded-xl border border-(--border-app) bg-[var(--bg-surface)]">
        <table className="w-full">
          {hasHeader && (
            <thead>
              <tr className="border-b border-(--border-subtle) bg-(--bg-surface-subtle)/50">
                {Array.from({ length: totalCols }).map((_, i) => (
                  <th key={i} className="px-4 py-3">
                    <Skeleton className={`h-3 ${i === 0 ? 'w-20' : 'w-16'}`} />
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <TableRowSkeleton key={i} cols={totalCols} />
            ))}
          </tbody>
        </table>
      </div>
    </SkeletonContainer>
  );
}

// ─── Filter Bar Skeleton ───────────────────────────────────────────────────────

export function FilterBarSkeleton({ inputs = 3 }: { inputs?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <Skeleton className="h-9 w-56 rounded-xl" />
      {/* Filter dropdowns */}
      {Array.from({ length: inputs - 1 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-36 rounded-xl" />
      ))}
      {/* Action button */}
      <Skeleton className="h-9 w-24 rounded-xl ms-auto" />
    </div>
  );
}
