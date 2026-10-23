'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../../lib/auth-context';
import { AppShell } from '../../../../components/layout/AppShell';
import { PageHeader } from '../../../../components/ui/PageHeader';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { api } from '../../../../lib/api-client';
import type {
  AttendanceEventSummary,
  AttendanceRosterItem,
  AttendanceStatus,
  GenerateQrResponse,
  SessionDetails,
  SessionCashierSummary,
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
  Check,
  UserCheck,
  Timer,
  X,
  CreditCard,
  Wallet,
  Receipt,
  PlusCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
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

  // Session Cashier Summary
  const [cashierSummary, setCashierSummary] = useState<SessionCashierSummary | null>(null);
  const [isCashierExpanded, setIsCashierExpanded] = useState(true);
  const [_isLoadingCashier, setIsLoadingCashier] = useState(false);

  // Payment Collection Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPlayerForPayment, setSelectedPlayerForPayment] = useState<AttendanceRosterItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'POS' | 'BANK_TRANSFER'>('CASH');
  const [paymentRefNumber, setPaymentRefNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Session Expense Modal
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseNotes, setExpenseNotes] = useState('');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // Close Cashier Modal
  const [isCloseCashierModalOpen, setIsCloseCashierModalOpen] = useState(false);
  const [closeCashierNotes, setCloseCashierNotes] = useState('');
  const [isSubmittingCloseCashier, setIsSubmittingCloseCashier] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  const loadCashierSummary = useCallback(async () => {
    if (!sessionId) return;
    setIsLoadingCashier(true);
    try {
      const summary = await api.finance.getSessionCashierSummary(sessionId);
      setCashierSummary(summary);
    } catch {
      // Non-blocking if finance permissions are limited
    } finally {
      setIsLoadingCashier(false);
    }
  }, [sessionId]);

  const loadSessionDetails = useCallback(async () => {
    if (!sessionId) return;
    setIsFetching(true);
    setErrorMsg(null);
    try {
      const data = await api.attendance.getSession(sessionId);
      setSession(data);
      void loadCashierSummary();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'فشل تحميل كشف الحضور للحصة');
    } finally {
      setIsFetching(false);
    }
  }, [sessionId, loadCashierSummary]);

  useEffect(() => {
    if (user && activeTenant && sessionId) {
      void loadSessionDetails();
    }
  }, [user, activeTenant, sessionId, loadSessionDetails]);

  // Payment Handler
  const handleOpenPaymentModal = (item: AttendanceRosterItem) => {
    setSelectedPlayerForPayment(item);
    const defaultAmount =
      item.outstandingBalance && item.outstandingBalance > 0
        ? item.outstandingBalance
        : item.amountDue && item.amountDue > 0
          ? item.amountDue
          : 650;
    setPaymentAmount(defaultAmount);
    setPaymentMethod('CASH');
    setPaymentRefNumber('');
    setPaymentNotes('');
    setIsPaymentModalOpen(true);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayerForPayment || !session || paymentAmount <= 0) return;
    setIsSubmittingPayment(true);
    try {
      await api.finance.recordPayment({
        playerId: selectedPlayerForPayment.playerId,
        subscriptionId: selectedPlayerForPayment.subscriptionId || undefined,
        branchId: session.branchId,
        sessionId: session.id,
        amount: Number(paymentAmount),
        paymentMethod,
        referenceNumber: paymentRefNumber.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
      });
      setIsPaymentModalOpen(false);
      await Promise.all([loadSessionDetails(), loadCashierSummary()]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'فشل تسجيل الدفعة');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || expenseAmount <= 0 || !expenseNotes.trim()) return;
    setIsSubmittingExpense(true);
    try {
      await api.finance.recordSessionExpense(sessionId, {
        branchId: session.branchId,
        amount: Number(expenseAmount),
        paymentMethod: 'CASH',
        notes: expenseNotes.trim(),
      });
      setIsExpenseModalOpen(false);
      setExpenseAmount(0);
      setExpenseNotes('');
      await loadCashierSummary();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'فشل تسجيل المصروف');
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  const handleConfirmCloseCashier = async () => {
    if (!session) return;
    setIsSubmittingCloseCashier(true);
    try {
      await api.finance.closeSessionCashier(sessionId, {
        notes: closeCashierNotes.trim() || undefined,
      });
      setIsCloseCashierModalOpen(false);
      setCloseCashierNotes('');
      await loadCashierSummary();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'فشل إغلاق الصندوق المالي');
    } finally {
      setIsSubmittingCloseCashier(false);
    }
  };

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

      // Synchronize exact server version while safely preserving playerName and photoUrl
      const rawRecord = (updatedItem as { record?: Partial<AttendanceRosterItem> & { id?: string } })?.record;
      const serverItem: Partial<AttendanceRosterItem> & { id?: string } = rawRecord || (updatedItem as Partial<AttendanceRosterItem> & { id?: string });
      setSession((curr) => {
        if (!curr) return null;
        return {
          ...curr,
          roster: (curr.roster || []).map((r) =>
            r.playerId === item.playerId
              ? {
                  ...r,
                  ...serverItem,
                  recordId: serverItem.id || serverItem.recordId || r.recordId,
                  playerName: serverItem.playerName || r.playerName || 'لاعب غير معروف',
                  photoUrl: serverItem.photoUrl !== undefined ? serverItem.photoUrl : r.photoUrl,
                  status: serverItem.status || newStatus,
                  version: serverItem.version || r.version + 1,
                }
              : r,
          ),
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
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-[var(--brand-primary)]" />
            <p className="text-sm font-medium text-[var(--text-muted)]">جارٍ تحميل كشف الحضور للحصة التدريبية...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (errorMsg || !session) {
    return (
      <AppShell>
        <ErrorState
          title="تعذر الوصول للحصة التدريبية"
          message={errorMsg || 'الحصة غير موجودة'}
          onRetry={loadSessionDetails}
        />
      </AppShell>
    );
  }

  const isClosed = session.status === 'CLOSED';
  const totalRoster = session.roster?.length || 0;
  const filteredRoster = (session.roster || []).filter((item) => {
    const rawName = typeof item?.playerName === 'string' ? item.playerName : '';
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query || rawName.toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'ALL' || item?.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={[
            { label: 'الرئيسية', href: '/dashboard' },
            { label: 'الحصص التدريبية', href: '/sessions' },
            { label: session.groupName },
            { label: 'كشف الحضور المباشر' },
          ]}
          title={`كشف حضور: ${session.groupName}`}
          description={session.coachName ? `المدرب المشرف: ${session.coachName}` : undefined}
          actions={
            <div className="flex flex-wrap items-center gap-2.5">
              {!isClosed && (
                <Link
                  href={`/attendance/scanner?sessionId=${sessionId}`}
                  id="btn-open-scanner"
                  className="flex items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 py-2 text-xs font-bold text-white shadow-sm hover:brightness-110 transition-all cursor-pointer"
                >
                  <QrCode className="h-4 w-4" />
                  <span>ماسح الحضور بالكاميرا</span>
                </Link>
              )}

              {!isClosed && (
                <button
                  type="button"
                  id="btn-open-qr-modal"
                  onClick={handleOpenQrModal}
                  className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-semibold text-[var(--brand-primary)] hover:border-[var(--brand-primary)] transition-all cursor-pointer"
                >
                  <QrCode className="h-4 w-4" />
                  <span>رمز QR للحصة</span>
                </button>
              )}

              <button
                type="button"
                id="btn-open-events-modal"
                onClick={handleOpenEventsModal}
                className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--brand-primary)] transition-all cursor-pointer"
              >
                <History className="h-4 w-4" />
                <span>سجل العمليات (Audit)</span>
              </button>

              {!isClosed && (
                <button
                  type="button"
                  id="btn-close-session"
                  onClick={handleCloseSession}
                  className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/20 transition-all cursor-pointer"
                >
                  <Lock className="h-4 w-4" />
                  <span>إغلاق الحصة وتثبيت الكشف</span>
                </button>
              )}
            </div>
          }
        />

        {/* Session Meta & Live KPI Counters */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold border ${
                session.status === 'IN_PROGRESS'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 animate-pulse'
                  : session.status === 'SCHEDULED'
                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                    : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30'
              }`}
            >
              {session.status === 'IN_PROGRESS'
                ? '• الحصة جارية الآن'
                : session.status === 'SCHEDULED'
                  ? 'حصة مجدولة'
                  : 'حصة مغلقة ومؤكدة'}
            </span>

            <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <Building2 className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
              <span>{session.branchName}</span>
            </span>

            <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <Calendar className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
              <span>{session.sessionDate}</span>
            </span>

            <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <Clock className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
              <span>{session.startTime} - {session.endTime}</span>
            </span>
          </div>

          {/* Live KPI Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4 border-t border-[var(--border-subtle)]">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-center">
              <span className="text-[11px] text-[var(--text-muted)] block mb-1">إجمالي الكشف</span>
              <span className="text-xl font-extrabold text-[var(--text-primary)]">{totalRoster}</span>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block mb-1 font-semibold">
                حاضر (Present)
              </span>
              <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{session.totalPresent}</span>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
              <span className="text-[11px] text-amber-600 dark:text-amber-400 block mb-1 font-semibold">
                متأخر (Late)
              </span>
              <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400">{session.totalLate}</span>
            </div>

            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-center">
              <span className="text-[11px] text-rose-600 dark:text-rose-400 block mb-1 font-semibold">
                غائب (Absent)
              </span>
              <span className="text-xl font-extrabold text-rose-600 dark:text-rose-400">{session.totalAbsent}</span>
            </div>

            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 text-center">
              <span className="text-[11px] text-sky-600 dark:text-sky-400 block mb-1 font-semibold">
                معذور (Excused)
              </span>
              <span className="text-xl font-extrabold text-sky-600 dark:text-sky-400">{session.totalExcused}</span>
            </div>

            <div className="rounded-xl border border-slate-500/20 bg-slate-500/5 p-3 text-center">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1 font-semibold">
                غير محدد (Unmarked)
              </span>
              <span className="text-xl font-extrabold text-slate-600 dark:text-slate-300">{session.totalUnmarked}</span>
            </div>
          </div>
        </div>

        {/* SESSION CASHIER & DAILY RECONCILIATION */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  صندوق الحصة التدريبية والإغلاق المالي (Session Cashier & Reconciliation)
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  متابعة التحصيلات الميدانية النقدية والإلكترونية ومصروفات الحصة والتسوية المحاسبية.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {cashierSummary?.isReconciled ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>
                    تمت المطابقة والإغلاق {cashierSummary.closedByUserName ? `بواسطة ${cashierSummary.closedByUserName}` : ''}
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 px-3 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 border border-blue-500/30">
                  <Clock className="h-3.5 w-3.5" />
                  <span>الصندوق مفتوح وجارٍ التحصيل</span>
                </span>
              )}

              <button
                type="button"
                onClick={() => setIsCashierExpanded(!isCashierExpanded)}
                className="p-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                {isCashierExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {isCashierExpanded && (
            <div className="space-y-4 pt-3 border-t border-[var(--border-subtle)]">
              {/* Cashier Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold block mb-0.5">
                    التحصيل النقدي (كاش)
                  </span>
                  <span className="text-lg font-extrabold text-[var(--text-primary)]">
                    {cashierSummary?.totalCashCollected ?? 0} <span className="text-xs font-normal">ر.س</span>
                  </span>
                </div>

                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                  <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold block mb-0.5">
                    التحصيل الإلكتروني (مدى/بطاقة)
                  </span>
                  <span className="text-lg font-extrabold text-[var(--text-primary)]">
                    {cashierSummary?.totalElectronicCollected ?? 0} <span className="text-xs font-normal">ر.س</span>
                  </span>
                </div>

                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
                  <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold block mb-0.5">
                    مصروفات الحصة (ماء/تجهيز)
                  </span>
                  <span className="text-lg font-extrabold text-[var(--text-primary)]">
                    {cashierSummary?.totalExpenses ?? 0} <span className="text-xs font-normal">ر.س</span>
                  </span>
                </div>

                <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
                  <span className="text-[11px] text-violet-600 dark:text-violet-400 font-semibold block mb-0.5">
                    صافي الحركة النقدية
                  </span>
                  <span className="text-lg font-extrabold text-[var(--text-primary)]">
                    {cashierSummary?.netCashMovement ?? 0} <span className="text-xs font-normal">ر.س</span>
                  </span>
                </div>
              </div>

              {/* Cashier Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsExpenseModalOpen(true)}
                    disabled={cashierSummary?.isReconciled}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs font-bold text-[var(--text-primary)] hover:border-[var(--brand-primary)] disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <PlusCircle className="h-4 w-4 text-rose-500" />
                    <span>تسجيل مصروف للحصة</span>
                  </button>
                </div>

                {!cashierSummary?.isReconciled && (
                  <button
                    type="button"
                    onClick={() => setIsCloseCashierModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:brightness-110 transition-all cursor-pointer"
                  >
                    <Receipt className="h-4 w-4" />
                    <span>مطابقة وإغلاق الصندوق المالي</span>
                  </button>
                )}
              </div>

              {/* Session Transactions History */}
              {cashierSummary?.transactions && cashierSummary.transactions.length > 0 && (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] overflow-hidden text-xs">
                  <div className="px-3.5 py-2 font-bold text-[var(--text-primary)] border-b border-[var(--border-subtle)]">
                    حركات الصندوق المسجلة في هذه الحصة ({cashierSummary.transactions.length})
                  </div>
                  <div className="divide-y divide-[var(--border-subtle)] max-h-48 overflow-y-auto">
                    {cashierSummary.transactions.map((tx) => (
                      <div key={tx.id} className="p-3 flex items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-[var(--text-primary)]">
                            {tx.type === 'SESSION_EXPENSE' ? 'مصروف حصة' : tx.playerName || 'سداد اشتراك'}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] flex items-center gap-2 mt-0.5">
                            <span>{tx.receiptNumber || tx.id.slice(0, 8)}</span>
                            <span>• {tx.paymentMethod}</span>
                            {tx.notes && <span>• {tx.notes}</span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`font-mono font-bold ${
                              tx.type === 'SESSION_EXPENSE' ? 'text-rose-500' : 'text-emerald-500'
                            }`}
                          >
                            {tx.type === 'SESSION_EXPENSE' ? '-' : '+'}
                            {tx.amount} ر.س
                          </span>
                          <div className="text-[10px] text-[var(--text-muted)]">
                            {tx.createdAt
                              ? new Date(tx.createdAt).toLocaleTimeString('ar-EG', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Global Bulk Action & Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-[var(--brand-primary)] text-white shadow-sm'
                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
              }`}
            >
              الكل ({session.roster.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('UNMARKED')}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'UNMARKED'
                  ? 'bg-slate-600 text-white shadow-sm'
                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
              }`}
            >
              غير محدد ({session.totalUnmarked})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('PRESENT')}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'PRESENT'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-[var(--bg-surface)] text-emerald-600 dark:text-emerald-400 border border-[var(--border-subtle)] hover:bg-emerald-500/10'
              }`}
            >
              حاضر ({session.totalPresent})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('LATE')}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'LATE'
                  ? 'bg-amber-500 text-slate-900 shadow-sm'
                  : 'bg-[var(--bg-surface)] text-amber-600 dark:text-amber-400 border border-[var(--border-subtle)] hover:bg-amber-500/10'
              }`}
            >
              متأخر ({session.totalLate})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ABSENT')}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'ABSENT'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-[var(--bg-surface)] text-rose-600 dark:text-rose-400 border border-[var(--border-subtle)] hover:bg-rose-500/10'
              }`}
            >
              غائب ({session.totalAbsent})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('EXCUSED')}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'EXCUSED'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-[var(--bg-surface)] text-sky-600 dark:text-sky-400 border border-[var(--border-subtle)] hover:bg-sky-500/10'
              }`}
            >
              معذور ({session.totalExcused})
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 md:w-64">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
              <input
                type="text"
                id="input-search-roster"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="البحث باسم اللاعب..."
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] pr-10 pl-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </div>

            {/* Bulk Mark All Unmarked as Present */}
            {!isClosed && session.totalUnmarked > 0 && (
              <button
                type="button"
                id="btn-bulk-mark-present"
                disabled={isBulkMarking}
                onClick={handleBulkMarkPresent}
                className="flex items-center gap-1.5 rounded-xl bg-[var(--brand-primary)] px-4 py-2 text-xs font-bold text-white shadow hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>تحضير الكل كحاضر ({session.totalUnmarked})</span>
              </button>
            )}
          </div>
        </div>

        {/* Closed Session Alert */}
        {isClosed && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center gap-3 text-xs text-amber-700 dark:text-amber-300">
            <Lock className="h-5 w-5 text-amber-500 shrink-0" />
            <span>
              تم إغلاق هذه الحصة التدريبية رسمياً وتثبيت الكشف. جميع السجلات مقفلة ضد التعديل
              المباشر إلا عبر طلب تصحيح رسمي.
            </span>
          </div>
        )}

        {/* ROSTER LIST: ONE-TAP ATTENDANCE MARKING */}
        {filteredRoster.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-12 text-center text-[var(--text-muted)] space-y-2">
            <Users className="h-8 w-8 mx-auto text-[var(--brand-primary)]" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">
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
                  className={`rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-sm bg-[var(--bg-surface)] ${
                    item.status === 'PRESENT'
                      ? 'border-emerald-500/40 ring-1 ring-emerald-500/20'
                      : item.status === 'LATE'
                        ? 'border-amber-500/40 ring-1 ring-amber-500/20'
                        : item.status === 'ABSENT'
                          ? 'border-rose-500/40 ring-1 ring-rose-500/20'
                          : item.status === 'EXCUSED'
                            ? 'border-sky-500/40 ring-1 ring-sky-500/20'
                            : 'border-[var(--border-subtle)] hover:border-[var(--brand-primary)]/40'
                  }`}
                >
                  {/* Player Info */}
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl font-bold text-sm ${
                        item.status === 'PRESENT'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : item.status === 'LATE'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : item.status === 'ABSENT'
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                              : item.status === 'EXCUSED'
                                ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                                : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                      }`}
                    >
                      {item.playerName.slice(0, 2)}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-[var(--text-primary)]">{item.playerName}</h3>
                        {item.jerseyNumber && (
                          <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] font-bold text-[var(--brand-primary)] border border-[var(--border-subtle)]">
                            #{item.jerseyNumber}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-0.5">
                        {item.status === 'PRESENT' && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            حاضر {item.checkInTime ? `(${item.checkInTime.slice(11, 16)})` : ''}
                          </span>
                        )}
                        {item.status === 'LATE' && (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                            <Clock4 className="h-3.5 w-3.5" />
                            متأخر {item.checkInTime ? `(${item.checkInTime.slice(11, 16)})` : ''}
                          </span>
                        )}
                        {item.status === 'ABSENT' && (
                          <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                            <XCircle className="h-3.5 w-3.5" />
                            غائب
                          </span>
                        )}
                        {item.status === 'EXCUSED' && (
                          <span className="text-sky-600 dark:text-sky-400 font-semibold flex items-center gap-1">
                            <HelpCircle className="h-3.5 w-3.5" />
                            غياب بعذر
                          </span>
                        )}
                        {item.status === 'UNMARKED' && (
                          <span className="text-[var(--text-muted)] italic">لم يسجل بعد</span>
                        )}
                        {item.remarks && <span className="text-[var(--text-muted)]">• {item.remarks}</span>}
                      </div>

                      {/* Payment Status & Quick Fee Collection */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {item.subscriptionStatus === 'ACTIVE' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>اشتراك ساري (مسدد)</span>
                          </span>
                        )}
                        {item.subscriptionStatus === 'PARTIAL' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            <AlertTriangle className="h-3 w-3" />
                            <span>متبقي: {item.outstandingBalance ?? 0} ر.س</span>
                          </span>
                        )}
                        {item.subscriptionStatus === 'OVERDUE' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 border border-rose-500/30">
                            <XCircle className="h-3 w-3" />
                            <span>متأخر: {item.outstandingBalance || item.amountDue || 0} ر.س</span>
                          </span>
                        )}
                        {(!item.subscriptionStatus ||
                          item.subscriptionStatus === 'EXEMPT' ||
                          item.subscriptionStatus === 'PAUSED' ||
                          item.subscriptionStatus === 'EXPIRED') && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/15 px-2.5 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 border border-slate-500/30">
                            <span>
                              {item.subscriptionStatus === 'EXEMPT'
                                ? 'معفى من الرسوم'
                                : item.subscriptionStatus === 'PAUSED'
                                  ? 'موقوف مؤقتاً'
                                  : item.subscriptionStatus === 'EXPIRED'
                                    ? 'منتهي'
                                    : 'غير مسدد'}
                            </span>
                          </span>
                        )}

                        <button
                          type="button"
                          id={`btn-collect-payment-${item.playerId}`}
                          onClick={() => handleOpenPaymentModal(item)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--brand-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-primary)] border border-[var(--border-subtle)] hover:border-[var(--brand-primary)]/40 transition-colors cursor-pointer"
                          title="تسجيل دفعة نقدية أو إلكترونية للاعب"
                        >
                          <CreditCard className="h-3 w-3" />
                          <span>تحصيل دفعة</span>
                        </button>
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
                          ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-emerald-600 hover:bg-emerald-500/10 border border-[var(--border-subtle)]'
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
                          ? 'bg-amber-500 text-slate-900 shadow-sm ring-2 ring-amber-300'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-amber-500 hover:bg-amber-500/10 border border-[var(--border-subtle)]'
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
                          ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 border border-[var(--border-subtle)]'
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
                          ? 'bg-sky-600 text-white shadow-sm ring-2 ring-sky-300'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-sky-500 hover:bg-sky-500/10 border border-[var(--border-subtle)]'
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
      </div>

      {/* QR MODAL */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-surface)] text-[var(--brand-primary)]">
                  <QrCode className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">رمز QR المؤقت للتحضير</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Timer countdown */}
            <div className="flex items-center justify-between rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-4 py-2.5 text-xs">
              <span className="text-[var(--text-muted)] flex items-center gap-1.5">
                <Timer className="h-4 w-4 text-amber-500" />
                صلاحية الرمز تنتهي خلال:
              </span>
              <span
                className={`font-mono font-bold text-sm ${qrSecondsLeft < 15 ? 'text-rose-500 animate-pulse' : 'text-[var(--brand-primary)]'}`}
              >
                {qrSecondsLeft} ثانية
              </span>
            </div>

            {/* QR Visual Card */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-white p-6 flex flex-col items-center justify-center text-center shadow-inner">
              {isGeneratingQr ? (
                <RefreshCw className="h-12 w-12 animate-spin text-slate-800" />
              ) : (
                <div className="space-y-3">
                  <div className="mx-auto w-48 h-48 bg-slate-900 rounded-xl p-3 flex flex-col justify-between shadow-lg">
                    <div className="flex justify-between">
                      <div className="w-10 h-10 border-4 border-white bg-slate-900 p-1">
                        <div className="w-full h-full bg-emerald-400" />
                      </div>
                      <div className="w-10 h-10 border-4 border-white bg-slate-900 p-1">
                        <div className="w-full h-full bg-emerald-400" />
                      </div>
                    </div>
                    <div className="flex items-center justify-center text-center">
                      <QrCode className="h-12 w-12 text-emerald-400" />
                    </div>
                    <div className="flex justify-between">
                      <div className="w-10 h-10 border-4 border-white bg-slate-900 p-1">
                        <div className="w-full h-full bg-emerald-400" />
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
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] py-2 text-xs font-semibold text-[var(--brand-primary)] hover:border-[var(--brand-primary)] transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>تجديد الرمز فوراً</span>
              </button>
            </div>

            {/* Quick QR Check-in Simulator */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                <UserCheck className="h-4 w-4 text-[var(--brand-primary)]" />
                <span>محاكي المسح للاعب (Quick QR Scanner)</span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                للاختبار دون ماسح ضوئي كاميرا، اختر لاعباً وانقر لتسجيل حضوره بالرمز الحالي:
              </p>

              {qrSimSuccess && (
                <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 p-2 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{qrSimSuccess}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <select
                  value={qrCheckInPlayerId}
                  onChange={(e) => setQrCheckInPlayerId(e.target.value)}
                  className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
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
                  className="rounded-xl bg-[var(--brand-primary)] px-3.5 py-2 text-xs font-bold text-white hover:brightness-110 disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-surface)] text-[var(--brand-primary)]">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">سجل العمليات والتدقيق التراكمي</h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    سجل غير قابل للتعديل (Append-Only Event Stream) لجميع حركات التحضير والتصحيح.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEventsModalOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isLoadingEvents ? (
              <div className="p-8 text-center text-[var(--text-muted)]">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-[var(--brand-primary)] mb-2" />
                <p className="text-xs">جارٍ جلب سجل الأحداث...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-muted)]">
                <p className="text-xs">لا توجد حركات مسجلة في هذه الحصة حتى الآن.</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2.5 pr-1">
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-xs flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[var(--text-primary)]">{ev.playerName}</span>
                        <span className="text-[var(--text-muted)]">←</span>
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                            ev.newStatus === 'PRESENT'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : ev.newStatus === 'LATE'
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                : ev.newStatus === 'ABSENT'
                                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                  : 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                          }`}
                        >
                          {ev.newStatus}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)]">(المصدر: {ev.source})</span>
                      </div>
                      {ev.reason && (
                        <p className="text-[11px] text-[var(--text-muted)]">السبب: {ev.reason}</p>
                      )}
                    </div>

                    <div className="text-left text-[10px] text-[var(--text-muted)]">
                      <div>{ev.eventAt.slice(0, 10)}</div>
                      <div className="font-mono text-[var(--text-secondary)]">{ev.eventAt.slice(11, 19)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 1. PAYMENT COLLECTION MODAL */}
      {isPaymentModalOpen && selectedPlayerForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">تحصيل دفعة مالية للاعب</h3>
                  <p className="text-xs text-[var(--text-muted)]">{selectedPlayerForPayment.playerName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-xs flex justify-between items-center">
                <span className="text-[var(--text-muted)]">المتبقي على الاشتراك:</span>
                <span className="font-extrabold text-[var(--brand-primary)]">
                  {selectedPlayerForPayment.outstandingBalance ?? selectedPlayerForPayment.amountDue ?? 0} ر.س
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                  المبلغ المحصل (ر.س) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm font-bold text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                  طريقة التحصيل *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(
                      e.target.value as 'CASH' | 'CARD' | 'POS' | 'BANK_TRANSFER',
                    )
                  }
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-xs font-semibold text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none cursor-pointer"
                >
                  <option value="CASH">نقدي (كاش بالملعب)</option>
                  <option value="POS">جهاز نقاط البيع (شبكة / POS)</option>
                  <option value="CARD">بطاقة بنكية / مدى (Online / Card)</option>
                  <option value="BANK_TRANSFER">تحويل بنكي مباشر</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                  رقم الإيصال أو المرجع (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="مثال: POS-99881 أو رقم الحوالة"
                  value={paymentRefNumber}
                  onChange={(e) => setPaymentRefNumber(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                  ملاحظات الدفعة (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="ملاحظات توثيقية إضافية..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment || paymentAmount <= 0}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSubmittingPayment && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>تأكيد استلام الدفعة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. RECORD SESSION EXPENSE MODAL */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <PlusCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">تسجيل مصروف للحصة التدريبية</h3>
                  <p className="text-xs text-[var(--text-muted)]">يتم خصم هذا المبلغ من كاش الصندوق الميداني للحصة</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                  قيمة المصروف (ر.س) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={expenseAmount || ''}
                  onChange={(e) => setExpenseAmount(parseFloat(e.target.value) || 0)}
                  placeholder="مثال: 50"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm font-bold text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                  بيان وسبب المصروف *
                </label>
                <textarea
                  required
                  rows={3}
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  placeholder="مثال: شراء مياه معدنية وعصيرات للاعبين، أو أدوات تدريب طارئة..."
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingExpense || expenseAmount <= 0 || !expenseNotes.trim()}
                  className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSubmittingExpense && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>حفظ المصروف</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. RECONCILE & CLOSE CASHIER MODAL */}
      {isCloseCashierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">مطابقة وإغلاق الصندوق المالي</h3>
                  <p className="text-xs text-[var(--text-muted)]">إغلاق الصندوق وتثبيت الحركة المحاسبية للحصة</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCloseCashierModalOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">الكاش المحصل:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    +{cashierSummary?.totalCashCollected ?? 0} ر.س
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">المصروفات:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    -{cashierSummary?.totalExpenses ?? 0} ر.س
                  </span>
                </div>
                <div className="flex justify-between border-t border-[var(--border-subtle)] pt-2 font-bold text-[var(--text-primary)]">
                  <span>صافي النقد المطلوب تسليمه:</span>
                  <span>{cashierSummary?.netCashMovement ?? 0} ر.س</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                  ملاحظات التسوية الختامية (اختياري)
                </label>
                <textarea
                  rows={2}
                  value={closeCashierNotes}
                  onChange={(e) => setCloseCashierNotes(e.target.value)}
                  placeholder="ملاحظات حول عهدة الكاش أو التسليم للمحاسب..."
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none resize-none"
                />
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                سيتم توثيق إغلاق الصندوق باسمك وتاريخ اليوم في سجل التدقيق المالي.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setIsCloseCashierModalOpen(false)}
                className="rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                disabled={isSubmittingCloseCashier}
                onClick={handleConfirmCloseCashier}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isSubmittingCloseCashier && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>تأكيد المطابقة وإغلاق الصندوق</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
