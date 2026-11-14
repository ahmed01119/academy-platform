'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useLocale } from '@/contexts/locale-context';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Button } from '../../components/ui/Button';
import { Tabs, TabList, TabTrigger, TabContent } from '../../components/ui/Tabs';
import { translateDataString } from '@/utils/data-translator';
import { apiClient } from '@/api/client';
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
  PlusCircle,
  Clock,
  XCircle,
  Users,
  Layers,
  ShieldCheck,
  Printer,
  Download,
} from 'lucide-react';

import {
  CollectPaymentModal,
  ReversalModal,
  CreateSubscriptionModal,
  CreatePlanModal,
  OverviewTab,
  SubscriptionsTab,
  PlansTab,
} from '@/components/finance';

export default function FinanceDashboardPage() {
  const router = useRouter();
  const { user, activeTenant, isLoading: authLoading } = useAuth();
  const { t, locale } = useLocale();
  const isAr = locale === 'ar';

  // Active Tab
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'SUBSCRIPTIONS' | 'PLANS'>('OVERVIEW');

  // Dashboard Data State
  const [metrics, setMetrics] = useState<AcademyFinancialDashboardMetrics | null>(null);
  const [tenantSub, setTenantSub] = useState<TenantSubscriptionItem | null>(null);
  const [subscriptions, setSubscriptions] = useState<PlayerSubscriptionItem[]>([]);
  const [plans, setPlans] = useState<PlayerSubscriptionPlanItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Modals state
  const [isCollectPaymentOpen, setIsCollectPaymentOpen] = useState(false);
  const [selectedSubForPayment, setSelectedSubForPayment] = useState<PlayerSubscriptionItem | null>(
    null,
  );
  const [reversalTx, setReversalTx] = useState<FinancialTransactionItem | null>(null);
  const [isCreateSubOpen, setIsCreateSubOpen] = useState(false);
  const [isCreatePlanOpen, setIsCreatePlanOpen] = useState(false);

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
        setIsLoadingData(false);
      }
    }
  }, [user, activeTenant, authLoading, loadFinancialData]);

  const handleOpenPaymentModal = (sub: PlayerSubscriptionItem) => {
    setSelectedSubForPayment(sub);
    setIsCollectPaymentOpen(true);
  };

  const handleExportCsv = () => {
    if (!metrics?.recentTransactions?.length) return;
    const headers = isAr
      ? [
          'رقم الإيصال',
          'التاريخ',
          'المستفيد / اللاعب',
          'الفرع',
          'النوع',
          'المبلغ (ر.س)',
          'طريقة الدفع',
          'الحالة',
          'ملاحظات',
        ]
      : [
          'Receipt No',
          'Date',
          'Beneficiary / Athlete',
          'Branch',
          'Type',
          'Amount',
          'Payment Method',
          'Status',
          'Notes',
        ];
    const rows = metrics.recentTransactions.map((tx) => [
      tx.receiptNumber || tx.id.slice(0, 8),
      new Date(tx.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US'),
      tx.playerName || (isAr ? 'مصروف تشغيلي' : 'Operating Expense'),
      tx.branchName || (isAr ? 'الفرع الرئيسي' : 'Main Branch'),
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
        <PageSkeleton hasStats statsCount={4} variant="table" hasFilters />
      </AppShell>
    );
  }

  // Super Admin / platform-level users have no academy tenant — show a clear message
  if (user && !activeTenant) {
    return (
      <AppShell>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center px-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-(--accent-primary)/10 border border-(--accent-primary)/20">
            <ShieldCheck className="h-8 w-8 text-(--accent-primary)" />
          </div>
          <div className="space-y-2 max-w-sm">
            <h2 className="text-xl font-bold text-(--text-main)">
              {isAr ? 'لوحة الإدارة المركزية' : 'Central Platform Administration'}
            </h2>
            <p className="text-sm text-(--text-muted) leading-relaxed">
              {t(
                'finance.platform_admin_desc',
                isAr
                  ? 'صفحة العمليات المالية مخصصة للأكاديميات. كمدير المنصة، يمكنك مراجعة التقارير المالية الإجمالية من لوحة تحكم المنصة.'
                  : 'Financial operations are dedicated to tenant academies. As platform super-admin, you can audit overall financial metrics from Platform Hub.',
              )}
            </p>
          </div>
          <a
            href="/platform"
            className="mt-2 flex items-center gap-2 rounded-xl bg-(--accent-primary) px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 transition-all"
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
                {translateDataString(
                  activeTenant?.tenantName || (isAr ? 'الأكاديمية الرياضية' : 'Sports Academy'),
                  locale,
                )}
              </h1>
              <p className="text-xs text-black">
                {isAr
                  ? 'التقرير المالي وكشف الحساب الرسمي — منصة سبورتكسس'
                  : 'Official Financial Statement & Ledger — Sportexus'}
              </p>
            </div>
            <div className="text-left rtl:text-left text-xs text-black">
              <p>
                {isAr ? 'تاريخ الطباعة: ' : 'Print Date: '}
                {new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}
              </p>
              <p>
                {isAr ? 'الوقت: ' : 'Time: '}
                {new Date().toLocaleTimeString(isAr ? 'ar-EG' : 'en-US')}
              </p>
            </div>
          </div>
        </div>

        <PageHeader
          breadcrumbs={[
            { label: t('nav.dashboard', 'لوحة التحكم'), href: '/dashboard' },
            { label: t('finance.title', 'العمليات المالية والاشتراكات') },
          ]}
          title={t('finance.title', 'العمليات المالية والاشتراكات')}
          description={t(
            'finance.subtitle',
            'متابعة تحصيلات الاشتراكات، تسوية الصناديق، والأرصدة المستحقة للأكاديمية.',
          )}
          actions={
            <div className="flex flex-wrap items-center gap-2.5 print:hidden">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrint}
                startIcon={<Printer className="h-4 w-4 text-(--accent-primary)" />}
              >
                {isAr ? 'طباعة تقرير مالي (PDF)' : 'Print Report (PDF)'}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                startIcon={<Download className="h-4 w-4 text-(--accent-primary)" />}
              >
                {isAr ? 'تصدير كشف الحساب' : 'Export Statement'}
              </Button>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setIsCreateSubOpen(true)}
                startIcon={<PlusCircle className="h-4 w-4" />}
              >
                {isAr ? 'إضافة اشتراك لاعب' : 'New Subscription'}
              </Button>
            </div>
          }
        />

        {/* 6 TOP FINANCIAL KPI CARDS */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface) p-4 shadow-xs">
              <div className="flex items-center justify-between text-(--text-muted) mb-1">
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

            <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface) p-4 shadow-xs">
              <div className="flex items-center justify-between text-(--text-muted) mb-1">
                <span className="text-[11px] font-semibold">
                  {isAr ? 'تحصيلات الحصص' : 'Session Fees'}
                </span>
                <Wallet className="h-4 w-4 text-blue-500" />
              </div>
              <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400">
                {metrics.sessionCollections.toLocaleString()}{' '}
                <span className="text-xs font-normal">{isAr ? 'ر.س' : 'SAR'}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface) p-4 shadow-xs">
              <div className="flex items-center justify-between text-(--text-muted) mb-1">
                <span className="text-[11px] font-semibold">
                  {isAr ? 'إيرادات الشهر' : 'Monthly Revenue'}
                </span>
                <TrendingUp className="h-4 w-4 text-(--accent-primary)" />
              </div>
              <div className="text-xl font-extrabold text-(--text-main)">
                {metrics.monthlyRevenue.toLocaleString()}{' '}
                <span className="text-xs font-normal">{isAr ? 'ر.س' : 'SAR'}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface)shadow-xs">
              <div className="flex items-center justify-between text-(--text-muted)">
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

            <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface) p-4 shadow-xs">
              <div className="flex items-center justify-between text-(--text-muted) mb-1">
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

            <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface) p-4 shadow-xs">
              <div className="flex items-center justify-between text-(--text-muted) mb-1">
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

        {/* TABS NAVIGATION */}
        <Tabs
          value={activeTab}
          onValueChange={(val: string) =>
            setActiveTab(val as 'OVERVIEW' | 'SUBSCRIPTIONS' | 'PLANS')
          }
        >
          <TabList className="mb-6">
            <TabTrigger value="OVERVIEW" icon={<Receipt className="h-4 w-4" />}>
              {isAr ? 'سجل العمليات والتحصيلات' : 'Transactions & Ledger'}
            </TabTrigger>
            <TabTrigger
              value="SUBSCRIPTIONS"
              icon={<Users className="h-4 w-4" />}
              badge={subscriptions.length}
            >
              {isAr ? 'عضويات واشتراكات اللاعبين' : 'Athlete Subscriptions'}
            </TabTrigger>
            <TabTrigger value="PLANS" icon={<Layers className="h-4 w-4" />}>
              {isAr ? 'باقات التدريب وعقد الأكاديمية' : 'Training Plans & SaaS Tier'}
            </TabTrigger>
          </TabList>

          <TabContent value="OVERVIEW">
            <OverviewTab metrics={metrics} onReverseTransaction={setReversalTx} />
          </TabContent>

          <TabContent value="SUBSCRIPTIONS">
            <SubscriptionsTab
              subscriptions={subscriptions}
              onCollectPayment={handleOpenPaymentModal}
            />
          </TabContent>

          <TabContent value="PLANS">
            <PlansTab
              tenantSub={tenantSub}
              plans={plans}
              onOpenCreatePlan={() => setIsCreatePlanOpen(true)}
            />
          </TabContent>
        </Tabs>
      </div>

      {/* MODALS */}
      <CollectPaymentModal
        isOpen={isCollectPaymentOpen}
        onClose={() => setIsCollectPaymentOpen(false)}
        subscription={selectedSubForPayment}
        branchId={activeTenant?.branchId || undefined}
        onSuccess={loadFinancialData}
      />

      <ReversalModal
        transaction={reversalTx}
        onClose={() => setReversalTx(null)}
        onSuccess={loadFinancialData}
      />

      <CreateSubscriptionModal
        isOpen={isCreateSubOpen}
        onClose={() => setIsCreateSubOpen(false)}
        plans={plans}
        onSuccess={loadFinancialData}
      />

      <CreatePlanModal
        isOpen={isCreatePlanOpen}
        onClose={() => setIsCreatePlanOpen(false)}
        onSuccess={loadFinancialData}
      />
    </AppShell>
  );
}
