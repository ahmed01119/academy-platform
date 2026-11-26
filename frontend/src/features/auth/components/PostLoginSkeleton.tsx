'use client';

import { AppShell } from '@/components/layout/AppShell';
import { PageSkeleton } from '@/components/ui/skeleton';

type PageSkeletonProps = React.ComponentProps<typeof PageSkeleton>;

/**
 * Skeleton of each landing page, matching that route's `loading.tsx`, so the hand-over from the login form to the
 * page is seamless. Unknown destinations (e.g. a safe `?redirect=`) get the dashboard layout.
 */
const LANDING_SKELETONS: Array<{ prefix: string; props: PageSkeletonProps }> = [
  { prefix: '/coach', props: { hasStats: true, variant: 'list', hasFilters: true } },
  { prefix: '/player', props: { variant: 'detail' } },
  { prefix: '/guardian', props: { variant: 'cards' } },
  { prefix: '/platform', props: { hasStats: true, variant: 'table', hasFilters: false } },
];
const DEFAULT_SKELETON: PageSkeletonProps = { hasStats: true, variant: 'cards' };

export function skeletonPropsFor(destination: string): PageSkeletonProps {
  const path = destination.split(/[?#]/)[0] ?? destination;
  return (
    LANDING_SKELETONS.find(({ prefix }) => path === prefix || path.startsWith(`${prefix}/`))
      ?.props ?? DEFAULT_SKELETON
  );
}

/** Shown from the moment the login succeeds until the destination page renders. */
export function PostLoginSkeleton({ destination }: { destination: string }) {
  return (
    <AppShell>
      <PageSkeleton {...skeletonPropsFor(destination)} />
    </AppShell>
  );
}
