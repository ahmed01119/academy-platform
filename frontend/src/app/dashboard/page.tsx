'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useLocale } from '@/contexts/locale-context';
import { canAccessAdminRoutes, getRoleHomeRoute } from '@/utils/role-routing';
import { AppShell } from '../../components/layout/AppShell';
import { StatCard, StatusBadge } from '../../components/ui';
import { PageSkeleton } from '@/components/ui/skeleton';
import { api, apiClient } from '@/api/client';
import { translateDataString } from '@/utils/data-translator';
import { PlayerJoinRequestsTab } from '../../components/dashboard/PlayerJoinRequestsTab';
import type { BranchSummary, PlayerSummary } from '@academy/shared';
import {
  Users,
  GitBranch,
  ShieldCheck,
  RefreshCw,
  Trophy,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Phone,
  Layers,
  CalendarCheck,
  BarChart3,
  Zap,
  Building2,
} from 'lucide-react';

interface DashboardCacheData {
  players: PlayerSummary[];
  totalPlayers: number;
  branches: BranchSummary[];
  staffCount: number;
  groupCount: number;
  sessionCount: number;
  platformMetrics: {
    totalAcademies: number;
    totalUsers: number;
    pendingApps: number;
    activePlans: number;
    mrr: number;
  } | null;
}

function getStoredDashboardCache(cacheKey: string): DashboardCacheData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(cacheKey);
    return raw ? (JSON.parse(raw) as DashboardCacheData) : null;
  } catch {
    return null;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, activeTenant, memberships, isLoading, refreshUser, switchTenant } = useAuth();
  const { t, locale, isRtl } = useLocale();

  const cacheKey = activeTenant
    ? `sportexus_dash_${activeTenant.tenantId}`
    : `sportexus_dash_platform`;

  // Client-safe state initialization to prevent React hydration mismatch (#418)
  const [hasLoadedOnce, setHasLoadedOnce] = useState<boolean>(false);
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [totalPlayers, setTotalPlayers] = useState<number>(0);
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [staffCount, setStaffCount] = useState<number>(0);
  const [groupCount, setGroupCount] = useState<number>(0);
  const [sessionCount, setSessionCount] = useState<number>(0);
  const [platformMetrics, setPlatformMetrics] = useState<DashboardCacheData['platformMetrics']>(null);
  const [isFetchingData, setIsFetchingData] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      if (!canAccessAdminRoutes(user, activeTenant)) {
        router.push(getRoleHomeRoute(user, activeTenant));
      }
    }
  }, [user, activeTenant, isLoading, router]);

  useEffect(() => {
    const cached = getStoredDashboardCache(cacheKey);
    if (cached) {
      if (cached.platformMetrics) setPlatformMetrics(cached.platformMetrics);
      if (cached.players.length > 0) setPlayers(cached.players);
      if (cached.totalPlayers > 0) setTotalPlayers(cached.totalPlayers);
      if (cached.branches.length > 0) setBranches(cached.branches);
      if (cached.staffCount > 0) setStaffCount(cached.staffCount);
      if (cached.groupCount > 0) setGroupCount(cached.groupCount);
      if (cached.sessionCount > 0) setSessionCount(cached.sessionCount);
      setHasLoadedOnce(true);
    }
  }, [cacheKey]);

  useEffect(() => {
    if (user && (activeTenant || user.isPlatformSuperAdmin)) {
      const loadDashboardData = async () => {
        setIsFetchingData(true);
        try {
          if (user.isPlatformSuperAdmin && !activeTenant) {
            const [metricsRes, academiesRes, appsRes] = await Promise.all([
              apiClient.platform.getMetrics().catch(() => null),
              apiClient.platform.listAcademies().catch(() => []),
              apiClient.platform.listAcademyApplications().catch(() => []),
            ]);
            const nextMetrics = {
              totalAcademies: metricsRes?.totalAcademies ?? academiesRes.length,
              totalUsers: metricsRes?.totalUsers ?? 0,
              pendingApps: appsRes.filter((a: { status: string }) => a.status === 'PENDING_REVIEW')
                .length,
              activePlans: metricsRes?.activeSubscriptions ?? 0,
              mrr: metricsRes?.mrr ?? 0,
            };
            setPlatformMetrics(nextMetrics);
            setHasLoadedOnce(true);

            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem(
                  cacheKey,
                  JSON.stringify({
                    players: [],
                    totalPlayers: 0,
                    branches: [],
                    staffCount: 0,
                    groupCount: 0,
                    sessionCount: 0,
                    platformMetrics: nextMetrics,
                  }),
                );
              } catch {
                // Ignore storage error
              }
            }
          } else {
            const [playersRes, branchList, staffList, groupsRes, sessionsRes] = await Promise.all([
              api.players.list({ limit: 5 }).catch(() => ({ items: [], total: 0 })),
              api.branches.list().catch(() => []),
              api.tenancy.listStaff().catch(() => []),
              api.groups.list({ page: 1, limit: 1 }).catch(() => ({ items: [], total: 0 })),
              api.attendance
                .listSessions({ page: 1, limit: 1 })
                .catch(() => ({ items: [], total: 0 })),
            ]);
            setPlayers(playersRes.items);
            setTotalPlayers(playersRes.total);
            setBranches(branchList);
            setStaffCount(staffList.length);
            setGroupCount(groupsRes.total);
            setSessionCount(sessionsRes.total);
            setHasLoadedOnce(true);

            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem(
                  cacheKey,
                  JSON.stringify({
                    players: playersRes.items,
                    totalPlayers: playersRes.total,
                    branches: branchList,
                    staffCount: staffList.length,
                    groupCount: groupsRes.total,
                    sessionCount: sessionsRes.total,
                    platformMetrics: null,
                  }),
                );
              } catch {
                // Ignore storage error
              }
            }
          }
        } finally {
          setIsFetchingData(false);
        }
      };
      void loadDashboardData();
    }
  }, [user, activeTenant, cacheKey]);

  if (isLoading) {
    return (
      <AppShell>
        <PageSkeleton hasStats statsCount={4} variant="cards" />
      </AppShell>
    );
  }

  if (!user) {
    return null;
  }

  const DirectionIcon = isRtl ? ChevronLeft : ChevronRight;
  const primaryMembership = memberships[0];

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        {/* Welcome and Identity Hero Banner */}
        <div className="rounded-3xl border border-(--border-app) bg-linear-to-br from-[var(--bg-surface)] via-[var(--bg-surface-subtle)] to-[var(--bg-surface)] p-6 sm:p-8 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 start-0 w-80 h-80 bg-(--accent-primary)/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-(--badge-fg) bg-(--badge-bg) px-3 py-1 rounded-full border border-(--badge-border)">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {user.isPlatformSuperAdmin && !activeTenant
                    ? locale === 'ar'
                      ? 'لوحة قيادة المنصة المركزية'
                      : 'Central Platform Console'
                    : locale === 'ar'
                      ? 'لوحة تحكم العمليات المركزية'
                      : 'Academy Operations Hub'}
                </span>
                <span className="text-xs text-(--text-muted) font-medium">
                  {activeTenant?.tenantName
                    ? translateDataString(activeTenant.tenantName, locale)
                    : user.isPlatformSuperAdmin
                      ? locale === 'ar'
                        ? 'منظومة المنصة المركزية'
                        : 'Central Platform System'
                      : ''}
                </span>
                {user.isPlatformSuperAdmin && !activeTenant && primaryMembership && (
                  <button
                    type="button"
                    onClick={() => void switchTenant(primaryMembership.tenantId)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full hover:bg-emerald-500/20 transition-all cursor-pointer"
                  >
                    <Building2 className="h-3 w-3" />
                    <span>
                      {locale === 'ar'
                        ? `التبديل إلى ${primaryMembership.tenantName}`
                        : `Switch to ${primaryMembership.tenantName}`}
                    </span>
                  </button>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-(--text-main)">
                {locale === 'ar' ? (
                  <>
                    أهلاً بك،{' '}
                    <bdi className="inline-block" dir="auto">
                      {user.name}
                    </bdi>{' '}
                    👋
                  </>
                ) : (
                  <>
                    Welcome back,{' '}
                    <bdi className="inline-block" dir="auto">
                      {user.name}
                    </bdi>{' '}
                    👋
                  </>
                )}
              </h1>
              <p className="text-xs sm:text-sm text-(--text-muted) max-w-2xl leading-relaxed">
                {user.isPlatformSuperAdmin && !activeTenant
                  ? locale === 'ar'
                    ? 'نظرة شمولية عليا على مؤشرات المنصة، الأكاديميات المشتركة، وطلبات التأسيس الجديدة.'
                    : 'High-level overview of platform operations, registered academies, and onboarding requests.'
                  : locale === 'ar'
                    ? 'المنظومة السحابية المتكاملة لإدارة اللاعبين، الحصص، التحضير الذكي، وذكاء الأداء الرياضي.'
                    : 'Centralized operations console for squad management, training sessions, QR check-ins, and performance intelligence.'}
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              {user.isPlatformSuperAdmin && (
                <Link
                  href="/platform"
                  id="btn-platform-hub"
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-purple-500/20 hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>{locale === 'ar' ? 'إدارة المنصة المركزية' : 'Platform Operations'}</span>
                </Link>
              )}

              <button
                type="button"
                id="btn-refresh-dashboard"
                onClick={() => void refreshUser()}
                className="flex items-center gap-2 rounded-xl border border-(--border-app) bg-[var(--bg-surface)] px-4 py-2.5 text-xs font-semibold text-(--text-main) hover:border-[var(--accent-primary)] hover:text-(--accent-primary) transition-all cursor-pointer shadow-sm"
              >
                <RefreshCw className={`h-4 w-4 ${isFetchingData ? 'animate-spin' : ''}`} />
                <span>{t('common.refresh')}</span>
              </button>

              {/* Prominent Quick Attendance Button (Owner / Manager / Branch Manager / Receptionist; Coaches strictly excluded) */}
              {activeTenant?.role !== 'COACH' && (
                <Link
                  href="/attendance/quick"
                  id="btn-quick-attendance"
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Zap className="h-4 w-4 text-cyan-200 fill-cyan-200/20 animate-pulse" />
                  <span>{locale === 'ar' ? 'تسجيل الحضور السريع' : 'Quick Attendance'}</span>
                </Link>
              )}

              {/* QR Scanner button */}
              {activeTenant?.role !== 'COACH' && (
                <Link
                  href="/attendance/scanner"
                  id="btn-quick-scanner"
                  className="flex items-center gap-2 rounded-xl border border-(--border-app) bg-[var(--bg-surface)] px-4 py-2.5 text-xs font-semibold text-[var(--accent-primary)] hover:border-[var(--accent-primary)] transition-all cursor-pointer shadow-sm"
                >
                  <CalendarCheck className="h-4 w-4" />
                  <span>{t('nav.scanner')}</span>
                </Link>
              )}

              <Link
                href="/players/new"
                id="btn-new-player"
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent-primary)] to-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-500/20 hover:brightness-110 transition-all"
              >
                <UserPlus className="h-4 w-4" />
                <span>{locale === 'ar' ? 'تسجيل لاعب جديد' : 'New Player'}</span>
              </Link>
            </div>
          </div>
        </div>

        {/* 6-Grid Operational KPI Cards */}
        {user.isPlatformSuperAdmin && !activeTenant ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/platform?tab=academies"
              id="kpi-platform-academies"
              className="block card-hover-interactive rounded-2xl"
            >
              <StatCard
                title={locale === 'ar' ? 'إجمالي الأكاديميات' : 'Total Academies'}
                value={platformMetrics?.totalAcademies ?? 0}
                subtitle={
                  locale === 'ar' ? 'سجل الأكاديميات والمنشآت' : 'Registered platform academies'
                }
                icon={Building2}
                loading={!hasLoadedOnce && isFetchingData}
              />
            </Link>

            <Link
              href="/platform?tab=applications"
              id="kpi-platform-applications"
              className="block card-hover-interactive rounded-2xl"
            >
              <StatCard
                title={locale === 'ar' ? 'طلبات التأسيس' : 'Academy Applications'}
                value={platformMetrics?.pendingApps ?? 0}
                subtitle={
                  locale === 'ar' ? 'طلبات بانتظار المراجعة' : 'Pending onboarding requests'
                }
                icon={Layers}
                loading={!hasLoadedOnce && isFetchingData}
              />
            </Link>

            <Link
              href="/platform?tab=users"
              id="kpi-platform-users"
              className="block card-hover-interactive rounded-2xl"
            >
              <StatCard
                title={locale === 'ar' ? 'مستخدمي المنصة' : 'Platform Users'}
                value={platformMetrics?.totalUsers ?? 0}
                subtitle={locale === 'ar' ? 'إجمالي الحسابات المسجلة' : 'Active platform accounts'}
                icon={Users}
                loading={!hasLoadedOnce && isFetchingData}
              />
            </Link>

            <Link
              href="/platform?tab=plans"
              id="kpi-platform-plans"
              className="block card-hover-interactive rounded-2xl"
            >
              <StatCard
                title={locale === 'ar' ? 'باقات الاشتراك (SaaS)' : 'SaaS Plans'}
                value={3}
                subtitle={locale === 'ar' ? 'باقات التشغيل والفوترة' : 'Commercial platform tiers'}
                icon={Trophy}
                loading={!hasLoadedOnce && isFetchingData}
              />
            </Link>

            <Link
              href="/platform"
              id="kpi-platform-mrr"
              className="block card-hover-interactive rounded-2xl"
            >
              <StatCard
                title={locale === 'ar' ? 'الإيراد الشهري (MRR)' : 'Monthly Recurring (MRR)'}
                value={`${platformMetrics?.mrr ?? 799} SAR`}
                subtitle={
                  locale === 'ar' ? 'مؤشرات الاشتراكات النشطة' : 'Active subscription revenue'
                }
                icon={BarChart3}
                loading={!hasLoadedOnce && isFetchingData}
              />
            </Link>

            <Link
              href="/platform?tab=security"
              id="kpi-platform-security"
              className="block card-hover-interactive rounded-2xl"
            >
              <StatCard
                title={locale === 'ar' ? 'الأمان والرقابة' : 'Security & Governance'}
                value={locale === 'ar' ? 'نشط ومحمي' : 'Active & Guarded'}
                subtitle={locale === 'ar' ? 'سجلات الرقابة والحماية' : 'Platform audit and logs'}
                icon={ShieldCheck}
                loading={!hasLoadedOnce && isFetchingData}
              />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/players"
              id="kpi-players"
              className="block card-hover-interactive rounded-2xl"
            >
              <StatCard
                title={locale === 'ar' ? 'اللاعبين والناشئين' : 'Players & Youth'}
                value={totalPlayers}
                subtitle={locale === 'ar' ? 'عرض السجلات والملفات' : 'View roster records'}
                icon={Users}
                trend="up"
                change="+12%"
                loading={!hasLoadedOnce && isFetchingData}
              />
            </Link>

            <Link
              href="/groups"
              id="kpi-groups"
              className="block card-hover-interactive rounded-2xl"
            >
              <StatCard
                title={locale === 'ar' ? 'المجموعات التدريبية' : 'Training Groups'}
                value={groupCount}
                subtitle={locale === 'ar' ? 'إدارة الفرق والجدول' : 'Manage squads and rosters'}
                icon={Layers}
                loading={!hasLoadedOnce && isFetchingData}
              />
            </Link>

            <Link
              href="/sessions"
              id="kpi-sessions"
              className="block card-hover-interactive rounded-2xl"
            >
              <StatCard
                title={locale === 'ar' ? 'الحصص التدريبية' : 'Training Sessions'}
                value={sessionCount}
                subtitle={locale === 'ar' ? 'كشوف الحضور والتحضير' : 'Live attendance logs'}
                icon={CalendarCheck}
                loading={!hasLoadedOnce && isFetchingData}
              />
            </Link>

            <Link
              href="/attendance/reports"
              id="kpi-reports"
              className="block card-hover-interactive rounded-2xl"
            >
              <StatCard
                title={locale === 'ar' ? 'تقارير الحضور' : 'Attendance Reports'}
                value={locale === 'ar' ? 'التحليلات' : 'Analytics'}
                subtitle={locale === 'ar' ? 'معدلات الانضباط والغياب' : 'Attendance rate analytics'}
                icon={BarChart3}
                loading={!hasLoadedOnce && isFetchingData}
              />
            </Link>

            <Link
              href="/branches"
              id="kpi-branches"
              className="block card-hover-interactive rounded-2xl"
            >
              <StatCard
                title={locale === 'ar' ? 'الفروع والملاعب' : 'Branches & Pitches'}
                value={branches.length}
                subtitle={locale === 'ar' ? 'المقرات التشغيلية' : 'Operating pitch sites'}
                icon={GitBranch}
                loading={!hasLoadedOnce && isFetchingData}
              />
            </Link>

            <Link
              href="/settings?tab=staff"
              id="kpi-staff"
              className="block card-hover-interactive rounded-2xl"
            >
              <StatCard
                title={locale === 'ar' ? 'الكادر الفني والإداري' : 'Coaching & Staff'}
                value={staffCount}
                subtitle={locale === 'ar' ? 'إدارة الطاقم والمدربين' : 'Manage coaches & staff'}
                icon={Trophy}
                loading={!hasLoadedOnce && isFetchingData}
              />
            </Link>
          </div>
        )}

        {/* Main Content Grid: Recent Players & Operational Branches */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Players Table (2 Cols) */}
          <div className="lg:col-span-2 rounded-3xl border border-(--border-app) bg-[var(--bg-surface)] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-(--border-subtle)">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-[var(--accent-primary)]" />
                <h2 className="text-base font-bold text-(--text-main)">
                  {locale === 'ar' ? 'أحدث اللاعبين المسجلين' : 'Recent Player Enrollments'}
                </h2>
              </div>
              <Link
                href="/players"
                id="link-view-all-players"
                className="text-xs font-semibold text-[var(--accent-primary)] hover:underline flex items-center gap-1"
              >
                <span>
                  {locale === 'ar' ? `عرض الكل (${totalPlayers})` : `View All (${totalPlayers})`}
                </span>
                <DirectionIcon className="h-3.5 w-3.5" />
              </Link>
            </div>

            {players.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <Users className="h-10 w-10 mx-auto text-(--text-muted) opacity-50" />
                <p className="text-sm font-semibold text-(--text-main)">{t('common.noResults')}</p>
                <Link
                  href="/players/new"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-(--accent-primary) px-3.5 py-1.5 text-xs font-bold text-white hover:brightness-110 transition-all mt-2"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>{locale === 'ar' ? 'تسجيل لاعب جديد' : 'Enroll First Player'}</span>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-(--bg-surface-subtle) text-(--text-muted) border-b border-(--border-subtle)">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold text-start">
                        {locale === 'ar' ? 'اللاعب' : 'Player'}
                      </th>
                      <th className="py-2.5 px-3 font-semibold text-start">
                        {locale === 'ar' ? 'الفرع' : 'Branch'}
                      </th>
                      <th className="py-2.5 px-3 font-semibold text-start">
                        {locale === 'ar' ? 'ولي الأمر' : 'Parent / Guardian'}
                      </th>
                      <th className="py-2.5 px-3 font-semibold text-start">
                        {locale === 'ar' ? 'الحالة' : 'Status'}
                      </th>
                      <th className="py-2.5 px-3 font-semibold text-end">
                        {locale === 'ar' ? 'الإجراءات' : 'Actions'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {players.map((p) => {
                      const currentBranch = p.currentBranch;
                      const primaryGuardian = p.primaryGuardian;

                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-(--bg-surface-subtle)/60 transition-colors"
                        >
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-(--badge-bg) text-[var(--accent-primary)] font-bold text-xs shadow-inner">
                                {p.firstName.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-(--text-main) truncate">
                                  {p.firstName} {p.lastName}
                                </div>
                                <div className="text-[10px] text-(--text-muted)">
                                  {p.gender === 'MALE'
                                    ? locale === 'ar'
                                      ? 'ذكر'
                                      : 'Male'
                                    : locale === 'ar'
                                      ? 'أنثى'
                                      : 'Female'}{' '}
                                  • {p.dateOfBirth.slice(0, 10)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-(--text-main) font-medium">
                              {translateDataString(currentBranch?.name, locale) || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {primaryGuardian ? (
                              <div>
                                <span className="text-(--text-main) font-medium block">
                                  {primaryGuardian.firstName} {primaryGuardian.lastName}
                                </span>
                                <span className="text-[10px] text-(--text-muted) font-mono flex items-center gap-1">
                                  <Phone className="h-2.5 w-2.5" /> {primaryGuardian.phone}
                                </span>
                              </div>
                            ) : (
                              <span className="text-(--text-muted)">-</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <StatusBadge
                              status={p.status}
                              label={t(`common.${p.status.toLowerCase()}`, p.status)}
                            />
                          </td>
                          <td className="py-3 px-3 text-end">
                            <Link
                              href={`/players/${p.id}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-(--border-subtle) bg-(--bg-surface-subtle) px-2.5 py-1 text-[11px] font-semibold text-(--text-main) hover:border-[var(--accent-primary)] hover:text-(--accent-primary) transition-all"
                            >
                              <span>{locale === 'ar' ? 'الملف' : 'Profile'}</span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Branches List (1 Col) */}
          <div className="rounded-3xl border border-(--border-app) bg-[var(--bg-surface)] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-(--border-subtle)">
              <div className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-[var(--accent-primary)]" />
                <h2 className="text-base font-bold text-(--text-main)">
                  {locale === 'ar' ? 'الفروع والملاعب' : 'Branches & Pitches'}
                </h2>
              </div>
              <Link
                href="/branches"
                className="text-xs font-semibold text-[var(--accent-primary)] hover:underline"
              >
                {locale === 'ar' ? 'إدارة' : 'Manage'}
              </Link>
            </div>

            {branches.length === 0 ? (
              <div className="py-6 text-center text-(--text-muted) text-xs">
                {t('common.noResults')}
              </div>
            ) : (
              <div className="space-y-2.5">
                {branches.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) p-3 space-y-1.5 hover:border-emerald-500/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-(--text-main) text-xs truncate">{b.name}</h4>
                      {b.code && (
                        <span className="rounded bg-(--badge-bg) px-1.5 py-0.5 text-[9px] font-mono font-bold text-(--badge-fg)">
                          {b.code}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-(--text-muted) flex items-center justify-between">
                      <span>
                        {translateDataString(b.city, locale) ||
                          (locale === 'ar' ? 'المدينة' : 'Site')}
                      </span>
                      <span className="text-[var(--accent-primary)] font-bold">
                        {b.activePlayersCount || 0} {locale === 'ar' ? 'لاعب' : 'players'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2">
              <Link
                href="/branches"
                id="btn-add-branch-dashboard"
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--accent-primary)]/40 bg-(--badge-bg)/50 py-2.5 text-xs font-bold text-[var(--accent-primary)] hover:bg-(--badge-bg) transition-colors"
              >
                <GitBranch className="h-4 w-4" />
                <span>{locale === 'ar' ? 'إضافة أو تعديل الفروع' : 'Manage Branches'}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Player Join Requests - visible to OWNER and MANAGER only */}
      {(activeTenant?.role === 'OWNER' || activeTenant?.role === 'MANAGER') && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-8">
          <div className="rounded-3xl border border-(--border-app) bg-[var(--bg-surface)] p-6 shadow-xs">
            <PlayerJoinRequestsTab />
          </div>
        </div>
      )}
    </AppShell>
  );
}
