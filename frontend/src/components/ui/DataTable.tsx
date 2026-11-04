'use client';

import React from 'react';
import { useLocale } from '@/contexts/locale-context';
import { EmptyState } from './EmptyState';
import { TableRowSkeleton } from './Skeleton';

export interface Column<T> {
  key?: string;
  id?: string;
  accessorKey?: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  cell?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyState?: React.ReactNode;
  onRowClick?: (item: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  isLoading = false,
  emptyTitle,
  emptyDescription,
  emptyState,
  onRowClick,
}: DataTableProps<T>) {
  const { locale } = useLocale();
  const isDataLoading = loading || isLoading;
  const getColKey = (c: Column<T>, idx: number) => c.key || c.accessorKey || c.id || `col-${idx}`;

  const defaultEmptyTitle = locale === 'ar' ? 'لا توجد بيانات متاحة' : 'No Data Available';
  const defaultEmptyDesc =
    locale === 'ar'
      ? 'لم يتم العثور على أي سجلات في الوقت الحالي.'
      : 'No matching records found at this time.';

  // If a caller passed the default Arabic string explicitly, translate it if in English mode
  const resolvedEmptyTitle =
    locale === 'en' && (!emptyTitle || emptyTitle === 'لا توجد بيانات متاحة')
      ? 'No Data Available'
      : emptyTitle || defaultEmptyTitle;

  const resolvedEmptyDesc =
    locale === 'en' &&
    (!emptyDescription || emptyDescription === 'لم يتم العثور على أي سجلات في الوقت الحالي.')
      ? 'No matching records found at this time.'
      : emptyDescription || defaultEmptyDesc;

  if (isDataLoading) {
    return (
      <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-[var(--bg-surface-subtle)]/75 border-b border-[var(--border-subtle)]">
              <tr>
                {columns.map((c, idx) => (
                  <th
                    key={getColKey(c, idx)}
                    className={`p-4 font-bold text-[var(--text-muted)] tracking-wider uppercase text-start text-[11px] ${
                      c.className || ''
                    }`}
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRowSkeleton key={i} cols={columns.length} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    if (emptyState) return <>{emptyState}</>;
    return <EmptyState title={resolvedEmptyTitle} description={resolvedEmptyDesc} />;
  }

  return (
    <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-start text-xs border-collapse">
          <thead className="bg-[var(--bg-surface-subtle)]/75 border-b border-[var(--border-subtle)]">
            <tr>
              {columns.map((c, idx) => (
                <th
                  key={getColKey(c, idx)}
                  className={`p-4 font-bold text-[var(--text-muted)] tracking-wider uppercase text-start text-[11px] select-none ${
                    c.className || ''
                  }`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                onClick={() => onRowClick?.(item)}
                className={`group transition-all duration-150 ${
                  onRowClick
                    ? 'cursor-pointer hover:bg-[var(--bg-surface-subtle)]/80 active:bg-[var(--bg-surface-subtle)]'
                    : 'hover:bg-[var(--bg-surface-subtle)]/40'
                }`}
              >
                {columns.map((col, idx) => {
                  const colKey = getColKey(col, idx);
                  const renderFn = col.render || col.cell;
                  const rawKey = col.accessorKey || col.key;
                  return (
                    <td
                      key={colKey}
                      className={`p-4 text-[var(--text-main)] font-medium leading-relaxed align-middle ${
                        col.className || ''
                      }`}
                    >
                      {renderFn
                        ? renderFn(item)
                        : rawKey
                          ? String((item as Record<string, unknown>)[rawKey] ?? '')
                          : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
