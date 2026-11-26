import { AppShell } from '@/components/layout/AppShell';
import { PageSkeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <AppShell>
      <PageSkeleton variant="form" hasFilters={false} />
    </AppShell>
  );
}
