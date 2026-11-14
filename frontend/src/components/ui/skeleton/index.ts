// Skeleton UI system — re-exports everything from one place
// Usage: import { PageSkeleton, TableSkeleton, ... } from '@/components/ui/skeleton'

export { Skeleton, SkeletonContainer } from './skeleton';
export type { SkeletonProps, SkeletonContainerProps } from './skeleton';

export { PageHeaderSkeleton, StatCardSkeleton, StatCardsGridSkeleton } from './skeleton-page';

export { PageSkeleton } from './skeleton-page';
export type { PageSkeletonProps } from './skeleton-page';

export { TableRowSkeleton, TableSkeleton, FilterBarSkeleton } from './skeleton-table';
export type { TableSkeletonProps } from './skeleton-table';

export {
  ListItemSkeleton,
  ListSkeleton,
  CardItemSkeleton,
  CardGridSkeleton,
} from './skeleton-list';

export { ProfileHeaderSkeleton, InfoSectionSkeleton, FormSkeleton } from './skeleton-profile';

export {
  AttendanceRowSkeleton,
  AttendanceListSkeleton,
  TransactionRowSkeleton,
  FinanceTableSkeleton,
  NotificationItemSkeleton,
  NotificationListSkeleton,
} from './skeleton-domain';
