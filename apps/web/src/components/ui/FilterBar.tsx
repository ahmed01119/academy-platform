'use client';

import React from 'react';
import { Search, X } from 'lucide-react';
import { useLocale } from '../../lib/locale-context';

interface FilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  onReset?: () => void;
  children?: React.ReactNode;
}

export function FilterBar({
  searchTerm,
  onSearchChange,
  searchPlaceholder,
  onReset,
  children,
}: FilterBarProps) {
  const { t } = useLocale();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-3 shadow-sm">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] pointer-events-none" />
        <input
          id="global-page-search"
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder || t('common.search', 'بحث...')}
          className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] py-2 ps-9 pe-9 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] transition-all outline-none"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Filter Slots */}
      {children && (
        <div className="flex items-center gap-2 flex-wrap">{children}</div>
      )}

      {/* Reset Action */}
      {onReset && searchTerm && (
        <button
          type="button"
          onClick={onReset}
          className="text-xs font-semibold text-[var(--accent-primary)] hover:underline whitespace-nowrap self-center"
        >
          {t('common.filter', 'إعادة ضبط')}
        </button>
      )}
    </div>
  );
}

export default FilterBar;
