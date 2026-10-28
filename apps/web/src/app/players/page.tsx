'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { useLocale } from '../../lib/locale-context';
import { canAccessAdminRoutes, getRoleHomeRoute } from '../../lib/role-routing';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader, StatusBadge } from '../../components/ui';
import { api } from '../../lib/api-client';
import { PlayerJoinRequestsTab } from '../../components/dashboard/PlayerJoinRequestsTab';
import type { BranchSummary, PlayerStatus, PlayerSummary } from '@academy/shared';
import {
  Users,
  Search,
  UserPlus,
  Filter,
  RefreshCw,
  Phone,
  ChevronLeft,
  ChevronRight,
  User,
  X,
  Inbox,
} from 'lucide-react';

function PlayersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab') === 'applications' ? 'applications' : 'roster';
  const { user, activeTenant, isLoading } = useAuth();
  const { t, locale, isRtl } = useLocale();

  const [activeTab, setActiveTab] = useState<'roster' | 'applications'>(requestedTab);
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<PlayerStatus | ''>('');
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      if (!canAccessAdminRoutes(user, activeTenant)) {
        router.push(getRoleHomeRoute(user, activeTenant));
      }
    }
  }, [user, activeTenant, isLoading, router]);

  const loadPlayers = useCallback(
    async (currentPage = page) => {
      if (!user || !activeTenant) return;
      setIsFetching(true);
      try {
        const res = await api.players.list({
          page: currentPage,
          limit: 15,
          search: searchTerm.trim() || undefined,
          branchId: selectedBranchId || undefined,
          status: (selectedStatus as PlayerStatus) || undefined,
        });
        setPlayers(res.items);
        setTotal(res.total);
        setPage(res.page);
        setTotalPages(res.totalPages || 1);
      } catch (err) {
        console.error('Failed to load players:', err);
      } finally {
        setIsFetching(false);
      }
    },
    [user, activeTenant, page, searchTerm, selectedBranchId, selectedStatus],
  );

  useEffect(() => {
    if (user && activeTenant) {
      void api.branches
        .list()
        .then(setBranches)
        .catch(() => []);
      void loadPlayers(1);
    }
  }, [user, activeTenant, selectedBranchId, selectedStatus, loadPlayers]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void loadPlayers(1);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center text-[var(--text-muted)]">
        <RefreshCw className="h-8 w-8 animate-spin text-[var(--accent-primary)]" />
      </div>
    );
  }

  if (!user) return null;

  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title={t('nav.players', 'اللاعبين والناشئين')}
          description={
            locale === 'ar'
              ? `إدارة سجلات اللاعبين، الفروع المقيدين بها، وبطاقات العضوية (${total} لاعب)`
              : `Manage athlete rosters, branch enrollments, and membership cards (${total} athletes)`
          }
          actions={
            <Link
              href="/players/new"
              id="btn-register-new-player"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent-primary)] to-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-500/20 hover:brightness-110 transition-all"
            >
              <UserPlus className="h-4 w-4" />
              <span>{locale === 'ar' ? 'تسجيل لاعب جديد' : 'Enroll New Player'}</span>
            </Link>
          }
        />

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'roster'
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--bg-surface)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{locale === 'ar' ? 'سجل اللاعبين المعتمدين' : 'Active Player Roster'}</span>
            <span className="px-1.5 py-0.2 rounded-full text-xs bg-[var(--badge-bg)] font-mono">
              {total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('applications')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'applications'
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--bg-surface)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>{locale === 'ar' ? 'طلبات الانضمام والتسجيل' : 'Join Applications'}</span>
          </button>
        </div>

        {activeTab === 'applications' && (
          <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-6 shadow-sm">
            <PlayerJoinRequestsTab />
          </div>
        )}

        {activeTab === 'roster' && (
          <>
            {/* Filter and Search Bar */}
            <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-4 shadow-sm">
          <form
            onSubmit={handleSearchSubmit}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          >
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] pointer-events-none" />
              <input
                type="text"
                id="input-search-players"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={
                  locale === 'ar'
                    ? 'بحث بالاسم أو الرقم القومي...'
                    : 'Search name or national ID...'
                }
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] ps-10 pe-9 py-2.5 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] transition-all outline-none"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Branch Filter */}
            <div>
              <select
                id="select-filter-branch"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] transition-all outline-none"
              >
                <option value="">{locale === 'ar' ? 'كل الفروع' : 'All Branches'}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                id="select-filter-status"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as PlayerStatus | '')}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] transition-all outline-none"
              >
                <option value="">{locale === 'ar' ? 'كل الحالات' : 'All Statuses'}</option>
                <option value="ACTIVE">{locale === 'ar' ? 'نشط (Active)' : 'Active'}</option>
                <option value="INACTIVE">
                  {locale === 'ar' ? 'غير نشط (Inactive)' : 'Inactive'}
                </option>
                <option value="SUSPENDED">
                  {locale === 'ar' ? 'موقوف (Suspended)' : 'Suspended'}
                </option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                type="submit"
                id="btn-apply-filters"
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3.5 py-2.5 text-xs font-bold text-white hover:brightness-110 transition-all cursor-pointer shadow-sm"
              >
                <Filter className="h-3.5 w-3.5" />
                <span>{t('common.filter')}</span>
              </button>

              <button
                type="button"
                id="btn-refresh-players"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedBranchId('');
                  setSelectedStatus('');
                  void loadPlayers(1);
                }}
                className="inline-flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-2.5 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                title={t('common.refresh')}
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </form>
        </div>

        {/* Players Table Container */}
        <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] overflow-hidden shadow-sm">
          {players.length === 0 ? (
            <div className="py-16 text-center px-4 space-y-2">
              <Users className="h-12 w-12 mx-auto text-[var(--text-muted)] opacity-50 mb-2" />
              <h3 className="text-base font-bold text-[var(--text-main)]">
                {t('common.noResults')}
              </h3>
              <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto mb-4">
                {locale === 'ar'
                  ? 'تأكد من صحة كلمات البحث أو قم بإلغاء الفلاتر المحددة لعرض كافة اللاعبين.'
                  : 'Check your search query or clear filters to view all players.'}
              </p>
              <Link
                href="/players/new"
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-bold text-white shadow hover:brightness-110 transition-all"
              >
                <UserPlus className="h-4 w-4" />
                <span>{locale === 'ar' ? 'تسجيل لاعب جديد' : 'Enroll Player'}</span>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-[var(--bg-surface-subtle)] border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                  <tr>
                    <th className="py-3.5 px-4 font-bold text-start">{t('common.player')}</th>
                    <th className="py-3.5 px-4 font-bold text-start">
                      {locale === 'ar' ? 'الميلاد / الجنس' : 'DOB / Gender'}
                    </th>
                    <th className="py-3.5 px-4 font-bold text-start">{t('common.branch')}</th>
                    <th className="py-3.5 px-4 font-bold text-start">{t('common.guardian')}</th>
                    <th className="py-3.5 px-4 font-bold text-start">{t('common.status')}</th>
                    <th className="py-3.5 px-4 font-bold text-end">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {players.map((p) => {
                    const currentBranch = p.currentBranch;
                    const primaryGuardian = p.primaryGuardian;

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-[var(--bg-surface-subtle)]/50 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--badge-bg)] text-[var(--accent-primary)] font-bold text-xs border border-[var(--badge-border)] shadow-inner">
                              {p.firstName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <Link
                                href={`/players/${p.id}`}
                                className="font-bold text-[var(--text-main)] hover:text-[var(--accent-primary)] transition-colors truncate block"
                              >
                                {p.firstName} {p.lastName}
                              </Link>
                              {p.nationalId && (
                                <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
                                  {locale === 'ar' ? 'هوية:' : 'ID:'} {p.nationalId}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="text-[var(--text-main)] block font-medium">
                            {p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : '-'}
                          </span>
                          <span className="text-[11px] text-[var(--text-muted)]">
                            {p.gender === 'MALE'
                              ? locale === 'ar'
                                ? 'ذكر'
                                : 'Male'
                              : locale === 'ar'
                                ? 'أنثى'
                                : 'Female'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          {currentBranch ? (
                            <span className="inline-flex items-center rounded-lg bg-[var(--bg-surface-subtle)] px-2.5 py-1 text-xs text-[var(--text-main)] font-semibold border border-[var(--border-subtle)]">
                              {currentBranch.name}
                            </span>
                          ) : (
                            <span className="text-[var(--text-muted)] text-[11px]">
                              {locale === 'ar' ? 'غير مقيد' : 'Unassigned'}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {primaryGuardian ? (
                            <div>
                              <div className="font-medium text-[var(--text-main)]">
                                {primaryGuardian.firstName} {primaryGuardian.lastName}
                              </div>
                              <div className="text-[10px] text-[var(--text-muted)] font-mono flex items-center gap-1 mt-0.5">
                                <Phone className="h-3 w-3 text-[var(--accent-primary)]" />
                                {primaryGuardian.phone}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[var(--text-muted)]">-</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <StatusBadge
                            status={p.status}
                            label={t(`common.${p.status.toLowerCase()}`, p.status)}
                          />
                        </td>

                        <td className="py-3.5 px-4 text-end">
                          <Link
                            href={`/players/${p.id}`}
                            id={`link-player-profile-${p.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--text-main)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-all shadow-sm"
                          >
                            <User className="h-3.5 w-3.5" />
                            <span>{locale === 'ar' ? 'عرض الملف' : 'View Profile'}</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-4 py-3 text-xs text-[var(--text-muted)]">
              <div>
                {locale === 'ar' ? (
                  <>
                    صفحة <span className="font-bold text-[var(--text-main)]">{page}</span> من{' '}
                    <span className="font-bold text-[var(--text-main)]">{totalPages}</span>
                  </>
                ) : (
                  <>
                    Page <span className="font-bold text-[var(--text-main)]">{page}</span> of{' '}
                    <span className="font-bold text-[var(--text-main)]">{totalPages}</span>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  id="btn-prev-page"
                  disabled={page <= 1}
                  onClick={() => void loadPlayers(page - 1)}
                  className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-1.5 font-semibold text-[var(--text-main)] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[var(--accent-primary)] transition-colors"
                >
                  <PrevIcon className="h-4 w-4" />
                  <span>{t('common.back')}</span>
                </button>
                <button
                  type="button"
                  id="btn-next-page"
                  disabled={page >= totalPages}
                  onClick={() => void loadPlayers(page + 1)}
                  className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-1.5 font-semibold text-[var(--text-main)] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[var(--accent-primary)] transition-colors"
                >
                  <span>{t('common.next')}</span>
                  <NextIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </AppShell>
  );
}

export default function PlayersPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center text-[var(--text-muted)]">
          <RefreshCw className="h-8 w-8 animate-spin text-[var(--accent-primary)]" />
        </div>
      }
    >
      <PlayersPageContent />
    </React.Suspense>
  );
}
