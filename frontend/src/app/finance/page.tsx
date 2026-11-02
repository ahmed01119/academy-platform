'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { useLocale } from '../../lib/locale-context';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/ui/PageHeader';
import { useToast } from '../../components/ui/Toast';
import { translateDataString } from '../../lib/data-translator';
import { apiClient } from '../../lib/api-client';
import type {
  AcademyFinancialDashboardMetrics,
  FinancialTransactionItem,
  PlayerSubscriptionItem,
  PlayerSubscriptionPlanItem,
  TenantSubscriptionItem,
} from '@academy/shared';
import {
  Wallet,
  TrendingUp,
  Receipt,
  AlertCircle,
  CreditCard,
  PlusCircle,
  Search,
  Download,
  RotateCcw,
  Clock,
  XCircle,
  Building2,
  Users,
  RefreshCw,
  X,
  Layers,
  ShieldCheck,
  Printer,
} from 'lucide-react';

export default function FinanceDashboardPage() {
  const router = useRouter();
  const { user, activeTenant, isLoading: authLoading } = useAuth();
  const { t, locale, isRtl } = useLocale();
  const isAr = locale === 'ar';
  const { toast } = useToast();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'SUBSCRIPTIONS' | 'PLANS'>('OVERVIEW');

  // Dashboard Data State
  const [metrics, setMetrics] = useState<AcademyFinancialDashboardMetrics | null>(null);
  const [tenantSub, setTenantSub] = useState<TenantSubscriptionItem | null>(null);
  const [subscriptions, setSubscriptions] = useState<PlayerSubscriptionItem[]>([]);
  const [plans, setPlans] = useState<PlayerSubscriptionPlanItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Filters
  const [txSearch, setTxSearch] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<string>('ALL');
  const [subSearch, setSubSearch] = useState('');
  const [subStatusFilter, setSubStatusFilter] = useState<string>('ALL');

  // Modals
  const [isCollectPaymentOpen, setIsCollectPaymentOpen] = useState(false);
  const [selectedSubForPayment, setSelectedSubForPayment] = useState<PlayerSubscriptionItem | null>(
    null,
  );
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'POS' | 'BANK_TRANSFER'>(
    'CASH',
  );
  const [paymentRefNumber, setPaymentRefNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Reversal Modal
  const [reversalTx, setReversalTx] = useState<FinancialTransactionItem | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [isSubmittingReversal, setIsSubmittingReversal] = useState(false);

  // Create Subscription Modal
  const [isCreateSubOpen, setIsCreateSubOpen] = useState(false);
  const [allPlayers, setAllPlayers] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [subFeeAmount, setSubFeeAmount] = useState<number>(650);
  const [subDiscountAmount, setSubDiscountAmount] = useState<number>(0);
  const [subDiscountReason, setSubDiscountReason] = useState('');
  const [subDueDate, setSubDueDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [subNotes, setSubNotes] = useState('');
  const [isSubmittingNewSub, setIsSubmittingNewSub] = useState(false);

  // Create Plan Modal
  const [isCreatePlanOpen, setIsCreatePlanOpen] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState<number>(650);
  const [planPeriod, setPlanPeriod] = useState<'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'PER_SESSION'>(
    'MONTHLY',
  );
  const [planDescription, setPlanDescription] = useState('');
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);

  // Ensure authorized staff
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const loadFinancialData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const [metricsData, tenantSubData, subsData, plansData] = await Promise.all([
        apiClient.finance.getDashboardMetrics(),
        apiClient.finance.getTenantSubscription().catch(() => null),
        apiClient.finance.listPlayerSubscriptions({ limit: 100 }),
        apiClient.finance.listPlayerPlans(),
      ]);

      setMetrics(metricsData);
      setTenantSub(tenantSubData);
      setSubscriptions(subsData);
      setPlans(plansData);
    } catch (err) {
      console.error('Failed to load financial data:', err);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (user && activeTenant) {
        void loadFinancialData();
      } else if (user && !activeTenant) {
        // Platform-level user (Super Admin) has no academy tenant context
        setIsLoadingData(false);
      }
    }
  }, [user, activeTenant, authLoading, loadFinancialData]);

  // Load players for new subscription dropdown
  useEffect(() => {
    if (isCreateSubOpen && allPlayers.length === 0) {
      apiClient.players
        .list({ limit: 100 })
        .then((res) => {
          const formatted = res.items.map((p) => ({
            id: p.id,
            name: `${p.firstName} ${p.lastName}`,
          }));
          setAllPlayers(formatted);
          if (formatted.length > 0 && !selectedPlayerId && formatted[0]) {
            setSelectedPlayerId(formatted[0].id);
          }
        })
        .catch(console.error);
    }
  }, [isCreateSubOpen, allPlayers.length, selectedPlayerId]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    if (!metrics?.recentTransactions) return [];
    return metrics.recentTransactions.filter((tx) => {
      const q = txSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (tx.receiptNumber && tx.receiptNumber.toLowerCase().includes(q)) ||
        (tx.playerName && tx.playerName.toLowerCase().includes(q)) ||
        (tx.notes && tx.notes.toLowerCase().includes(q));

      const matchesType = txTypeFilter === 'ALL' || tx.type === txTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [metrics?.recentTransactions, txSearch, txTypeFilter]);

  // Filtered Subscriptions
  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((sub) => {
      const q = subSearch.trim().toLowerCase();
      const matchesSearch = !q || sub.playerName.toLowerCase().includes(q);
      const matchesStatus = subStatusFilter === 'ALL' || sub.status === subStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [subscriptions, subSearch, subStatusFilter]);

  // Handlers
  const handleOpenPaymentModal = (sub: PlayerSubscriptionItem) => {
    setSelectedSubForPayment(sub);
    setPaymentAmount(sub.outstandingBalance > 0 ? sub.outstandingBalance : sub.feeAmount);
    setPaymentMethod('CASH');
    setPaymentRefNumber('');
    setPaymentNotes('');
    setIsCollectPaymentOpen(true);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubForPayment || paymentAmount <= 0 || !activeTenant) return;
    setIsSubmittingPayment(true);
    try {
      await apiClient.finance.recordPayment({
        playerId: selectedSubForPayment.playerId,
        subscriptionId: selectedSubForPayment.id,
        branchId: activeTenant.branchId || selectedSubForPayment.tenantId, // fallback branch
        amount: Number(paymentAmount),
        paymentMethod,
        referenceNumber: paymentRefNumber.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
      });
      setIsCollectPaymentOpen(false);
      toast.success(isAr ? 'تم تسجيل الدفعة بنجاح وتحديث الحساب' : 'Payment recorded and account updated successfully');
      await loadFinancialData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (isAr ? 'فشل تسجيل الدفعة' : 'Failed to record payment'));
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleOpenReversalModal = (tx: FinancialTransactionItem) => {
    setReversalTx(tx);
    setReversalReason('');
  };

  const handleSubmitReversal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalTx || reversalReason.trim().length < 5) return;
    setIsSubmittingReversal(true);
    try {
      await apiClient.finance.reverseTransaction(reversalTx.id, {
        reason: reversalReason.trim(),
      });
      setReversalTx(null);
      toast.success(isAr ? 'تم عكس المعاملة المالية وتوثيق السبب في سجل التدقيق' : 'Transaction reversed and audited successfully');
      await loadFinancialData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (isAr ? 'فشل عكس المعاملة' : 'Failed to reverse transaction'));
    } finally {
      setIsSubmittingReversal(false);
    }
  };

  const handleSubmitNewSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayerId || subFeeAmount <= 0) return;
    setIsSubmittingNewSub(true);
    try {
      await apiClient.finance.createPlayerSubscription({
        playerId: selectedPlayerId,
        planId: selectedPlanId || undefined,
        feeAmount: Number(subFeeAmount),
        discountAmount: Number(subDiscountAmount || 0),
        discountReason: subDiscountReason.trim() || undefined,
        dueDate: subDueDate,
        notes: subNotes.trim() || undefined,
      });
      setIsCreateSubOpen(false);
      toast.success(isAr ? 'تم إنشاء اشتراك اللاعب بنجاح' : 'Athlete subscription created successfully');
      await loadFinancialData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (isAr ? 'فشل إنشاء الاشتراك' : 'Failed to create subscription'));
    } finally {
      setIsSubmittingNewSub(false);
    }
  };

  const handleSubmitNewPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName.trim() || planPrice <= 0) return;
    setIsSubmittingPlan(true);
    try {
      await apiClient.finance.createPlayerPlan({
        name: planName.trim(),
        feeAmount: Number(planPrice),
        currency: 'SAR',
        billingPeriod: planPeriod,
        sport: 'FOOTBALL',
        description: planDescription.trim() || undefined,
      });
      setIsCreatePlanOpen(false);
      setPlanName('');
      setPlanPrice(650);
      setPlanDescription('');
      toast.success(isAr ? 'تم إنشاء الباقة التدريبية بنجاح' : 'Training plan created successfully');
      await loadFinancialData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (isAr ? 'فشل إنشاء الباقة التدريبية' : 'Failed to create training plan'));
    } finally {
      setIsSubmittingPlan(false);
    }
  };

  const handleExportCsv = () => {
    if (!filteredTransactions.length) return;
    const headers = isAr
      ? ['رقم الإيصال', 'التاريخ', 'المستفيد / اللاعب', 'الفرع', 'النوع', 'المبلغ (ر.س)', 'طريقة الدفع', 'الحالة', 'ملاحظات']
      : ['Receipt No', 'Date', 'Beneficiary / Athlete', 'Branch', 'Type', 'Amount', 'Payment Method', 'Status', 'Notes'];
    const rows = filteredTransactions.map((tx) => [
      tx.receiptNumber || tx.id.slice(0, 8),
      new Date(tx.createdAt).toLocaleDateString('ar-EG'),
      tx.playerName || 'مصروف تشغيلي',
      tx.branchName || 'الفرع الرئيسي',
      tx.type,
      tx.amount,
      tx.paymentMethod,
      tx.status,
      tx.notes || '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `financial-statement-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  if (authLoading || isLoadingData) {
    return (
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-[var(--accent-primary)]" />
            <p className="text-sm font-medium text-[var(--text-muted)]">
              {isAr ? 'جارٍ تحميل بيانات العمليات المالية والاشتراكات...' : 'Loading financial records and subscriptions...'}
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  // Super Admin / platform-level users have no academy tenant — show a clear message
  if (user && !activeTenant) {
    return (
      <AppShell>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center px-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20">
            <ShieldCheck className="h-8 w-8 text-[var(--accent-primary)]" />
          </div>
          <div className="space-y-2 max-w-sm">
            <h2 className="text-xl font-bold text-[var(--text-main)]">
              {isAr ? 'لوحة الإدارة المركزية' : 'Central Platform Administration'}
            </h2>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              {t(
                'finance.platform_admin_desc',
                isAr ? 'صفحة العمليات المالية مخصصة للأكاديميات. كمدير المنصة، يمكنك مراجعة التقارير المالية الإجمالية من لوحة تحكم المنصة.' : 'Financial operations are dedicated to tenant academies. As platform super-admin, you can audit overall financial metrics from Platform Hub.',
              )}
            </p>
          </div>
          <a
            href="/platform"
            className="mt-2 flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 transition-all"
          >
            <Layers className="h-4 w-4" />
            {isAr ? 'الذهاب إلى لوحة إدارة المنصة' : 'Go to Platform Admin'}
          </a>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Official Printable Header (Visible only when printing to PDF / paper) */}
        <div className="hidden print:block p-4 border-b-2 border-black space-y-1 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-extrabold text-black">
                {translateDataString(activeTenant?.tenantName || (isAr ? 'الأكاديمية الرياضية' : 'Sports Academy'), locale)}
              </h1>
              <p className="text-xs text-gray-700">
                {isAr ? 'التقرير المالي وكشف الحساب الرسمي — منصة سبورتكسس' : 'Official Financial Statement & Ledger — Sportexus'}
              </p>
            </div>
            <div className="text-left rtl:text-left text-xs text-gray-700">
              <p>{isAr ? 'تاريخ الطباعة: ' : 'Print Date: '}{new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}</p>
              <p>{isAr ? 'الوقت: ' : 'Time: '}{new Date().toLocaleTimeString(isAr ? 'ar-EG' : 'en-US')}</p>
            </div>
          </div>
        </div>

        <PageHeader
          breadcrumbs={[
            { label: t('nav.dashboard', 'الرئيسية'), href: '/dashboard' },
            { label: t('finance.title', 'العمليات المالية والاشتراكات') },
          ]}
          title={t('finance.title', 'العمليات المالية والاشتراكات')}
          description={t(
            'finance.subtitle',
            'متابعة تحصيلات الاشتراكات، تسوية الصناديق، والأرصدة المستحقة للأكاديمية.',
          )}
          actions={
            <div className="flex flex-wrap items-center gap-2.5 print:hidden">
              <button
                type="button"
                id="btn-print-finance-report"
                onClick={handlePrint}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-semibold text-[var(--text-main)] hover:border-[var(--accent-primary)] transition-all cursor-pointer"
              >
                <Printer className="h-4 w-4 text-[var(--accent-primary)]" />
                <span>{isAr ? 'طباعة تقرير مالي (PDF)' : 'Print Report (PDF)'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-semibold text-[var(--text-main)] hover:border-[var(--accent-primary)] transition-all cursor-pointer"
              >
                <Download className="h-4 w-4 text-[var(--accent-primary)]" />
                <span>{isAr ? 'تصدير كشف الحساب' : 'Export Statement'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCreateSubOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-bold text-white shadow hover:brightness-110 transition-all cursor-pointer"
              >
                <PlusCircle className="h-4 w-4" />
                <span>{isAr ? 'إضافة اشتراك لاعب' : 'New Subscription'}</span>
              </button>
            </div>
          }
        />

        {/* 6 TOP FINANCIAL KPI CARDS */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm">
              <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
                <span className="text-[11px] font-semibold">
                  {isAr ? 'تحصيلات اليوم' : "Today's Collections"}
                </span>
                <Clock className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {metrics.todayCollections.toLocaleString()}{' '}
                <span className="text-xs font-normal">{isAr ? 'ر.س' : 'SAR'}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm">
              <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
                <span className="text-[11px] font-semibold">{isAr ? 'تحصيلات الحصص' : 'Session Fees'}</span>
                <Wallet className="h-4 w-4 text-blue-500" />
              </div>
              <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400">
                {metrics.sessionCollections.toLocaleString()}{' '}
                <span className="text-xs font-normal">{isAr ? 'ر.س' : 'SAR'}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm">
              <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
                <span className="text-[11px] font-semibold">
                  {isAr ? 'إيرادات الشهر' : 'Monthly Revenue'}
                </span>
                <TrendingUp className="h-4 w-4 text-[var(--accent-primary)]" />
              </div>
              <div className="text-xl font-extrabold text-[var(--text-main)]">
                {metrics.monthlyRevenue.toLocaleString()}{' '}
                <span className="text-xs font-normal">{isAr ? 'ر.س' : 'SAR'}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm">
              <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
                <span className="text-[11px] font-semibold">
                  {isAr ? 'الأرصدة المستحقة' : 'Outstanding Receivables'}
                </span>
                <AlertCircle className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
                {metrics.outstandingPlayerBalances.toLocaleString()}{' '}
                <span className="text-xs font-normal">{isAr ? 'ر.س' : 'SAR'}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm">
              <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
                <span className="text-[11px] font-semibold">
                  {isAr ? 'اشتراكات متأخرة' : 'Overdue Subscriptions'}
                </span>
                <XCircle className="h-4 w-4 text-rose-500" />
              </div>
              <div className="text-xl font-extrabold text-rose-600 dark:text-rose-400">
                {metrics.overdueSubscriptionsCount}{' '}
                <span className="text-xs font-normal">{isAr ? 'لاعب' : 'athletes'}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm">
              <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
                <span className="text-[11px] font-semibold">
                  {isAr ? 'صافي الحركة النقدية' : 'Net Cash Movement'}
                </span>
                <Receipt className="h-4 w-4 text-violet-500" />
              </div>
              <div className="text-xl font-extrabold text-violet-600 dark:text-violet-400">
                {metrics.netCashMovement.toLocaleString()}{' '}
                <span className="text-xs font-normal">{isAr ? 'ر.س' : 'SAR'}</span>
              </div>
            </div>
          </div>
        )}

        {/* NAVIGATION TABS */}
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('OVERVIEW')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'OVERVIEW'
                ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-main)]'
            }`}
          >
            <Receipt className="h-4 w-4" />
            <span>{isAr ? 'سجل العمليات والتحصيلات' : 'Transactions & Ledger'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SUBSCRIPTIONS')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'SUBSCRIPTIONS'
                ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-main)]'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>{isAr ? `عضويات واشتراكات اللاعبين (${subscriptions.length})` : `Athlete Subscriptions (${subscriptions.length})`}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PLANS')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'PLANS'
                ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-main)]'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>{isAr ? 'باقات التدريب وعقد الأكاديمية' : 'Training Plans & SaaS Tier'}</span>
          </button>
        </div>

        {/* TAB 1: OVERVIEW & TRANSACTION LEDGER */}
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-6">
            {/* Visual Breakdown Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Payment Methods Breakdown */}
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-[var(--accent-primary)]" />
                  <h3 className="text-sm font-bold text-[var(--text-main)]">
                    {isAr ? 'طرق الدفع المعتمدة' : 'Payment Methods Breakdown'}
                  </h3>
                </div>

                <div className="space-y-3">
                  {metrics &&
                    Object.entries(metrics.paymentMethodBreakdown).map(([method, amount]) => {
                      const total =
                        Object.values(metrics.paymentMethodBreakdown).reduce((a, b) => a + b, 0) ||
                        1;
                      const percentage = Math.round((amount / total) * 100);

                      return (
                        <div key={method} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold text-[var(--text-main)]">
                              {method === 'CASH'
                                ? 'نقدي (كاش)'
                                : method === 'POS'
                                  ? 'نقاط البيع (شبكة / مدى)'
                                  : method === 'CARD'
                                    ? 'بطاقة بنكية / فيزا'
                                    : method === 'BANK_TRANSFER'
                                      ? 'تحويل بنكي'
                                      : method}
                            </span>
                            <span className="font-mono text-[var(--text-muted)]">
                              {amount.toLocaleString()} {isAr ? 'ر.س' : 'SAR'} ({percentage}%)
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-[var(--bg-surface-subtle)] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[var(--accent-primary)]"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Branch Revenue Breakdown */}
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[var(--accent-primary)]" />
                  <h3 className="text-sm font-bold text-[var(--text-main)]">
                    {isAr ? 'إيرادات الفروع والملاعب' : 'Revenue by Branch & Ground'}
                  </h3>
                </div>

                <div className="space-y-3">
                  {metrics && Object.keys(metrics.branchRevenue).length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] py-4 text-center">
                      {isAr ? 'لا توجد إيرادات مسجلة بالفروع حتى الآن.' : 'No revenue recorded by branches yet.'}
                    </p>
                  ) : (
                    metrics &&
                    Object.entries(metrics.branchRevenue).map(([branchName, amount]) => (
                      <div
                        key={branchName}
                        className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3 text-xs flex justify-between items-center"
                      >
                        <span className="font-semibold text-[var(--text-main)]">{branchName}</span>
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                          {amount.toLocaleString()} {isAr ? 'ر.س' : 'SAR'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Transactions Ledger Table */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-main)]">
                    سجل القيود والمعاملات المالية
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    سجل شامل لجميع المقبوضات ومصروفات الحصص مع إمكانية عكس القيود المحاسبية.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      placeholder={isAr ? 'بحث برقم الإيصال أو اللاعب...' : 'Search receipt number or athlete...'}
                      value={txSearch}
                      onChange={(e) => setTxSearch(e.target.value)}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] pr-9 pl-3 py-1.5 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
                    />
                  </div>

                  <select
                    value={txTypeFilter}
                    onChange={(e) => setTxTypeFilter(e.target.value)}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-1.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">جميع الحركات</option>
                    <option value="MEMBERSHIP_FEE">رسوم اشتراك لاعب</option>
                    <option value="SESSION_EXPENSE">مصروف حصة تشغيلي</option>
                    <option value="REGISTRATION_FEE">رسوم تسجيل</option>
                  </select>
                </div>
              </div>

              {filteredTransactions.length === 0 ? (
                <div className="py-12 text-center text-[var(--text-muted)] text-xs">
                  {isAr ? 'لا توجد حركات مالية مطابقة للبحث أو الفلتر.' : 'No financial transactions match search or filter.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                        <th className="py-2.5 px-3">رقم الإيصال</th>
                        <th className="py-2.5 px-3">التاريخ والوقت</th>
                        <th className="py-2.5 px-3">المستفيد / اللاعب</th>
                        <th className="py-2.5 px-3">النوع</th>
                        <th className="py-2.5 px-3">المبلغ</th>
                        <th className="py-2.5 px-3">طريقة الدفع</th>
                        <th className="py-2.5 px-3">سجل بواسطة</th>
                        <th className="py-2.5 px-3">الحالة</th>
                        <th className="py-2.5 px-3 text-left">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {filteredTransactions.map((tx) => (
                        <tr
                          key={tx.id}
                          className="hover:bg-[var(--bg-surface-subtle)]/50 transition-colors"
                        >
                          <td className="py-3 px-3 font-mono font-bold text-[var(--accent-primary)]">
                            {tx.receiptNumber || tx.id.slice(0, 8)}
                          </td>
                          <td className="py-3 px-3 text-[var(--text-muted)] font-mono">
                            {new Date(tx.createdAt).toLocaleDateString('ar-EG', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3 px-3 font-bold text-[var(--text-main)]">
                            {tx.playerName || (isAr ? 'مصروف تشغيلي للحصة' : 'Session Expense')}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                tx.type === 'MEMBERSHIP_FEE'
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : tx.type === 'SESSION_EXPENSE'
                                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                    : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                              }`}
                            >
                              {isAr
                                ? (tx.type === 'MEMBERSHIP_FEE' ? 'سداد اشتراك' : tx.type === 'SESSION_EXPENSE' ? 'مصروف حصة' : tx.type)
                                : (tx.type === 'MEMBERSHIP_FEE' ? 'Subscription' : tx.type === 'SESSION_EXPENSE' ? 'Expense' : tx.type)}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-extrabold">
                            <span
                              className={
                                tx.type === 'SESSION_EXPENSE'
                                  ? 'text-rose-600'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }
                            >
                              {tx.type === 'SESSION_EXPENSE' ? '-' : '+'}
                              {tx.amount.toLocaleString()} {isAr ? 'ر.س' : 'SAR'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-[var(--text-muted)]">{tx.paymentMethod}</td>
                          <td className="py-3 px-3 text-[var(--text-muted)]">
                            {tx.recordedByName || (isAr ? 'النظام' : 'System')}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                tx.status === 'COMPLETED'
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {tx.status === 'COMPLETED' ? (isAr ? 'مكتمل' : 'Completed') : (isAr ? 'معكوس / ملغي' : 'Reversed')}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-left">
                            {tx.status === 'COMPLETED' && (
                              <button
                                type="button"
                                onClick={() => handleOpenReversalModal(tx)}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer"
                                title={isAr ? 'إلغاء المعاملة وعكس القيد المحاسبي' : 'Reverse transaction and cancel ledger'}
                              >
                                <RotateCcw className="h-3 w-3" />
                                <span>{isAr ? 'عكس القيد' : 'Reverse'}</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PLAYER SUBSCRIPTIONS */}
        {activeTab === 'SUBSCRIPTIONS' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-main)]">
                  {isAr ? 'اشتراكات وعضويات اللاعبين' : 'Athlete Subscriptions & Memberships'}
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  {isAr ? 'إدارة خطط اشتراكات اللاعبين، متابعة الأرصدة المتبقية، وتحصيل الرسوم.' : 'Manage athlete membership plans, track receivables, and collect dues.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder={isAr ? 'بحث باسم اللاعب...' : 'Search by athlete name...'}
                    value={subSearch}
                    onChange={(e) => setSubSearch(e.target.value)}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] pr-9 pl-3 py-1.5 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
                  />
                </div>

                <select
                  value={subStatusFilter}
                  onChange={(e) => setSubStatusFilter(e.target.value)}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-1.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none cursor-pointer"
                >
                  <option value="ALL">{isAr ? 'جميع الحالات' : 'All Statuses'}</option>
                  <option value="ACTIVE">{isAr ? 'نشط ومسدد' : 'Active & Paid'}</option>
                  <option value="PARTIAL">{isAr ? 'مسدد جزئياً' : 'Partially Paid'}</option>
                  <option value="OVERDUE">{isAr ? 'متأخر عن السداد' : 'Overdue'}</option>
                  <option value="EXPIRED">{isAr ? 'منتهي الصلاحية' : 'Expired'}</option>
                </select>
              </div>
            </div>

            {filteredSubscriptions.length === 0 ? (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-12 text-center text-[var(--text-muted)] text-xs">
                {isAr ? 'لا يوجد اشتراكات مطابقة للبحث أو الفلتر.' : 'No subscriptions match search or filter.'}
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/50 text-[var(--text-muted)]">
                        <th className="py-3 px-4">اللاعب</th>
                        <th className="py-3 px-4">الباقة التدريبية</th>
                        <th className="py-3 px-4">تاريخ البداية</th>
                        <th className="py-3 px-4">تاريخ الاستحقاق</th>
                        <th className="py-3 px-4">قيمة الاشتراك</th>
                        <th className="py-3 px-4">المسدد</th>
                        <th className="py-3 px-4">المتبقي</th>
                        <th className="py-3 px-4">الحالة</th>
                        <th className="py-3 px-4 text-left">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {filteredSubscriptions.map((sub) => (
                        <tr
                          key={sub.id}
                          className="hover:bg-[var(--bg-surface-subtle)]/40 transition-colors"
                        >
                          <td className="py-3 px-4 font-bold text-[var(--text-main)]">
                            {sub.playerName}
                          </td>
                          <td className="py-3 px-4 text-[var(--text-muted)]">
                            {translateDataString(sub.planName || (isAr ? 'باقة مخصصة' : 'Custom Plan'), locale)}
                          </td>
                          <td className="py-3 px-4 font-mono text-[var(--text-muted)]">
                            {String(sub.startDate).slice(0, 10)}
                          </td>
                          <td className="py-3 px-4 font-mono text-[var(--text-muted)]">
                            {String(sub.dueDate).slice(0, 10)}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-[var(--text-main)]">
                            {sub.feeAmount.toLocaleString()} {isAr ? 'ر.س' : 'SAR'}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {sub.paidAmount.toLocaleString()} {isAr ? 'ر.س' : 'SAR'}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold">
                            <span
                              className={
                                sub.outstandingBalance > 0
                                  ? 'text-amber-500'
                                  : 'text-[var(--text-muted)]'
                              }
                            >
                              {sub.outstandingBalance.toLocaleString()} {isAr ? 'ر.س' : 'SAR'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                sub.status === 'ACTIVE'
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                  : sub.status === 'PARTIAL'
                                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                              }`}
                            >
                              {sub.status === 'ACTIVE'
                                ? 'نشط ومسدد'
                                : sub.status === 'PARTIAL'
                                  ? 'مسدد جزئياً'
                                  : sub.status === 'OVERDUE'
                                    ? 'متأخر'
                                    : sub.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-left">
                            <button
                              type="button"
                              onClick={() => handleOpenPaymentModal(sub)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-bold text-white shadow hover:brightness-110 transition-all cursor-pointer"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              <span>{isAr ? 'تحصيل دفعة' : 'Collect Payment'}</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MEMBERSHIP PLANS & SAAS STATUS */}
        {activeTab === 'PLANS' && (
          <div className="space-y-6">
            {/* SaaS Contract Card */}
            {tenantSub && (
              <div className="rounded-2xl border border-[var(--accent-primary)]/40 bg-[var(--bg-surface)] p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--brand-surface)] text-[var(--accent-primary)] font-bold">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-[var(--text-main)]">
                          {isAr ? `عقد اشتراك الأكاديمية بالمنصة (${tenantSub.planName})` : `Academy Platform Subscription (${tenantSub.planName})`}
                        </h3>
                        <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 text-xs font-bold border border-emerald-500/30">
                          {tenantSub.status}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        الباقة المفعلة تشمل حتى {tenantSub.maxBranches} {isAr ? 'فروع' : 'branches'} و{' '}
                        {tenantSub.maxPlayers} {isAr ? 'لاعب' : 'athletes'} نشط.
                      </p>
                    </div>
                  </div>

                  <div className="text-left font-mono">
                    <span className="text-xs text-[var(--text-muted)] block">
                      {isAr ? 'قيمة الاشتراك الشهري (MRR)' : 'Monthly SaaS Tier (MRR)'}
                    </span>
                    <span className="text-xl font-black text-[var(--accent-primary)]">
                      {tenantSub.currentPrice.toLocaleString()} {tenantSub.currency || 'ر.س'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[var(--border-subtle)] text-xs">
                  <div>
                    <span className="text-[var(--text-muted)] block mb-0.5">{isAr ? 'تاريخ بدء العقد:' : 'Contract Start Date:'}</span>
                    <span className="font-mono font-bold text-[var(--text-main)]">
                      {String(tenantSub.startDate).slice(0, 10)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block mb-0.5">
                      {isAr ? 'تاريخ التجديد القادم:' : 'Next Renewal Date:'}
                    </span>
                    <span className="font-mono font-bold text-[var(--text-main)]">
                      {String(tenantSub.renewalDate).slice(0, 10)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block mb-0.5">
                      {isAr ? 'الحد الأقصى للفروع:' : 'Max Branches:'}
                    </span>
                    <span className="font-bold text-[var(--text-main)]">
                      {tenantSub.maxBranches} فروع
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block mb-0.5">
                      {isAr ? 'الحد الأقصى للاعبين:' : 'Max Athletes:'}
                    </span>
                    <span className="font-bold text-[var(--text-main)]">
                      {tenantSub.maxPlayers} لاعب
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Player Plans Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-main)]">
                    {isAr ? 'باقات العضويات والتدريب للأكاديمية' : 'Academy Membership & Training Plans'}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    {isAr ? 'الباقات المتاحة لتسجيل اللاعبين والاشتراكات الدورية.' : 'Available recurring membership plans for enrolling athletes.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCreatePlanOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-bold text-white shadow hover:brightness-110 transition-all cursor-pointer"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>{isAr ? 'إنشاء باقة جديدة' : 'New Training Plan'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {plans.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-sm space-y-4 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <h4 className="text-base font-bold text-[var(--text-main)]">{p.name}</h4>
                        <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold">
                          {p.billingPeriod === 'MONTHLY' ? (isAr ? 'شهري' : 'Monthly') : p.billingPeriod}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        {p.description || (isAr ? 'باقة تدريب رسمية' : 'Official training package')}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-[var(--border-subtle)] flex items-baseline justify-between">
                      <div>
                        <span className="text-2xl font-black text-[var(--text-main)]">
                          {p.feeAmount.toLocaleString()}
                        </span>
                        <span className="text-xs text-[var(--text-muted)] font-semibold mr-1">
                          {isAr ? 'ر.س / دورة' : 'SAR / cycle'}
                        </span>
                      </div>
                      <span className="text-xs text-[var(--accent-primary)] font-bold">
                        {p.billingPeriod === 'MONTHLY'
                          ? 'شهري'
                          : p.billingPeriod === 'PER_SESSION'
                            ? 'حسب الحصة'
                            : p.billingPeriod}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 1. COLLECT PAYMENT MODAL */}
      {isCollectPaymentOpen && selectedSubForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-main)]">
                    تحصيل دفعة مالية للاعب
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    {selectedSubForPayment.playerName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCollectPaymentOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3 text-xs flex justify-between items-center">
                <span className="text-[var(--text-muted)]">{isAr ? 'المتبقي على الاشتراك:' : 'Remaining Outstanding:'}</span>
                <span className="font-extrabold text-[var(--accent-primary)]">
                  {selectedSubForPayment.outstandingBalance} {isAr ? 'ر.س' : 'SAR'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                  {isAr ? 'المبلغ المحصل (ر.س) *' : 'Collected Amount (SAR) *'}
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-sm font-bold text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                  {isAr ? 'طريقة التحصيل *' : 'Payment Method *'}
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as 'CASH' | 'CARD' | 'POS' | 'BANK_TRANSFER')
                  }
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs font-semibold text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none cursor-pointer"
                >
                  <option value="CASH">{isAr ? 'نقدي (كاش بالملعب)' : 'Cash (Pitchside)'}</option>
                  <option value="POS">{isAr ? 'جهاز نقاط البيع (POS / شبكة)' : 'POS Terminal / Mada'}</option>
                  <option value="CARD">{isAr ? 'بطاقة مدى / ائتمانية' : 'Credit / Debit Card'}</option>
                  <option value="BANK_TRANSFER">{isAr ? 'تحويل بنكي' : 'Bank Transfer'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                  {isAr ? 'رقم الإيصال / المرجع' : 'Receipt / Reference No.'}
                </label>
                <input
                  type="text"
                  placeholder={isAr ? 'رقم الإيصال أو الحوالة...' : 'Receipt or transfer reference...'}
                  value={paymentRefNumber}
                  onChange={(e) => setPaymentRefNumber(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                  ملاحظات
                </label>
                <input
                  type="text"
                  placeholder={isAr ? 'ملاحظات توثيقية إضافية...' : 'Optional audit notes...'}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setIsCollectPaymentOpen(false)}
                  className="rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment || paymentAmount <= 0}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSubmittingPayment && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{isAr ? 'تأكيد استلام المبلغ' : 'Confirm Payment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. REVERSAL TRANSACTION MODAL */}
      {reversalTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-main)]">
                    عكس المعاملة وإلغاء القيد
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    {reversalTx.receiptNumber || reversalTx.id.slice(0, 8)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReversalTx(null)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReversal} className="space-y-4">
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
                {isAr
                  ? <>سيتم إلغاء هذه المعاملة ({reversalTx.amount} ر.س) وعكس أثرها المالي على رصيد اللاعب وسجل الأكاديمية فوراً مع توثيق سبب الإلغاء في سجل التدقيق.</>
                  : <>This transaction ({reversalTx.amount} SAR) will be voided and reversed immediately on athlete ledger and audited in security logs.</>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                  {isAr ? 'سبب الإلغاء وعكس القيد (إلزامي) *' : 'Reversal Reason (Mandatory) *'}
                </label>
                <textarea
                  required
                  rows={3}
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder={isAr ? 'يرجى كتابة سبب الإلغاء بالتفصيل (مثل: خطأ في إدخال المبلغ، دفع مكرر، طلب ولي الأمر...)' : 'Please describe reason (e.g., duplicate charge, clerk error, refund request)...'}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setReversalTx(null)}
                  className="rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReversal || reversalReason.trim().length < 5}
                  className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSubmittingReversal && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{isAr ? 'تأكيد عكس القيد' : 'Confirm Reversal'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. CREATE SUBSCRIPTION MODAL */}
      {isCreateSubOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-surface)] text-[var(--accent-primary)]">
                  <PlusCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-main)]">
                    تسجيل اشتراك جديد للاعب
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    إضافة دورة اشتراك تدريبي وتحديد رسوم العضوية
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateSubOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewSubscription} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                  {isAr ? 'اختيار اللاعب *' : 'Select Athlete *'}
                </label>
                <select
                  required
                  value={selectedPlayerId}
                  onChange={(e) => setSelectedPlayerId(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs font-semibold text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none cursor-pointer"
                >
                  {allPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                  {isAr ? 'الباقة التدريبية (اختياري)' : 'Training Plan (Optional)'}
                </label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => {
                    const planId = e.target.value;
                    setSelectedPlanId(planId);
                    const chosen = plans.find((p) => p.id === planId);
                    if (chosen) setSubFeeAmount(chosen.feeAmount);
                  }}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs font-semibold text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none cursor-pointer"
                >
                  <option value="">{isAr ? 'بدون باقة محددة (مبلغ مخصص)' : 'Custom Fee (No pre-set plan)'}</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.feeAmount} {isAr ? 'ر.س' : 'SAR'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                    {isAr ? 'قيمة الاشتراك (ر.س) *' : 'Subscription Fee (SAR) *'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={subFeeAmount}
                    onChange={(e) => setSubFeeAmount(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2 text-xs text-[var(--text-main)] font-bold focus:border-[var(--accent-primary)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                    {isAr ? 'خصم ممنوح (ر.س)' : 'Discount (SAR)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={subDiscountAmount}
                    onChange={(e) => setSubDiscountAmount(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
                  />
                </div>
              </div>

              {subDiscountAmount > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                    {isAr ? 'سبب الخصم الممنوح' : 'Discount Reason'}
                  </label>
                  <input
                    type="text"
                    placeholder={isAr ? 'مثال: خصم إخوة، منحة تفوق رياضي...' : 'e.g. Sibling discount, athletic scholarship...'}
                    value={subDiscountReason}
                    onChange={(e) => setSubDiscountReason(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                  {isAr ? 'تاريخ استحقاق التجديد *' : 'Renewal Due Date *'}
                </label>
                <input
                  type="date"
                  required
                  value={subDueDate}
                  onChange={(e) => setSubDueDate(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                  {isAr ? 'ملاحظات الاشتراك' : 'Subscription Notes'}
                </label>
                <textarea
                  rows={2}
                  value={subNotes}
                  onChange={(e) => setSubNotes(e.target.value)}
                  placeholder={isAr ? 'ملاحظات العضوية والاشتراك...' : 'Membership notes...'}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setIsCreateSubOpen(false)}
                  className="rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNewSub || !selectedPlayerId || subFeeAmount <= 0}
                  className="flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-5 py-2 text-xs font-bold text-white shadow hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSubmittingNewSub && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{isAr ? 'حفظ الاشتراك' : 'Save Subscription'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. CREATE PLAN MODAL */}
      {isCreatePlanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-surface)] text-[var(--accent-primary)]">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-main)]">
                    إنشاء باقة تدريبية جديدة
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    إضافة خطة اشتراك للناشئين واللاعبين
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatePlanOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewPlan} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                  {isAr ? 'اسم الباقة التدريبية *' : 'Plan Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isAr ? 'مثال: باقة النخبة الشهرية (3 حصص أسبوعياً)' : 'e.g. Monthly Elite Plan (3 sessions/week)'}
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                    {isAr ? 'السعر (ر.س) *' : 'Price (SAR) *'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={planPrice}
                    onChange={(e) => setPlanPrice(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2 text-xs text-[var(--text-main)] font-bold focus:border-[var(--accent-primary)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                    {isAr ? 'دورة الفوترة *' : 'Billing Cycle *'}
                  </label>
                  <select
                    value={planPeriod}
                    onChange={(e) =>
                      setPlanPeriod(
                        e.target.value as 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'PER_SESSION',
                      )
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2 text-xs font-semibold text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none cursor-pointer"
                  >
                    <option value="MONTHLY">شهري (Monthly)</option>
                    <option value="QUARTERLY">ربع سنوي (3 أشهر)</option>
                    <option value="ANNUAL">سنوي (12 شهر)</option>
                    <option value="PER_SESSION">حسب الحصة (Per Session)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                  {isAr ? 'وصف ومميزات الباقة' : 'Plan Description & Perks'}
                </label>
                <textarea
                  rows={2}
                  value={planDescription}
                  onChange={(e) => setPlanDescription(e.target.value)}
                  placeholder={isAr ? 'تفاصيل التمارين والمميزات المرفقة...' : 'Included perks, drills, and hours...'}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setIsCreatePlanOpen(false)}
                  className="rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPlan || !planName.trim() || planPrice <= 0}
                  className="flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-5 py-2 text-xs font-bold text-white shadow hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSubmittingPlan && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{isAr ? 'إنشاء الباقة' : 'Create Plan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
