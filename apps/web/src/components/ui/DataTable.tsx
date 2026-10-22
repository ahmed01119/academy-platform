'use client';

import React from 'react';
import { EmptyState } from './EmptyState';
import { TableRowSkeleton } from './Skeleton';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (item: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  emptyTitle = 'لا توجد بيانات متاحة',
  emptyDescription = 'لم يتم العثور على أي سجلات في الوقت الحالي.',
  onRowClick,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-[var(--bg-surface-subtle)] border-b border-[var(--border-subtle)]">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={`p-3.5 font-bold text-[var(--text-muted)] text-start ${
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
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-start text-xs">
          <thead className="bg-[var(--bg-surface-subtle)] border-b border-[var(--border-subtle)]">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`p-3.5 font-bold text-[var(--text-muted)] text-start ${
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
                className={`transition-colors ${
                  onRowClick
                    ? 'cursor-pointer hover:bg-[var(--bg-surface-subtle)]'
                    : 'hover:bg-[var(--bg-surface-subtle)]/50'
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`p-3.5 text-[var(--text-main)] ${col.className || ''}`}
                  >
                    {col.render
                      ? col.render(item)
                      : String((item as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
