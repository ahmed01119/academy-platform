'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { useLocale } from '../../lib/locale-context';
import { canAccessAdminRoutes, canAccessCoachRoutes, getRoleHomeRoute } from '../../lib/role-routing';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader, StatusBadge, useToast } from '../../components/ui';
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
  ChevronRight,
  X,
  CheckCircle2,
  QrCode,
} from 'lucide-react';

export default function SessionsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center text-[var(--text-muted)]">
          <RefreshCw className="h-8 w-8 animate-spin text-[var(--accent-primary)]" />
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
  const { t, locale, isRtl } = useLocale();
  const { toast } = useToast();

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
      setCreateError(locale === 'ar' ? 'يرجى تحديد الفرع' : 'Please select a branch');
      return;
    }
    if (!createForm.groupId) {
      setCreateError(locale === 'ar' ? 'يرجى تحديد المجموعة التدريبية' : 'Please select a training group');
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
    if (
      !confirm(
        locale === 'ar'
          ? 'هل أنت متأكد من إغلاق هذه الحصة التدريبية وتثبيت سجل الحضور؟'
          : 'Are you sure you want to close this training session and lock attendance?',
      )
    ) {
      return;
    }
    try {
      await api.attendance.closeSession(sessionId);
      toast.success(locale === 'ar' ? 'تم إغلاق الحصة التدريبية وتثبيت سجل الحضور بنجاح' : 'Session closed and attendance locked successfully');
      await loadSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (locale === 'ar' ? 'فشل إغلاق الحصة' : 'Failed to close session'));
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
          title={t('nav.sessions', 'الحصص التدريبية')}
          description={
            locale === 'ar'
              ? `إدارة الحصص التدريبية، كشوف الحضور الذكية، والتحضير بالـ QR (${total} حصة)`
              : `Training session management, live attendance tracking, and QR check-ins (${total} sessions)`
          }
          actions={
            <div className="flex items-center gap-2.5">
              <Link
                href="/attendance/scanner"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs font-semibold text-[var(--accent-primary)] hover:border-[var(--accent-primary)] transition-all shadow-sm"
              >
                <QrCode className="h-4 w-4" />
                <span>{t('nav.scanner', 'ماسح QR')}</span>
              </Link>

              <button
                type="button"
                id="btn-create-session"
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent-primary)] to-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-500/20 hover:brightness-110 transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>{locale === 'ar' ? 'إنشاء حصة تدريبية' : 'New Session'}</span>
              </button>
            </div>
          }
        />

        {/* Filter Bar */}
        <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Branch Filter */}
            <select
              id="select-filter-branch"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] transition-all outline-none"
            >
              <option value="">{locale === 'ar' ? 'جميع الفروع' : 'All Branches'}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            {/* Group Filter */}
            <select
              id="select-filter-group"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] transition-all outline-none"
            >
              <option value="">{locale === 'ar' ? 'جميع المجموعات' : 'All Groups'}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.branchName})
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              id="select-filter-status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as SessionStatus | '')}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] transition-all outline-none"
            >
              <option value="">{locale === 'ar' ? 'جميع الحالات' : 'All Statuses'}</option>
              <option value="SCHEDULED">{locale === 'ar' ? 'مجدولة' : 'Scheduled'}</option>
              <option value="IN_PROGRESS">{locale === 'ar' ? 'جارية الآن' : 'In Progress'}</option>
              <option value="CLOSED">{locale === 'ar' ? 'مغلقة' : 'Closed'}</option>
            </select>

            {/* Date Range From */}
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] transition-all outline-none"
            />

            {/* Date Range To & Reset */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] transition-all outline-none"
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
                className="p-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                title={t('common.refresh')}
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Sessions Grid */}
        {isFetching && sessions.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-12 text-center text-[var(--text-muted)] shadow-sm">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-[var(--accent-primary)] mb-3" />
            <p className="text-sm font-medium">{t('common.loading')}</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-12 text-center text-[var(--text-muted)] space-y-3 shadow-sm">
            <div className="h-12 w-12 rounded-2xl bg-[var(--badge-bg)] text-[var(--accent-primary)] flex items-center justify-center mx-auto">
              <CalendarCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-main)]">{t('common.noResults')}</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {locale === 'ar'
                  ? 'قم بإنشاء حصة تدريبية لمجموعة للبدء بأخذ الحضور إلكترونياً.'
                  : 'Create a training session to start recording attendance.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-bold text-white hover:brightness-110 transition-all mt-2"
            >
              <Plus className="h-4 w-4" />
              <span>{locale === 'ar' ? 'إنشاء أول حصة تدريبية' : 'Create First Session'}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sessions.map((session) => {
              const totalExpected = session.totalExpected || 0;
              const attendedCount = (session.totalPresent || 0) + (session.totalLate || 0);
              const attendanceRate =
                totalExpected > 0 ? Math.round((attendedCount / totalExpected) * 100) : 0;

              return (
                <div
                  key={session.id}
                  id={`session-card-${session.id}`}
                  className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-5 flex flex-col justify-between hover:border-[var(--accent-primary)]/50 transition-all shadow-sm hover:shadow-md"
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge
                            status={session.status}
                            label={
                              session.status === 'IN_PROGRESS'
                                ? locale === 'ar'
                                  ? 'جارية الآن'
                                  : 'In Progress'
                                : session.status === 'SCHEDULED'
                                  ? locale === 'ar'
                                    ? 'مجدولة'
                                    : 'Scheduled'
                                  : locale === 'ar'
                                    ? 'مغلقة'
                                    : 'Closed'
                            }
                            pulse={session.status === 'IN_PROGRESS'}
                          />
                          <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-[var(--accent-primary)]" />
                            {session.branchName}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-[var(--text-main)] mt-2 truncate">
                          {session.groupName}
                        </h3>
                      </div>

                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--badge-bg)] text-[var(--accent-primary)]">
                        <CalendarCheck className="h-5 w-5" />
                      </div>
                    </div>

                    {/* Date & Time */}
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-[var(--text-main)] font-semibold">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                          {session.sessionDate}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                          {session.startTime} - {session.endTime}
                        </span>
                      </div>
                      {session.coachName && (
                        <div className="text-[var(--text-muted)] text-[11px] pt-1.5 border-t border-[var(--border-subtle)]">
                          {locale === 'ar' ? 'المدرب:' : 'Coach:'}{' '}
                          <span className="font-semibold text-[var(--text-main)]">
                            {session.coachName}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Attendance segmented bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-muted)] flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                          {locale === 'ar'
                            ? `نسبة الحضور (${attendedCount} من ${totalExpected})`
                            : `Attendance (${attendedCount} / ${totalExpected})`}
                        </span>
                        <span className="font-bold text-[var(--accent-primary)]">
                          {attendanceRate}%
                        </span>
                      </div>

                      <div className="h-2 w-full rounded-full bg-[var(--bg-surface-subtle)] overflow-hidden flex">
                        <div
                          style={{
                            width: `${totalExpected > 0 ? (session.totalPresent / totalExpected) * 100 : 0}%`,
                          }}
                          className="bg-emerald-500"
                        />
                        <div
                          style={{
                            width: `${totalExpected > 0 ? (session.totalLate / totalExpected) * 100 : 0}%`,
                          }}
                          className="bg-amber-400"
                        />
                        <div
                          style={{
                            width: `${totalExpected > 0 ? (session.totalAbsent / totalExpected) * 100 : 0}%`,
                          }}
                          className="bg-rose-500"
                        />
                        <div
                          style={{
                            width: `${totalExpected > 0 ? (session.totalExcused / totalExpected) * 100 : 0}%`,
                          }}
                          className="bg-sky-400"
                        />
                      </div>

                      <div className="grid grid-cols-4 gap-1 text-[10px] text-center pt-1 font-bold">
                        <span className="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 py-0.5">
                          {session.totalPresent} {locale === 'ar' ? 'حاضر' : 'P'}
                        </span>
                        <span className="rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 py-0.5">
                          {session.totalLate} {locale === 'ar' ? 'متأخر' : 'L'}
                        </span>
                        <span className="rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 py-0.5">
                          {session.totalAbsent} {locale === 'ar' ? 'غائب' : 'A'}
                        </span>
                        <span className="rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 py-0.5">
                          {session.totalExcused} {locale === 'ar' ? 'معذور' : 'E'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 mt-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2.5">
                    <Link
                      href={`/attendance/sessions/${session.id}`}
                      id={`btn-mark-session-${session.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3.5 py-2.5 text-xs font-bold text-white shadow-sm hover:brightness-110 transition-all"
                    >
                      <span>{locale === 'ar' ? 'شاشة التحضير' : 'Take Attendance'}</span>
                      <DirectionIcon className="h-3.5 w-3.5" />
                    </Link>

                    {session.status !== 'CLOSED' && (
                      <button
                        type="button"
                        id={`btn-close-session-${session.id}`}
                        onClick={() => handleCloseSession(session.id)}
                        className="p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] hover:text-rose-500 hover:border-rose-500/40 transition-colors"
                        title={locale === 'ar' ? 'إغلاق الحصة وتثبيت الكشف' : 'Close Session'}
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
                disabled={page <= 1}
                onClick={() => void loadSessions(page - 1)}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-main)] hover:border-[var(--accent-primary)] disabled:opacity-40 transition-colors"
              >
                {t('common.back')}
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => void loadSessions(page + 1)}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-main)] hover:border-[var(--accent-primary)] disabled:opacity-40 transition-colors"
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE SESSION MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-6 shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--badge-bg)] text-[var(--accent-primary)]">
                  <Plus className="h-5 w-5" />
                </div>
                <h2 className="text-base font-bold text-[var(--text-main)]">
                  {locale === 'ar' ? 'إنشاء حصة تدريبية جديدة' : 'Create New Training Session'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {createError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-500">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="create-session-branch"
                    className="block text-xs font-bold text-[var(--text-main)] mb-1.5"
                  >
                    {t('common.branch')} <span className="text-[var(--accent-primary)]">*</span>
                  </label>
                  <select
                    id="create-session-branch"
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
                    htmlFor="create-session-group"
                    className="block text-xs font-bold text-[var(--text-main)] mb-1.5"
                  >
                    {t('common.group')} <span className="text-[var(--accent-primary)]">*</span>
                  </label>
                  <select
                    id="create-session-group"
                    value={createForm.groupId}
                    onChange={(e) => setCreateForm({ ...createForm, groupId: e.target.value })}
                    required
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] transition-all outline-none"
                  >
                    <option value="" disabled>
                      {locale === 'ar' ? 'اختر المجموعة...' : 'Select group...'}
                    </option>
                    {groups
                      .filter((g) => !createForm.branchId || g.branchId === createForm.branchId)
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.memberCount} {locale === 'ar' ? 'لاعب' : 'players'})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="create-session-date"
                  className="block text-xs font-bold text-[var(--text-main)] mb-1.5"
                >
                  {t('common.date')} <span className="text-[var(--accent-primary)]">*</span>
                </label>
                <input
                  type="date"
                  id="create-session-date"
                  value={createForm.sessionDate}
                  onChange={(e) => setCreateForm({ ...createForm, sessionDate: e.target.value })}
                  required
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] transition-all outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="create-session-start"
                    className="block text-xs font-bold text-[var(--text-main)] mb-1.5"
                  >
                    {locale === 'ar' ? 'وقت البدء' : 'Start Time'}
                  </label>
                  <input
                    type="time"
                    id="create-session-start"
                    value={createForm.startTime}
                    onChange={(e) => setCreateForm({ ...createForm, startTime: e.target.value })}
                    required
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] transition-all outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="create-session-end"
                    className="block text-xs font-bold text-[var(--text-main)] mb-1.5"
                  >
                    {locale === 'ar' ? 'وقت الانتهاء' : 'End Time'}
                  </label>
                  <input
                    type="time"
                    id="create-session-end"
                    value={createForm.endTime}
                    onChange={(e) => setCreateForm({ ...createForm, endTime: e.target.value })}
                    required
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="create-session-coach"
                  className="block text-xs font-bold text-[var(--text-main)] mb-1.5"
                >
                  {t('common.coach')} ({locale === 'ar' ? 'اختياري' : 'Optional'})
                </label>
                <select
                  id="create-session-coach"
                  value={createForm.coachUserId}
                  onChange={(e) => setCreateForm({ ...createForm, coachUserId: e.target.value })}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] transition-all outline-none"
                >
                  <option value="">{locale === 'ar' ? 'تحديد لاحقاً' : 'Assign Later'}</option>
                  {availableStaff.map((s) => (
                    <option key={s.user.id} value={s.user.id}>
                      {s.user.name} ({s.role})
                    </option>
                  ))}
                </select>
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
                  id="btn-submit-create-session"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[var(--accent-primary)] px-5 py-2.5 text-xs font-bold text-white hover:brightness-110 disabled:opacity-50 transition-all shadow-md"
                >
                  {isSubmitting ? t('common.loading') : locale === 'ar' ? 'إنشاء الحصة' : 'Create Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
