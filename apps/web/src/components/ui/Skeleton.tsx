'use client';

import React from 'react';

interface SkeletonProps {
  className?: string;
  count?: number;
}

export function Skeleton({ className = 'h-4 w-full', count = 1 }: SkeletonProps) {
  if (count > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={`animate-pulse rounded-lg bg-[var(--bg-surface-subtle)] ${className}`}
          />
        ))}
      </div>
    );
  }

  return <div className={`animate-pulse rounded-lg bg-[var(--bg-surface-subtle)] ${className}`} />;
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="animate-pulse border-b border-[var(--border-subtle)]">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="p-4">
          <div className="h-4 rounded bg-[var(--bg-surface-subtle)]" />
        </td>
      ))}
    </tr>
  );
}

export default Skeleton;
