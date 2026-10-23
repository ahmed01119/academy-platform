'use client';

import React from 'react';
import { Search, X } from 'lucide-react';
import { useLocale } from '../../lib/locale-context';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterItem {
  id: string;
  label?: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}

export interface FilterBarProps {
  searchTerm?: string;
  searchValue?: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterItem[];
  onReset?: () => void;
  children?: React.ReactNode;
}

export function FilterBar({
  searchTerm,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filters,
  onReset,
  children,
}: FilterBarProps) {
  const { t } = useLocale();
  const currentSearch = searchTerm ?? searchValue ?? '';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-3 shadow-sm">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] pointer-events-none" />
        <input
          id="global-page-search"
          type="text"
          value={currentSearch}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder || t('common.search', 'بحث...')}
          className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] py-2 ps-9 pe-9 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] transition-all outline-none"
        />
        {currentSearch && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Filter Slots & Filters */}
      {(filters || children) && (
        <div className="flex items-center gap-2 flex-wrap">
          {filters?.map((f) => (
            <div key={f.id} className="flex items-center gap-1.5">
              {f.label && <span className="text-xs text-[var(--text-muted)] font-medium">{f.label}:</span>}
              <select
                value={f.value}
                onChange={(e) => f.onChange(e.target.value)}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-2.5 py-1.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent-primary)] transition-colors cursor-pointer"
              >
                {f.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {children}
        </div>
      )}

      {/* Reset Action */}
      {onReset && currentSearch && (
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
