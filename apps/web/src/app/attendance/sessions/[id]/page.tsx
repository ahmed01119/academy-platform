'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../../lib/auth-context';
import { Navbar } from '../../../../components/Navbar';
import { api } from '../../../../lib/api-client';
import type {
  AttendanceEventSummary,
  AttendanceRosterItem,
  AttendanceStatus,
  GenerateQrResponse,
  SessionDetails,
} from '@academy/shared';
import {
  Calendar,
  Clock,
  Building2,
  Users,
  CheckCircle2,
  Clock4,
  XCircle,
  HelpCircle,
  QrCode,
  History,
  Lock,
  RefreshCw,
  Search,
  ChevronRight,
  AlertCircle,
  Check,
  UserCheck,
  Timer,
  X,
} from 'lucide-react';

export default function SessionAttendancePage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;
  const { user, activeTenant, isLoading } = useAuth();

  const [session, setSession] = useState<SessionDetails | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | 'ALL'>('ALL');

  // Mutation in-flight tracking
  const [pendingPlayerIds, setPendingPlayerIds] = useState<Set<string>>(new Set());

  // QR Modal
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrData, setQrData] = useState<GenerateQrResponse | null>(null);
  const [qrSecondsLeft, setQrSecondsLeft] = useState<number>(60);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [qrCheckInPlayerId, setQrCheckInPlayerId] = useState('');
  const [qrSimSuccess, setQrSimSuccess] = useState<string | null>(null);

  // Events / Audit Modal
  const [isEventsModalOpen, setIsEventsModalOpen] = useState(false);
  const [events, setEvents] = useState<AttendanceEventSummary[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  // Bulk action in flight
  const [isBulkMarking, setIsBulkMarking] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  const loadSessionDetails = useCallback(async () => {
    if (!sessionId) return;
    setIsFetching(true);
    setErrorMsg(null);
    try {
      const data = await api.attendance.getSession(sessionId);
      setSession(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'فشل تحميل كشف الحضور للحصة');
    } finally {
      setIsFetching(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (user && activeTenant && sessionId) {
      void loadSessionDetails();
    }
  }, [user, activeTenant, sessionId, loadSessionDetails]);

  // QR Countdown Timer
  useEffect(() => {
    if (!isQrModalOpen || qrSecondsLeft <= 0) return;
    const interval = setInterval(() => {
      setQrSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isQrModalOpen, qrSecondsLeft]);

  // Generate QR Code
  const handleOpenQrModal = async () => {
    setIsQrModalOpen(true);
    setIsGeneratingQr(true);
    setQrSimSuccess(null);
    try {
      const res = await api.attendance.generateQr(sessionId, { expiresInSeconds: 120 });
      setQrData(res);
      setQrSecondsLeft(120);
      const firstRosterItem = session?.roster?.[0];
      if (firstRosterItem) {
        setQrCheckInPlayerId(firstRosterItem.playerId);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'فشل توليد رمز QR');
    } finally {
      setIsGeneratingQr(false);
    }
  };

  // Simulate QR Check-In
  const handleSimulateQrCheckIn = async () => {
    if (!qrData || !qrCheckInPlayerId) return;
    try {
      await api.attendance.checkInViaQr(sessionId, {
        token: qrData.token,
        playerId: qrCheckInPlayerId,
      });
      setQrSimSuccess('تم تسجيل الحضور عبر QR بنجاح!');
      await loadSessionDetails();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'فشل التحضير بالرمز');
    }
  };

  // Open Event Stream Modal
  const handleOpenEventsModal = async () => {
    setIsEventsModalOpen(true);
    setIsLoadingEvents(true);
    try {
      const evList = await api.attendance.getSessionEvents(sessionId);
      setEvents(evList);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  // Close Session
  const handleCloseSession = async () => {
    if (!confirm('هل أنت متأكد من إغلاق الحصة التدريبية؟ سيتم قفل التحضير.')) return;
    try {
      await api.attendance.closeSession(sessionId);
      await loadSessionDetails();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'فشل إغلاق الحصة');
    }
  };

  // One-Tap Attendance Marking (Idempotent)
  const handleMarkStatus = async (
    item: AttendanceRosterItem,
    newStatus: Exclude<AttendanceStatus, 'UNMARKED'>,
  ) => {
    if (!session || session.status === 'CLOSED') return;
    if (item.status === newStatus) return; // already in this status

    // Optimistic UI Update
    const previousRoster = [...session.roster];
    const updatedRoster = session.roster.map((r) =>
      r.playerId === item.playerId
        ? {
            ...r,
            status: newStatus,
            checkInTime:
              newStatus === 'PRESENT' || newStatus === 'LATE'
                ? new Date().toISOString()
                : r.checkInTime,
            version: r.version + 1,
          }
        : r,
    );

    // Recompute totals
    const totalPresent = updatedRoster.filter((r) => r.status === 'PRESENT').length;
    const totalLate = updatedRoster.filter((r) => r.status === 'LATE').length;
    const totalAbsent = updatedRoster.filter((r) => r.status === 'ABSENT').length;
    const totalExcused = updatedRoster.filter((r) => r.status === 'EXCUSED').length;
    const totalUnmarked = updatedRoster.filter((r) => r.status === 'UNMARKED').length;

    setSession({
      ...session,
      status: session.status === 'SCHEDULED' ? 'IN_PROGRESS' : session.status,
      roster: updatedRoster,
      totalPresent,
      totalLate,
      totalAbsent,
      totalExcused,
      totalUnmarked,
    });

    setPendingPlayerIds((prev) => new Set(prev).add(item.playerId));

    try {
      const idempotencyKey = crypto.randomUUID();
      const updatedItem = await api.attendance.recordAttendance({
        sessionId,
        playerId: item.playerId,
        status: newStatus,
        idempotencyKey,
        expectedVersion: item.version,
      });

      // Synchronize exact server version
      setSession((curr) => {
        if (!curr) return null;
        return {
          ...curr,
          roster: curr.roster.map((r) => (r.playerId === item.playerId ? updatedItem : r)),
        };
      });
    } catch (err) {
      console.error('Failed to mark attendance, rolling back:', err);
      // Rollback on error
      setSession((curr) => (curr ? { ...curr, roster: previousRoster } : null));
      alert(err instanceof Error ? err.message : 'فشل تسجيل حالة الحضور');
    } finally {
      setPendingPlayerIds((prev) => {
        const next = new Set(prev);
        next.delete(item.playerId);
        return next;
      });
    }
  };

  // Bulk Mark All Unmarked as Present
  const handleBulkMarkPresent = async () => {
    if (!session || session.status === 'CLOSED') return;
    const unmarkedPlayers = session.roster.filter((r) => r.status === 'UNMARKED');
    if (unmarkedPlayers.length === 0) {
      alert('جميع اللاعبين تم تسجيل حضورهم بالفعل');
      return;
    }

    if (
      !confirm(
        `هل تريد تحضير جميع اللاعبين غير المحددين (${unmarkedPlayers.length} لاعب) كـ "حاضر" دفعة واحدة؟`,
      )
    ) {
      return;
    }

    setIsBulkMarking(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      await api.attendance.bulkRecordAttendance({
        sessionId,
        idempotencyKey,
        records: unmarkedPlayers.map((p) => ({
          playerId: p.playerId,
          status: 'PRESENT',
          expectedVersion: p.version,
        })),
      });
      await loadSessionDetails();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'فشل التحضير الجماعي');
    } finally {
      setIsBulkMarking(false);
    }
  };

  if (isLoading || isFetching) {
    return (
      <div className="min-h-screen bg-[#0f1c18] flex items-center justify-center text-[#9bb5a8]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-[#2f9e6b]" />
          <p className="text-sm font-medium">جارٍ تحميل كشف الحضور للحصة التدريبية...</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !session) {
    return (
      <div className="min-h-screen bg-[#0f1c18] text-[#e8f0ec] flex flex-col font-sans">
        <Navbar />
        <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-12 text-center space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-white">تعذر الوصول للحصة التدريبية</h2>
          <p className="text-sm text-[#9bb5a8]">{errorMsg || 'الحصة غير موجودة'}</p>
          <Link
            href="/sessions"
            className="inline-flex items-center gap-2 rounded-xl bg-[#2f9e6b] px-4 py-2 text-xs font-semibold text-[#062016]"
          >
            العودة لجدول الحصص
          </Link>
        </main>
      </div>
    );
  }

  const isClosed = session.status === 'CLOSED';
  const totalRoster = session.roster.length;
  const filteredRoster = session.roster.filter((item) => {
    const matchesSearch = item.playerName.toLowerCase().includes(searchTerm.trim().toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-[#0f1c18] text-[#e8f0ec] flex flex-col font-sans pb-16">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#9bb5a8]">
          <Link href="/sessions" className="hover:text-[#45c387] transition-colors">
            الحصص التدريبية
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-white font-medium">{session.groupName}</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span>كشف الحضور المباشر</span>
        </div>

        {/* Hero Session Control Card */}
        <div className="rounded-2xl border border-[#234235] bg-[#162821] p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold border ${
                    session.status === 'IN_PROGRESS'
                      ? 'bg-[#2f9e6b]/20 text-[#45c387] border-[#2f9e6b]/40 animate-pulse'
                      : session.status === 'SCHEDULED'
                        ? 'bg-[#3b82f6]/20 text-[#60a5fa] border-[#3b82f6]/40'
                        : 'bg-[#64748b]/20 text-[#94a3b8] border-[#64748b]/40'
                  }`}
                >
                  {session.status === 'IN_PROGRESS'
                    ? '• الحصة جارية الآن'
                    : session.status === 'SCHEDULED'
                      ? 'حصة مجدولة'
                      : 'حصة مغلقة ومؤكدة'}
                </span>

                <span className="flex items-center gap-1 text-xs text-[#9bb5a8]">
                  <Building2 className="h-3.5 w-3.5 text-[#2f9e6b]" />
                  {session.branchName}
                </span>

                <span className="flex items-center gap-1 text-xs text-[#9bb5a8]">
                  <Calendar className="h-3.5 w-3.5 text-[#2f9e6b]" />
                  {session.sessionDate}
                </span>

                <span className="flex items-center gap-1 text-xs text-[#9bb5a8]">
                  <Clock className="h-3.5 w-3.5 text-[#2f9e6b]" />
                  {session.startTime} - {session.endTime}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                كشف حضور: {session.groupName}
              </h1>
              {session.coachName && (
                <p className="text-xs text-[#9bb5a8]">
                  المدرب المشرف:{' '}
                  <span className="text-white font-semibold">{session.coachName}</span>
                </p>
              )}
            </div>

            {/* Quick Session Actions */}
            <div className="flex flex-wrap items-center gap-3">
              {/* QR Check-In Modal Trigger */}
              {!isClosed && (
                <button
                  type="button"
                  id="btn-open-qr-modal"
                  onClick={handleOpenQrModal}
                  className="flex items-center gap-2 rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-4 py-2.5 text-xs font-semibold text-[#45c387] hover:border-[#2f9e6b] transition-all cursor-pointer"
                >
                  <QrCode className="h-4 w-4" />
                  <span>رمز QR للتحضير</span>
                </button>
              )}

              {/* Event Stream History */}
              <button
                type="button"
                id="btn-open-events-modal"
                onClick={handleOpenEventsModal}
                className="flex items-center gap-2 rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-4 py-2.5 text-xs font-semibold text-[#9bb5a8] hover:text-white hover:border-[#2f9e6b] transition-all cursor-pointer"
              >
                <History className="h-4 w-4" />
                <span>سجل العمليات (Audit)</span>
              </button>

              {/* Close Session Button */}
              {!isClosed && (
                <button
                  type="button"
                  id="btn-close-session"
                  onClick={handleCloseSession}
                  className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
                >
                  <Lock className="h-4 w-4" />
                  <span>إغلاق الحصة وتثبيت الكشف</span>
                </button>
              )}
            </div>
          </div>

          {/* Live KPI Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-[#234235]">
            {/* Total */}
            <div className="rounded-xl border border-[#234235] bg-[#0f1c18] p-3 text-center">
              <span className="text-[11px] text-[#9bb5a8] block mb-1">إجمالي الكشف</span>
              <span className="text-xl font-extrabold text-white">{totalRoster}</span>
            </div>

            {/* Present */}
            <div className="rounded-xl border border-[#2f9e6b]/30 bg-[#2f9e6b]/10 p-3 text-center">
              <span className="text-[11px] text-[#45c387] block mb-1 font-semibold">
                حاضر (Present)
              </span>
              <span className="text-xl font-extrabold text-[#45c387]">{session.totalPresent}</span>
            </div>

            {/* Late */}
            <div className="rounded-xl border border-[#facc15]/30 bg-[#facc15]/10 p-3 text-center">
              <span className="text-[11px] text-[#facc15] block mb-1 font-semibold">
                متأخر (Late)
              </span>
              <span className="text-xl font-extrabold text-[#facc15]">{session.totalLate}</span>
            </div>

            {/* Absent */}
            <div className="rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/10 p-3 text-center">
              <span className="text-[11px] text-[#f87171] block mb-1 font-semibold">
                غائب (Absent)
              </span>
              <span className="text-xl font-extrabold text-[#f87171]">{session.totalAbsent}</span>
            </div>

            {/* Excused */}
            <div className="rounded-xl border border-[#38bdf8]/30 bg-[#38bdf8]/10 p-3 text-center">
              <span className="text-[11px] text-[#38bdf8] block mb-1 font-semibold">
                معذور (Excused)
              </span>
              <span className="text-xl font-extrabold text-[#38bdf8]">{session.totalExcused}</span>
            </div>

            {/* Unmarked */}
            <div className="rounded-xl border border-[#64748b]/30 bg-[#64748b]/10 p-3 text-center">
              <span className="text-[11px] text-[#94a3b8] block mb-1 font-semibold">
                غير محدد (Unmarked)
              </span>
              <span className="text-xl font-extrabold text-[#94a3b8]">{session.totalUnmarked}</span>
            </div>
          </div>
        </div>

        {/* Global Bulk Action & Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-[#2f9e6b] text-[#062016]'
                  : 'bg-[#162821] text-[#9bb5a8] hover:text-white'
              }`}
            >
              الكل ({session.roster.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('UNMARKED')}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'UNMARKED'
                  ? 'bg-[#64748b] text-white'
                  : 'bg-[#162821] text-[#94a3b8] hover:text-white'
              }`}
            >
              غير محدد ({session.totalUnmarked})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('PRESENT')}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'PRESENT'
                  ? 'bg-[#2f9e6b] text-[#062016]'
                  : 'bg-[#162821] text-[#45c387] hover:bg-[#2f9e6b]/20'
              }`}
            >
              حاضر ({session.totalPresent})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('LATE')}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'LATE'
                  ? 'bg-[#facc15] text-[#062016]'
                  : 'bg-[#162821] text-[#facc15] hover:bg-[#facc15]/20'
              }`}
            >
              متأخر ({session.totalLate})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ABSENT')}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'ABSENT'
                  ? 'bg-[#ef4444] text-white'
                  : 'bg-[#162821] text-[#f87171] hover:bg-[#ef4444]/20'
              }`}
            >
              غائب ({session.totalAbsent})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('EXCUSED')}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'EXCUSED'
                  ? 'bg-[#38bdf8] text-[#062016]'
                  : 'bg-[#162821] text-[#38bdf8] hover:bg-[#38bdf8]/20'
              }`}
            >
              معذور ({session.totalExcused})
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 md:w-64">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9bb5a8]" />
              <input
                type="text"
                id="input-search-roster"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="البحث باسم اللاعب..."
                className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] pr-10 pl-3 py-2 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
              />
            </div>

            {/* Bulk Mark All Unmarked as Present */}
            {!isClosed && session.totalUnmarked > 0 && (
              <button
                type="button"
                id="btn-bulk-mark-present"
                disabled={isBulkMarking}
                onClick={handleBulkMarkPresent}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] px-4 py-2 text-xs font-bold text-[#062016] shadow hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>تحضير الكل كحاضر ({session.totalUnmarked})</span>
              </button>
            )}
          </div>
        </div>

        {/* Closed Session Alert */}
        {isClosed && (
          <div className="rounded-xl border border-[#64748b]/40 bg-[#162821] p-4 flex items-center gap-3 text-xs text-[#9bb5a8]">
            <Lock className="h-5 w-5 text-[#facc15] shrink-0" />
            <span>
              تم إغلاق هذه الحصة التدريبية رسمياً وتثبيت الكشف. جميع السجلات مقفلة ضد التعديل
              المباشر إلا عبر طلب تصحيح رسمي.
            </span>
          </div>
        )}

        {/* ROSTER LIST: ONE-TAP ATTENDANCE MARKING */}
        {filteredRoster.length === 0 ? (
          <div className="rounded-2xl border border-[#234235] bg-[#162821]/60 p-12 text-center text-[#9bb5a8] space-y-2">
            <Users className="h-8 w-8 mx-auto text-[#2f9e6b]" />
            <p className="text-sm font-semibold text-white">
              لا يوجد لاعبين مطابقين للبحث أو الفلتر
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRoster.map((item) => {
              const isPending = pendingPlayerIds.has(item.playerId);

              return (
                <div
                  key={item.playerId}
                  id={`roster-row-${item.playerId}`}
                  className={`rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-md ${
                    item.status === 'PRESENT'
                      ? 'border-[#2f9e6b]/40 bg-[#162821]/95'
                      : item.status === 'LATE'
                        ? 'border-[#facc15]/40 bg-[#162821]/95'
                        : item.status === 'ABSENT'
                          ? 'border-[#ef4444]/40 bg-[#162821]/95'
                          : item.status === 'EXCUSED'
                            ? 'border-[#38bdf8]/40 bg-[#162821]/95'
                            : 'border-[#234235] bg-[#162821]/80 hover:border-[#2f9e6b]/30'
                  }`}
                >
                  {/* Player Info */}
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl font-bold text-sm ${
                        item.status === 'PRESENT'
                          ? 'bg-[#2f9e6b]/20 text-[#45c387]'
                          : item.status === 'LATE'
                            ? 'bg-[#facc15]/20 text-[#facc15]'
                            : item.status === 'ABSENT'
                              ? 'bg-[#ef4444]/20 text-[#f87171]'
                              : item.status === 'EXCUSED'
                                ? 'bg-[#38bdf8]/20 text-[#38bdf8]'
                                : 'bg-[#0f1c18] text-[#9bb5a8]'
                      }`}
                    >
                      {item.playerName.slice(0, 2)}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white">{item.playerName}</h3>
                        {item.jerseyNumber && (
                          <span className="rounded-full bg-[#0f1c18] px-2 py-0.5 text-[10px] font-bold text-[#45c387] border border-[#234235]">
                            #{item.jerseyNumber}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-[#9bb5a8] mt-0.5">
                        {item.status === 'PRESENT' && (
                          <span className="text-[#45c387] font-semibold flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            حاضر {item.checkInTime ? `(${item.checkInTime.slice(11, 16)})` : ''}
                          </span>
                        )}
                        {item.status === 'LATE' && (
                          <span className="text-[#facc15] font-semibold flex items-center gap-1">
                            <Clock4 className="h-3.5 w-3.5" />
                            متأخر {item.checkInTime ? `(${item.checkInTime.slice(11, 16)})` : ''}
                          </span>
                        )}
                        {item.status === 'ABSENT' && (
                          <span className="text-[#f87171] font-semibold flex items-center gap-1">
                            <XCircle className="h-3.5 w-3.5" />
                            غائب
                          </span>
                        )}
                        {item.status === 'EXCUSED' && (
                          <span className="text-[#38bdf8] font-semibold flex items-center gap-1">
                            <HelpCircle className="h-3.5 w-3.5" />
                            غياب بعذر
                          </span>
                        )}
                        {item.status === 'UNMARKED' && (
                          <span className="text-[#94a3b8] italic">لم يسجل بعد</span>
                        )}
                        {item.remarks && <span className="text-white/60">• {item.remarks}</span>}
                      </div>
                    </div>
                  </div>

                  {/* ONE-TAP ACTION BUTTONS */}
                  <div className="flex items-center gap-1.5 sm:gap-2 self-end sm:self-center">
                    {/* 1. PRESENT */}
                    <button
                      type="button"
                      id={`btn-mark-present-${item.playerId}`}
                      disabled={isClosed || isPending}
                      onClick={() => handleMarkStatus(item, 'PRESENT')}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        item.status === 'PRESENT'
                          ? 'bg-[#2f9e6b] text-[#062016] shadow-md shadow-[#2f9e6b]/30 ring-2 ring-[#45c387]'
                          : 'bg-[#12231c] text-[#9bb5a8] hover:text-[#45c387] hover:bg-[#2f9e6b]/15 border border-[#2b4c3e]'
                      }`}
                    >
                      <Check className="h-4 w-4" />
                      <span>حاضر</span>
                    </button>

                    {/* 2. LATE */}
                    <button
                      type="button"
                      id={`btn-mark-late-${item.playerId}`}
                      disabled={isClosed || isPending}
                      onClick={() => handleMarkStatus(item, 'LATE')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        item.status === 'LATE'
                          ? 'bg-[#facc15] text-[#062016] shadow-md shadow-[#facc15]/30 ring-2 ring-[#fde047]'
                          : 'bg-[#12231c] text-[#9bb5a8] hover:text-[#facc15] hover:bg-[#facc15]/15 border border-[#2b4c3e]'
                      }`}
                    >
                      <Clock4 className="h-3.5 w-3.5" />
                      <span>متأخر</span>
                    </button>

                    {/* 3. ABSENT */}
                    <button
                      type="button"
                      id={`btn-mark-absent-${item.playerId}`}
                      disabled={isClosed || isPending}
                      onClick={() => handleMarkStatus(item, 'ABSENT')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        item.status === 'ABSENT'
                          ? 'bg-[#ef4444] text-white shadow-md shadow-[#ef4444]/30 ring-2 ring-red-400'
                          : 'bg-[#12231c] text-[#9bb5a8] hover:text-[#f87171] hover:bg-red-500/15 border border-[#2b4c3e]'
                      }`}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>غائب</span>
                    </button>

                    {/* 4. EXCUSED */}
                    <button
                      type="button"
                      id={`btn-mark-excused-${item.playerId}`}
                      disabled={isClosed || isPending}
                      onClick={() => handleMarkStatus(item, 'EXCUSED')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        item.status === 'EXCUSED'
                          ? 'bg-[#38bdf8] text-[#062016] shadow-md shadow-[#38bdf8]/30 ring-2 ring-sky-300'
                          : 'bg-[#12231c] text-[#9bb5a8] hover:text-[#38bdf8] hover:bg-sky-500/15 border border-[#2b4c3e]'
                      }`}
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      <span>بعذر</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* QR MODAL */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-[#234235] bg-[#12231c] p-6 shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#234235] pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2f9e6b]/20 text-[#45c387]">
                  <QrCode className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-white">رمز QR المؤقت للتحضير</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="p-1 text-[#9bb5a8] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Timer countdown */}
            <div className="flex items-center justify-between rounded-xl bg-[#0f1c18] border border-[#234235] px-4 py-2.5 text-xs">
              <span className="text-[#9bb5a8] flex items-center gap-1.5">
                <Timer className="h-4 w-4 text-[#facc15]" />
                صلاحية الرمز تنتهي خلال:
              </span>
              <span
                className={`font-mono font-bold text-sm ${qrSecondsLeft < 15 ? 'text-red-400 animate-pulse' : 'text-[#45c387]'}`}
              >
                {qrSecondsLeft} ثانية
              </span>
            </div>

            {/* QR Visual Card */}
            <div className="rounded-2xl border border-[#234235] bg-white p-6 flex flex-col items-center justify-center text-center shadow-inner">
              {isGeneratingQr ? (
                <RefreshCw className="h-12 w-12 animate-spin text-[#0f1c18]" />
              ) : (
                <div className="space-y-3">
                  {/* Decorative QR code graphic using SVG matrix */}
                  <div className="mx-auto w-48 h-48 bg-[#062016] rounded-xl p-3 flex flex-col justify-between shadow-lg">
                    <div className="flex justify-between">
                      <div className="w-10 h-10 border-4 border-white bg-[#062016] p-1">
                        <div className="w-full h-full bg-[#45c387]" />
                      </div>
                      <div className="w-10 h-10 border-4 border-white bg-[#062016] p-1">
                        <div className="w-full h-full bg-[#45c387]" />
                      </div>
                    </div>
                    <div className="flex items-center justify-center text-center">
                      <QrCode className="h-12 w-12 text-[#45c387]" />
                    </div>
                    <div className="flex justify-between">
                      <div className="w-10 h-10 border-4 border-white bg-[#062016] p-1">
                        <div className="w-full h-full bg-[#45c387]" />
                      </div>
                      <div className="w-6 h-6 bg-white/40 self-end" />
                    </div>
                  </div>
                  <p className="text-[11px] font-mono text-gray-700 break-all select-all">
                    {qrData?.qrPayload || 'ACADEMY:SESSION:CHECKIN'}
                  </p>
                </div>
              )}
            </div>

            {/* Refresh Token Button */}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                id="btn-refresh-qr"
                onClick={handleOpenQrModal}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-[#2b4c3e] bg-[#0f1c18] py-2 text-xs font-semibold text-[#45c387] hover:border-[#2f9e6b] transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>تجديد الرمز فوراً</span>
              </button>
            </div>

            {/* Quick QR Check-in Simulator */}
            <div className="rounded-xl border border-[#234235] bg-[#0f1c18] p-4 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <UserCheck className="h-4 w-4 text-[#2f9e6b]" />
                <span>محاكي المسح للاعب (Quick QR Scanner)</span>
              </div>
              <p className="text-[11px] text-[#9bb5a8]">
                للاختبار دون ماسح ضوئي كاميرا، اختر لاعباً وانقر لتسجيل حضوره بالرمز الحالي:
              </p>

              {qrSimSuccess && (
                <div className="rounded-lg bg-[#2f9e6b]/20 border border-[#2f9e6b]/40 p-2 text-xs text-[#45c387] flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{qrSimSuccess}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <select
                  value={qrCheckInPlayerId}
                  onChange={(e) => setQrCheckInPlayerId(e.target.value)}
                  className="flex-1 rounded-xl border border-[#2b4c3e] bg-[#12231c] px-3 py-2 text-xs text-[#e8f0ec] focus:outline-none"
                >
                  {session.roster.map((r) => (
                    <option key={r.playerId} value={r.playerId}>
                      {r.playerName} ({r.status})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  id="btn-simulate-qr-checkin"
                  disabled={!qrData || qrSecondsLeft <= 0}
                  onClick={handleSimulateQrCheckIn}
                  className="rounded-xl bg-[#2f9e6b] px-3.5 py-2 text-xs font-bold text-[#062016] hover:brightness-110 disabled:opacity-50"
                >
                  تسجيل بالرمز
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EVENTS AUDIT MODAL */}
      {isEventsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-[#234235] bg-[#12231c] p-6 shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#234235] pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2f9e6b]/20 text-[#45c387]">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">سجل العمليات والتدقيق التراكمي</h3>
                  <p className="text-xs text-[#9bb5a8]">
                    سجل غير قابل للتعديل (Append-Only Event Stream) لجميع حركات التحضير والتصحيح.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEventsModalOpen(false)}
                className="p-1 text-[#9bb5a8] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isLoadingEvents ? (
              <div className="p-8 text-center text-[#9bb5a8]">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-[#2f9e6b] mb-2" />
                <p className="text-xs">جارٍ جلب سجل الأحداث...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="p-8 text-center text-[#9bb5a8]">
                <p className="text-xs">لا توجد حركات مسجلة في هذه الحصة حتى الآن.</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2.5 pr-1">
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-xl border border-[#234235] bg-[#0f1c18] p-3 text-xs flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{ev.playerName}</span>
                        <span className="text-[#9bb5a8]">←</span>
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                            ev.newStatus === 'PRESENT'
                              ? 'bg-[#2f9e6b]/20 text-[#45c387]'
                              : ev.newStatus === 'LATE'
                                ? 'bg-[#facc15]/20 text-[#facc15]'
                                : ev.newStatus === 'ABSENT'
                                  ? 'bg-[#ef4444]/20 text-[#f87171]'
                                  : 'bg-[#38bdf8]/20 text-[#38bdf8]'
                          }`}
                        >
                          {ev.newStatus}
                        </span>
                        <span className="text-[10px] text-[#9bb5a8]">(المصدر: {ev.source})</span>
                      </div>
                      {ev.reason && (
                        <p className="text-[11px] text-[#9bb5a8]">السبب: {ev.reason}</p>
                      )}
                    </div>

                    <div className="text-left text-[10px] text-[#9bb5a8]">
                      <div>{ev.eventAt.slice(0, 10)}</div>
                      <div className="font-mono text-white/70">{ev.eventAt.slice(11, 19)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
