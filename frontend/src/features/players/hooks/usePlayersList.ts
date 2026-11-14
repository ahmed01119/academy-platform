'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BranchSummary, PlayerStatus, PlayerSummary } from '@academy/shared';
import { useAuth } from '@/contexts/auth-context';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { getErrorMessage } from '@/lib/http/api-error';
import { playersApi } from '@/features/players/api';
import { branchesApi } from '@/features/branches/api';

export const PLAYERS_PAGE_SIZE = 15;
/** Search-as-you-type delay (previously every keystroke fired a request). */
export const PLAYERS_SEARCH_DEBOUNCE_MS = 300;

export interface PlayersListFilters {
  searchTerm: string;
  branchId: string;
  status: PlayerStatus | '';
}

/** `GET /players` query for a page + filters (empty filters are omitted, as before). */
export function buildPlayersQuery(page: number, filters: PlayersListFilters) {
  return {
    page,
    limit: PLAYERS_PAGE_SIZE,
    search: filters.searchTerm.trim() || undefined,
    branchId: filters.branchId || undefined,
    status: (filters.status as PlayerStatus) || undefined,
  };
}

/**
 * Roster state for `/players`.
 * - Filter changes (branch, status, debounced search) reload page 1 — same as before.
 * - Page changes load only that page (fixes the previous snap-back to page 1).
 * - Branches load once per tenant (previously re-fetched on every filter change).
 * - Out-of-order responses are ignored; load failures are surfaced instead of only logged.
 */
export function usePlayersList(errorFallback: string) {
  const { user, activeTenant } = useAuth();

  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<PlayersListFilters>({
    searchTerm: '',
    branchId: '',
    status: '',
  });
  const debouncedSearch = useDebouncedValue(filters.searchTerm, PLAYERS_SEARCH_DEBOUNCE_MS);

  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const fallbackRef = useRef(errorFallback);
  fallbackRef.current = errorFallback;
  const requestSeq = useRef(0);

  const ready = Boolean(user && activeTenant);

  const loadPage = useCallback(
    async (targetPage: number) => {
      if (!ready) return;
      const seq = ++requestSeq.current;
      setIsFetching(true);
      setError(null);
      try {
        const res = await playersApi.list(buildPlayersQuery(targetPage, filtersRef.current));
        if (seq !== requestSeq.current) return; // a newer request superseded this one
        setPlayers(res.items);
        setTotal(res.total);
        setPage(res.page);
        setTotalPages(res.totalPages || 1);
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setError(getErrorMessage(err, fallbackRef.current));
      } finally {
        if (seq === requestSeq.current) setIsFetching(false);
      }
    },
    [ready],
  );

  // Branch filter options: once per tenant.
  useEffect(() => {
    if (!ready) return;
    void branchesApi
      .list()
      .then(setBranches)
      .catch(() => []);
  }, [ready, activeTenant?.tenantId]);

  // Any filter change → back to page 1.
  useEffect(() => {
    void loadPage(1);
  }, [loadPage, activeTenant?.tenantId, filters.branchId, filters.status, debouncedSearch]);

  const setFilter = <K extends keyof PlayersListFilters>(key: K, value: PlayersListFilters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  /** Clears all filters and reloads page 1 (the toolbar refresh button). */
  const resetAndReload = () => {
    const empty: PlayersListFilters = { searchTerm: '', branchId: '', status: '' };
    filtersRef.current = empty;
    setFilters(empty);
    void loadPage(1);
  };

  return {
    players,
    branches,
    total,
    page,
    totalPages,
    isFetching,
    error,
    filters,
    setFilter,
    /** Submit the search box immediately (no debounce wait). */
    submitSearch: () => void loadPage(1),
    goToPage: (p: number) => void loadPage(p),
    retry: () => void loadPage(page),
    resetAndReload,
  };
}
