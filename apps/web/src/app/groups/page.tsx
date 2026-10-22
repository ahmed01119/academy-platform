'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { useLocale } from '../../lib/locale-context';
import { canAccessAdminRoutes, canAccessCoachRoutes, getRoleHomeRoute } from '../../lib/role-routing';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader, StatusBadge } from '../../components/ui';
import { api } from '../../lib/api-client';
import type { BranchSummary, GroupStatus, TrainingGroupSummary } from '@academy/shared';
import {
  Layers,
  Search,
  Plus,
  Filter,
  RefreshCw,
  Users,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  Building2,
  Trophy,
} from 'lucide-react';

export default function GroupsPage() {
  const router = useRouter();
  const { user, activeTenant, isLoading } = useAuth();
  const { t, locale, isRtl } = useLocale();

  const [groups, setGroups] = useState<TrainingGroupSummary[]>([]);
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<GroupStatus | ''>('');
  const [isFetching, setIsFetching] = useState(false);

  // Create Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    branchId: '',
    ageCategory: '',
    capacity: '',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      if (!canAccessAdminRoutes(user, activeTenant) && !canAccessCoachRoutes(user, activeTenant)) {
        router.push(getRoleHomeRoute(user, activeTenant));
      }
    }
  }, [user, activeTenant, isLoading, router]);

  const loadGroups = useCallback(
    async (currentPage = page) => {
      if (!user || !activeTenant) return;
      setIsFetching(true);
      try {
        const res = await api.groups.list({
          page: currentPage,
          limit: 12,
          search: searchTerm.trim() || undefined,
          branchId: selectedBranchId || undefined,
          status: (selectedStatus as GroupStatus) || undefined,
        });
        setGroups(res.items);
        setTotal(res.total);
        setPage(res.page);
        setTotalPages(res.totalPages || 1);
      } catch (err) {
        console.error('Failed to load training groups:', err);
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
        .then((bList) => {
          setBranches(bList);
          const firstBranch = bList[0];
          if (firstBranch && !createForm.branchId) {
            setCreateForm((prev) => ({ ...prev, branchId: firstBranch.id }));
          }
        })
        .catch(() => []);
      void loadGroups(1);
    }
  }, [user, activeTenant, selectedBranchId, selectedStatus, loadGroups, createForm.branchId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void loadGroups(1);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!createForm.name.trim()) {
      setCreateError(locale === 'ar' ? 'يرجى إدخال اسم المجموعة التدريبية' : 'Please enter group name');
      return;
    }
    if (!createForm.branchId) {
      setCreateError(locale === 'ar' ? 'يرجى تحديد الفرع التابع للمجموعة' : 'Please select branch');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await api.groups.create({
        name: createForm.name.trim(),
        branchId: createForm.branchId,
        sport: 'FOOTBALL',
        ageCategory: createForm.ageCategory.trim() || undefined,
        capacity: createForm.capacity ? parseInt(createForm.capacity, 10) : undefined,
        description: createForm.description.trim() || undefined,
      });

      setIsCreateModalOpen(false);
      setCreateForm({
        name: '',
        branchId: branches[0]?.id || '',
        ageCategory: '',
        capacity: '',
        description: '',
      });
      await loadGroups(1);
      router.push(`/groups/${created.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'فشل إنشاء المجموعة التدريبية');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center text-[var(--text-muted)]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-[var(--accent-primary)]" />
          <p className="text-sm font-medium">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  const DirectionIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title={t('nav.groups', 'المجموعات التدريبية')}
          description={
            locale === 'ar'
              ? `تنظيم اللاعبين في فرق ومجموعات بحسب الفئات العمرية وجدول المواعيد (${total} مجموعة)`
              : `Squad and roster organization by age categories, training schedules, and coaching staff (${total} squads)`
          }
          actions={
            <button
              type="button"
              id="btn-create-group"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent-primary)] to-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-500/20 hover:brightness-110 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{locale === 'ar' ? 'مجموعة تدريبية جديدة' : 'New Training Group'}</span>
            </button>
          }
        />

        {/* Filter Bar */}
        <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-4 shadow-sm">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col md:flex-row items-center gap-3"
          >
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] pointer-events-none" />
              <input
                type="text"
                id="input-search-groups"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={locale === 'ar' ? 'البحث باسم المجموعة أو الوصف...' : 'Search group name or description...'}
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
            <div className="w-full md:w-56">
              <select
                id="select-filter-branch"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] transition-all outline-none"
              >
                <option value="">{locale === 'ar' ? 'جميع الفروع' : 'All Branches'}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="w-full md:w-44">
              <select
                id="select-filter-status"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as GroupStatus | '')}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] transition-all outline-none"
              >
                <option value="">{locale === 'ar' ? 'جميع الحالات' : 'All Statuses'}</option>
                <option value="ACTIVE">{locale === 'ar' ? 'نشطة' : 'Active'}</option>
                <option value="INACTIVE">{locale === 'ar' ? 'غير نشطة' : 'Inactive'}</option>
                <option value="ARCHIVED">{locale === 'ar' ? 'مؤرشفة' : 'Archived'}</option>
              </select>
            </div>

            {/* Submit & Reset */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                type="submit"
                id="btn-filter-submit"
                className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-4 py-2.5 text-xs font-bold text-white hover:brightness-110 transition-all cursor-pointer shadow-sm"
              >
                <Filter className="h-3.5 w-3.5" />
                <span>{t('common.filter')}</span>
              </button>

              <button
                type="button"
                id="btn-filter-reset"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedBranchId('');
                  setSelectedStatus('');
                  void loadGroups(1);
                }}
                className="p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                title={t('common.refresh')}
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </form>
        </div>

        {/* Groups Grid */}
        {isFetching && groups.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-12 text-center text-[var(--text-muted)] shadow-sm">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-[var(--accent-primary)] mb-3" />
            <p className="text-sm font-medium">{t('common.loading')}</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-12 text-center text-[var(--text-muted)] space-y-3 shadow-sm">
            <div className="h-12 w-12 rounded-2xl bg-[var(--badge-bg)] text-[var(--accent-primary)] flex items-center justify-center mx-auto">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-main)]">{t('common.noResults')}</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {locale === 'ar'
                  ? 'قم بإضافة مجموعة تدريبية جديدة لتوزيع اللاعبين وجدولة الحصص التدريبية.'
                  : 'Add a training group to organize players and set training schedules.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-bold text-white hover:brightness-110 transition-all cursor-pointer mt-2"
            >
              <Plus className="h-4 w-4" />
              <span>{locale === 'ar' ? 'إضافة مجموعة الآن' : 'Create Group'}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {groups.map((group) => {
              const capacity = group.capacity || null;
              const fillPercentage = capacity
                ? Math.min(100, Math.round((group.memberCount / capacity) * 100))
                : 0;
              const isFull = capacity ? group.memberCount >= capacity : false;

              return (
                <div
                  key={group.id}
                  id={`group-card-${group.id}`}
                  className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-5 flex flex-col justify-between hover:border-[var(--accent-primary)]/50 transition-all shadow-sm hover:shadow-md"
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge
                            status={group.status}
                            label={
                              group.status === 'ACTIVE'
                                ? locale === 'ar'
                                  ? 'نشطة'
                                  : 'Active'
                                : group.status === 'INACTIVE'
                                  ? locale === 'ar'
                                    ? 'غير نشطة'
                                    : 'Inactive'
                                  : locale === 'ar'
                                    ? 'مؤرشفة'
                                    : 'Archived'
                            }
                          />
                          {group.ageCategory && (
                            <span className="rounded-full bg-[var(--bg-surface-subtle)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-muted)] border border-[var(--border-subtle)]">
                              {group.ageCategory}
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-[var(--text-main)] mt-2 truncate">
                          {group.name}
                        </h3>
                      </div>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--badge-bg)] text-[var(--accent-primary)]">
                        <Trophy className="h-5 w-5" />
                      </div>
                    </div>

                    {/* Branch & Description */}
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                        <Building2 className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                        <span className="font-medium truncate">
                          {t('common.branch')}: {group.branchName}
                        </span>
                      </div>
                      {group.description && (
                        <p className="text-[var(--text-muted)] line-clamp-2 text-xs leading-relaxed">
                          {group.description}
                        </p>
                      )}
                    </div>

                    {/* Capacity Bar */}
                    <div className="rounded-xl bg-[var(--bg-surface-subtle)] p-3 border border-[var(--border-subtle)] space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-muted)] flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                          {locale === 'ar' ? 'قوام اللاعبين' : 'Squad Size'}
                        </span>
                        <span className="font-bold text-[var(--text-main)]">
                          {group.memberCount}{' '}
                          {capacity ? `/ ${capacity} (${fillPercentage}%)` : locale === 'ar' ? 'لاعب' : 'players'}
                        </span>
                      </div>
                      {capacity && (
                        <div className="h-2 w-full rounded-full bg-[var(--bg-surface)] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isFull
                                ? 'bg-rose-500'
                                : fillPercentage > 80
                                  ? 'bg-amber-400'
                                  : 'bg-emerald-500'
                            }`}
                            style={{ width: `${fillPercentage}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Coaches & Schedules Count */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 flex items-center justify-between">
                        <span className="text-[var(--text-muted)]">{t('common.coach')}</span>
                        <span className="font-bold text-[var(--text-main)]">{group.coachCount}</span>
                      </div>
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 flex items-center justify-between">
                        <span className="text-[var(--text-muted)]">{locale === 'ar' ? 'المواعيد' : 'Schedules'}</span>
                        <span className="font-bold text-[var(--text-main)]">{group.scheduleCount}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 mt-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2.5">
                    <Link
                      href={`/groups/${group.id}`}
                      id={`btn-view-group-${group.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-main)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-all"
                    >
                      <span>{locale === 'ar' ? 'إدارة المجموعة' : 'Manage Squad'}</span>
                      <DirectionIcon className="h-3.5 w-3.5" />
                    </Link>

                    <Link
                      href={`/sessions?groupId=${group.id}&branchId=${group.branchId}`}
                      id={`btn-group-sessions-${group.id}`}
                      className="flex items-center gap-1 rounded-xl bg-[var(--badge-bg)] px-3 py-2 text-xs font-bold text-[var(--badge-fg)] border border-[var(--badge-border)] hover:brightness-95 transition-all"
                      title={t('nav.sessions')}
                    >
                      <CalendarCheck className="h-4 w-4" />
                      <span>{t('nav.sessions')}</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-4 text-xs text-[var(--text-muted)]">
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-page-prev"
                disabled={page <= 1}
                onClick={() => void loadGroups(page - 1)}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-main)] hover:border-[var(--accent-primary)] disabled:opacity-40 transition-colors"
              >
                {t('common.back')}
              </button>
              <button
                type="button"
                id="btn-page-next"
                disabled={page >= totalPages}
                onClick={() => void loadGroups(page + 1)}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-main)] hover:border-[var(--accent-primary)] disabled:opacity-40 transition-colors"
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {isCreateModalOpen && (
        <div
          id="modal-create-group"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-6 shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--badge-bg)] text-[var(--accent-primary)]">
                  <Plus className="h-5 w-5" />
                </div>
                <h2 className="text-base font-bold text-[var(--text-main)]">
                  {locale === 'ar' ? 'إضافة مجموعة تدريبية جديدة' : 'Add New Training Group'}
                </h2>
              </div>
              <button
                type="button"
                id="btn-close-create-modal"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {createError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 flex items-start gap-2.5 text-xs text-rose-500">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label
                  htmlFor="create-group-name"
                  className="block text-xs font-bold text-[var(--text-main)] mb-1.5"
                >
                  {locale === 'ar' ? 'اسم المجموعة / الفريق' : 'Group Name'}{' '}
                  <span className="text-[var(--accent-primary)]">*</span>
                </label>
                <input
                  type="text"
                  id="create-group-name"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder={locale === 'ar' ? 'مثال: فريق النمور U14 (أ)' : 'e.g. U14 Tigers (A)'}
                  required
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] transition-all outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="create-group-branch"
                    className="block text-xs font-bold text-[var(--text-main)] mb-1.5"
                  >
                    {t('common.branch')} <span className="text-[var(--accent-primary)]">*</span>
                  </label>
                  <select
                    id="create-group-branch"
                    value={createForm.branchId}
                    onChange={(e) => setCreateForm({ ...createForm, branchId: e.target.value })}
                    required
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] transition-all outline-none"
                  >
                    <option value="" disabled>
                      {locale === 'ar' ? 'اختر الفرع...' : 'Select branch...'}
                    </option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="create-group-age"
                    className="block text-xs font-bold text-[var(--text-main)] mb-1.5"
                  >
                    {locale === 'ar' ? 'الفئة العمرية' : 'Age Category'}
                  </label>
                  <input
                    type="text"
                    id="create-group-age"
                    value={createForm.ageCategory}
                    onChange={(e) => setCreateForm({ ...createForm, ageCategory: e.target.value })}
                    placeholder={locale === 'ar' ? 'مثال: U12 أو U14' : 'e.g. U12, U14'}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="create-group-capacity"
                  className="block text-xs font-bold text-[var(--text-main)] mb-1.5"
                >
                  {locale === 'ar' ? 'الاستيعاب الأقصى (اختياري)' : 'Max Capacity'}
                </label>
                <input
                  type="number"
                  id="create-group-capacity"
                  value={createForm.capacity}
                  onChange={(e) => setCreateForm({ ...createForm, capacity: e.target.value })}
                  placeholder="25"
                  min="1"
                  max="100"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] transition-all outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="create-group-desc"
                  className="block text-xs font-bold text-[var(--text-main)] mb-1.5"
                >
                  {locale === 'ar' ? 'وصف تفصيلي' : 'Description'}
                </label>
                <textarea
                  id="create-group-desc"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] transition-all outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  id="btn-submit-create-group"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[var(--accent-primary)] px-5 py-2.5 text-xs font-bold text-white hover:brightness-110 disabled:opacity-50 transition-all shadow-md"
                >
                  {isSubmitting ? t('common.loading') : locale === 'ar' ? 'حفظ وإنشاء' : 'Save & Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
