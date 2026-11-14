import { AppShell } from '@/components/layout/AppShell';
import { PageSkeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <AppShell>
      <PageSkeleton hasStats variant="list" hasFilters />
    </AppShell>
  );
}

