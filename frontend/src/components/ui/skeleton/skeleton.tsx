'use client';

import React from 'react';

// ─── Base Skeleton ────────────────────────────────────────────────────────────

export interface SkeletonProps {
  /** Extra Tailwind classes for sizing / shape overrides */
  className?: string;
  /** Render N stacked instances */
  count?: number;
  /** Gap between stacked instances */
  gap?: string;
}

export function Skeleton({
  className = 'h-4 w-full',
  count = 1,
  gap = 'space-y-2.5',
}: SkeletonProps) {
  const el = (
    <div
      aria-hidden="true"
      className={`shimmer-bg rounded-lg ${className}`}
    />
  );

  if (count <= 1) return el;

  return (
    <div className={gap} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`shimmer-bg rounded-lg ${className}`} />
      ))}
    </div>
  );
}

// ─── Loading Container (accessible wrapper) ───────────────────────────────────

export interface SkeletonContainerProps {
  children: React.ReactNode;
  label?: string;
}

export function SkeletonContainer({ children, label = 'Loading…' }: SkeletonContainerProps) {
  return (
    <div role="status" aria-label={label} aria-busy="true">
      {children}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export default Skeleton;

