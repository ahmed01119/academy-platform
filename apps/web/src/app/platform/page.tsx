'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { useLocale } from '../../lib/locale-context';
import { apiClient } from '../../lib/api-client';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { FilterBar } from '../../components/ui/FilterBar';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/Toast';
import {
  Building2,
  Users,
  ShieldCheck,
  Activity,
  AlertTriangle,
  Search,
  CheckCircle2,
  XCircle,
  TrendingUp,
  RefreshCw,
  DollarSign,
  LogOut,
  KeyRound,
  ShieldAlert,
  Layers,
} from 'lucide-react';
import type {
  PlatformAcademyItem,
  PlatformAuditLogItem,
  PlatformOverviewMetrics,
  PlatformSecurityEvent,
  PlatformUserItem,
  SaaSPlanItem,
} from '@academy/shared';

export default function PlatformSuperAdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { t, locale } = useLocale();
  const { toast } = useToast();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'academies' | 'users' | 'plans' | 'security' | 'audit'>('academies');
  const [metrics, setMetrics] = useState<PlatformOverviewMetrics | null>(null);
  const [academies, setAcademies] = useState<PlatformAcademyItem[]>([]);
  const [usersList, setUsersList] = useState<PlatformUserItem[]>([]);
  const [plans, setPlans] = useState<SaaSPlanItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<PlatformAuditLogItem[]>([]);
  const [securityEvents, setSecurityEvents] = useState<PlatformSecurityEvent[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Selected academy for plan modification modal
  const [editingAcademy, setEditingAcademy] = useState<PlatformAcademyItem | null>(null);
  const [selectedPlanCode, setSelectedPlanCode] = useState<'STARTER' | 'PRO' | 'ENTERPRISE' | 'CUSTOM'>('PRO');

  useEffect(() => {
    if (!authLoading && !user?.isPlatformSuperAdmin) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setFeedbackMessage(null);
    try {
      const [m, a, u, p, l, s] = await Promise.all([
        apiClient.platform.getMetrics().catch(() => null),
        apiClient.platform.listAcademies().catch(() => []),
        apiClient.platform.listUsers({ limit: 50 }).catch(() => []),
        apiClient.platform.listSaaSPlans().catch(() => []),
        apiClient.platform.listAuditLogs({ limit: 50 }).catch(() => []),
        apiClient.platform.getSecurityEvents().catch(() => []),
      ]);
      setMetrics(m);
      setAcademies(a);
      setUsersList(u);
      setPlans(p);
      setAuditLogs(l);
      setSecurityEvents(s);
    } catch (err: unknown) {
      setFeedbackMessage({
        type: 'error',
        text: (err as Error)?.message || (locale === 'ar' ? 'فشل تحميل بيانات المنصة' : 'Failed to load platform data'),
      });
    } finally {
      setIsLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    if (user?.isPlatformSuperAdmin) {
      void loadData();
    }
  }, [user, loadData]);

  // Handle Suspend / Reactivate Academy
  const handleToggleStatus = async (academy: PlatformAcademyItem) => {
    const newStatus = academy.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const actionName = newStatus === 'SUSPENDED' ? t('platform.suspendAction', 'إيقاف وتجميد') : t('platform.activateAction', 'إعادة تفعيل');
    const reasonPrompt = locale === 'ar' ? `يرجى إدخال سبب ${actionName} الأكاديمية (${academy.name}):` : `Enter reason for ${actionName} of ${academy.name}:`;
    const defaultReason = locale === 'ar' ? 'قرار إداري من المنصة' : 'Platform administrative decision';
    const reason = prompt(reasonPrompt, defaultReason);
    if (!reason) return;

    setActionLoading(academy.id);
    try {
      await apiClient.platform.updateAcademyStatus(academy.id, {
        status: newStatus,
        reason,
      });
      setFeedbackMessage({
        type: 'success',
        text: locale === 'ar' ? `تم ${actionName} الأكاديمية بنجاح.` : `Academy ${actionName} successful.`,
      });
      await loadData();
    } catch (err: unknown) {
      setFeedbackMessage({
        type: 'error',
        text: (err as Error)?.message || (locale === 'ar' ? 'فشلت العملية' : 'Operation failed'),
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Support Access
  const handleSupportAccess = async (academy: PlatformAcademyItem) => {
    const reasonPrompt = locale === 'ar' ? `سبب طلب جلسة الدعم الفني الموثقة للأكاديمية (${academy.name}):` : `State the required reason for accessing ${academy.name} support session:`;
    const defaultReason = locale === 'ar' ? 'معالجة تذكرة دعم فني بطلب من مالك الأكاديمية' : 'Resolving support ticket requested by academy owner';
    const reason = prompt(reasonPrompt, defaultReason);
    if (!reason || reason.trim().length < 10) {
      toast.warning(locale === 'ar' ? 'يجب إدخال سبب واضح لا يقل عن 10 أحرف لتوثيق الجلسة في سجل الأمان' : 'Reason must be at least 10 characters for compliance logging');
      return;
    }

    setActionLoading(academy.id);
    try {
      const res = await apiClient.platform.requestSupportAccess(academy.id, { reason });
      toast.success(locale === 'ar' ? `تم تفعيل جلسة الدعم الفني بنجاح حتى: ${new Date(res.expiresAt).toLocaleTimeString()}` : `Support session authorized until: ${new Date(res.expiresAt).toLocaleTimeString()}`);
      await loadData();
    } catch (err: unknown) {
      toast.error((err as Error)?.message || (locale === 'ar' ? 'فشل بدء جلسة الدعم الفني' : 'Failed to start support session'));
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Change SaaS Plan for Academy
  const handleSaveAcademyPlan = async () => {
    if (!editingAcademy) return;
    setActionLoading('plan-modal');
    try {
      await apiClient.platform.updateTenantSubscription(editingAcademy.id, {
        planCode: selectedPlanCode,
        reason: 'Super Admin updated commercial plan',
      });
      setFeedbackMessage({
        type: 'success',
        text: locale === 'ar' ? 'تم تحديث خطة اشتراك الأكاديمية بنجاح' : 'Academy subscription plan updated successfully',
      });
      setEditingAcademy(null);
      await loadData();
    } catch (err: unknown) {
      setFeedbackMessage({
        type: 'error',
        text: (err as Error)?.message || 'Failed to update subscription',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Force Logout for User
  const handleForceLogout = async (targetUser: PlatformUserItem) => {
    const confirmMsg = locale === 'ar'
      ? `هل أنت متأكد من إنهاء كافة الجلسات النشطة للمستخدم (${targetUser.email})؟ سيتم تسجيل خروجه فوراً من جميع الأجهزة.`
      : `Force logout all active sessions for ${targetUser.email}?`;
    if (!confirm(confirmMsg)) return;

    setActionLoading(`user-logout-${targetUser.id}`);
    try {
      const res = await apiClient.platform.revokeUserSessions(targetUser.id);
      setFeedbackMessage({
        type: 'success',
        text: locale === 'ar' ? `تم إنهاء ${res.revokedCount} جلسة نشطة بنجاح.` : `Revoked ${res.revokedCount} active sessions.`,
      });
      await loadData();
    } catch (err: unknown) {
      setFeedbackMessage({
        type: 'error',
        text: (err as Error)?.message || 'Failed to revoke sessions',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Toggle Require Password Reset
  const handleTogglePasswordReset = async (targetUser: PlatformUserItem) => {
    const nextState = !targetUser.mustResetPassword;
    setActionLoading(`user-pwd-${targetUser.id}`);
    try {
      await apiClient.platform.updateUserSecurityPolicy(targetUser.id, {
        mustResetPassword: nextState,
      });
      setFeedbackMessage({
        type: 'success',
        text: nextState
          ? (locale === 'ar' ? 'سيُطلب من المستخدم تعيين كلمة مرور جديدة فور تسجيل دخوله القادم.' : 'User will be required to reset password upon next sign-in.')
          : (locale === 'ar' ? 'تم إلغاء شرط إعادة تعيين كلمة المرور.' : 'Password reset requirement cleared.'),
      });
      await loadData();
    } catch (err: unknown) {
      setFeedbackMessage({
        type: 'error',
        text: (err as Error)?.message || 'Failed to update security policy',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Toggle User Suspension
  const handleToggleUserSuspension = async (targetUser: PlatformUserItem) => {
    const nextState = !targetUser.isSuspended;
    const reasonPrompt = nextState
      ? (locale === 'ar' ? `سبب تجميد حساب المستخدم (${targetUser.email}):` : `Reason for suspending user account (${targetUser.email}):`)
      : (locale === 'ar' ? `سبب إعادة تفعيل الحساب (${targetUser.email}):` : `Reason for reactivating account:`);
    const reason = prompt(reasonPrompt, 'Super Admin policy update');
    if (reason === null) return;

    setActionLoading(`user-suspend-${targetUser.id}`);
    try {
      await apiClient.platform.updateUserSecurityPolicy(targetUser.id, {
        isSuspended: nextState,
        reason,
      });
      setFeedbackMessage({
        type: 'success',
        text: nextState
          ? (locale === 'ar' ? 'تم تجميد حساب المستخدم وإنهاء جلساته بنجاح.' : 'User account suspended and sessions revoked.')
          : (locale === 'ar' ? 'تمت إعادة تفعيل حساب المستخدم بنجاح.' : 'User account reactivated.'),
      });
      await loadData();
    } catch (err: unknown) {
      setFeedbackMessage({
        type: 'error',
        text: (err as Error)?.message || 'Failed to update user status',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const filteredAcademies = academies.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredUsers = usersList.filter((u) => {
    return (
      u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
    );
  });

  const academyColumns: Column<PlatformAcademyItem>[] = [
    {
      header: t('platform.academyName', 'الأكاديمية'),
      accessorKey: 'name',
      cell: (item) => (
        <div>
          <div className="font-semibold text-[var(--text-primary)]">{item.name}</div>
          <div className="text-xs text-[var(--text-secondary)] font-mono">{item.slug}</div>
        </div>
      ),
    },
    {
      header: t('subscriptions.plan', 'خطة الاشتراك'),
      id: 'plan',
      cell: (item) => {
        const plan = item.planCode || 'PRO';
        const isPro = plan === 'PRO';
        const isEnterprise = plan === 'ENTERPRISE';
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
              isEnterprise
                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                : isPro
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
            }`}
          >
            {plan}
          </span>
        );
      },
    },
    {
      header: t('platform.status', 'الحالة'),
      accessorKey: 'status',
      cell: (item) => <StatusBadge status={item.status} />,
    },
    {
      header: t('platform.branchesCount', 'الفروع'),
      accessorKey: 'branchesCount',
    },
    {
      header: t('platform.playersCount', 'اللاعبين'),
      accessorKey: 'playersCount',
    },
    {
      header: t('common.actions', 'الإجراءات'),
      id: 'actions',
      cell: (item) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => handleToggleStatus(item)}
            disabled={actionLoading === item.id}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              item.status === 'ACTIVE'
                ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
            }`}
          >
            {item.status === 'ACTIVE'
              ? t('platform.suspendAction', 'تجميد')
              : t('platform.activateAction', 'تنشيط')}
          </button>
          <button
            onClick={() => {
              setEditingAcademy(item);
              setSelectedPlanCode(item.planCode || 'PRO');
            }}
            className="px-2.5 py-1 text-xs font-medium rounded bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
          >
            {t('platform.changePlan', 'تعديل الباقة')}
          </button>
          <button
            onClick={() => handleSupportAccess(item)}
            disabled={actionLoading === item.id}
            className="px-2.5 py-1 text-xs font-medium rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300"
          >
            {t('platform.supportAccessAction', 'دعم فني')}
          </button>
        </div>
      ),
    },
  ];

  return (
    <AppShell
      breadcrumbs={[
        { label: t('nav.platform', 'وحدة المنصة'), href: '/platform' },
      ]}
    >
      <div className="space-y-6">
        <PageHeader
          title={t('platform.title', 'وحدة المشرف العام للمنصة')}
          description={t('platform.subtitle', 'مراقبة الأكاديميات المشتركة عبر المنظومة المركزية، إدارة باقات الـ SaaS، ومتابعة الأمان والتحصيلات.')}
          badge={
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              {locale === 'ar' ? 'تحكم مركزي' : 'Super Admin Core'}
            </span>
          }
          actions={
            <button
              onClick={() => void loadData()}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] transition-colors shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[var(--brand-primary)]' : ''}`} />
              {t('common.refresh', 'تحديث')}
            </button>
          }
        />

        {feedbackMessage && (
          <div
            className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-medium ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* Global Platform Real Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            label={t('platform.kpiTotalAcademies', 'إجمالي الأكاديميات')}
            value={metrics?.totalAcademies ?? 0}
            icon={Building2}
            trend={{ value: `${metrics?.activeAcademies ?? 0} نشطة`, isPositive: true }}
          />
          <StatCard
            label={t('platform.kpiMrr', 'الإيراد الشهري (MRR)')}
            value={`${(metrics?.mrr ?? 0).toLocaleString()} ${locale === 'ar' ? 'ر.س' : 'SAR'}`}
            icon={DollarSign}
            trend={{ value: `${metrics?.activeSubscriptions ?? 0} باقة`, isPositive: true }}
          />
          <StatCard
            label={t('platform.kpiRevenue', 'المتحصلات الكلية')}
            value={`${(metrics?.collectedRevenue ?? 0).toLocaleString()} ${locale === 'ar' ? 'ر.س' : 'SAR'}`}
            icon={TrendingUp}
          />
          <StatCard
            label={t('platform.kpiTotalPlayers', 'إجمالي اللاعبين')}
            value={metrics?.totalPlayers ?? 0}
            icon={Users}
          />
          <StatCard
            label={t('platform.kpiTotalCoaches', 'المدربين')}
            value={metrics?.totalCoaches ?? 0}
            icon={ShieldCheck}
          />
          <StatCard
            label={t('platform.kpiSystemHealth', 'حالة النظام')}
            value={metrics?.systemHealth ?? 'HEALTHY'}
            icon={Activity}
            trend={{ value: '100% Uptime', isPositive: true }}
          />
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('academies')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'academies'
                ? 'border-[var(--brand-primary)] text-[var(--brand-primary)] bg-[var(--bg-card)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Building2 className="w-4 h-4" />
            {t('platform.tabAcademies', 'سجل الأكاديميات')}
            <span className="px-1.5 py-0.2 rounded-full text-xs bg-[var(--bg-card-hover)] font-mono">
              {academies.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'users'
                ? 'border-[var(--brand-primary)] text-[var(--brand-primary)] bg-[var(--bg-card)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Users className="w-4 h-4" />
            {t('platform.tabUsers', 'إدارة المستخدمين والجلسات')}
            <span className="px-1.5 py-0.2 rounded-full text-xs bg-[var(--bg-card-hover)] font-mono">
              {usersList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('plans')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'plans'
                ? 'border-[var(--brand-primary)] text-[var(--brand-primary)] bg-[var(--bg-card)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Layers className="w-4 h-4" />
            {t('platform.tabPlans', 'باقات الـ SaaS')}
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'security'
                ? 'border-[var(--brand-primary)] text-[var(--brand-primary)] bg-[var(--bg-card)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            {t('platform.tabSecurity', 'عمليات الأمان والحماية')}
            {securityEvents.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-xs bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 font-mono">
                {securityEvents.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'audit'
                ? 'border-[var(--brand-primary)] text-[var(--brand-primary)] bg-[var(--bg-card)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            {t('platform.tabAudit', 'سجل التدقيق المركزي')}
          </button>
        </div>

        {/* Tab 1: Academies */}
        {activeTab === 'academies' && (
          <div className="space-y-4">
            <FilterBar
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder={locale === 'ar' ? 'بحث باسم الأكاديمية أو المعرف...' : 'Search academy name or slug...'}
              filters={[
                {
                  id: 'status',
                  label: t('platform.status', 'الحالة'),
                  value: statusFilter,
                  options: [
                    { label: t('common.all', 'الكل'), value: 'ALL' },
                    { label: t('common.active', 'نشط'), value: 'ACTIVE' },
                    { label: t('common.suspended', 'معلق'), value: 'SUSPENDED' },
                    { label: t('common.provisioning', 'قيد الاعتماد'), value: 'PROVISIONING' },
                  ],
                  onChange: setStatusFilter,
                },
              ]}
            />

            <DataTable
              columns={academyColumns}
              data={filteredAcademies}
              isLoading={isLoading}
              keyExtractor={(item) => item.id}
              emptyState={
                <EmptyState
                  icon={Building2}
                  title={locale === 'ar' ? 'لا توجد أكاديميات مطابقة' : 'No academies found'}
                  description={locale === 'ar' ? 'لم يتم العثور على أي أكاديميات تطابق شروط البحث الحالية.' : 'Try adjusting your filters or search keywords.'}
                />
              }
            />
          </div>
        )}

        {/* Tab 2: Users & Sessions Administration */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-[var(--text-secondary)]" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder={t('platform.userSearchPlaceholder', 'بحث باسم المستخدم أو البريد...')}
                  className="w-full ps-9 pe-4 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
              <table className="w-full text-sm text-start">
                <thead className="bg-[var(--bg-card-hover)] border-b border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] uppercase">
                  <tr>
                    <th className="px-4 py-3 text-start">المستخدم</th>
                    <th className="px-4 py-3 text-start">الأكاديميات والأدوار</th>
                    <th className="px-4 py-3 text-start">الجلسات النشطة</th>
                    <th className="px-4 py-3 text-start">حالة الحساب</th>
                    <th className="px-4 py-3 text-start">إجراءات الأمان</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[var(--text-secondary)]">
                        {locale === 'ar' ? 'لا يوجد مستخدمين مطابقين' : 'No users found'}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[var(--text-primary)]">{u.name}</div>
                          <div className="text-xs text-[var(--text-secondary)] font-mono">{u.email}</div>
                          {u.isPlatformSuperAdmin && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300">
                              SUPER ADMIN
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            {u.memberships.map((m, idx) => (
                              <div key={idx} className="text-xs">
                                <span className="font-medium text-[var(--text-primary)]">{m.tenantName}</span>
                                <span className="ms-1.5 px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-card-hover)] text-[var(--text-secondary)] font-mono">
                                  {m.role}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 font-mono text-xs px-2 py-1 rounded-full ${
                            u.activeSessionsCount > 0
                              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${u.activeSessionsCount > 0 ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                            {u.activeSessionsCount} {locale === 'ar' ? 'جلسة' : 'sessions'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {u.isSuspended ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                              <XCircle className="w-3.5 h-3.5" />
                              {locale === 'ar' ? 'حساب معلق' : 'Suspended'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {locale === 'ar' ? 'نشط' : 'Active'}
                            </span>
                          )}
                          {u.mustResetPassword && (
                            <div className="text-[10px] text-amber-700 dark:text-amber-400 font-medium mt-1">
                              {locale === 'ar' ? 'مطلوب تعيين كلمة مرور' : 'Reset Required'}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => handleForceLogout(u)}
                              disabled={actionLoading === `user-logout-${u.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 transition-colors"
                              title={locale === 'ar' ? 'إنهاء كافة الجلسات النشطة للمستخدم فوراً' : 'Force logout user from all devices'}
                            >
                              <LogOut className="w-3 h-3" />
                              {locale === 'ar' ? 'طرد من الجلسات' : 'Force Logout'}
                            </button>

                            <button
                              onClick={() => handleTogglePasswordReset(u)}
                              disabled={actionLoading === `user-pwd-${u.id}`}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                                u.mustResetPassword
                                  ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300'
                              }`}
                              title={locale === 'ar' ? 'إلزام المستخدم بتعيين كلمة مرور عند الدخول القادم' : 'Require password change on next login'}
                            >
                              <KeyRound className="w-3 h-3" />
                              {u.mustResetPassword
                                ? (locale === 'ar' ? 'إلغاء الإلزام' : 'Clear Reset')
                                : (locale === 'ar' ? 'إلزام تغيير المرور' : 'Force Reset')}
                            </button>

                            <button
                              onClick={() => handleToggleUserSuspension(u)}
                              disabled={actionLoading === `user-suspend-${u.id}`}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                                u.isSuspended
                                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                              }`}
                            >
                              {u.isSuspended
                                ? (locale === 'ar' ? 'فك التجميد' : 'Unsuspend')
                                : (locale === 'ar' ? 'تجميد الحساب' : 'Suspend')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: SaaS Plans Configuration */}
        {activeTab === 'plans' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {plans.map((p) => (
                <div
                  key={p.id}
                  className="p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-extrabold tracking-wide uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        {p.code}
                      </span>
                      <span className="text-xs font-medium text-[var(--text-secondary)]">
                        {p.isActive ? (locale === 'ar' ? 'مفعلة' : 'Active') : (locale === 'ar' ? 'معطلة' : 'Disabled')}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">{p.name}</h3>
                    <p className="text-xs text-[var(--text-secondary)] mb-4">{p.description}</p>

                    <div className="mb-4">
                      <div className="text-2xl font-black text-[var(--brand-primary)]">
                        {p.priceMonthly.toLocaleString()}{' '}
                        <span className="text-xs font-normal text-[var(--text-secondary)]">
                          {p.currency} / {locale === 'ar' ? 'شهرياً' : 'month'}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {p.priceYearly.toLocaleString()} {p.currency} / {locale === 'ar' ? 'سنوياً' : 'year'}
                      </div>
                    </div>

                    <div className="space-y-2 py-3 border-t border-[var(--border-subtle)] text-xs text-[var(--text-primary)]">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">{locale === 'ar' ? 'الحد الأقصى للفروع:' : 'Max Branches:'}</span>
                        <span className="font-bold">{p.maxBranches}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">{locale === 'ar' ? 'الحد الأقصى للاعبين:' : 'Max Players:'}</span>
                        <span className="font-bold">{p.maxPlayers}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">{locale === 'ar' ? 'المدربين المسموح بهم:' : 'Max Coaches:'}</span>
                        <span className="font-bold">{p.maxCoaches}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[var(--border-subtle)] mt-3">
                    <button
                      onClick={() => {
                        const newPrice = prompt(
                          locale === 'ar' ? `تعديل السعر الشهري لخطة ${p.name}:` : `Edit monthly price for ${p.name}:`,
                          String(p.priceMonthly),
                        );
                        if (newPrice !== null && !isNaN(Number(newPrice))) {
                          void apiClient.platform
                            .updateSaaSPlan(p.code, { priceMonthly: Number(newPrice) })
                            .then(() => {
                              toast.success(locale === 'ar' ? 'تم تحديث السعر بنجاح' : 'Price updated successfully');
                              void loadData();
                            });
                        }
                      }}
                      className="w-full py-2 text-xs font-semibold rounded-lg bg-[var(--bg-card-hover)] hover:bg-[var(--border-subtle)] text-[var(--text-primary)] transition-colors"
                    >
                      {locale === 'ar' ? 'تعديل السعر والشروط' : 'Edit Plan Details'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Security Operations & Incidents */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/20">
                <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 text-sm font-semibold mb-1">
                  <XCircle className="w-4 h-4" />
                  {locale === 'ar' ? 'محاولات دخول فاشلة' : 'Failed Login Attempts'}
                </div>
                <div className="text-2xl font-bold text-rose-900 dark:text-rose-100">
                  {securityEvents.filter((e) => e.type === 'FAILED_LOGIN').length}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-900 bg-purple-50/60 dark:bg-purple-950/20">
                <div className="flex items-center gap-2 text-purple-800 dark:text-purple-300 text-sm font-semibold mb-1">
                  <ShieldAlert className="w-4 h-4" />
                  {locale === 'ar' ? 'إعادة استخدام توكن مشبوهة' : 'Suspicious Token Reuses'}
                </div>
                <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {securityEvents.filter((e) => e.type === 'SUSPICIOUS_TOKEN_REUSE').length}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-sm font-semibold mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  {locale === 'ar' ? 'تجاوز حدود الطلبات (Rate Limit)' : 'Rate Limit Triggers'}
                </div>
                <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                  {securityEvents.filter((e) => e.type === 'RATE_LIMIT_TRIGGERED').length}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/20">
                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 text-sm font-semibold mb-1">
                  <ShieldCheck className="w-4 h-4" />
                  {locale === 'ar' ? 'جلسات أمان مسجلة' : 'Logged Security Signals'}
                </div>
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {securityEvents.length}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
              <h3 className="font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                {locale === 'ar' ? 'سجل الأحداث الأمنية المباشر' : 'Live Security Operations Stream'}
              </h3>
              <div className="divide-y divide-[var(--border-subtle)]">
                {securityEvents.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[var(--text-secondary)]">
                    {locale === 'ar' ? 'لا توجد أحداث أمنية مشبوهة مسجلة حديثاً.' : 'No suspicious security signals logged.'}
                  </p>
                ) : (
                  securityEvents.map((evt) => (
                    <div key={evt.id} className="py-3 flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                              evt.severity === 'CRITICAL'
                                ? 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200'
                                : evt.severity === 'HIGH'
                                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                                : 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200'
                            }`}
                          >
                            {evt.severity}
                          </span>
                          <span className="font-semibold text-xs text-[var(--text-primary)] font-mono">
                            {evt.type}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--text-primary)]">{evt.description}</p>
                        {evt.actorEmail && (
                          <div className="text-xs text-[var(--text-secondary)] mt-0.5 font-mono">
                            User: {evt.actorEmail} {evt.ipAddress && `| IP: ${evt.ipAddress}`}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] whitespace-nowrap font-mono">
                        {new Date(evt.timestamp).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Centralized Audit Trail */}
        {activeTab === 'audit' && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-x-auto">
            <table className="w-full text-sm text-start">
              <thead className="bg-[var(--bg-card-hover)] border-b border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] uppercase">
                <tr>
                  <th className="px-4 py-3 text-start">{t('common.date', 'التاريخ')}</th>
                  <th className="px-4 py-3 text-start">الإجراء</th>
                  <th className="px-4 py-3 text-start">المستخدم المنفذ</th>
                  <th className="px-4 py-3 text-start">الأكاديمية</th>
                  <th className="px-4 py-3 text-start">الكيان المتأثر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[var(--text-secondary)]">
                      {locale === 'ar' ? 'لا توجد سجلات تدقيق' : 'No audit records'}
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)] font-mono whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US')}
                      </td>
                      <td className="px-4 py-3 font-semibold text-xs text-[var(--text-primary)] font-mono">
                        {log.action}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-primary)] font-mono">
                        {log.actorEmail || 'System / Anonymous'}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-primary)]">
                        {log.tenantName || 'Platform Core'}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)] font-mono">
                        {log.resourceType} {log.resourceId ? `(${log.resourceId.slice(0, 8)}...)` : ''}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Change Plan Modal */}
        {editingAcademy && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-md p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                {t('platform.changePlan', 'تعديل باقة الأكاديمية')}
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                {editingAcademy.name} ({editingAcademy.slug})
              </p>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--text-primary)]">
                  {t('subscriptions.plan', 'خطة الاشتراك التجارية')}
                </label>
                <select
                  value={selectedPlanCode}
                  onChange={(e) =>
                    setSelectedPlanCode(
                      e.target.value as 'STARTER' | 'PRO' | 'ENTERPRISE' | 'CUSTOM',
                    )
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] font-medium"
                >
                  <option value="STARTER">STARTER (1 Branch / 50 Players)</option>
                  <option value="PRO">PRO (5 Branches / 250 Players / Cashiering)</option>
                  <option value="ENTERPRISE">ENTERPRISE (25 Branches / 2000 Players)</option>
                  <option value="CUSTOM">CUSTOM (Bespoke Negotiated SLA)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setEditingAcademy(null)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--bg-card-hover)] hover:bg-[var(--border-subtle)] text-[var(--text-primary)]"
                >
                  {t('common.cancel', 'إلغاء')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveAcademyPlan()}
                  disabled={actionLoading === 'plan-modal'}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white shadow-sm"
                >
                  {actionLoading === 'plan-modal' ? t('common.loading', 'جارٍ الحفظ...') : t('common.save', 'حفظ')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
