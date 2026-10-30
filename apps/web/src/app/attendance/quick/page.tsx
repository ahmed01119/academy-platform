'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { AppShell } from '../../../components/layout/AppShell';
import { PageHeader } from '../../../components/ui/PageHeader';
import { useToast } from '../../../components/ui/Toast';
import { api } from '../../../lib/api-client';
import { offlineStore } from '../../../lib/offline-attendance-store';
import type { AttendanceStatus, SessionDetails, SessionSummary } from '@academy/shared';
import {
  CheckCircle2,
  Clock4,
  XCircle,
  HelpCircle,
  QrCode,
  Search,
  Check,
  RefreshCw,
  Zap,
  ArrowRight,
  ArrowLeft,
  WifiOff,
} from 'lucide-react';
import { useLocale } from '../../../lib/locale-context';

function QuickAttendanceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSessionId = searchParams.get('sessionId') || '';
  const { user, activeTenant, isLoading: authLoading } = useAuth();
  const { isRtl } = useLocale();
  const { toast } = useToast();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(initialSessionId);
  const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [isBulkMarking, setIsBulkMarking] = useState(false);
  const [pendingPlayerIds, setPendingPlayerIds] = useState<Set<string>>(new Set());

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | 'ALL'>('ALL');
  const [isOnline, setIsOnline] = useState(true);

  // Online / Offline Detection
  useEffect(() => {
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auth gate
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      if (activeTenant?.role === 'COACH') {
        toast.error(
          isRtl
            ? 'غير مصرح للمدربين بتسجيل الحضور وفقاً للسياسات الإدارية المعتمدة'
            : 'Coaches are not permitted to record player attendance.',
        );
        router.push('/attendance');
      }
    }
  }, [user, activeTenant, authLoading, router, isRtl, toast]);

  // Load Sessions
  useEffect(() => {
    async function loadTodaySessions() {
      if (!user || !activeTenant) return;
      setIsLoadingSessions(true);
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const res = await api.attendance.listSessions({ dateFrom: todayStr, dateTo: todayStr });
        const sessionList = res?.items || [];
        setSessions(sessionList);
        if (!selectedSessionId && sessionList.length > 0 && sessionList[0]) {
          setSelectedSessionId(sessionList[0].id);
        }
      } catch (err) {
        console.error('Failed to load sessions for quick attendance:', err);
      } finally {
        setIsLoadingSessions(false);
      }
    }
    loadTodaySessions();
  }, [user, activeTenant, selectedSessionId]);

  // Load Session Details Roster
  const loadRoster = useCallback(
    async (sid: string) => {
      if (!sid) return;
      setIsLoadingRoster(true);
      try {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          // Try offline store
          const cached = await offlineStore.getCachedSession(sid);
          if (cached) {
            setSessionDetails(cached);
            setIsLoadingRoster(false);
            return;
          }
        }
        const data = await api.attendance.getSession(sid);
        setSessionDetails(data);
        // Cache for offline resilience
        await offlineStore.cacheSessionRoster(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'تعذر تحميل كشف الحضور';
        toast.error(msg);
      } finally {
        setIsLoadingRoster(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (selectedSessionId) {
      loadRoster(selectedSessionId);
    }
  }, [selectedSessionId, loadRoster]);

  // Fast One-Tap Status Toggle
  const handleRecordStatus = async (
    playerId: string,
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED',
  ) => {
    if (!selectedSessionId || pendingPlayerIds.has(playerId)) return;

    setPendingPlayerIds((prev) => new Set(prev).add(playerId));

    // Optimistic UI update
    setSessionDetails((prev) => {
      if (!prev) return null;
      const updatedRoster = (prev.roster || []).map((item) =>
        item.playerId === playerId ? { ...item, status } : item,
      );
      // recalculate counts
      let pCount = 0,
        lCount = 0,
        aCount = 0,
        eCount = 0,
        uCount = 0;
      updatedRoster.forEach((r) => {
        if (r.status === 'PRESENT') pCount++;
        else if (r.status === 'LATE') lCount++;
        else if (r.status === 'ABSENT') aCount++;
        else if (r.status === 'EXCUSED') eCount++;
        else uCount++;
      });
      return {
        ...prev,
        roster: updatedRoster,
        totalPresent: pCount,
        totalLate: lCount,
        totalAbsent: aCount,
        totalExcused: eCount,
        totalUnmarked: uCount,
      };
    });

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        // Enqueue offline scan
        await offlineStore.enqueueScan({
          operationId: `quick_${Date.now()}_${playerId}`,
          sessionId: selectedSessionId,
          qrCardCode: playerId,
          deviceObservedTime: new Date().toISOString(),
          reason: `Quick marking: ${status}`,
        });
        toast.info('تم الحفظ محلياً (وضع غير متصل)');
      } else {
        await api.attendance.recordAttendance({
          sessionId: selectedSessionId,
          playerId,
          status,
          idempotencyKey: crypto.randomUUID(),
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل تسجيل الحضور';
      toast.error(msg);
      // Rollback roster
      loadRoster(selectedSessionId);
    } finally {
      setPendingPlayerIds((prev) => {
        const next = new Set(prev);
        next.delete(playerId);
        return next;
      });
    }
  };

  // Bulk Action: Mark All Present
  const handleMarkAllPresent = async () => {
    if (!selectedSessionId || !sessionDetails?.roster) return;
    setIsBulkMarking(true);

    const unmarkedOrAbsent = sessionDetails.roster.filter((r) => r.status !== 'PRESENT');

    if (unmarkedOrAbsent.length === 0) {
      toast.info('جميع اللاعبين مسجلين حضور بالفعل');
      setIsBulkMarking(false);
      return;
    }

    try {
      await api.attendance.bulkRecordAttendance({
        sessionId: selectedSessionId,
        idempotencyKey: crypto.randomUUID(),
        records: unmarkedOrAbsent.map((r) => ({
          playerId: r.playerId,
          status: 'PRESENT' as const,
        })),
      });
      toast.success(`تم تحضير ${unmarkedOrAbsent.length} لاعب بنجاح`);
      loadRoster(selectedSessionId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل التحضير الجماعي';
      toast.error(msg);
    } finally {
      setIsBulkMarking(false);
    }
  };

  const filteredRoster = (sessionDetails?.roster || []).filter((item) => {
    const rawName = typeof item?.playerName === 'string' ? item.playerName : '';
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query || rawName.toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'ALL' || item?.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={[
            { label: 'الرئيسية', href: '/dashboard' },
            { label: 'إدارة الحضور', href: '/attendance' },
            { label: 'التحضير السريع الميداني' },
          ]}
          title="التحضير السريع (Quick Attendance)"
          description="تسجيل فوري لحضور اللاعبين بنقرة واحدة، ودعم كامل للعمل دون اتصال بالإنترنت."
          actions={
            <div className="flex items-center gap-2.5">
              {!isOnline && (
                <span className="flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-600 border border-amber-500/20">
                  <WifiOff className="h-3.5 w-3.5" />
                  <span>أوفلاين (يتم الحفظ محلياً)</span>
                </span>
              )}
              {selectedSessionId && (
                <Link
                  href={`/attendance/scanner?sessionId=${selectedSessionId}`}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-all cursor-pointer"
                >
                  <QrCode className="h-4 w-4" />
                  <span>مسح QR</span>
                </Link>
              )}
              {selectedSessionId && (
                <Link
                  href={`/attendance/sessions/${selectedSessionId}`}
                  className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--brand-primary)] transition-all cursor-pointer"
                >
                  <span>الكشف الكامل والمالية</span>
                  <ArrowIcon className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          }
        />

        {/* Session Selector Strip */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Zap className="h-5 w-5 text-emerald-500" />
              <label
                htmlFor="session-select"
                className="text-sm font-bold text-[var(--text-primary)]"
              >
                اختر الحصة التدريبية:
              </label>
            </div>

            <div className="flex items-center gap-3">
              <select
                id="session-select"
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
              >
                {isLoadingSessions ? (
                  <option>جارٍ تحميل الحصص...</option>
                ) : sessions.length === 0 ? (
                  <option>لا توجد حصص مجدولة اليوم</option>
                ) : (
                  sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.groupName} - {s.branchName} ({s.startTime} - {s.endTime})
                    </option>
                  ))
                )}
              </select>

              <button
                type="button"
                onClick={() => selectedSessionId && loadRoster(selectedSessionId)}
                className="p-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--brand-primary)] transition-all cursor-pointer"
                title="تحديث الكشف"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingRoster ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* KPI Counters Strip */}
          {sessionDetails && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-[var(--border-subtle)]">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-center">
                <span className="text-[11px] text-[var(--text-muted)] block mb-0.5">الإجمالي</span>
                <span className="text-lg font-black text-[var(--text-primary)]">
                  {sessionDetails.roster?.length || 0}
                </span>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                <span className="text-[11px] text-emerald-600 font-bold block mb-0.5">حاضر</span>
                <span className="text-lg font-black text-emerald-600">
                  {sessionDetails.totalPresent}
                </span>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
                <span className="text-[11px] text-amber-600 font-bold block mb-0.5">متأخر</span>
                <span className="text-lg font-black text-amber-600">
                  {sessionDetails.totalLate}
                </span>
              </div>
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-center">
                <span className="text-[11px] text-rose-600 font-bold block mb-0.5">غائب</span>
                <span className="text-lg font-black text-rose-600">
                  {sessionDetails.totalAbsent}
                </span>
              </div>
              <div className="rounded-xl border border-slate-500/20 bg-slate-500/5 p-3 text-center">
                <span className="text-[11px] text-slate-500 font-bold block mb-0.5">غير محدد</span>
                <span className="text-lg font-black text-slate-600 dark:text-slate-300">
                  {sessionDetails.totalUnmarked}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Toolbar: Search, Filter, Bulk Mark */}
        {sessionDetails && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute right-3 rtl:right-3 ltr:left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] pointer-events-none" />
                <input
                  type="text"
                  placeholder="بحث باسم اللاعب..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-2 pr-9 rtl:pr-9 ltr:pl-9 pl-3 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                />
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto p-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                {(['ALL', 'UNMARKED', 'PRESENT', 'LATE', 'ABSENT'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                      statusFilter === st
                        ? 'bg-[var(--brand-primary)] text-white shadow-sm'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {st === 'ALL'
                      ? 'الكل'
                      : st === 'UNMARKED'
                        ? 'غير محدد'
                        : st === 'PRESENT'
                          ? 'حاضر'
                          : st === 'LATE'
                            ? 'متأخر'
                            : 'غائب'}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Bulk Action */}
            <button
              type="button"
              id="btn-mark-all-present"
              onClick={handleMarkAllPresent}
              disabled={isBulkMarking || sessionDetails.status === 'CLOSED'}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-all cursor-pointer w-full sm:w-auto justify-center"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{isBulkMarking ? 'جارٍ التحضير...' : 'تحضير الكل كحاضر (1-Tap)'}</span>
            </button>
          </div>
        )}

        {/* Rapid Roster Grid */}
        {isLoadingRoster ? (
          <div className="py-20 text-center text-xs text-[var(--text-muted)]">
            جارٍ تحميل كشف الحضور...
          </div>
        ) : !sessionDetails ? (
          <div className="py-20 text-center text-xs text-[var(--text-muted)]">
            يرجى اختيار حصة تدريبية لعرض الكشف.
          </div>
        ) : filteredRoster.length === 0 ? (
          <div className="py-16 text-center text-xs text-[var(--text-muted)] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            لا يوجد لاعبين مطابقين للبحث أو الفلتر.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredRoster.map((player) => {
              const isPending = pendingPlayerIds.has(player.playerId);
              const isClosed = sessionDetails.status === 'CLOSED';

              return (
                <div
                  key={player.playerId}
                  className={`rounded-2xl border p-4 space-y-3 transition-all ${
                    player.status === 'PRESENT'
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : player.status === 'LATE'
                        ? 'border-amber-500/30 bg-amber-500/5'
                        : player.status === 'ABSENT'
                          ? 'border-rose-500/30 bg-rose-500/5'
                          : player.status === 'EXCUSED'
                            ? 'border-sky-500/30 bg-sky-500/5'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-[var(--text-primary)]">
                        {player.playerName}
                      </h4>
                      {player.jerseyNumber && (
                        <span className="text-[11px] text-[var(--text-muted)]">
                          رقم: #{player.jerseyNumber}
                        </span>
                      )}
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                        player.status === 'PRESENT'
                          ? 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30'
                          : player.status === 'LATE'
                            ? 'bg-amber-500/20 text-amber-600 border-amber-500/30'
                            : player.status === 'ABSENT'
                              ? 'bg-rose-500/20 text-rose-600 border-rose-500/30'
                              : player.status === 'EXCUSED'
                                ? 'bg-sky-500/20 text-sky-600 border-sky-500/30'
                                : 'bg-slate-500/20 text-slate-500 border-slate-500/30'
                      }`}
                    >
                      {player.status === 'PRESENT'
                        ? 'حاضر'
                        : player.status === 'LATE'
                          ? 'متأخر'
                          : player.status === 'ABSENT'
                            ? 'غائب'
                            : player.status === 'EXCUSED'
                              ? 'معذور'
                              : 'غير محدد'}
                    </span>
                  </div>

                  {/* 4 Large 1-Tap Toggle Buttons */}
                  <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-[var(--border-subtle)]">
                    <button
                      type="button"
                      disabled={isPending || isClosed}
                      onClick={() => handleRecordStatus(player.playerId, 'PRESENT')}
                      className={`flex flex-col items-center justify-center py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        player.status === 'PRESENT'
                          ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500'
                          : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                      } disabled:opacity-50`}
                    >
                      <Check className="h-4 w-4 mb-0.5" />
                      <span className="text-[10px]">حاضر</span>
                    </button>

                    <button
                      type="button"
                      disabled={isPending || isClosed}
                      onClick={() => handleRecordStatus(player.playerId, 'LATE')}
                      className={`flex flex-col items-center justify-center py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        player.status === 'LATE'
                          ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-500'
                          : 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
                      } disabled:opacity-50`}
                    >
                      <Clock4 className="h-4 w-4 mb-0.5" />
                      <span className="text-[10px]">متأخر</span>
                    </button>

                    <button
                      type="button"
                      disabled={isPending || isClosed}
                      onClick={() => handleRecordStatus(player.playerId, 'ABSENT')}
                      className={`flex flex-col items-center justify-center py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        player.status === 'ABSENT'
                          ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-500'
                          : 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20'
                      } disabled:opacity-50`}
                    >
                      <XCircle className="h-4 w-4 mb-0.5" />
                      <span className="text-[10px]">غائب</span>
                    </button>

                    <button
                      type="button"
                      disabled={isPending || isClosed}
                      onClick={() => handleRecordStatus(player.playerId, 'EXCUSED')}
                      className={`flex flex-col items-center justify-center py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        player.status === 'EXCUSED'
                          ? 'bg-sky-600 text-white shadow-sm ring-2 ring-sky-500'
                          : 'bg-sky-500/10 text-sky-600 hover:bg-sky-500/20'
                      } disabled:opacity-50`}
                    >
                      <HelpCircle className="h-4 w-4 mb-0.5" />
                      <span className="text-[10px]">معذور</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function QuickAttendancePage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        </div>
      }
    >
      <QuickAttendanceContent />
    </React.Suspense>
  );
}
