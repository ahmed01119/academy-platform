'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useAccessGuard } from '@/hooks/useAccessGuard';
import { useLocale } from '@/contexts/locale-context';
import { apiClient, clearApiCache } from '@/api/client';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { TableSkeleton, PageSkeleton } from '@/components/ui/skeleton';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Building2, Users, Activity, RefreshCw, DollarSign } from 'lucide-react';
import dynamic from 'next/dynamic';
import type {
  PlatformAcademyItem,
  PlatformAuditLogItem,
  PlatformOverviewMetrics,
  PlatformSecurityEvent,
  PlatformUserItem,
  SaaSPlanItem,
  AcademyApplicationItem,
} from '@academy/shared';

const TabLoadingFallback = () => <TableSkeleton rows={8} cols={5} />;

const ApplicationsTab = dynamic(
  () => import('../../components/platform/ApplicationsTab').then((m) => m.ApplicationsTab),
  { loading: TabLoadingFallback },
);

const StorageTab = dynamic(
  () => import('../../components/platform/StorageTab').then((m) => m.StorageTab),
  { loading: TabLoadingFallback },
);

const GovernanceTab = dynamic(
  () => import('../../components/platform/GovernanceTab').then((m) => m.GovernanceTab),
  { loading: TabLoadingFallback },
);

const CoOwnerTab = dynamic(
  () => import('../../components/platform/CoOwnerTab').then((m) => m.CoOwnerTab),
  { loading: TabLoadingFallback },
);

import {
  PlatformAcademiesTab,
  PlatformUsersTab,
  PlatformPlansTab,
  PlatformSecurityTab,
  PlatformAuditTab,
  ChangePlanModal,
} from '@/components/platform';

import { PromptModal, type PromptModalConfig } from '../../components/ui/PromptModal';

function PlatformSuperAdminContent() {
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const { toast } = useToast();
  const requestConfirmation = useConfirm();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<
    | 'academies'
    | 'applications'
    | 'users'
    | 'plans'
    | 'storage'
    | 'governance'
    | 'coowner'
    | 'security'
    | 'audit'
  >('academies');

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const validTabs = [
      'academies',
      'applications',
      'users',
      'plans',
      'storage',
      'governance',
      'coowner',
      'security',
      'audit',
    ];
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam as typeof activeTab);
    }
  }, [searchParams]);

  const [metrics, setMetrics] = useState<PlatformOverviewMetrics | null>(null);
  const [academies, setAcademies] = useState<PlatformAcademyItem[]>([]);
  const [applications, setApplications] = useState<AcademyApplicationItem[]>([]);
  const [usersList, setUsersList] = useState<PlatformUserItem[]>([]);
  const [plans, setPlans] = useState<SaaSPlanItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<PlatformAuditLogItem[]>([]);
  const [securityEvents, setSecurityEvents] = useState<PlatformSecurityEvent[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Prompt / Confirmation accessible dialog state
  const [promptConfig, setPromptConfig] = useState<PromptModalConfig | null>(null);

  // Selected academy for plan modification modal
  const [editingAcademy, setEditingAcademy] = useState<PlatformAcademyItem | null>(null);
  const [selectedPlanCode, setSelectedPlanCode] = useState<
    'STARTER' | 'PRO' | 'ENTERPRISE' | 'CUSTOM'
  >('PRO');

  const isPlatformStaff = Boolean(user?.isPlatformSuperAdmin || user?.isPlatformOwner);

  useAccessGuard('platform-staff');

  const loadData = useCallback(
    async (forceRefresh = false) => {
      if (forceRefresh) {
        clearApiCache();
      }
      setIsLoading(true);
      setFeedbackMessage(null);
      try {
        const [m, a, apps, u, p, l, s] = await Promise.all([
          apiClient.platform.getMetrics().catch(() => null),
          apiClient.platform.listAcademies().catch(() => []),
          apiClient.platform.listAcademyApplications().catch(() => []),
          apiClient.platform.listUsers({ limit: 50 }).catch(() => []),
          apiClient.platform.listSaaSPlans().catch(() => []),
          apiClient.platform.listAuditLogs({ limit: 50 }).catch(() => []),
          apiClient.platform.getSecurityEvents().catch(() => []),
        ]);
        setMetrics(m);
        setAcademies(a);
        setApplications(apps);
        setUsersList(u);
        setPlans(p);
        setAuditLogs(l);
        setSecurityEvents(s);
      } catch (err: unknown) {
        setFeedbackMessage({
          type: 'error',
          text:
            (err as Error)?.message ||
            (locale === 'ar' ? 'فشل تحميل بيانات المنصة' : 'Failed to load platform data'),
        });
      } finally {
        setIsLoading(false);
      }
    },
    [locale],
  );

  useEffect(() => {
    if (isPlatformStaff) {
      void loadData();
    }
  }, [isPlatformStaff, loadData]);

  // Handle Suspend / Reactivate Academy with accessible Modal
  const handleToggleStatus = (academy: PlatformAcademyItem) => {
    const newStatus = academy.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const actionName =
      newStatus === 'SUSPENDED'
        ? locale === 'ar'
          ? 'إيقاف وتجميد'
          : 'Suspend'
        : locale === 'ar'
          ? 'إعادة تفعيل'
          : 'Reactivate';

    setPromptConfig({
      isOpen: true,
      title:
        locale === 'ar'
          ? `${actionName} الأكاديمية: ${academy.name}`
          : `${actionName} Academy: ${academy.name}`,
      description:
        newStatus === 'SUSPENDED'
          ? locale === 'ar'
            ? 'سيتم تجميد بيئة العمل ولن يتمكن موظفو الأكاديمية من الدخول حتى إعادة التفعيل.'
            : 'Suspending this tenant prevents all staff from accessing the workspace.'
          : locale === 'ar'
            ? 'سيتم استعادة صلاحيات العمل لكافة مستخدمي الأكاديمية فوراً.'
            : 'Reactivating this tenant restores access immediately.',
      inputLabel: locale === 'ar' ? 'سبب الإجراء (للتوثيق الإداري)' : 'Reason (for audit trail)',
      defaultValue: locale === 'ar' ? 'قرار إداري من المنصة' : 'Platform administrative decision',
      requireInput: true,
      isDestructive: newStatus === 'SUSPENDED',
      confirmText: actionName,
      onConfirm: async (reason) => {
        setActionLoading(academy.id);
        try {
          await apiClient.platform.updateAcademyStatus(academy.id, {
            status: newStatus,
            reason: reason || 'Administrative decision',
          });
          toast.success(
            locale === 'ar'
              ? `تم ${actionName} الأكاديمية بنجاح.`
              : `Academy ${actionName} successful.`,
          );
          await loadData();
        } catch (err: unknown) {
          toast.error((err as Error)?.message || 'Failed');
        } finally {
          setActionLoading(null);
        }
      },
      onClose: () => setPromptConfig(null),
    });
  };

  // Handle Support Access with accessible Modal
  const handleSupportAccess = (academy: PlatformAcademyItem) => {
    setPromptConfig({
      isOpen: true,
      title:
        locale === 'ar' ? `طلب جلسة دعم فني: ${academy.name}` : `Support Access: ${academy.name}`,
      description:
        locale === 'ar'
          ? 'جلسة الدعم مؤقتة ومسجلة في سجل الأمان المركزي لمساعدة إدارة الأكاديمية.'
          : 'Temporary support session logged in the central security audit trail.',
      inputLabel:
        locale === 'ar' ? 'سبب طلب جلسة الدعم (10 أحرف على الأقل)' : 'Reason for support session',
      defaultValue:
        locale === 'ar'
          ? 'معالجة تذكرة دعم فني بطلب من مالك الأكاديمية'
          : 'Resolving support ticket requested by academy owner',
      requireInput: true,
      confirmText: locale === 'ar' ? 'بدء جلسة الدعم' : 'Initiate Session',
      onConfirm: async (reason) => {
        setActionLoading(academy.id);
        try {
          const res = await apiClient.platform.requestSupportAccess(academy.id, {
            reason: reason || 'Resolving support ticket requested by academy owner',
          });
          toast.success(
            locale === 'ar'
              ? `تم تفعيل جلسة الدعم الفني بنجاح حتى: ${new Date(res.expiresAt).toLocaleTimeString()}`
              : `Support session authorized until: ${new Date(res.expiresAt).toLocaleTimeString()}`,
          );
          await loadData();
        } catch (err: unknown) {
          toast.error((err as Error)?.message || 'Failed');
        } finally {
          setActionLoading(null);
        }
      },
      onClose: () => setPromptConfig(null),
    });
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
        text:
          locale === 'ar'
            ? 'تم تحديث خطة اشتراك الأكاديمية بنجاح'
            : 'Academy subscription plan updated successfully',
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
    const confirmMsg =
      locale === 'ar'
        ? `هل أنت متأكد من إنهاء كافة الجلسات النشطة للمستخدم (${targetUser.email})؟ سيتم تسجيل خروجه فوراً من جميع الأجهزة.`
        : `Force logout all active sessions for ${targetUser.email}?`;
    if (!(await requestConfirmation({ message: confirmMsg, isDestructive: true }))) return;

    setActionLoading(`user-logout-${targetUser.id}`);
    try {
      const res = await apiClient.platform.revokeUserSessions(targetUser.id);
      setFeedbackMessage({
        type: 'success',
        text:
          locale === 'ar'
            ? `تم إنهاء ${res.revokedCount} جلسة نشطة بنجاح.`
            : `Revoked ${res.revokedCount} active sessions.`,
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
          ? locale === 'ar'
            ? 'سيُطلب من المستخدم تعيين كلمة مرور جديدة فور تسجيل دخوله القادم.'
            : 'User will be required to reset password upon next sign-in.'
          : locale === 'ar'
            ? 'تم إلغاء شرط إعادة تعيين كلمة المرور.'
            : 'Password reset requirement cleared.',
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

  // Handle Toggle User Suspension with accessible Modal
  const handleToggleUserSuspension = (targetUser: PlatformUserItem) => {
    const nextState = !targetUser.isSuspended;
    setPromptConfig({
      isOpen: true,
      title: nextState
        ? locale === 'ar'
          ? `تجميد حساب المستخدم (${targetUser.email})`
          : `Suspend User Account (${targetUser.email})`
        : locale === 'ar'
          ? `إعادة تفعيل الحساب (${targetUser.email})`
          : `Reactivate Account (${targetUser.email})`,
      description: nextState
        ? locale === 'ar'
          ? 'سيتم حظر المستخدم فوراً وإنهاء جميع جلساته وأجهزته النشطة.'
          : 'User will be immediately blocked and all active sessions revoked.'
        : undefined,
      inputLabel: locale === 'ar' ? 'سبب الإجراء (للتوثيق)' : 'Reason (for audit)',
      defaultValue: 'Super Admin policy update',
      isDestructive: nextState,
      confirmText: nextState
        ? locale === 'ar'
          ? 'تجميد الحساب'
          : 'Suspend User'
        : locale === 'ar'
          ? 'تفعيل الحساب'
          : 'Reactivate',
      onConfirm: async (reason) => {
        setActionLoading(`user-suspend-${targetUser.id}`);
        try {
          await apiClient.platform.updateUserSecurityPolicy(targetUser.id, {
            isSuspended: nextState,
            reason: reason || 'Policy update',
          });
          toast.success(
            nextState
              ? locale === 'ar'
                ? 'تم تجميد حساب المستخدم وإنهاء جلساته بنجاح.'
                : 'User account suspended and sessions revoked.'
              : locale === 'ar'
                ? 'تمت إعادة تفعيل حساب المستخدم بنجاح.'
                : 'User account reactivated.',
          );
          await loadData();
        } catch (err: unknown) {
          toast.error((err as Error)?.message || 'Failed to update user status');
        } finally {
          setActionLoading(null);
        }
      },
      onClose: () => setPromptConfig(null),
    });
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={[
            { label: t('nav.dashboard', 'لوحة التحكم'), href: '/dashboard' },
            { label: t('platform.title', 'إدارة المنصة المركزية') },
          ]}
          title={t('platform.title', 'إدارة المنصة المركزية')}
          description={t(
            'platform.subtitle',
            'مراقبة الأكاديميات، الموارد، جلسات المستخدمين، وحوكمة النظام المركزي.',
          )}
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadData(true)}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--bg-surface-elevated)] border border-(--border-subtle) text-(--text-main) hover:bg-(--bg-surface-subtle) disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                {t('common.refresh', 'تحديث البيانات')}
              </button>
            </div>
          }
        />

        {feedbackMessage && (
          <div
            className={`p-4 rounded-xl border text-sm font-medium flex items-center justify-between ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
            }`}
          >
            <span>{feedbackMessage.text}</span>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="text-xs underline hover:opacity-80"
            >
              {locale === 'ar' ? 'إغلاق' : 'Dismiss'}
            </button>
          </div>
        )}

        {/* Global KPI Stat Cards - Displayed on overview (Academies) tab only */}
        {activeTab === 'academies' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={locale === 'ar' ? 'إجمالي الأكاديميات' : 'Total Academies'}
              value={metrics?.totalAcademies ?? academies.length}
              icon={Building2}
              trend={{
                value: `${metrics?.activeAcademies ?? academies.filter((a) => a.status === 'ACTIVE').length} ${locale === 'ar' ? 'نشطة حالياً' : 'active'}`,
                isPositive: true,
              }}
            />
            <StatCard
              label={locale === 'ar' ? 'إجمالي المستخدمين' : 'Total System Users'}
              value={metrics?.totalUsers ?? usersList.length}
              icon={Users}
              trend={{
                value: `${usersList.reduce((acc, u) => acc + u.activeSessionsCount, 0)} ${locale === 'ar' ? 'جلسة نشطة' : 'active sessions'}`,
                isPositive: true,
              }}
            />
            <StatCard
              label={locale === 'ar' ? 'إجمالي الإيرادات السحابية (MRR)' : 'Platform SaaS MRR'}
              value={`${metrics?.mrr ? metrics.mrr.toLocaleString() : '0'} ${locale === 'ar' ? 'ر.س' : 'SAR'}`}
              icon={DollarSign}
              trend={{
                value: `${plans.length} ${locale === 'ar' ? 'باقات تجارية متاحة' : 'plans'}`,
                isPositive: true,
              }}
            />
            <StatCard
              label={locale === 'ar' ? 'حالة النظام المركزي' : 'System Health'}
              value={metrics?.systemHealth ?? 'HEALTHY'}
              icon={Activity}
              trend={{
                value:
                  metrics?.systemHealth === 'HEALTHY'
                    ? locale === 'ar'
                      ? 'اعتماديات متصلة'
                      : 'Dependencies reachable'
                    : metrics?.systemHealth === 'DEGRADED'
                      ? locale === 'ar'
                        ? 'تدهور جزئي'
                        : 'Partial degradation'
                      : locale === 'ar'
                        ? 'غير متوفر'
                        : 'Unavailable',
                isPositive: metrics?.systemHealth === 'HEALTHY',
              }}
            />
          </div>
        )}

        {/* Tab 1: Academies */}
        {activeTab === 'academies' && (
          <PlatformAcademiesTab
            academies={academies}
            isLoading={isLoading}
            actionLoading={actionLoading}
            onToggleStatus={handleToggleStatus}
            onSupportAccess={handleSupportAccess}
            onEditPlan={(academy) => {
              setEditingAcademy(academy);
              setSelectedPlanCode(
                (academy.planCode as 'STARTER' | 'PRO' | 'ENTERPRISE' | 'CUSTOM') || 'PRO',
              );
            }}
          />
        )}

        {/* Tab 2: Users & Sessions Administration */}
        {activeTab === 'users' && (
          <PlatformUsersTab
            users={usersList}
            actionLoading={actionLoading}
            onForceLogout={handleForceLogout}
            onTogglePasswordReset={handleTogglePasswordReset}
            onToggleUserSuspension={handleToggleUserSuspension}
          />
        )}

        {/* Tab 3: SaaS Plans Configuration */}
        {activeTab === 'plans' && <PlatformPlansTab plans={plans} onReload={loadData} />}

        {/* Tab 4: Security Operations & Incidents */}
        {activeTab === 'security' && <PlatformSecurityTab securityEvents={securityEvents} />}

        {/* Tab 5: Centralized Audit Trail */}
        {activeTab === 'audit' && <PlatformAuditTab auditLogs={auditLogs} />}

        {/* Tab: Applications */}
        {activeTab === 'applications' && (
          <ApplicationsTab applications={applications} onRefresh={loadData} isLoading={isLoading} />
        )}

        {/* Tab: Platform Co-Owners */}
        {activeTab === 'coowner' && <CoOwnerTab />}

        {/* Tab: Storage & Lifecycle */}
        {activeTab === 'storage' && <StorageTab />}

        {/* Tab: Governance & Sovereign Roles */}
        {activeTab === 'governance' && (
          <GovernanceTab
            users={usersList}
            academies={academies}
            onRefresh={loadData}
            isLoading={isLoading}
          />
        )}

        {/* Change Plan Modal */}
        <ChangePlanModal
          academy={editingAcademy}
          selectedPlanCode={selectedPlanCode}
          onPlanCodeChange={setSelectedPlanCode}
          onSave={handleSaveAcademyPlan}
          onClose={() => setEditingAcademy(null)}
          isLoading={actionLoading === 'plan-modal'}
        />

        {/* Accessible Prompt / Confirmation Dialog */}
        {promptConfig && <PromptModal {...promptConfig} />}
      </div>
    </AppShell>
  );
}

export default function PlatformSuperAdminPage() {
  return (
    <React.Suspense
      fallback={
        <AppShell>
          <PageSkeleton hasStats variant="table" hasFilters={false} />
        </AppShell>
      }
    >
      <PlatformSuperAdminContent />
    </React.Suspense>
  );
}
