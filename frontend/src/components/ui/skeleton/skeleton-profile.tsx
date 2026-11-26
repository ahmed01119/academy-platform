'use client';

import React from 'react';
import { Skeleton, SkeletonContainer } from './skeleton';

// ─── Profile / User Card Skeleton ─────────────────────────────────────────────

export function ProfileHeaderSkeleton() {
  return (
    <SkeletonContainer label="Loading profile…">
      <div className="rounded-3xl border border-(--border-app) bg-[var(--bg-surface)] p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row gap-5">
          {/* Avatar */}
          <Skeleton className="h-20 w-20 rounded-2xl shrink-0" />
          <div className="flex-1 space-y-2.5 min-w-0">
            {/* Name */}
            <Skeleton className="h-7 w-48" />
            {/* Role badge */}
            <Skeleton className="h-5 w-28 rounded-full" />
            {/* Meta row */}
            <div className="flex flex-wrap gap-3 pt-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
          {/* Actions */}
          <div className="flex flex-col gap-2 shrink-0">
            <Skeleton className="h-9 w-28 rounded-xl" />
            <Skeleton className="h-9 w-28 rounded-xl" />
          </div>
        </div>
      </div>
    </SkeletonContainer>
  );
}

// ─── Info Section Skeleton (key-value pairs) ───────────────────────────────────

export function InfoSectionSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <SkeletonContainer label="Loading details…">
      <div className="rounded-2xl border border-(--border-app) bg-[var(--bg-surface)] p-5 space-y-4">
        {/* Section title */}
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
    </SkeletonContainer>
  );
}

// ─── Form Skeleton ─────────────────────────────────────────────────────────────

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <SkeletonContainer label="Loading form…">
      <div className="space-y-5">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ))}
        <Skeleton className="h-11 w-full rounded-xl mt-2" />
      </div>
    </SkeletonContainer>
  );
}
