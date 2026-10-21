'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { Navbar } from '../../components/Navbar';
import { api } from '../../lib/api-client';
import type {
  BranchSummary,
  SessionStatus,
  SessionSummary,
  TrainingGroupSummary,
} from '@academy/shared';
import {
  CalendarCheck,
  Calendar,
  Clock,
  Plus,
  RefreshCw,
  Building2,
  Users,
  ChevronLeft,
  X,
  CheckCircle2,
} from 'lucide-react';

export default function SessionsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0f1c18] flex items-center justify-center text-[#9bb5a8]">
          <RefreshCw className="h-8 w-8 animate-spin text-[#2f9e6b]" />
        </div>
      }
    >
      <SessionsContent />
    </Suspense>
  );
}

function SessionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialGroupId = searchParams.get('groupId') || '';
  const initialBranchId = searchParams.get('branchId') || '';
  const shouldAutoCreate = searchParams.get('create') === 'true';

  const { user, activeTenant, isLoading } = useAuth();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [groups, setGroups] = useState<TrainingGroupSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [selectedBranchId, setSelectedBranchId] = useState(initialBranchId);
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);
  const [selectedStatus, setSelectedStatus] = useState<SessionStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isFetching, setIsFetching] = useState(false);

  // Create Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(shouldAutoCreate);
  const [availableStaff, setAvailableStaff] = useState<
    Array<{ id: string; role: string; user: { id: string; name: string } }>
  >([]);
  const [createForm, setCreateForm] = useState({
    branchId: initialBranchId,
    groupId: initialGroupId,
    sessionDate: new Date().toISOString().slice(0, 10),
    startTime: '17:00',
    endTime: '18:30',
    coachUserId: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  const loadSessions = useCallback(
    async (currentPage = page) => {
      if (!user || !activeTenant) return;
      setIsFetching(true);
      try {
        const res = await api.attendance.listSessions({
          page: currentPage,
          limit: 12,
          branchId: selectedBranchId || undefined,
          groupId: selectedGroupId || undefined,
          status: (selectedStatus as SessionStatus) || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        });
        setSessions(res.items);
        setTotal(res.total);
        setPage(res.page);
        setTotalPages(res.totalPages || 1);
      } catch (err) {
        console.error('Failed to load sessions:', err);
      } finally {
        setIsFetching(false);
      }
    },
    [user, activeTenant, page, selectedBranchId, selectedGroupId, selectedStatus, dateFrom, dateTo],
  );

  useEffect(() => {
    if (user && activeTenant) {
      void Promise.all([
        api.branches.list().then((bList) => {
          setBranches(bList);
          const firstBranch = bList[0];
          if (firstBranch && !createForm.branchId) {
            setCreateForm((prev) => ({ ...prev, branchId: firstBranch.id }));
          }
        }),
        api.groups.list({ limit: 100 }).then((gList) => setGroups(gList.items)),
        api.tenancy.listStaff().then((sList) => {
          const coaches = sList.filter((s) => s.role === 'COACH' || s.role === 'MANAGER');
          setAvailableStaff(coaches);
        }),
      ]).catch(() => []);
      void loadSessions(1);
    }
  }, [
    user,
    activeTenant,
    selectedBranchId,
    selectedGroupId,
    selectedStatus,
    loadSessions,
    createForm.branchId,
  ]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!createForm.branchId) {
      setCreateError('يرجى تحديد الفرع');
      return;
    }
    if (!createForm.groupId) {
      setCreateError('يرجى تحديد المجموعة التدريبية');
      return;
    }

    const selectedGroup = groups.find((g) => g.id === createForm.groupId);
    const groupName = selectedGroup ? selectedGroup.name : 'حصة تدريبية';

    setIsSubmitting(true);
    try {
      const created = await api.attendance.createSession({
        branchId: createForm.branchId,
        groupId: createForm.groupId,
        sport: 'FOOTBALL',
        groupName,
        sessionDate: createForm.sessionDate,
        startTime: createForm.startTime,
        endTime: createForm.endTime,
        coachUserId: createForm.coachUserId || undefined,
      });

      setIsCreateModalOpen(false);
      router.push(`/attendance/sessions/${created.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'فشل إنشاء الحصة التدريبية');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseSession = async (sessionId: string) => {
    if (!confirm('هل أنت متأكد من إغلاق هذه الحصة التدريبية وتثبيت سجل الحضور؟')) {
      return;
    }
    try {
      await api.attendance.closeSession(sessionId);
      await loadSessions();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'فشل إغلاق الحصة');
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-[#0f1c18] flex items-center justify-center text-[#9bb5a8]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-[#2f9e6b]" />
          <p className="text-sm font-medium">جارٍ تحميل الحصص التدريبية...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1c18] text-[#e8f0ec] flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#234235] pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#45c387] bg-[#2f9e6b]/15 px-2.5 py-1 rounded-full border border-[#2f9e6b]/30">
                <CalendarCheck className="h-3.5 w-3.5" />
                الحصص والتحضير المباشر
              </span>
              <span className="text-xs text-[#9bb5a8]">إجمالي {total} حصة</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              إدارة الحصص التدريبية وسجلات الحضور
            </h1>
            <p className="text-sm text-[#9bb5a8]">
              تحضير اللاعبين بلمسة واحدة One-Tap، وتوليد رموز QR المؤقتة، وتتبع الحضور الحي والغياب.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              id="btn-create-session"
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] px-4 py-2.5 text-xs font-semibold text-[#062016] shadow-md shadow-[#2f9e6b]/20 hover:brightness-110 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>إنشاء حصة تدريبية جديدة</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-4 shadow-lg backdrop-blur-md">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Branch */}
            <select
              id="select-filter-branch"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              aria-label="تصفية حسب الفرع"
              className="rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3 py-2 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
            >
              <option value="">جميع الفروع</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            {/* Group */}
            <select
              id="select-filter-group"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              aria-label="تصفية حسب المجموعة"
              className="rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3 py-2 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
            >
              <option value="">جميع المجموعات</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.branchName})
                </option>
              ))}
            </select>

            {/* Status */}
            <select
              id="select-filter-status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as SessionStatus | '')}
              aria-label="تصفية حسب الحالة"
              className="rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3 py-2 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
            >
              <option value="">جميع الحالات</option>
              <option value="SCHEDULED">مجدولة</option>
              <option value="IN_PROGRESS">جارية الآن</option>
              <option value="CLOSED">مغلقة</option>
            </select>

            {/* Date Range */}
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="من تاريخ"
              aria-label="من تاريخ"
              className="rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3 py-2 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
            />

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="إلى تاريخ"
                aria-label="إلى تاريخ"
                className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3 py-2 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
              />

              <button
                type="button"
                id="btn-filter-reset"
                onClick={() => {
                  setSelectedBranchId('');
                  setSelectedGroupId('');
                  setSelectedStatus('');
                  setDateFrom('');
                  setDateTo('');
                  void loadSessions(1);
                }}
                className="p-2 rounded-xl border border-[#2b4c3e] bg-[#12231c] text-[#9bb5a8] hover:text-white"
                title="إعادة التعيين"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Sessions Grid */}
        {isFetching && sessions.length === 0 ? (
          <div className="rounded-2xl border border-[#234235] bg-[#162821]/60 p-12 text-center text-[#9bb5a8]">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-[#2f9e6b] mb-3" />
            <p className="text-sm">جارٍ تحميل الحصص التدريبية...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-2xl border border-[#234235] bg-[#162821]/60 p-12 text-center text-[#9bb5a8] space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-[#2f9e6b]/10 text-[#45c387] flex items-center justify-center mx-auto">
              <CalendarCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">لا توجد حصص تدريبية مطابقة</h3>
              <p className="text-xs text-[#9bb5a8] mt-1">
                قم بإنشاء حصة تدريبية لمجموعة للبدء بأخذ الحضور إلكترونياً.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2f9e6b] px-4 py-2 text-xs font-semibold text-[#062016] hover:brightness-110"
            >
              <Plus className="h-4 w-4" />
              <span>إنشاء أول حصة تدريبية</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((session) => {
              const totalExpected = session.totalExpected || 0;
              const attendedCount = (session.totalPresent || 0) + (session.totalLate || 0);
              const attendanceRate =
                totalExpected > 0 ? Math.round((attendedCount / totalExpected) * 100) : 0;

              return (
                <div
                  key={session.id}
                  id={`session-card-${session.id}`}
                  className="rounded-2xl border border-[#234235] bg-[#162821]/90 p-6 flex flex-col justify-between hover:border-[#2f9e6b]/60 transition-all shadow-lg"
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                              session.status === 'IN_PROGRESS'
                                ? 'bg-[#2f9e6b]/20 text-[#45c387] border-[#2f9e6b]/40 animate-pulse'
                                : session.status === 'SCHEDULED'
                                  ? 'bg-[#3b82f6]/20 text-[#60a5fa] border-[#3b82f6]/40'
                                  : 'bg-[#64748b]/20 text-[#94a3b8] border-[#64748b]/40'
                            }`}
                          >
                            {session.status === 'IN_PROGRESS'
                              ? '• جارية الآن'
                              : session.status === 'SCHEDULED'
                                ? 'مجدولة'
                                : 'مغلقة ومؤكدة'}
                          </span>
                          <span className="text-[11px] text-[#9bb5a8] flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-[#2f9e6b]" />
                            {session.branchName}
                          </span>
                        </div>

                        <h3 className="text-lg font-bold text-white mt-1.5">{session.groupName}</h3>
                      </div>

                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2f9e6b]/15 text-[#45c387]">
                        <CalendarCheck className="h-5 w-5" />
                      </div>
                    </div>

                    {/* Date & Time */}
                    <div className="rounded-xl border border-[#234235] bg-[#0f1c18] p-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-white font-medium">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-[#2f9e6b]" />
                          {session.sessionDate}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-[#2f9e6b]" />
                          {session.startTime} - {session.endTime}
                        </span>
                      </div>
                      {session.coachName && (
                        <div className="text-[#9bb5a8] text-[11px] pt-1 border-t border-[#234235]">
                          المدرب المسؤول: {session.coachName}
                        </div>
                      )}
                    </div>

                    {/* Live Attendance Progress */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#9bb5a8] flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-[#45c387]" />
                          نسبة الحضور ({attendedCount} من {totalExpected})
                        </span>
                        <span className="font-bold text-[#45c387]">{attendanceRate}%</span>
                      </div>

                      {/* Visual segmented bar */}
                      <div className="h-2 w-full rounded-full bg-[#12231c] overflow-hidden flex">
                        <div
                          style={{
                            width: `${totalExpected > 0 ? (session.totalPresent / totalExpected) * 100 : 0}%`,
                          }}
                          className="bg-[#2f9e6b]"
                          title={`حاضر: ${session.totalPresent}`}
                        />
                        <div
                          style={{
                            width: `${totalExpected > 0 ? (session.totalLate / totalExpected) * 100 : 0}%`,
                          }}
                          className="bg-[#facc15]"
                          title={`متأخر: ${session.totalLate}`}
                        />
                        <div
                          style={{
                            width: `${totalExpected > 0 ? (session.totalAbsent / totalExpected) * 100 : 0}%`,
                          }}
                          className="bg-[#ef4444]"
                          title={`غائب: ${session.totalAbsent}`}
                        />
                        <div
                          style={{
                            width: `${totalExpected > 0 ? (session.totalExcused / totalExpected) * 100 : 0}%`,
                          }}
                          className="bg-[#38bdf8]"
                          title={`معذور: ${session.totalExcused}`}
                        />
                      </div>

                      {/* Pill badges breakdown */}
                      <div className="grid grid-cols-4 gap-1 text-[10px] text-center pt-1 font-semibold">
                        <span className="rounded bg-[#2f9e6b]/10 text-[#45c387] py-0.5">
                          {session.totalPresent} حاضر
                        </span>
                        <span className="rounded bg-[#facc15]/10 text-[#facc15] py-0.5">
                          {session.totalLate} متأخر
                        </span>
                        <span className="rounded bg-[#ef4444]/10 text-[#f87171] py-0.5">
                          {session.totalAbsent} غائب
                        </span>
                        <span className="rounded bg-[#38bdf8]/10 text-[#38bdf8] py-0.5">
                          {session.totalExcused} معذور
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="pt-4 mt-4 border-t border-[#234235] flex items-center justify-between gap-3">
                    <Link
                      href={`/attendance/sessions/${session.id}`}
                      id={`btn-mark-session-${session.id}`}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] px-3.5 py-2.5 text-xs font-bold text-[#062016] shadow-sm hover:brightness-110 transition-all"
                    >
                      <span>شاشة التحضير السريع</span>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Link>

                    {session.status !== 'CLOSED' && (
                      <button
                        type="button"
                        id={`btn-close-session-${session.id}`}
                        onClick={() => handleCloseSession(session.id)}
                        className="p-2.5 rounded-xl border border-[#2b4c3e] bg-[#12231c] text-[#9bb5a8] hover:text-white hover:border-red-500/50 transition-colors"
                        title="إغلاق الحصة وتثبيت الكشف"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    )}
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
              الصفحة {page} من {totalPages} (إجمالي {total} حصة)
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => void loadSessions(page - 1)}
                className="rounded-lg border border-[#2b4c3e] bg-[#12231c] px-3 py-1.5 text-xs text-[#e8f0ec] hover:border-[#2f9e6b] disabled:opacity-40"
              >
                السابق
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => void loadSessions(page + 1)}
                className="rounded-lg border border-[#2b4c3e] bg-[#12231c] px-3 py-1.5 text-xs text-[#e8f0ec] hover:border-[#2f9e6b] disabled:opacity-40"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </main>

      {/* CREATE SESSION MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-[#234235] bg-[#12231c] p-6 shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#234235] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2f9e6b]/20 text-[#45c387]">
                  <Plus className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold text-white">إنشاء حصة تدريبية جديدة</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg p-1 text-[#9bb5a8] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {createError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="create-session-branch"
                    className="block text-xs font-semibold text-[#e8f0ec] mb-1.5"
                  >
                    الفرع <span className="text-[#45c387]">*</span>
                  </label>
                  <select
                    id="create-session-branch"
                    value={createForm.branchId}
                    onChange={(e) => setCreateForm({ ...createForm, branchId: e.target.value })}
                    required
                    className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
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
                    htmlFor="create-session-group"
                    className="block text-xs font-semibold text-[#e8f0ec] mb-1.5"
                  >
                    المجموعة التدريبية <span className="text-[#45c387]">*</span>
                  </label>
                  <select
                    id="create-session-group"
                    value={createForm.groupId}
                    onChange={(e) => setCreateForm({ ...createForm, groupId: e.target.value })}
                    required
                    className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
                  >
                    <option value="" disabled>
                      اختر المجموعة...
                    </option>
                    {groups
                      .filter((g) => !createForm.branchId || g.branchId === createForm.branchId)
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.memberCount} لاعب)
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="create-session-date"
                  className="block text-xs font-semibold text-[#e8f0ec] mb-1.5"
                >
                  تاريخ الحصة التدريبية <span className="text-[#45c387]">*</span>
                </label>
                <input
                  type="date"
                  id="create-session-date"
                  value={createForm.sessionDate}
                  onChange={(e) => setCreateForm({ ...createForm, sessionDate: e.target.value })}
                  required
                  className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="create-session-start"
                    className="block text-xs font-semibold text-[#e8f0ec] mb-1.5"
                  >
                    وقت البدء (HH:MM)
                  </label>
                  <input
                    type="time"
                    id="create-session-start"
                    value={createForm.startTime}
                    onChange={(e) => setCreateForm({ ...createForm, startTime: e.target.value })}
                    required
                    className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="create-session-end"
                    className="block text-xs font-semibold text-[#e8f0ec] mb-1.5"
                  >
                    وقت الانتهاء (HH:MM)
                  </label>
                  <input
                    type="time"
                    id="create-session-end"
                    value={createForm.endTime}
                    onChange={(e) => setCreateForm({ ...createForm, endTime: e.target.value })}
                    required
                    className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="create-session-coach"
                  className="block text-xs font-semibold text-[#e8f0ec] mb-1.5"
                >
                  المدرب المشرف (اختياري)
                </label>
                <select
                  id="create-session-coach"
                  value={createForm.coachUserId}
                  onChange={(e) => setCreateForm({ ...createForm, coachUserId: e.target.value })}
                  className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
                >
                  <option value="">تحديد لاحقاً أو المدرب الحالي</option>
                  {availableStaff.map((s) => (
                    <option key={s.user.id} value={s.user.id}>
                      {s.user.name} ({s.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#234235]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs text-[#9bb5a8] hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  id="btn-submit-create-session"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#2f9e6b] px-5 py-2.5 text-xs font-bold text-[#062016] hover:brightness-110 disabled:opacity-50"
                >
                  {isSubmitting ? 'جارٍ الإنشاء...' : 'إنشاء وبدء التحضير'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
