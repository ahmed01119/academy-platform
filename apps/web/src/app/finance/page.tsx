'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { useLocale } from '../../lib/locale-context';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/ui/PageHeader';
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
} from 'lucide-react';

export default function FinanceDashboardPage() {
  const router = useRouter();
  const { user, activeTenant, isLoading: authLoading } = useAuth();
  const { t } = useLocale();

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
  const [selectedSubForPayment, setSelectedSubForPayment] = useState<PlayerSubscriptionItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'POS' | 'BANK_TRANSFER'>('CASH');
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
  const [planPeriod, setPlanPeriod] = useState<'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'PER_SESSION'>('MONTHLY');
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
    if (user && activeTenant) {
      void loadFinancialData();
    }
  }, [user, activeTenant, loadFinancialData]);

  // Load players for new subscription dropdown
  useEffect(() => {
    if (isCreateSubOpen && allPlayers.length === 0) {
      apiClient.players.list({ limit: 100 }).then((res) => {
        const formatted = res.items.map((p) => ({
          id: p.id,
          name: `${p.firstName} ${p.lastName}`,
        }));
        setAllPlayers(formatted);
        if (formatted.length > 0 && !selectedPlayerId && formatted[0]) {
          setSelectedPlayerId(formatted[0].id);
        }
      }).catch(console.error);
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
      await loadFinancialData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'فشل تسجيل الدفعة');
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
      await loadFinancialData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'فشل عكس المعاملة');
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
      await loadFinancialData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'فشل إنشاء الاشتراك');
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
      await loadFinancialData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'فشل إنشاء الباقة التدريبية');
    } finally {
      setIsSubmittingPlan(false);
    }
  };

  const handleExportCsv = () => {
    if (!filteredTransactions.length) return;
    const headers = ['رقم الإيصال', 'التاريخ', 'المستفيد / اللاعب', 'الفرع', 'النوع', 'المبلغ (ر.س)', 'طريقة الدفع', 'الحالة', 'ملاحظات'];
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
    link.setAttribute('download', `financial-statement-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (authLoading || isLoadingData) {
    return (
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-[var(--brand-primary)]" />
            <p className="text-sm font-medium text-[var(--text-muted)]">جارٍ تحميل بيانات العمليات المالية والاشتراكات...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
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
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--brand-primary)] transition-all cursor-pointer"
              >
                <Download className="h-4 w-4 text-[var(--brand-primary)]" />
                <span>{t('finance.exportStatement', 'تصدير كشف الحساب')}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCreateSubOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-[var(--brand-primary)] px-4 py-2 text-xs font-bold text-white shadow hover:brightness-110 transition-all cursor-pointer"
              >
                <PlusCircle className="h-4 w-4" />
                <span>إضافة اشتراك لاعب</span>
              </button>
            </div>
          }
        />

        {/* 6 TOP FINANCIAL KPI CARDS */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm">
              <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
                <span className="text-[11px] font-semibold">{t('finance.todayCollections', 'تحصيلات اليوم')}</span>
                <Clock className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {metrics.todayCollections.toLocaleString()} <span className="text-xs font-normal">ر.س</span>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm">
              <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
                <span className="text-[11px] font-semibold">تحصيلات الحصص</span>
                <Wallet className="h-4 w-4 text-blue-500" />
              </div>
              <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400">
                {metrics.sessionCollections.toLocaleString()} <span className="text-xs font-normal">ر.س</span>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm">
              <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
                <span className="text-[11px] font-semibold">{t('finance.monthlyRevenue', 'إيرادات الشهر')}</span>
                <TrendingUp className="h-4 w-4 text-[var(--brand-primary)]" />
              </div>
              <div className="text-xl font-extrabold text-[var(--text-primary)]">
                {metrics.monthlyRevenue.toLocaleString()} <span className="text-xs font-normal">ر.س</span>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm">
              <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
                <span className="text-[11px] font-semibold">{t('finance.outstandingBalances', 'الأرصدة المستحقة')}</span>
                <AlertCircle className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
                {metrics.outstandingPlayerBalances.toLocaleString()} <span className="text-xs font-normal">ر.س</span>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm">
              <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
                <span className="text-[11px] font-semibold">{t('finance.overdueCount', 'اشتراكات متأخرة')}</span>
                <XCircle className="h-4 w-4 text-rose-500" />
              </div>
              <div className="text-xl font-extrabold text-rose-600 dark:text-rose-400">
                {metrics.overdueSubscriptionsCount} <span className="text-xs font-normal">لاعب</span>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm">
              <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
                <span className="text-[11px] font-semibold">{t('finance.netCashMovement', 'صافي الحركة النقدية')}</span>
                <Receipt className="h-4 w-4 text-violet-500" />
              </div>
              <div className="text-xl font-extrabold text-violet-600 dark:text-violet-400">
                {metrics.netCashMovement.toLocaleString()} <span className="text-xs font-normal">ر.س</span>
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
                ? 'bg-[var(--brand-primary)] text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Receipt className="h-4 w-4" />
            <span>سجل العمليات والتحصيلات</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SUBSCRIPTIONS')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'SUBSCRIPTIONS'
                ? 'bg-[var(--brand-primary)] text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>عضويات واشتراكات اللاعبين ({subscriptions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PLANS')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'PLANS'
                ? 'bg-[var(--brand-primary)] text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>باقات التدريب وعقد الأكاديمية</span>
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
                  <CreditCard className="h-4 w-4 text-[var(--brand-primary)]" />
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('finance.paymentMethods', 'طرق الدفع المعتمدة')}</h3>
                </div>

                <div className="space-y-3">
                  {metrics &&
                    Object.entries(metrics.paymentMethodBreakdown).map(([method, amount]) => {
                      const total = Object.values(metrics.paymentMethodBreakdown).reduce((a, b) => a + b, 0) || 1;
                      const percentage = Math.round((amount / total) * 100);

                      return (
                        <div key={method} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold text-[var(--text-primary)]">
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
                              {amount.toLocaleString()} ر.س ({percentage}%)
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[var(--brand-primary)]"
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
                  <Building2 className="h-4 w-4 text-[var(--brand-primary)]" />
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">إيرادات الفروع والملاعب</h3>
                </div>

                <div className="space-y-3">
                  {metrics && Object.keys(metrics.branchRevenue).length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] py-4 text-center">لا توجد إيرادات مسجلة بالفروع حتى الآن.</p>
                  ) : (
                    metrics &&
                    Object.entries(metrics.branchRevenue).map(([branchName, amount]) => (
                      <div
                        key={branchName}
                        className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-xs flex justify-between items-center"
                      >
                        <span className="font-semibold text-[var(--text-primary)]">{branchName}</span>
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                          {amount.toLocaleString()} ر.س
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
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">سجل القيود والمعاملات المالية</h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    سجل شامل لجميع المقبوضات ومصروفات الحصص مع إمكانية عكس القيود المحاسبية.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      placeholder="بحث برقم الإيصال أو اللاعب..."
                      value={txSearch}
                      onChange={(e) => setTxSearch(e.target.value)}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] pr-9 pl-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none"
                    />
                  </div>

                  <select
                    value={txTypeFilter}
                    onChange={(e) => setTxTypeFilter(e.target.value)}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none cursor-pointer"
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
                  لا توجد حركات مالية مطابقة للبحث أو الفلتر.
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
                        <tr key={tx.id} className="hover:bg-[var(--bg-elevated)]/50 transition-colors">
                          <td className="py-3 px-3 font-mono font-bold text-[var(--brand-primary)]">
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
                          <td className="py-3 px-3 font-bold text-[var(--text-primary)]">
                            {tx.playerName || 'مصروف تشغيلي للحصة'}
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
                              {tx.type === 'MEMBERSHIP_FEE'
                                ? 'سداد اشتراك'
                                : tx.type === 'SESSION_EXPENSE'
                                  ? 'مصروف حصة'
                                  : tx.type}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-extrabold">
                            <span className={tx.type === 'SESSION_EXPENSE' ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400'}>
                              {tx.type === 'SESSION_EXPENSE' ? '-' : '+'}
                              {tx.amount.toLocaleString()} ر.س
                            </span>
                          </td>
                          <td className="py-3 px-3 text-[var(--text-muted)]">{tx.paymentMethod}</td>
                          <td className="py-3 px-3 text-[var(--text-muted)]">{tx.recordedByName || 'النظام'}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                tx.status === 'COMPLETED'
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {tx.status === 'COMPLETED' ? 'مكتمل' : 'معكوس / ملغي'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-left">
                            {tx.status === 'COMPLETED' && (
                              <button
                                type="button"
                                onClick={() => handleOpenReversalModal(tx)}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer"
                                title="إلغاء المعاملة وعكس القيد المحاسبي"
                              >
                                <RotateCcw className="h-3 w-3" />
                                <span>عكس القيد</span>
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
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  {t('subscriptions.playerTitle', 'اشتراكات وعضويات اللاعبين')}
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  إدارة خطط اشتراكات اللاعبين، متابعة الأرصدة المتبقية، وتحصيل الرسوم.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder="بحث باسم اللاعب..."
                    value={subSearch}
                    onChange={(e) => setSubSearch(e.target.value)}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] pr-9 pl-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none"
                  />
                </div>

                <select
                  value={subStatusFilter}
                  onChange={(e) => setSubStatusFilter(e.target.value)}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none cursor-pointer"
                >
                  <option value="ALL">جميع الحالات</option>
                  <option value="ACTIVE">نشط ومسدد</option>
                  <option value="PARTIAL">مسدد جزئياً</option>
                  <option value="OVERDUE">متأخر عن السداد</option>
                  <option value="EXPIRED">منتهي الصلاحية</option>
                </select>
              </div>
            </div>

            {filteredSubscriptions.length === 0 ? (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-12 text-center text-[var(--text-muted)] text-xs">
                لا يوجد اشتراكات مطابقة للبحث أو الفلتر.
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/50 text-[var(--text-muted)]">
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
                        <tr key={sub.id} className="hover:bg-[var(--bg-elevated)]/40 transition-colors">
                          <td className="py-3 px-4 font-bold text-[var(--text-primary)]">{sub.playerName}</td>
                          <td className="py-3 px-4 text-[var(--text-muted)]">{sub.planName || 'باقة مخصصة'}</td>
                          <td className="py-3 px-4 font-mono text-[var(--text-muted)]">
                            {String(sub.startDate).slice(0, 10)}
                          </td>
                          <td className="py-3 px-4 font-mono text-[var(--text-muted)]">
                            {String(sub.dueDate).slice(0, 10)}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-[var(--text-primary)]">
                            {sub.feeAmount.toLocaleString()} ر.س
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {sub.paidAmount.toLocaleString()} ر.س
                          </td>
                          <td className="py-3 px-4 font-mono font-bold">
                            <span className={sub.outstandingBalance > 0 ? 'text-amber-500' : 'text-[var(--text-muted)]'}>
                              {sub.outstandingBalance.toLocaleString()} ر.س
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
                              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-bold text-white shadow hover:brightness-110 transition-all cursor-pointer"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              <span>تحصيل دفعة</span>
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
              <div className="rounded-2xl border border-[var(--brand-primary)]/40 bg-[var(--bg-surface)] p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--brand-surface)] text-[var(--brand-primary)] font-bold">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-[var(--text-primary)]">
                          عقد اشتراك الأكاديمية بالمنصة ({tenantSub.planName})
                        </h3>
                        <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 text-xs font-bold border border-emerald-500/30">
                          {tenantSub.status}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        الباقة المفعلة تشمل حتى {tenantSub.maxBranches} فروع و {tenantSub.maxPlayers} لاعب نشط.
                      </p>
                    </div>
                  </div>

                  <div className="text-left font-mono">
                    <span className="text-xs text-[var(--text-muted)] block">قيمة الاشتراك الشهري (MRR)</span>
                    <span className="text-xl font-black text-[var(--brand-primary)]">
                      {tenantSub.currentPrice.toLocaleString()} {tenantSub.currency || 'ر.س'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[var(--border-subtle)] text-xs">
                  <div>
                    <span className="text-[var(--text-muted)] block mb-0.5">تاريخ بدء العقد:</span>
                    <span className="font-mono font-bold text-[var(--text-primary)]">
                      {String(tenantSub.startDate).slice(0, 10)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block mb-0.5">تاريخ التجديد القادم:</span>
                    <span className="font-mono font-bold text-[var(--text-primary)]">
                      {String(tenantSub.renewalDate).slice(0, 10)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block mb-0.5">الحد الأقصى للفروع:</span>
                    <span className="font-bold text-[var(--text-primary)]">{tenantSub.maxBranches} فروع</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block mb-0.5">الحد الأقصى للاعبين:</span>
                    <span className="font-bold text-[var(--text-primary)]">{tenantSub.maxPlayers} لاعب</span>
                  </div>
                </div>
              </div>
            )}

            {/* Player Plans Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">باقات العضويات والتدريب للأكاديمية</h3>
                  <p className="text-xs text-[var(--text-muted)]">الباقات المتاحة لتسجيل اللاعبين والاشتراكات الدورية.</p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCreatePlanOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-[var(--brand-primary)] px-4 py-2 text-xs font-bold text-white shadow hover:brightness-110 transition-all cursor-pointer"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>إنشاء باقة جديدة</span>
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
                        <h4 className="text-base font-bold text-[var(--text-primary)]">{p.name}</h4>
                        <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold">
                          {p.billingPeriod === 'MONTHLY' ? 'شهري' : p.billingPeriod}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-1">{p.description || 'باقة تدريب رسمية'}</p>
                    </div>

                    <div className="pt-4 border-t border-[var(--border-subtle)] flex items-baseline justify-between">
                      <div>
                        <span className="text-2xl font-black text-[var(--text-primary)]">
                          {p.feeAmount.toLocaleString()}
                        </span>
                        <span className="text-xs text-[var(--text-muted)] font-semibold mr-1">ر.س / دورة</span>
                      </div>
                      <span className="text-xs text-[var(--brand-primary)] font-bold">
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
                  <h3 className="text-base font-bold text-[var(--text-primary)]">تحصيل دفعة مالية للاعب</h3>
                  <p className="text-xs text-[var(--text-muted)]">{selectedSubForPayment.playerName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCollectPaymentOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-xs flex justify-between items-center">
                <span className="text-[var(--text-muted)]">المتبقي على الاشتراك:</span>
                <span className="font-extrabold text-[var(--brand-primary)]">
                  {selectedSubForPayment.outstandingBalance} ر.س
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
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
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">طريقة التحصيل *</label>
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
                  <option value="POS">جهاز نقاط البيع (POS / شبكة)</option>
                  <option value="CARD">بطاقة مدى / ائتمانية</option>
                  <option value="BANK_TRANSFER">تحويل بنكي</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">رقم الإيصال / المرجع</label>
                <input
                  type="text"
                  placeholder="رقم الإيصال أو الحوالة..."
                  value={paymentRefNumber}
                  onChange={(e) => setPaymentRefNumber(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">ملاحظات</label>
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
                  onClick={() => setIsCollectPaymentOpen(false)}
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
                  <span>تأكيد استلام المبلغ</span>
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
                  <h3 className="text-base font-bold text-[var(--text-primary)]">عكس المعاملة وإلغاء القيد</h3>
                  <p className="text-xs text-[var(--text-muted)]">{reversalTx.receiptNumber || reversalTx.id.slice(0, 8)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReversalTx(null)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReversal} className="space-y-4">
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
                سيتم إلغاء هذه المعاملة ({reversalTx.amount} ر.س) وعكس أثرها المالي على رصيد اللاعب وسجل الأكاديمية
                فوراً مع توثيق سبب الإلغاء في سجل التدقيق.
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  سبب الإلغاء وعكس القيد (إلزامي) *
                </label>
                <textarea
                  required
                  rows={3}
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="يرجى كتابة سبب الإلغاء بالتفصيل (مثل: خطأ في إدخال المبلغ، دفع مكرر، طلب ولي الأمر...)"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setReversalTx(null)}
                  className="rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReversal || reversalReason.trim().length < 5}
                  className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSubmittingReversal && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>تأكيد عكس القيد</span>
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
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-surface)] text-[var(--brand-primary)]">
                  <PlusCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">تسجيل اشتراك جديد للاعب</h3>
                  <p className="text-xs text-[var(--text-muted)]">إضافة دورة اشتراك تدريبي وتحديد رسوم العضوية</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateSubOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewSubscription} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">اختيار اللاعب *</label>
                <select
                  required
                  value={selectedPlayerId}
                  onChange={(e) => setSelectedPlayerId(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-xs font-semibold text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none cursor-pointer"
                >
                  {allPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  الباقة التدريبية (اختياري)
                </label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => {
                    const planId = e.target.value;
                    setSelectedPlanId(planId);
                    const chosen = plans.find((p) => p.id === planId);
                    if (chosen) setSubFeeAmount(chosen.feeAmount);
                  }}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-xs font-semibold text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none cursor-pointer"
                >
                  <option value="">بدون باقة محددة (مبلغ مخصص)</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.feeAmount} ر.س)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                    قيمة الاشتراك (ر.س) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={subFeeAmount}
                    onChange={(e) => setSubFeeAmount(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs text-[var(--text-primary)] font-bold focus:border-[var(--brand-primary)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                    خصم ممنوح (ر.س)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={subDiscountAmount}
                    onChange={(e) => setSubDiscountAmount(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
                  />
                </div>
              </div>

              {subDiscountAmount > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                    سبب الخصم الممنوح
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: خصم إخوة، منحة تفوق رياضي..."
                    value={subDiscountReason}
                    onChange={(e) => setSubDiscountReason(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  تاريخ استحقاق التجديد *
                </label>
                <input
                  type="date"
                  required
                  value={subDueDate}
                  onChange={(e) => setSubDueDate(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">ملاحظات الاشتراك</label>
                <textarea
                  rows={2}
                  value={subNotes}
                  onChange={(e) => setSubNotes(e.target.value)}
                  placeholder="ملاحظات العضوية والاشتراك..."
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setIsCreateSubOpen(false)}
                  className="rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNewSub || !selectedPlayerId || subFeeAmount <= 0}
                  className="flex items-center gap-1.5 rounded-xl bg-[var(--brand-primary)] px-5 py-2 text-xs font-bold text-white shadow hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSubmittingNewSub && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>حفظ الاشتراك</span>
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
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-surface)] text-[var(--brand-primary)]">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">إنشاء باقة تدريبية جديدة</h3>
                  <p className="text-xs text-[var(--text-muted)]">إضافة خطة اشتراك للناشئين واللاعبين</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatePlanOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewPlan} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">اسم الباقة التدريبية *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: باقة النخبة الشهرية (3 حصص أسبوعياً)"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                    السعر (ر.س) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={planPrice}
                    onChange={(e) => setPlanPrice(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs text-[var(--text-primary)] font-bold focus:border-[var(--brand-primary)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">دورة الفوترة *</label>
                  <select
                    value={planPeriod}
                    onChange={(e) =>
                      setPlanPeriod(
                        e.target.value as 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'PER_SESSION',
                      )
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none cursor-pointer"
                  >
                    <option value="MONTHLY">شهري (Monthly)</option>
                    <option value="QUARTERLY">ربع سنوي (3 أشهر)</option>
                    <option value="ANNUAL">سنوي (12 شهر)</option>
                    <option value="PER_SESSION">حسب الحصة (Per Session)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">وصف ومميزات الباقة</label>
                <textarea
                  rows={2}
                  value={planDescription}
                  onChange={(e) => setPlanDescription(e.target.value)}
                  placeholder="تفاصيل التمارين والمميزات المرفقة..."
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setIsCreatePlanOpen(false)}
                  className="rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPlan || !planName.trim() || planPrice <= 0}
                  className="flex items-center gap-1.5 rounded-xl bg-[var(--brand-primary)] px-5 py-2 text-xs font-bold text-white shadow hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSubmittingPlan && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>إنشاء الباقة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
