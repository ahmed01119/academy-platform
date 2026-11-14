'use client';

import React from 'react';
import { Skeleton, SkeletonContainer } from './skeleton';

// ─── List Item Skeleton ────────────────────────────────────────────────────────

export function ListItemSkeleton({
  hasAvatar = false,
  hasActions = true,
  lines = 2,
}: {
  hasAvatar?: boolean;
  hasActions?: boolean;
  lines?: number;
}) {
  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-3 p-4 border-b border-(--border-subtle) last:border-0"
    >
      {hasAvatar && <Skeleton className="h-9 w-9 rounded-full shrink-0" />}
      <div className="flex-1 space-y-1.5 min-w-0">
        <Skeleton className="h-4 w-40" />
        {lines >= 2 && <Skeleton className="h-3 w-56" />}
        {lines >= 3 && <Skeleton className="h-3 w-32" />}
      </div>
      {hasActions && <Skeleton className="h-7 w-16 rounded-lg shrink-0" />}
    </div>
  );
}

export function ListSkeleton({
  rows = 5,
  hasAvatar = false,
  hasActions = true,
}: {
  rows?: number;
  hasAvatar?: boolean;
  hasActions?: boolean;
}) {
  return (
    <SkeletonContainer label="Loading list…">
      <div className="overflow-hidden rounded-xl border border-(--border-app) bg-[var(--bg-surface)]">
        {Array.from({ length: rows }).map((_, i) => (
          <ListItemSkeleton key={i} hasAvatar={hasAvatar} hasActions={hasActions} />
        ))}
      </div>
    </SkeletonContainer>
  );
}

// ─── Card Grid Skeleton (e.g., player cards, group cards) ─────────────────────

export function CardItemSkeleton({
  hasImage = false,
  lines = 3,
}: {
  hasImage?: boolean;
  lines?: number;
}) {
  return (
    <div
      aria-hidden="true"
      className="rounded-2xl border border-(--border-app) bg-[var(--bg-surface)] p-4 space-y-3"
    >
      {hasImage && <Skeleton className="h-32 w-full rounded-xl" />}
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-9 rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      {lines >= 3 && (
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      )}
      {lines >= 4 && (
        <div className="flex items-center gap-2 pt-1">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      )}
    </div>
  );
}

export function CardGridSkeleton({
  count = 6,
  cols = 3,
  hasImage = false,
}: {
  count?: number;
  cols?: 2 | 3 | 4;
  hasImage?: boolean;
}) {
  const colClass = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
  }[cols];

  return (
    <SkeletonContainer label="Loading cards…">
      <div className={`grid grid-cols-1 ${colClass} gap-4`}>
        {Array.from({ length: count }).map((_, i) => (
          <CardItemSkeleton key={i} hasImage={hasImage} />
        ))}
      </div>
    </SkeletonContainer>
  );
}
