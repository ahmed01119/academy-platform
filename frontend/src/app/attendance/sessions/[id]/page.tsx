'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useLocale } from '@/contexts/locale-context';
import {
  translateDataString,
  translateStatus,
  translatePaymentMethod,
} from '@/utils/data-translator';
import { AppShell } from '../../../../components/layout/AppShell';
import { PageHeader } from '../../../../components/ui/PageHeader';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { useToast } from '../../../../components/ui/Toast';
import { api } from '@/api/client';
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
  const { locale, t } = useLocale();
  const { toast } = useToast();

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
  const [selectedPlayerForPayment, setSelectedPlayerForPayment] =
    useState<AttendanceRosterItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'POS' | 'BANK_TRANSFER'>(
    'CASH',
  );
  const [paymentRefNumber, setPaymentRefNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Session Expense Modal
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseNotes, setExpenseNotes] = useState('');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // Session Expense Approval & Rejection State
  const [approvingExpenseId, setApprovingExpenseId] = useState<string | null>(null);
  const [rejectingExpenseId, setRejectingExpenseId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmittingRejectExpense, setIsSubmittingRejectExpense] = useState(false);

  const userRole = activeTenant?.role;
  const canApproveExpenses =
    Boolean(user?.isPlatformSuperAdmin) ||
    userRole === 'OWNER' ||
    userRole === 'MANAGER' ||
    userRole === 'BRANCH_MANAGER' ||
    userRole === 'ACCOUNTANT';

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
      setErrorMsg(
        err instanceof Error
          ? err.message
          : locale === 'en'
            ? 'Failed to load session attendance roster'
            : 'فشل تحميل كشف الحضور للحصة',
      );
    } finally {
      setIsFetching(false);
    }
  }, [sessionId, loadCashierSummary, locale]);

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
      toast.success(
        locale === 'en'
          ? 'Payment recorded successfully and account updated'
          : 'تم تسجيل الدفعة المالية بنجاح وتحديث كشف الحساب',
      );
      await Promise.all([loadSessionDetails(), loadCashierSummary()]);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : locale === 'en'
            ? 'Failed to record payment'
            : 'فشل تسجيل الدفعة',
      );
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
      if (userRole === 'COACH') {
        toast.info(
          locale === 'en'
            ? 'Expense submitted successfully and pending management approval'
            : 'تم تقديم المصروف بنجاح وهو الآن قيد مراجعة واعتماد الإدارة',
        );
      } else {
        toast.success(
          locale === 'en'
            ? 'Expense recorded and approved successfully'
            : 'تم تسجيل المصروف واعتماده بنجاح وتحديث الصندوق',
        );
      }
      await loadCashierSummary();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : locale === 'en'
            ? 'Failed to record expense'
            : 'فشل تسجيل المصروف',
      );
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  const handleApproveExpense = async (expenseId: string) => {
    setApprovingExpenseId(expenseId);
    try {
      await api.finance.approveSessionExpense(expenseId);
      toast.success(
        locale === 'en'
          ? 'Expense approved successfully and cash drawer updated'
          : 'تم اعتماد المصروف بنجاح وتحديث رصيد الصندوق',
      );
      await loadCashierSummary();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : locale === 'en'
            ? 'Failed to approve expense'
            : 'فشل اعتماد المصروف',
      );
    } finally {
      setApprovingExpenseId(null);
    }
  };

  const handleConfirmRejectExpense = async () => {
    if (!rejectingExpenseId || !rejectionReason.trim()) return;
    setIsSubmittingRejectExpense(true);
    try {
      await api.finance.rejectSessionExpense(rejectingExpenseId, {
        reason: rejectionReason.trim(),
      });
      toast.success(
        locale === 'en'
          ? 'Expense rejected and reason logged'
          : 'تم رفض المصروف وتوثيق السبب في سجل التدقيق',
      );
      setRejectingExpenseId(null);
      setRejectionReason('');
      await loadCashierSummary();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : locale === 'en'
            ? 'Failed to reject expense'
            : 'فشل رفض المصروف',
      );
    } finally {
      setIsSubmittingRejectExpense(false);
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
      toast.success(
        locale === 'en'
          ? 'Cash drawer reconciled and closed successfully'
          : 'تمت مطابقة وإغلاق الصندوق المالي بنجاح',
      );
      await loadCashierSummary();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : locale === 'en'
            ? 'Failed to close cash drawer'
            : 'فشل إغلاق الصندوق المالي',
      );
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
      toast.error(
        err instanceof Error
          ? err.message
          : locale === 'en'
            ? 'Failed to generate QR code'
            : 'فشل توليد رمز QR',
      );
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
      toast.success(
        locale === 'en'
          ? 'Attendance recorded via QR code successfully!'
          : 'تم تسجيل الحضور عبر رمز QR بنجاح!',
      );
      setQrSimSuccess(
        locale === 'en'
          ? 'Attendance recorded via QR successfully!'
          : 'تم تسجيل الحضور عبر QR بنجاح!',
      );
      await loadSessionDetails();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : locale === 'en'
            ? 'Failed to check in via QR'
            : 'فشل التحضير بالرمز',
      );
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
    const confirmationMsg =
      locale === 'en'
        ? 'Are you sure you want to close this training session? Attendance will be locked.'
        : 'هل أنت متأكد من إغلاق الحصة التدريبية؟ سيتم قفل التحضير.';
    if (!confirm(confirmationMsg)) return;
    try {
      await api.attendance.closeSession(sessionId);
      toast.success(
        locale === 'en'
          ? 'Training session closed successfully'
          : 'تم إغلاق الحصة التدريبية بنجاح',
      );
      await loadSessionDetails();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : locale === 'en'
            ? 'Failed to close session'
            : 'فشل إغلاق الحصة',
      );
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
      const rawRecord = (
        updatedItem as { record?: Partial<AttendanceRosterItem> & { id?: string } }
      )?.record;
      const serverItem: Partial<AttendanceRosterItem> & { id?: string } =
        rawRecord || (updatedItem as Partial<AttendanceRosterItem> & { id?: string });
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
                  playerName:
                    serverItem.playerName ||
                    r.playerName ||
                    (locale === 'en' ? 'Unknown Player' : 'لاعب غير معروف'),
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
      toast.error(
        err instanceof Error
          ? err.message
          : locale === 'en'
            ? 'Failed to record attendance status'
            : 'فشل تسجيل حالة الحضور',
      );
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
      toast.info(
        locale === 'en'
          ? 'All players are already marked'
          : 'جميع اللاعبين تم تسجيل حضورهم بالفعل',
      );
      return;
    }

    const confirmMsg =
      locale === 'en'
        ? `Do you want to mark all unmarked players (${unmarkedPlayers.length}) as "Present" at once?`
        : `هل تريد تحضير جميع اللاعبين غير المحددين (${unmarkedPlayers.length} لاعب) كـ "حاضر" دفعة واحدة؟`;

    if (!confirm(confirmMsg)) {
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
      toast.success(
        locale === 'en'
          ? `Marked ${unmarkedPlayers.length} players successfully`
          : `تم تحضير ${unmarkedPlayers.length} لاعب بنجاح`,
      );
      await loadSessionDetails();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : locale === 'en'
            ? 'Failed bulk attendance'
            : 'فشل التحضير الجماعي',
      );
    } finally {
      setIsBulkMarking(false);
    }
  };

  if (isLoading || isFetching) {
    return (
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-()" />
            <p className="text-sm font-medium text-()">
              {locale === 'en'
                ? 'Loading session attendance roster...'
                : 'جارٍ تحميل كشف الحضور للحصة التدريبية...'}
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (errorMsg || !session) {
    return (
      <AppShell>
        <ErrorState
          title={
            locale === 'en' ? 'Unable to access training session' : 'تعذر الوصول للحصة التدريبية'
          }
          message={errorMsg || (locale === 'en' ? 'Session not found' : 'الحصة غير موجودة')}
          onRetry={loadSessionDetails}
        />
      </AppShell>
    );
  }

  const isClosed = session.status === 'CLOSED';
  const totalRoster = session.roster?.length || 0;
  const filteredRoster = (session.roster || []).filter((item) => {
    const rawName = typeof item?.playerName === 'string' ? item.playerName : '';
    const translatedName = translateDataString(rawName, locale);
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !query ||
      rawName.toLowerCase().includes(query) ||
      translatedName.toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'ALL' || item?.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const translatedGroupName = translateDataString(session.groupName, locale);
  const translatedBranchName = translateDataString(session.branchName, locale);
  const translatedCoachName = session.coachName
    ? translateDataString(session.coachName, locale)
    : undefined;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={[
            { label: t('nav.home', 'الرئيسية'), href: '/dashboard' },
            { label: locale === 'en' ? 'Sessions' : 'الحصص التدريبية', href: '/sessions' },
            { label: translatedGroupName },
            { label: locale === 'en' ? 'Live Attendance Roster' : 'كشف الحضور المباشر' },
          ]}
          title={
            locale === 'en'
              ? `Attendance Roster: ${translatedGroupName}`
              : `كشف حضور: ${translatedGroupName}`
          }
          description={
            translatedCoachName
              ? locale === 'en'
                ? `Coach: ${translatedCoachName}`
                : `المدرب المشرف: ${translatedCoachName}`
              : undefined
          }
          actions={
            <div className="flex flex-wrap items-center gap-2.5">
              {!isClosed && (
                <Link
                  href={`/attendance/scanner?sessionId=${sessionId}`}
                  id="btn-open-scanner"
                  className="flex items-center gap-2 rounded-xl bg-() px-4 py-2 text-xs font-bold text-white shadow-sm hover:brightness-110 transition-all cursor-pointer"
                >
                  <QrCode className="h-4 w-4" />
                  <span>{locale === 'en' ? 'Camera Scanner' : 'ماسح الحضور بالكاميرا'}</span>
                </Link>
              )}

              {!isClosed && (
                <button
                  type="button"
                  id="btn-open-qr-modal"
                  onClick={handleOpenQrModal}
                  className="flex items-center gap-2 rounded-xl border border-() bg-() px-4 py-2 text-xs font-semibold text-() hover:border-() transition-all cursor-pointer"
                >
                  <QrCode className="h-4 w-4" />
                  <span>{locale === 'en' ? 'Session QR Code' : 'رمز QR للحصة'}</span>
                </button>
              )}

              <button
                type="button"
                id="btn-open-events-modal"
                onClick={handleOpenEventsModal}
                className="flex items-center gap-2 rounded-xl border border-() bg-() px-4 py-2 text-xs font-semibold text-() hover:text-() hover:border-() transition-all cursor-pointer"
              >
                <History className="h-4 w-4" />
                <span>{locale === 'en' ? 'Audit Log' : 'سجل العمليات (Audit)'}</span>
              </button>

              {!isClosed && (
                <button
                  type="button"
                  id="btn-close-session"
                  onClick={handleCloseSession}
                  className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/20 transition-all cursor-pointer"
                >
                  <Lock className="h-4 w-4" />
                  <span>
                    {locale === 'en' ? 'Close & Lock Session' : 'إغلاق الحصة وتثبيت الكشف'}
                  </span>
                </button>
              )}
            </div>
          }
        />

        {/* Session Meta & Live KPI Counters */}
        <div className="rounded-2xl border border-() bg-() p-6 shadow-sm space-y-5">
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
                ? locale === 'en'
                  ? '• Session In Progress'
                  : '• الحصة جارية الآن'
                : session.status === 'SCHEDULED'
                  ? locale === 'en'
                    ? 'Scheduled Session'
                    : 'حصة مجدولة'
                  : locale === 'en'
                    ? 'Closed Session'
                    : 'حصة مغلقة ومؤكدة'}
            </span>

            <span className="flex items-center gap-1.5 text-xs text-()">
              <Building2 className="h-3.5 w-3.5 text-()" />
              <span>{translatedBranchName}</span>
            </span>

            <span className="flex items-center gap-1.5 text-xs text-()">
              <Calendar className="h-3.5 w-3.5 text-()" />
              <span>{session.sessionDate}</span>
            </span>

            <span className="flex items-center gap-1.5 text-xs text-()">
              <Clock className="h-3.5 w-3.5 text-()" />
              <span>
                {session.startTime} - {session.endTime}
              </span>
            </span>
          </div>

          {/* Live KPI Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4 border-t border-()">
            <div className="rounded-xl border border-() bg-() p-3 text-center">
              <span className="text-[11px] text-() block mb-1">
                {locale === 'en' ? 'Total Roster' : 'إجمالي الكشف'}
              </span>
              <span className="text-xl font-extrabold text-()">{totalRoster}</span>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block mb-1 font-semibold">
                {locale === 'en' ? 'Present' : 'حاضر (Present)'}
              </span>
              <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {session.totalPresent}
              </span>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
              <span className="text-[11px] text-amber-600 dark:text-amber-400 block mb-1 font-semibold">
                {locale === 'en' ? 'Late' : 'متأخر (Late)'}
              </span>
              <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
                {session.totalLate}
              </span>
            </div>

            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-center">
              <span className="text-[11px] text-rose-600 dark:text-rose-400 block mb-1 font-semibold">
                {locale === 'en' ? 'Absent' : 'غائب (Absent)'}
              </span>
              <span className="text-xl font-extrabold text-rose-600 dark:text-rose-400">
                {session.totalAbsent}
              </span>
            </div>

            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 text-center">
              <span className="text-[11px] text-sky-600 dark:text-sky-400 block mb-1 font-semibold">
                {locale === 'en' ? 'Excused' : 'معذور (Excused)'}
              </span>
              <span className="text-xl font-extrabold text-sky-600 dark:text-sky-400">
                {session.totalExcused}
              </span>
            </div>

            <div className="rounded-xl border border-slate-500/20 bg-slate-500/5 p-3 text-center">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1 font-semibold">
                {locale === 'en' ? 'Unmarked' : 'غير محدد (Unmarked)'}
              </span>
              <span className="text-xl font-extrabold text-slate-600 dark:text-slate-300">
                {session.totalUnmarked}
              </span>
            </div>
          </div>
        </div>

        {/* SESSION CASHIER & DAILY RECONCILIATION */}
        <div className="rounded-2xl border border-() bg-() p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-()">
                  {locale === 'en'
                    ? 'Session Cashier & Reconciliation'
                    : 'صندوق الحصة التدريبية والإغلاق المالي (Session Cashier & Reconciliation)'}
                </h3>
                <p className="text-xs text-()">
                  {locale === 'en'
                    ? 'Track on-pitch cash & electronic collections, session expenses, and accounting settlement.'
                    : 'متابعة التحصيلات الميدانية النقدية والإلكترونية ومصروفات الحصة والتسوية المحاسبية.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {cashierSummary?.isReconciled ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>
                    {locale === 'en'
                      ? `Reconciled & Closed ${cashierSummary.closedByUserName ? `by ${cashierSummary.closedByUserName}` : ''}`
                      : `تمت المطابقة والإغلاق ${cashierSummary.closedByUserName ? `بواسطة ${cashierSummary.closedByUserName}` : ''}`}
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 px-3 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 border border-blue-500/30">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    {locale === 'en'
                      ? 'Drawer Open & Active'
                      : 'الصندوق مفتوح وجارٍ التحصيل'}
                  </span>
                </span>
              )}

              <button
                type="button"
                onClick={() => setIsCashierExpanded(!isCashierExpanded)}
                className="p-1.5 rounded-lg border border-() bg-() text-() hover:text-() transition-colors cursor-pointer"
              >
                {isCashierExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {isCashierExpanded && (
            <div className="space-y-4 pt-3 border-t border-()">
              {/* Cashier Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold block mb-0.5">
                    {locale === 'en' ? 'Cash Collected' : 'التحصيل النقدي (كاش)'}
                  </span>
                  <span className="text-lg font-extrabold text-()">
                    {cashierSummary?.totalCashCollected ?? 0}{' '}
                    <span className="text-xs font-normal">
                      {locale === 'en' ? 'SAR' : 'ر.س'}
                    </span>
                  </span>
                </div>

                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                  <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold block mb-0.5">
                    {locale === 'en'
                      ? 'Electronic Collected (POS/Card)'
                      : 'التحصيل الإلكتروني (مدى/بطاقة)'}
                  </span>
                  <span className="text-lg font-extrabold text-()">
                    {cashierSummary?.totalElectronicCollected ?? 0}{' '}
                    <span className="text-xs font-normal">
                      {locale === 'en' ? 'SAR' : 'ر.س'}
                    </span>
                  </span>
                </div>

                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
                  <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold block mb-0.5">
                    {locale === 'en' ? 'Session Expenses' : 'مصروفات الحصة (ماء/تجهيز)'}
                  </span>
                  <span className="text-lg font-extrabold text-()">
                    {cashierSummary?.totalExpenses ?? 0}{' '}
                    <span className="text-xs font-normal">
                      {locale === 'en' ? 'SAR' : 'ر.س'}
                    </span>
                  </span>
                </div>

                <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
                  <span className="text-[11px] text-violet-600 dark:text-violet-400 font-semibold block mb-0.5">
                    {locale === 'en' ? 'Net Cash Movement' : 'صافي الحركة النقدية'}
                  </span>
                  <span className="text-lg font-extrabold text-()">
                    {cashierSummary?.netCashMovement ?? 0}{' '}
                    <span className="text-xs font-normal">
                      {locale === 'en' ? 'SAR' : 'ر.س'}
                    </span>
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
                    className="inline-flex items-center gap-1.5 rounded-xl border border-() bg-() px-3.5 py-2 text-xs font-bold text-() hover:border-() disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <PlusCircle className="h-4 w-4 text-rose-500" />
                    <span>
                      {locale === 'en' ? 'Record Session Expense' : 'تسجيل مصروف للحصة'}
                    </span>
                  </button>
                </div>

                {!cashierSummary?.isReconciled && (
                  <button
                    type="button"
                    onClick={() => setIsCloseCashierModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:brightness-110 transition-all cursor-pointer"
                  >
                    <Receipt className="h-4 w-4" />
                    <span>
                      {locale === 'en'
                        ? 'Reconcile & Close Cash Drawer'
                        : 'مطابقة وإغلاق الصندوق المالي'}
                    </span>
                  </button>
                )}
              </div>

              {/* Session Transactions History */}
              {cashierSummary?.transactions && cashierSummary.transactions.length > 0 && (
                <div className="rounded-xl border border-() bg-() overflow-hidden text-xs">
                  <div className="px-3.5 py-2 font-bold text-() border-b border-() flex items-center justify-between">
                    <span>
                      {locale === 'en'
                        ? `Session Transactions (${cashierSummary.transactions.length})`
                        : `حركات الصندوق المسجلة في هذه الحصة (${cashierSummary.transactions.length})`}
                    </span>
                    <span className="text-[10px] text-() font-normal">
                      {locale === 'en'
                        ? 'Coach expenses require management approval to settle in drawer'
                        : 'تتطلب مصروفات المدربين اعتماد الإدارة لتسويتها في الصندوق'}
                    </span>
                  </div>
                  <div className="divide-y divide-() max-h-72 overflow-y-auto">
                    {cashierSummary.transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-()/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-()">
                              {tx.type === 'SESSION_EXPENSE'
                                ? locale === 'en'
                                  ? 'Session Expense'
                                  : 'مصروف حصة'
                                : translateDataString(tx.playerName, locale) ||
                                  (locale === 'en' ? 'Subscription Payment' : 'سداد اشتراك')}
                            </span>
                            <StatusBadge status={tx.status} size="sm" />
                            {tx.type === 'SESSION_EXPENSE' && tx.status === 'PENDING' && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                {locale === 'en'
                                  ? '(Pending Approval - Not deducted until approved)'
                                  : '(قيد الاعتماد - لا يخصم من الصندوق حتى يعتمد)'}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-() flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                            <span>
                              {locale === 'en' ? 'Receipt #' : 'رقم الإيصال:'}{' '}
                              {tx.receiptNumber || tx.id.slice(0, 8)}
                            </span>
                            <span>
                              • {locale === 'en' ? 'Method:' : 'طريقة الدفع:'}{' '}
                              {translatePaymentMethod(tx.paymentMethod, locale)}
                            </span>
                            {tx.recordedByName && (
                              <span>
                                • {locale === 'en' ? 'Recorded by:' : 'المسجل:'}{' '}
                                {translateDataString(tx.recordedByName, locale)}
                              </span>
                            )}
                            {tx.notes && (
                              <span>
                                • {locale === 'en' ? 'Note:' : 'ملاحظة:'}{' '}
                                {translateDataString(tx.notes, locale)}
                              </span>
                            )}
                            {tx.status === 'COMPLETED' && tx.approvedByName && (
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                • {locale === 'en' ? 'Approved by:' : 'معتمد بواسطة:'}{' '}
                                {translateDataString(tx.approvedByName, locale)}
                              </span>
                            )}
                            {tx.status === 'REJECTED' && tx.rejectionReason && (
                              <span className="text-rose-600 dark:text-rose-400 font-medium">
                                • {locale === 'en' ? 'Rejection Reason:' : 'سبب الرفض:'}{' '}
                                {translateDataString(tx.rejectionReason, locale)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                          {/* Inline Approval / Rejection Controls for Pending Expenses */}
                          {tx.type === 'SESSION_EXPENSE' &&
                            tx.status === 'PENDING' &&
                            canApproveExpenses && (
                              <div className="flex items-center gap-1.5">
                                {user?.id === tx.recordedByUserId && userRole !== 'OWNER' ? (
                                  <span className="text-[10px] text-() italic bg-() px-2 py-0.5 rounded-md border border-()">
                                    {locale === 'en'
                                      ? 'Awaiting another admin'
                                      : 'فصل الصلاحيات (بانتظار مسؤول آخر)'}
                                  </span>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      disabled={approvingExpenseId === tx.id}
                                      onClick={() => handleApproveExpense(tx.id)}
                                      className="flex items-center gap-1 rounded-lg bg-emerald-600/10 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-white px-2.5 py-1 text-[11px] font-bold border border-emerald-500/30 transition-all cursor-pointer disabled:opacity-50"
                                      title={
                                        locale === 'en'
                                          ? 'Approve expense and include in drawer'
                                          : 'اعتماد المصروف وإدراجه في حسابات الصندوق'
                                      }
                                    >
                                      {approvingExpenseId === tx.id ? (
                                        <RefreshCw className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Check className="h-3 w-3" />
                                      )}
                                      <span>{locale === 'en' ? 'Approve' : 'اعتماد'}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRejectingExpenseId(tx.id);
                                        setRejectionReason('');
                                      }}
                                      className="flex items-center gap-1 rounded-lg bg-rose-600/10 hover:bg-rose-600 text-rose-700 dark:text-rose-300 hover:text-white px-2.5 py-1 text-[11px] font-bold border border-rose-500/30 transition-all cursor-pointer"
                                      title={
                                        locale === 'en'
                                          ? 'Reject expense with reason'
                                          : 'رفض المصروف مع توثيق السبب'
                                      }
                                    >
                                      <X className="h-3 w-3" />
                                      <span>{locale === 'en' ? 'Reject' : 'رفض'}</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            )}

                          <div className="text-end min-w-[70px]">
                            <span
                              className={`font-mono font-bold block ${
                                tx.type === 'SESSION_EXPENSE'
                                  ? tx.status === 'REJECTED'
                                    ? 'line-through text-slate-400'
                                    : 'text-rose-500'
                                  : 'text-emerald-500'
                              }`}
                            >
                              {tx.type === 'SESSION_EXPENSE' ? '-' : '+'}
                              {tx.amount} {locale === 'en' ? 'SAR' : 'ر.س'}
                            </span>
                            <div className="text-[10px] text-()">
                              {tx.createdAt
                                ? new Date(tx.createdAt).toLocaleTimeString(
                                    locale === 'en' ? 'en-US' : 'ar-EG',
                                    {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    },
                                  )
                                : ''}
                            </div>
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
                  ? 'bg-() text-white shadow-sm'
                  : 'bg-() text-() border border-() hover:text-()'
              }`}
            >
              {locale === 'en' ? `All (${session.roster.length})` : `الكل (${session.roster.length})`}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('UNMARKED')}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'UNMARKED'
                  ? 'bg-slate-600 text-white shadow-sm'
                  : 'bg-() text-() border border-() hover:text-()'
              }`}
            >
              {locale === 'en'
                ? `Unmarked (${session.totalUnmarked})`
                : `غير محدد (${session.totalUnmarked})`}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('PRESENT')}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'PRESENT'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-() text-emerald-600 dark:text-emerald-400 border border-() hover:bg-emerald-500/10'
              }`}
            >
              {locale === 'en'
                ? `Present (${session.totalPresent})`
                : `حاضر (${session.totalPresent})`}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('LATE')}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'LATE'
                  ? 'bg-amber-500 text-slate-900 shadow-sm'
                  : 'bg-() text-amber-600 dark:text-amber-400 border border-() hover:bg-amber-500/10'
              }`}
            >
              {locale === 'en'
                ? `Late (${session.totalLate})`
                : `متأخر (${session.totalLate})`}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ABSENT')}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'ABSENT'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-() text-rose-600 dark:text-rose-400 border border-() hover:bg-rose-500/10'
              }`}
            >
              {locale === 'en'
                ? `Absent (${session.totalAbsent})`
                : `غائب (${session.totalAbsent})`}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('EXCUSED')}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'EXCUSED'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-() text-sky-600 dark:text-sky-400 border border-() hover:bg-sky-500/10'
              }`}
            >
              {locale === 'en'
                ? `Excused (${session.totalExcused})`
                : `معذور (${session.totalExcused})`}
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 md:w-64">
              <Search className="absolute inset-s-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-()" />
              <input
                type="text"
                id="input-search-roster"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={
                  locale === 'en' ? 'Search by player name...' : 'البحث باسم اللاعب...'
                }
                className="w-full rounded-xl border border-() bg-() ps-10 pe-3 py-2 text-xs text-() placeholder:text-() focus:border-() focus:outline-none"
              />
            </div>

            {/* Bulk Mark All Unmarked as Present */}
            {!isClosed && session.totalUnmarked > 0 && (
              <button
                type="button"
                id="btn-bulk-mark-present"
                disabled={isBulkMarking}
                onClick={handleBulkMarkPresent}
                className="flex items-center gap-1.5 rounded-xl bg-() px-4 py-2 text-xs font-bold text-white shadow hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {locale === 'en'
                    ? `Mark All Present (${session.totalUnmarked})`
                    : `تحضير الكل كحاضر (${session.totalUnmarked})`}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Closed Session Alert */}
        {isClosed && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center gap-3 text-xs text-amber-700 dark:text-amber-300">
            <Lock className="h-5 w-5 text-amber-500 shrink-0" />
            <span>
              {locale === 'en'
                ? 'This training session is officially closed and the roster is locked. Direct modifications are restricted unless requested via formal correction.'
                : 'تم إغلاق هذه الحصة التدريبية رسمياً وتثبيت الكشف. جميع السجلات مقفلة ضد التعديل المباشر إلا عبر طلب تصحيح رسمي.'}
            </span>
          </div>
        )}

        {/* ROSTER LIST: ONE-TAP ATTENDANCE MARKING */}
        {filteredRoster.length === 0 ? (
          <div className="rounded-2xl border border-() bg-() p-12 text-center text-() space-y-2">
            <Users className="h-8 w-8 mx-auto text-()" />
            <p className="text-sm font-semibold text-()">
              {locale === 'en'
                ? 'No players match the search or filter criteria'
                : 'لا يوجد لاعبين مطابقين للبحث أو الفلتر'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRoster.map((item) => {
              const isPending = pendingPlayerIds.has(item.playerId);
              const pName = translateDataString(item.playerName, locale);

              return (
                <div
                  key={item.playerId}
                  id={`roster-row-${item.playerId}`}
                  className={`rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-sm bg-() ${
                    item.status === 'PRESENT'
                      ? 'border-emerald-500/40 ring-1 ring-emerald-500/20'
                      : item.status === 'LATE'
                        ? 'border-amber-500/40 ring-1 ring-amber-500/20'
                        : item.status === 'ABSENT'
                          ? 'border-rose-500/40 ring-1 ring-rose-500/20'
                          : item.status === 'EXCUSED'
                            ? 'border-sky-500/40 ring-1 ring-sky-500/20'
                            : 'border-() hover:border-()/40'
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
                                : 'bg-() text-()'
                      }`}
                    >
                      {pName.slice(0, 2)}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-()">
                          {pName}
                        </h3>
                        {item.jerseyNumber && (
                          <span className="rounded-full bg-() px-2 py-0.5 text-[10px] font-bold text-() border border-()">
                            #{item.jerseyNumber}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-() mt-0.5">
                        {item.status === 'PRESENT' && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {locale === 'en' ? 'Present' : 'حاضر'}{' '}
                            {item.checkInTime ? `(${item.checkInTime.slice(11, 16)})` : ''}
                          </span>
                        )}
                        {item.status === 'LATE' && (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                            <Clock4 className="h-3.5 w-3.5" />
                            {locale === 'en' ? 'Late' : 'متأخر'}{' '}
                            {item.checkInTime ? `(${item.checkInTime.slice(11, 16)})` : ''}
                          </span>
                        )}
                        {item.status === 'ABSENT' && (
                          <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                            <XCircle className="h-3.5 w-3.5" />
                            {locale === 'en' ? 'Absent' : 'غائب'}
                          </span>
                        )}
                        {item.status === 'EXCUSED' && (
                          <span className="text-sky-600 dark:text-sky-400 font-semibold flex items-center gap-1">
                            <HelpCircle className="h-3.5 w-3.5" />
                            {locale === 'en' ? 'Excused' : 'غياب بعذر'}
                          </span>
                        )}
                        {item.status === 'UNMARKED' && (
                          <span className="text-() italic">
                            {locale === 'en' ? 'Not recorded yet' : 'لم يسجل بعد'}
                          </span>
                        )}
                        {item.remarks && (
                          <span className="text-()">
                            • {translateDataString(item.remarks, locale)}
                          </span>
                        )}
                      </div>

                      {/* Payment Status & Quick Fee Collection */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {item.subscriptionStatus === 'ACTIVE' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>
                              {locale === 'en'
                                ? 'Active Subscription (Paid)'
                                : 'اشتراك ساري (مسدد)'}
                            </span>
                          </span>
                        )}
                        {item.subscriptionStatus === 'PARTIAL' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            <AlertTriangle className="h-3 w-3" />
                            <span>
                              {locale === 'en'
                                ? `Remaining: ${item.outstandingBalance ?? 0} SAR`
                                : `متبقي: ${item.outstandingBalance ?? 0} ر.س`}
                            </span>
                          </span>
                        )}
                        {item.subscriptionStatus === 'OVERDUE' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 border border-rose-500/30">
                            <XCircle className="h-3 w-3" />
                            <span>
                              {locale === 'en'
                                ? `Overdue: ${item.outstandingBalance || item.amountDue || 0} SAR`
                                : `متأخر: ${item.outstandingBalance || item.amountDue || 0} ر.س`}
                            </span>
                          </span>
                        )}
                        {(!item.subscriptionStatus ||
                          item.subscriptionStatus === 'EXEMPT' ||
                          item.subscriptionStatus === 'PAUSED' ||
                          item.subscriptionStatus === 'EXPIRED') && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/15 px-2.5 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 border border-slate-500/30">
                            <span>
                              {item.subscriptionStatus === 'EXEMPT'
                                ? locale === 'en'
                                  ? 'Fee Exempt'
                                  : 'معفى من الرسوم'
                                : item.subscriptionStatus === 'PAUSED'
                                  ? locale === 'en'
                                    ? 'Paused'
                                    : 'موقوف مؤقتاً'
                                  : item.subscriptionStatus === 'EXPIRED'
                                    ? locale === 'en'
                                      ? 'Expired'
                                      : 'منتهي'
                                    : locale === 'en'
                                      ? 'Unpaid'
                                      : 'غير مسدد'}
                            </span>
                          </span>
                        )}

                        <button
                          type="button"
                          id={`btn-collect-payment-${item.playerId}`}
                          onClick={() => handleOpenPaymentModal(item)}
                          className="inline-flex items-center gap-1 rounded-lg bg-() hover:bg-() px-2 py-0.5 text-[10px] font-semibold text-() border border-() hover:border-()/40 transition-colors cursor-pointer"
                          title={
                            locale === 'en'
                              ? 'Record cash or electronic payment for player'
                              : 'تسجيل دفعة نقدية أو إلكترونية للاعب'
                          }
                        >
                          <CreditCard className="h-3 w-3" />
                          <span>{locale === 'en' ? 'Collect Fee' : 'تحصيل دفعة'}</span>
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
                          : 'bg-() text-() hover:text-emerald-600 hover:bg-emerald-500/10 border border-()'
                      }`}
                    >
                      <Check className="h-4 w-4" />
                      <span>{locale === 'en' ? 'Present' : 'حاضر'}</span>
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
                          : 'bg-() text-() hover:text-amber-500 hover:bg-amber-500/10 border border-()'
                      }`}
                    >
                      <Clock4 className="h-3.5 w-3.5" />
                      <span>{locale === 'en' ? 'Late' : 'متأخر'}</span>
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
                          : 'bg-() text-() hover:text-rose-500 hover:bg-rose-500/10 border border-()'
                      }`}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>{locale === 'en' ? 'Absent' : 'غائب'}</span>
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
                          : 'bg-() text-() hover:text-sky-500 hover:bg-sky-500/10 border border-()'
                      }`}
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      <span>{locale === 'en' ? 'Excused' : 'بعذر'}</span>
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
          <div className="w-full max-w-md rounded-2xl border border-() bg-() p-6 shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-() pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-() text-()">
                  <QrCode className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-()">
                  {locale === 'en' ? 'Temporary Check-in QR Code' : 'رمز QR المؤقت للتحضير'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="p-1 text-() hover:text-()"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Timer countdown */}
            <div className="flex items-center justify-between rounded-xl bg-() border border-() px-4 py-2.5 text-xs">
              <span className="text-() flex items-center gap-1.5">
                <Timer className="h-4 w-4 text-amber-500" />
                {locale === 'en' ? 'Code expires in:' : 'صلاحية الرمز تنتهي خلال:'}
              </span>
              <span
                className={`font-mono font-bold text-sm ${qrSecondsLeft < 15 ? 'text-rose-500 animate-pulse' : 'text-()'}`}
              >
                {qrSecondsLeft} {locale === 'en' ? 'seconds' : 'ثانية'}
              </span>
            </div>

            {/* QR Visual Card */}
            <div className="rounded-2xl border border-() bg-white p-6 flex flex-col items-center justify-center text-center shadow-inner">
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
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-() bg-() py-2 text-xs font-semibold text-() hover:border-() transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>{locale === 'en' ? 'Refresh Code' : 'تجديد الرمز فوراً'}</span>
              </button>
            </div>

            {/* Quick QR Check-in Simulator */}
            <div className="rounded-xl border border-() bg-() p-4 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-()">
                <UserCheck className="h-4 w-4 text-()" />
                <span>
                  {locale === 'en'
                    ? 'Player Check-in Simulator (Quick QR)'
                    : 'محاكي المسح للاعب (Quick QR Scanner)'}
                </span>
              </div>
              <p className="text-[11px] text-()">
                {locale === 'en'
                  ? 'For testing without a camera, select a player and simulate scan with current token:'
                  : 'للاختبار دون ماسح ضوئي كاميرا، اختر لاعباً وانقر لتسجيل حضوره بالرمز الحالي:'}
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
                  className="flex-1 rounded-xl border border-() bg-() px-3 py-2 text-xs text-() focus:outline-none"
                >
                  {session.roster.map((r) => (
                    <option key={r.playerId} value={r.playerId}>
                      {translateDataString(r.playerName, locale)} ({translateStatus(r.status, locale)})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  id="btn-simulate-qr-checkin"
                  disabled={!qrData || qrSecondsLeft <= 0}
                  onClick={handleSimulateQrCheckIn}
                  className="rounded-xl bg-() px-3.5 py-2 text-xs font-bold text-white hover:brightness-110 disabled:opacity-50"
                >
                  {locale === 'en' ? 'Check In' : 'تسجيل بالرمز'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EVENTS AUDIT MODAL */}
      {isEventsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-() bg-() p-6 shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-() pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-() text-()">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-()">
                    {locale === 'en'
                      ? 'Audit Log & Event Stream'
                      : 'سجل العمليات والتدقيق التراكمي'}
                  </h3>
                  <p className="text-xs text-()">
                    {locale === 'en'
                      ? 'Immutable append-only event stream for all attendance records and corrections.'
                      : 'سجل غير قابل للتعديل (Append-Only Event Stream) لجميع حركات التحضير والتصحيح.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEventsModalOpen(false)}
                className="p-1 text-() hover:text-()"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isLoadingEvents ? (
              <div className="p-8 text-center text-()">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-() mb-2" />
                <p className="text-xs">
                  {locale === 'en' ? 'Loading events log...' : 'جارٍ جلب سجل الأحداث...'}
                </p>
              </div>
            ) : events.length === 0 ? (
              <div className="p-8 text-center text-()">
                <p className="text-xs">
                  {locale === 'en'
                    ? 'No recorded events in this session yet.'
                    : 'لا توجد حركات مسجلة في هذه الحصة حتى الآن.'}
                </p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2.5 pe-1">
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-xl border border-() bg-() p-3 text-xs flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-()">
                          {translateDataString(ev.playerName, locale)}
                        </span>
                        <span className="text-()">→</span>
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
                          {translateStatus(ev.newStatus, locale)}
                        </span>
                        <span className="text-[10px] text-()">
                          ({locale === 'en' ? 'Source:' : 'المصدر:'} {ev.source})
                        </span>
                      </div>
                      {ev.reason && (
                        <p className="text-[11px] text-()">
                          {locale === 'en' ? 'Reason:' : 'السبب:'}{' '}
                          {translateDataString(ev.reason, locale)}
                        </p>
                      )}
                    </div>

                    <div className="text-end text-[10px] text-()">
                      <div>{ev.eventAt.slice(0, 10)}</div>
                      <div className="font-mono text-()">
                        {ev.eventAt.slice(11, 19)}
                      </div>
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
          <div className="w-full max-w-md rounded-2xl border border-() bg-() p-6 shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-() pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-()">
                    {locale === 'en' ? 'Collect Player Payment' : 'تحصيل دفعة مالية للاعب'}
                  </h3>
                  <p className="text-xs text-()">
                    {translateDataString(selectedPlayerForPayment.playerName, locale)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1 text-() hover:text-()"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div className="rounded-xl border border-() bg-() p-3 text-xs flex justify-between items-center">
                <span className="text-()">
                  {locale === 'en' ? 'Outstanding Balance:' : 'المتبقي على الاشتراك:'}
                </span>
                <span className="font-extrabold text-()">
                  {selectedPlayerForPayment.outstandingBalance ??
                    selectedPlayerForPayment.amountDue ??
                    0}{' '}
                  {locale === 'en' ? 'SAR' : 'ر.س'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-() mb-1.5">
                  {locale === 'en'
                    ? 'Amount Collected (SAR) *'
                    : 'المبلغ المحصل (ر.س) *'}
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-() bg-() px-3.5 py-2.5 text-sm font-bold text-() focus:border-() focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-() mb-1.5">
                  {locale === 'en' ? 'Payment Method *' : 'طريقة التحصيل *'}
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as 'CASH' | 'CARD' | 'POS' | 'BANK_TRANSFER')
                  }
                  className="w-full rounded-xl border border-() bg-() px-3.5 py-2.5 text-xs font-semibold text-() focus:border-() focus:outline-none cursor-pointer"
                >
                  <option value="CASH">
                    {locale === 'en' ? 'Cash (On-pitch)' : 'نقدي (كاش بالملعب)'}
                  </option>
                  <option value="POS">
                    {locale === 'en' ? 'POS Terminal / Network' : 'جهاز نقاط البيع (شبكة / POS)'}
                  </option>
                  <option value="CARD">
                    {locale === 'en'
                      ? 'Bank Card / Mada (Online)'
                      : 'بطاقة بنكية / مدى (Online / Card)'}
                  </option>
                  <option value="BANK_TRANSFER">
                    {locale === 'en' ? 'Direct Bank Transfer' : 'تحويل بنكي مباشر'}
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-() mb-1.5">
                  {locale === 'en'
                    ? 'Receipt / Reference Number (Optional)'
                    : 'رقم الإيصال أو المرجع (اختياري)'}
                </label>
                <input
                  type="text"
                  placeholder={
                    locale === 'en'
                      ? 'e.g. POS-99881 or transfer ref'
                      : 'مثال: POS-99881 أو رقم الحوالة'
                  }
                  value={paymentRefNumber}
                  onChange={(e) => setPaymentRefNumber(e.target.value)}
                  className="w-full rounded-xl border border-() bg-() px-3.5 py-2 text-xs text-() placeholder-() focus:border-() focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-() mb-1.5">
                  {locale === 'en'
                    ? 'Payment Notes (Optional)'
                    : 'ملاحظات الدفعة (اختياري)'}
                </label>
                <input
                  type="text"
                  placeholder={
                    locale === 'en'
                      ? 'Additional documentation notes...'
                      : 'ملاحظات توثيقية إضافية...'
                  }
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full rounded-xl border border-() bg-() px-3.5 py-2 text-xs text-() placeholder-() focus:border-() focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-()">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="rounded-xl border border-() px-4 py-2 text-xs font-semibold text-() hover:bg-() transition-colors cursor-pointer"
                >
                  {locale === 'en' ? 'Cancel' : 'إلغاء'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment || paymentAmount <= 0}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSubmittingPayment && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{locale === 'en' ? 'Confirm Payment' : 'تأكيد استلام الدفعة'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. RECORD SESSION EXPENSE MODAL */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-() bg-() p-6 shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-() pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <PlusCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-()">
                    {locale === 'en'
                      ? 'Record Session Expense'
                      : 'تسجيل مصروف للحصة التدريبية'}
                  </h3>
                  <p className="text-xs text-()">
                    {locale === 'en'
                      ? 'Deducted from the on-pitch session cash drawer'
                      : 'يتم خصم هذا المبلغ من كاش الصندوق الميداني للحصة'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1 text-() hover:text-()"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-() mb-1.5">
                  {locale === 'en'
                    ? 'Expense Amount (SAR) *'
                    : 'قيمة المصروف (ر.س) *'}
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={expenseAmount || ''}
                  onChange={(e) => setExpenseAmount(parseFloat(e.target.value) || 0)}
                  placeholder="50"
                  className="w-full rounded-xl border border-() bg-() px-3.5 py-2.5 text-sm font-bold text-() focus:border-() focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-() mb-1.5">
                  {locale === 'en'
                    ? 'Expense Reason & Item *'
                    : 'بيان وسبب المصروف *'}
                </label>
                <textarea
                  required
                  rows={3}
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  placeholder={
                    locale === 'en'
                      ? 'e.g. Bottled water for players, first aid supplies...'
                      : 'مثال: شراء مياه معدنية وعصيرات للاعبين، أو أدوات تدريب طارئة...'
                  }
                  className="w-full rounded-xl border border-() bg-() p-3 text-xs text-() placeholder-() focus:border-() focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-()">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="rounded-xl border border-() px-4 py-2 text-xs font-semibold text-() hover:bg-() transition-colors cursor-pointer"
                >
                  {locale === 'en' ? 'Cancel' : 'إلغاء'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingExpense || expenseAmount <= 0 || !expenseNotes.trim()}
                  className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSubmittingExpense && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{locale === 'en' ? 'Save Expense' : 'حفظ المصروف'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. RECONCILE & CLOSE CASHIER MODAL */}
      {isCloseCashierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-() bg-() p-6 shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-() pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-()">
                    {locale === 'en'
                      ? 'Reconcile & Close Cash Drawer'
                      : 'مطابقة وإغلاق الصندوق المالي'}
                  </h3>
                  <p className="text-xs text-()">
                    {locale === 'en'
                      ? 'Close drawer and confirm session financial transactions'
                      : 'إغلاق الصندوق وتثبيت الحركة المحاسبية للحصة'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCloseCashierModalOpen(false)}
                className="p-1 text-() hover:text-()"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-() bg-() p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-()">
                    {locale === 'en' ? 'Cash Collected:' : 'الكاش المحصل:'}
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    +{cashierSummary?.totalCashCollected ?? 0} {locale === 'en' ? 'SAR' : 'ر.س'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-()">
                    {locale === 'en' ? 'Expenses:' : 'المصروفات:'}
                  </span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    -{cashierSummary?.totalExpenses ?? 0} {locale === 'en' ? 'SAR' : 'ر.س'}
                  </span>
                </div>
                <div className="flex justify-between border-t border-() pt-2 font-bold text-()">
                  <span>
                    {locale === 'en' ? 'Net Cash to Hand Over:' : 'صافي النقد المطلوب تسليمه:'}
                  </span>
                  <span>
                    {cashierSummary?.netCashMovement ?? 0} {locale === 'en' ? 'SAR' : 'ر.س'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-() mb-1.5">
                  {locale === 'en'
                    ? 'Settlement Notes (Optional)'
                    : 'ملاحظات التسوية الختامية (اختياري)'}
                </label>
                <textarea
                  rows={2}
                  value={closeCashierNotes}
                  onChange={(e) => setCloseCashierNotes(e.target.value)}
                  placeholder={
                    locale === 'en'
                      ? 'Notes on cash custody or handover to accountant...'
                      : 'ملاحظات حول عهدة الكاش أو التسليم للمحاسب...'
                  }
                  className="w-full rounded-xl border border-() bg-() p-3 text-xs text-() placeholder-() focus:border-() focus:outline-none resize-none"
                />
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                {locale === 'en'
                  ? 'Closing the cash drawer will be logged with your user identity and timestamp in the audit records.'
                  : 'سيتم توثيق إغلاق الصندوق باسمك وتاريخ اليوم في سجل التدقيق المالي.'}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-()">
              <button
                type="button"
                onClick={() => setIsCloseCashierModalOpen(false)}
                className="rounded-xl border border-() px-4 py-2 text-xs font-semibold text-() hover:bg-() transition-colors cursor-pointer"
              >
                {locale === 'en' ? 'Cancel' : 'تراجع'}
              </button>
              <button
                type="button"
                disabled={isSubmittingCloseCashier}
                onClick={handleConfirmCloseCashier}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isSubmittingCloseCashier && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>
                  {locale === 'en'
                    ? 'Confirm & Close Drawer'
                    : 'تأكيد المطابقة وإغلاق الصندوق'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. REJECT EXPENSE MODAL */}
      {rejectingExpenseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-() bg-() p-6 shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-() pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <XCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-()">
                    {locale === 'en' ? 'Reject Field Expense' : 'رفض المصروف الميداني'}
                  </h3>
                  <p className="text-xs text-()">
                    {locale === 'en'
                      ? 'Document rejection reason in financial audit log'
                      : 'توثيق سبب الرفض في سجل التدقيق المالي'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectingExpenseId(null)}
                className="p-1 text-() hover:text-()"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-()">
                {locale === 'en' ? (
                  <>
                    The expense will be marked as{' '}
                    <strong className="text-rose-600">REJECTED</strong> and will not be deducted
                    from the cash drawer.
                  </>
                ) : (
                  <>
                    سيتم وضع المصروف في حالة <strong className="text-rose-600">مرفوض</strong> ولن
                    يتم خصمه نهائياً من الصندوق المالي أو كشف الحساب.
                  </>
                )}
              </p>

              <div>
                <label className="block text-xs font-semibold text-() mb-1.5">
                  {locale === 'en' ? 'Rejection Reason ' : 'سبب الرفض '}
                  <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder={
                    locale === 'en'
                      ? 'e.g. Not permitted under academy policy, missing invoice...'
                      : 'مثال: المصروف غير مشمول بسياسة الأكاديمية، أو لم يتم إرفاق فاتورة رسمية...'
                  }
                  className="w-full rounded-xl border border-() bg-() p-3 text-xs text-() placeholder-() focus:border-rose-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-()">
              <button
                type="button"
                onClick={() => setRejectingExpenseId(null)}
                className="rounded-xl border border-() px-4 py-2 text-xs font-semibold text-() hover:bg-() transition-colors cursor-pointer"
              >
                {locale === 'en' ? 'Cancel' : 'إلغاء'}
              </button>
              <button
                type="button"
                disabled={isSubmittingRejectExpense || !rejectionReason.trim()}
                onClick={handleConfirmRejectExpense}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isSubmittingRejectExpense && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>{locale === 'en' ? 'Confirm Rejection' : 'تأكيد الرفض'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
