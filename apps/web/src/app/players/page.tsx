'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { Navbar } from '../../components/Navbar';
import { api } from '../../lib/api-client';
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
} from 'lucide-react';

export default function PlayersPage() {
  const router = useRouter();
  const { user, activeTenant, isLoading } = useAuth();

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
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

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
      <div className="min-h-screen bg-[#0f1c18] flex items-center justify-center text-[#9bb5a8]">
        <RefreshCw className="h-8 w-8 animate-spin text-[#2f9e6b]" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#0f1c18] text-[#e8f0ec] flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#234235] pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#45c387] bg-[#2f9e6b]/15 px-2.5 py-0.5 rounded-full border border-[#2f9e6b]/30">
                <Users className="h-3.5 w-3.5" />
                سجل اللاعبين
              </span>
              <span className="text-xs text-[#9bb5a8]">إجمالي {total} لاعب</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              إدارة شؤون اللاعبين
            </h1>
            <p className="text-sm text-[#9bb5a8]">
              قائمة لاعبي الأكاديمية والبحث السريع والمتابعة ونقل الفروع.
            </p>
          </div>

          <Link
            href="/players/new"
            id="btn-register-new-player"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] px-4 py-2.5 text-xs font-semibold text-[#062016] shadow-lg shadow-[#2f9e6b]/20 hover:brightness-110 transition-all"
          >
            <UserPlus className="h-4 w-4" />
            <span>تسجيل لاعب جديد</span>
          </Link>
        </div>

        {/* Filter and Search Bar */}
        <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-4 backdrop-blur-md">
          <form
            onSubmit={handleSearchSubmit}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          >
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute right-3.5 top-3 h-4 w-4 text-[#9bb5a8]" />
              <input
                type="text"
                id="input-search-players"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث بالاسم أو الرقم القومي..."
                className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] pr-10 pl-3.5 py-2.5 text-xs text-[#e8f0ec] placeholder-[#9bb5a8]/60 focus:border-[#2f9e6b] focus:outline-none transition-colors"
              />
            </div>

            {/* Branch Filter */}
            <div>
              <select
                id="select-filter-branch"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none transition-colors"
              >
                <option value="">كل الفروع</option>
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
                className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none transition-colors"
              >
                <option value="">كل الحالات</option>
                <option value="ACTIVE">نشط (Active)</option>
                <option value="INACTIVE">غير نشط (Inactive)</option>
                <option value="SUSPENDED">موقوف (Suspended)</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                type="submit"
                id="btn-apply-filters"
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#2f9e6b] bg-[#2f9e6b]/20 px-3.5 py-2.5 text-xs font-semibold text-[#45c387] hover:bg-[#2f9e6b]/30 transition-colors cursor-pointer"
              >
                <Filter className="h-3.5 w-3.5" />
                <span>تصفية</span>
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
                className="inline-flex items-center justify-center rounded-xl border border-[#234235] bg-[#0f1c18] p-2.5 text-[#9bb5a8] hover:text-white transition-colors cursor-pointer"
                title="إعادة ضبط الفلاتر"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </form>
        </div>

        {/* Players Table */}
        <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 backdrop-blur-md overflow-hidden shadow-xl">
          {players.length === 0 ? (
            <div className="py-16 text-center text-[#9bb5a8] px-4">
              <Users className="h-12 w-12 mx-auto text-[#234235] mb-3" />
              <h3 className="text-base font-bold text-white mb-1">لا توجد نتائج مطابقة للبحث</h3>
              <p className="text-xs text-[#9bb5a8] max-w-sm mx-auto mb-5">
                تأكد من صحة كلمات البحث أو قم بإلغاء الفلاتر المحددة لعرض كافة اللاعبين.
              </p>
              <Link
                href="/players/new"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] px-4 py-2 text-xs font-semibold text-[#062016] shadow hover:brightness-110"
              >
                <UserPlus className="h-4 w-4" />
                <span>تسجيل لاعب جديد</span>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-[#234235] bg-[#0f1c18]/50 text-[#9bb5a8]">
                    <th className="py-3.5 px-4 font-semibold">اللاعب</th>
                    <th className="py-3.5 px-4 font-semibold">تاريخ الميلاد / الجنس</th>
                    <th className="py-3.5 px-4 font-semibold">الفرع المقيد به</th>
                    <th className="py-3.5 px-4 font-semibold">ولي الأمر والتواصل</th>
                    <th className="py-3.5 px-4 font-semibold">حالة القيد</th>
                    <th className="py-3.5 px-4 font-semibold text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#234235]">
                  {players.map((p) => {
                    const currentBranch = p.currentBranch;
                    const primaryGuardian = p.primaryGuardian;

                    return (
                      <tr key={p.id} className="hover:bg-[#1a3328]/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#2f9e6b]/30 to-[#45c387]/30 text-[#45c387] font-bold text-sm border border-[#2f9e6b]/30">
                              {p.firstName.charAt(0)}
                            </div>
                            <div>
                              <Link
                                href={`/players/${p.id}`}
                                className="font-bold text-white hover:text-[#45c387] transition-colors"
                              >
                                {p.firstName} {p.lastName}
                              </Link>
                              {p.nationalId && (
                                <div className="text-[10px] text-[#9bb5a8] font-mono mt-0.5">
                                  هوية: {p.nationalId}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="text-[#e8f0ec] block">
                            {p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : '-'}
                          </span>
                          <span className="text-[11px] text-[#9bb5a8]">
                            {p.gender === 'MALE' ? 'ذكر' : 'أنثى'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          {currentBranch ? (
                            <span className="inline-flex items-center rounded-lg bg-[#234235] px-2.5 py-1 text-xs text-[#e8f0ec] font-medium border border-[#2b4c3e]">
                              {currentBranch.name}
                            </span>
                          ) : (
                            <span className="text-[#9bb5a8] text-[11px]">غير مقيد</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {primaryGuardian ? (
                            <div>
                              <div className="font-medium text-white">
                                {primaryGuardian.firstName} {primaryGuardian.lastName}
                              </div>
                              <div className="text-[10px] text-[#9bb5a8] font-mono flex items-center gap-1 mt-0.5">
                                <Phone className="h-3 w-3 text-[#2f9e6b]" />
                                {primaryGuardian.phone}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[#9bb5a8]">-</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              p.status === 'ACTIVE'
                                ? 'bg-[#2f9e6b]/20 text-[#45c387] border border-[#2f9e6b]/40'
                                : p.status === 'SUSPENDED'
                                  ? 'bg-[#eab308]/20 text-[#facc15] border border-[#eab308]/40'
                                  : 'bg-[#ef4444]/20 text-[#fca5a5] border border-[#ef4444]/40'
                            }`}
                          >
                            {p.status === 'ACTIVE'
                              ? 'نشط'
                              : p.status === 'SUSPENDED'
                                ? 'موقوف'
                                : 'غير نشط'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-left">
                          <Link
                            href={`/players/${p.id}`}
                            id={`link-player-profile-${p.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2b4c3e] bg-[#0f1c18] px-3 py-1.5 text-xs font-semibold text-[#e8f0ec] hover:border-[#2f9e6b] hover:text-[#45c387] transition-all"
                          >
                            <User className="h-3.5 w-3.5" />
                            <span>عرض الملف</span>
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
            <div className="flex items-center justify-between border-t border-[#234235] px-4 py-3 text-xs text-[#9bb5a8]">
              <div>
                صفحة <span className="font-bold text-white">{page}</span> من{' '}
                <span className="font-bold text-white">{totalPages}</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  id="btn-prev-page"
                  disabled={page <= 1}
                  onClick={() => void loadPlayers(page - 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#234235] bg-[#0f1c18] px-3 py-1.5 font-medium text-[#e8f0ec] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#2f9e6b] transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                  <span>السابق</span>
                </button>
                <button
                  type="button"
                  id="btn-next-page"
                  disabled={page >= totalPages}
                  onClick={() => void loadPlayers(page + 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#234235] bg-[#0f1c18] px-3 py-1.5 font-medium text-[#e8f0ec] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#2f9e6b] transition-colors"
                >
                  <span>التالي</span>
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
