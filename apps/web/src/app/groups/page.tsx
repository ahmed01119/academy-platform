'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { canAccessAdminRoutes, canAccessCoachRoutes, getRoleHomeRoute } from '../../lib/role-routing';
import { Navbar } from '../../components/Navbar';
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
  X,
  AlertCircle,
  Building2,
  Trophy,
} from 'lucide-react';

export default function GroupsPage() {
  const router = useRouter();
  const { user, activeTenant, isLoading } = useAuth();

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
      setCreateError('يرجى إدخال اسم المجموعة التدريبية');
      return;
    }
    if (!createForm.branchId) {
      setCreateError('يرجى تحديد الفرع التابع للمجموعة');
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
      <div className="min-h-screen bg-[#0f1c18] flex items-center justify-center text-[#9bb5a8]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-[#2f9e6b]" />
          <p className="text-sm font-medium">جارٍ تحميل المجموعات التدريبية...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1c18] text-[#e8f0ec] flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#234235] pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#45c387] bg-[#2f9e6b]/15 px-2.5 py-1 rounded-full border border-[#2f9e6b]/30">
                <Layers className="h-3.5 w-3.5" />
                المجموعات التدريبية والفرق
              </span>
              <span className="text-xs text-[#9bb5a8]">إجمالي {total} مجموعة</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              إدارة الفرق والمجموعات التدريبية
            </h1>
            <p className="text-sm text-[#9bb5a8]">
              تنظيم اللاعبين في مجموعات تدريبية متجانسة بحسب الفئة العمرية وتعيين الكادر التدريبي
              وجداول المواعيد.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              id="btn-create-group"
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] px-4 py-2.5 text-xs font-semibold text-[#062016] shadow-md shadow-[#2f9e6b]/20 hover:brightness-110 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>مجموعة تدريبية جديدة</span>
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-4 shadow-lg backdrop-blur-md">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col md:flex-row items-center gap-4"
          >
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9bb5a8]" />
              <input
                type="text"
                id="input-search-groups"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="البحث باسم المجموعة أو الوصف..."
                className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] pr-10 pl-4 py-2 text-xs text-[#e8f0ec] placeholder-[#9bb5a8]/50 focus:border-[#2f9e6b] focus:outline-none transition-colors"
              />
            </div>

            {/* Branch Filter */}
            <div className="w-full md:w-56">
              <select
                id="select-filter-branch"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                aria-label="تصفية حسب الفرع"
                className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3 py-2 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none transition-colors"
              >
                <option value="">جميع الفروع</option>
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
                aria-label="تصفية حسب الحالة"
                className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3 py-2 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none transition-colors"
              >
                <option value="">جميع الحالات</option>
                <option value="ACTIVE">نشطة</option>
                <option value="INACTIVE">غير نشطة</option>
                <option value="ARCHIVED">مؤرشفة</option>
              </select>
            </div>

            {/* Submit & Reset */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                type="submit"
                id="btn-filter-submit"
                className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 rounded-xl border border-[#2b4c3e] bg-[#12231c] px-4 py-2 text-xs font-medium text-[#45c387] hover:border-[#2f9e6b] transition-colors cursor-pointer"
              >
                <Filter className="h-3.5 w-3.5" />
                <span>تصفية</span>
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
                className="p-2 rounded-xl border border-[#2b4c3e] bg-[#12231c] text-[#9bb5a8] hover:text-white hover:border-[#2f9e6b] transition-colors cursor-pointer"
                title="إعادة تعيين الفلاتر"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </form>
        </div>

        {/* Groups Grid */}
        {isFetching && groups.length === 0 ? (
          <div className="rounded-2xl border border-[#234235] bg-[#162821]/60 p-12 text-center text-[#9bb5a8]">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-[#2f9e6b] mb-3" />
            <p className="text-sm">جارٍ تحميل المجموعات التدريبية...</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-[#234235] bg-[#162821]/60 p-12 text-center text-[#9bb5a8] space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-[#2f9e6b]/10 text-[#45c387] flex items-center justify-center mx-auto">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">لا توجد مجموعات تدريبية مطابقة</h3>
              <p className="text-xs text-[#9bb5a8] mt-1">
                قم بإضافة مجموعة تدريبية جديدة لتوزيع اللاعبين وجدولة الحصص التدريبية.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2f9e6b] px-4 py-2 text-xs font-semibold text-[#062016] hover:brightness-110 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة مجموعة الآن</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  className="group rounded-2xl border border-[#234235] bg-[#162821]/90 p-6 flex flex-col justify-between hover:border-[#2f9e6b]/60 transition-all shadow-lg hover:shadow-[#2f9e6b]/10"
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                              group.status === 'ACTIVE'
                                ? 'bg-[#2f9e6b]/15 text-[#45c387] border-[#2f9e6b]/30'
                                : group.status === 'INACTIVE'
                                  ? 'bg-[#eab308]/15 text-[#facc15] border-[#eab308]/30'
                                  : 'bg-[#64748b]/15 text-[#94a3b8] border-[#64748b]/30'
                            }`}
                          >
                            {group.status === 'ACTIVE'
                              ? 'نشطة'
                              : group.status === 'INACTIVE'
                                ? 'غير نشطة'
                                : 'مؤرشفة'}
                          </span>
                          {group.ageCategory && (
                            <span className="rounded-full bg-[#12231c] px-2 py-0.5 text-[10px] font-medium text-[#9bb5a8] border border-[#234235]">
                              {group.ageCategory}
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg font-bold text-white mt-1.5 group-hover:text-[#45c387] transition-colors">
                          {group.name}
                        </h3>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2f9e6b]/15 text-[#45c387]">
                        <Trophy className="h-5 w-5" />
                      </div>
                    </div>

                    {/* Branch & Description */}
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5 text-[#9bb5a8]">
                        <Building2 className="h-3.5 w-3.5 text-[#2f9e6b]" />
                        <span>الفرع: {group.branchName}</span>
                      </div>
                      {group.description && (
                        <p className="text-[#9bb5a8] line-clamp-2 text-xs">{group.description}</p>
                      )}
                    </div>

                    {/* Capacity Bar */}
                    <div className="rounded-xl bg-[#0f1c18] p-3 border border-[#234235] space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#9bb5a8] flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-[#45c387]" />
                          قوام اللاعبين
                        </span>
                        <span className="font-semibold text-white">
                          {group.memberCount}{' '}
                          {capacity ? `/ ${capacity} (${fillPercentage}%)` : 'لاعب'}
                        </span>
                      </div>
                      {capacity && (
                        <div className="h-2 w-full rounded-full bg-[#162821] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isFull
                                ? 'bg-[#ef4444]'
                                : fillPercentage > 80
                                  ? 'bg-[#eab308]'
                                  : 'bg-[#2f9e6b]'
                            }`}
                            style={{ width: `${fillPercentage}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Quick Stats: Coaches & Schedules */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl border border-[#234235] bg-[#12231c] px-3 py-2 flex items-center justify-between">
                        <span className="text-[#9bb5a8]">المدربين</span>
                        <span className="font-bold text-white">{group.coachCount}</span>
                      </div>
                      <div className="rounded-xl border border-[#234235] bg-[#12231c] px-3 py-2 flex items-center justify-between">
                        <span className="text-[#9bb5a8]">المواعيد الأسبوعية</span>
                        <span className="font-bold text-white">{group.scheduleCount}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="pt-4 mt-4 border-t border-[#234235] flex items-center justify-between gap-3">
                    <Link
                      href={`/groups/${group.id}`}
                      id={`btn-view-group-${group.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-[#2b4c3e] bg-[#12231c] px-3 py-2 text-xs font-semibold text-[#45c387] hover:border-[#2f9e6b] hover:bg-[#162821] transition-all"
                    >
                      <span>إدارة المجموعة</span>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Link>

                    <Link
                      href={`/sessions?groupId=${group.id}&branchId=${group.branchId}`}
                      id={`btn-group-sessions-${group.id}`}
                      className="flex items-center gap-1 rounded-xl bg-[#2f9e6b]/15 px-3 py-2 text-xs font-semibold text-[#45c387] border border-[#2f9e6b]/30 hover:bg-[#2f9e6b]/25 transition-all"
                      title="سجل الحصص والتحضير"
                    >
                      <CalendarCheck className="h-4 w-4" />
                      <span>الحصص</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#234235] pt-4 text-xs text-[#9bb5a8]">
            <div>
              الصفحة {page} من {totalPages} (إجمالي {total} مجموعة)
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-page-prev"
                disabled={page <= 1}
                onClick={() => void loadGroups(page - 1)}
                className="rounded-lg border border-[#2b4c3e] bg-[#12231c] px-3 py-1.5 text-xs text-[#e8f0ec] hover:border-[#2f9e6b] disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                السابق
              </button>
              <button
                type="button"
                id="btn-page-next"
                disabled={page >= totalPages}
                onClick={() => void loadGroups(page + 1)}
                className="rounded-lg border border-[#2b4c3e] bg-[#12231c] px-3 py-1.5 text-xs text-[#e8f0ec] hover:border-[#2f9e6b] disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Create Group Modal */}
      {isCreateModalOpen && (
        <div
          id="modal-create-group"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[#234235] bg-[#12231c] p-6 shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#234235] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2f9e6b]/20 text-[#45c387]">
                  <Plus className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold text-white">إضافة مجموعة تدريبية جديدة</h2>
              </div>
              <button
                type="button"
                id="btn-close-create-modal"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg p-1 text-[#9bb5a8] hover:text-white hover:bg-[#162821] transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {createError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 flex items-start gap-2.5 text-xs text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label
                  htmlFor="input-group-name"
                  className="block text-xs font-semibold text-[#e8f0ec] mb-1.5"
                >
                  اسم المجموعة التدريبية <span className="text-[#45c387]">*</span>
                </label>
                <input
                  type="text"
                  id="input-group-name"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="مثال: فريق البراعم (أ) - تحت 12 سنة"
                  required
                  className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] placeholder-[#9bb5a8]/50 focus:border-[#2f9e6b] focus:outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="select-group-branch"
                    className="block text-xs font-semibold text-[#e8f0ec] mb-1.5"
                  >
                    الفرع التابع له <span className="text-[#45c387]">*</span>
                  </label>
                  <select
                    id="select-group-branch"
                    value={createForm.branchId}
                    onChange={(e) => setCreateForm({ ...createForm, branchId: e.target.value })}
                    required
                    className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none transition-colors"
                  >
                    <option value="" disabled>
                      اختر الفرع...
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
                    htmlFor="input-group-age"
                    className="block text-xs font-semibold text-[#e8f0ec] mb-1.5"
                  >
                    الفئة العمرية
                  </label>
                  <input
                    type="text"
                    id="input-group-age"
                    value={createForm.ageCategory}
                    onChange={(e) => setCreateForm({ ...createForm, ageCategory: e.target.value })}
                    placeholder="مثال: تحت 12 سنة (U12)"
                    className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] placeholder-[#9bb5a8]/50 focus:border-[#2f9e6b] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="input-group-capacity"
                  className="block text-xs font-semibold text-[#e8f0ec] mb-1.5"
                >
                  الحد الأقصى لسعة المجموعة (اختياري)
                </label>
                <input
                  type="number"
                  id="input-group-capacity"
                  min="1"
                  max="200"
                  value={createForm.capacity}
                  onChange={(e) => setCreateForm({ ...createForm, capacity: e.target.value })}
                  placeholder="مثال: 25"
                  className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] placeholder-[#9bb5a8]/50 focus:border-[#2f9e6b] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label
                  htmlFor="textarea-group-desc"
                  className="block text-xs font-semibold text-[#e8f0ec] mb-1.5"
                >
                  الوصف أو ملاحظات التدريب
                </label>
                <textarea
                  id="textarea-group-desc"
                  rows={3}
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="اكتب وصفاً مختصراً لأهداف وتدريبات المجموعة..."
                  className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] placeholder-[#9bb5a8]/50 focus:border-[#2f9e6b] focus:outline-none transition-colors resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#234235]">
                <button
                  type="button"
                  id="btn-cancel-create-group"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl border border-[#2b4c3e] bg-transparent px-4 py-2.5 text-xs font-medium text-[#9bb5a8] hover:text-white transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  id="btn-submit-create-group"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] px-5 py-2.5 text-xs font-semibold text-[#062016] shadow-md shadow-[#2f9e6b]/20 hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>جارٍ الحفظ...</span>
                    </>
                  ) : (
                    <span>حفظ وإنشاء المجموعة</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
