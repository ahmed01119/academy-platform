'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { useLocale } from '../../lib/locale-context';
import { canAccessAdminRoutes, getRoleHomeRoute } from '../../lib/role-routing';
import { AppShell } from '../../components/layout/AppShell';
import { StatCard, StatusBadge } from '../../components/ui';
import { api } from '../../lib/api-client';
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
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { user, activeTenant, isLoading, refreshUser } = useAuth();
  const { t, locale, isRtl } = useLocale();

  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [totalPlayers, setTotalPlayers] = useState<number>(0);
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [staffCount, setStaffCount] = useState<number>(0);
  const [groupCount, setGroupCount] = useState<number>(0);
  const [sessionCount, setSessionCount] = useState<number>(0);
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
    if (user && activeTenant) {
      const loadDashboardData = async () => {
        setIsFetchingData(true);
        try {
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
        } finally {
          setIsFetchingData(false);
        }
      };
      void loadDashboardData();
    }
  }, [user, activeTenant]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center text-[var(--text-muted)]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-[var(--accent-primary)]" />
          <p className="text-sm font-medium">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const DirectionIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Welcome and Identity Hero Banner */}
        <div className="rounded-2xl border border-[var(--border-app)] bg-gradient-to-br from-[var(--bg-surface)] via-[var(--bg-surface-subtle)] to-[var(--bg-surface)] p-6 sm:p-8 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 start-0 w-80 h-80 bg-[var(--accent-primary)]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--badge-fg)] bg-[var(--badge-bg)] px-3 py-1 rounded-full border border-[var(--badge-border)]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {locale === 'ar' ? 'لوحة تحكم العمليات المركزية' : 'Academy Operations Hub'}
                </span>
                <span className="text-xs text-[var(--text-muted)] font-medium">
                  {activeTenant?.tenantName}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-main)]">
                {locale === 'ar' ? `أهلاً بك، ${user.name} 👋` : `Welcome back, ${user.name} 👋`}
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-2xl leading-relaxed">
                {locale === 'ar'
                  ? 'المنظومة السحابية المتكاملة لإدارة اللاعبين، الحصص، التحضير الذكي، وذكاء الأداء الرياضي.'
                  : 'Centralized operations console for squad management, training sessions, QR check-ins, and performance intelligence.'}
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                id="btn-refresh-dashboard"
                onClick={() => void refreshUser()}
                className="flex items-center gap-2 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] px-4 py-2.5 text-xs font-semibold text-[var(--text-main)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-all cursor-pointer shadow-sm"
              >
                <RefreshCw className={`h-4 w-4 ${isFetchingData ? 'animate-spin' : ''}`} />
                <span>{t('common.refresh')}</span>
              </button>

              <Link
                href="/attendance/scanner"
                id="btn-quick-scanner"
                className="flex items-center gap-2 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] px-4 py-2.5 text-xs font-semibold text-[var(--accent-primary)] hover:border-[var(--accent-primary)] transition-all cursor-pointer shadow-sm"
              >
                <CalendarCheck className="h-4 w-4" />
                <span>{t('nav.scanner')}</span>
              </Link>

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link href="/players" id="kpi-players">
            <StatCard
              title={t('nav.players', 'اللاعبين والناشئين')}
              value={totalPlayers}
              subtitle={locale === 'ar' ? 'عرض السجلات والملفات' : 'View roster records'}
              icon={Users}
              trend="up"
              change="+12%"
            />
          </Link>

          <Link href="/groups" id="kpi-groups">
            <StatCard
              title={t('nav.groups', 'المجموعات التدريبية')}
              value={groupCount}
              subtitle={locale === 'ar' ? 'إدارة الفرق والجدول' : 'Manage squads and rosters'}
              icon={Layers}
            />
          </Link>

          <Link href="/sessions" id="kpi-sessions">
            <StatCard
              title={t('nav.sessions', 'الحصص التدريبية')}
              value={sessionCount}
              subtitle={locale === 'ar' ? 'كشوف الحضور والتحضير' : 'Live attendance logs'}
              icon={CalendarCheck}
            />
          </Link>

          <Link href="/attendance/reports" id="kpi-reports">
            <StatCard
              title={t('nav.reports', 'تقارير الحضور')}
              value={locale === 'ar' ? 'التحليلات' : 'Analytics'}
              subtitle={locale === 'ar' ? 'معدلات الانضباط والغياب' : 'Attendance rate analytics'}
              icon={BarChart3}
            />
          </Link>

          <Link href="/branches" id="kpi-branches">
            <StatCard
              title={t('nav.branches', 'الفروع والملاعب')}
              value={branches.length}
              subtitle={locale === 'ar' ? 'المقرات التشغيلية' : 'Operating pitch sites'}
              icon={GitBranch}
            />
          </Link>

          <div>
            <StatCard
              title={locale === 'ar' ? 'الكادر الفني والإداري' : 'Coaching & Staff'}
              value={staffCount}
              subtitle={locale === 'ar' ? 'عضو معتمد بالنظام' : 'Active system users'}
              icon={Trophy}
            />
          </div>
        </div>

        {/* Main Content Grid: Recent Players & Operational Branches */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Players Table (2 Cols) */}
          <div className="lg:col-span-2 rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-[var(--accent-primary)]" />
                <h2 className="text-base font-bold text-[var(--text-main)]">
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
                <Users className="h-10 w-10 mx-auto text-[var(--text-muted)] opacity-50" />
                <p className="text-sm font-semibold text-[var(--text-main)]">
                  {t('common.noResults')}
                </p>
                <Link
                  href="/players/new"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3.5 py-1.5 text-xs font-bold text-white hover:brightness-110 transition-all mt-2"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>{locale === 'ar' ? 'تسجيل لاعب جديد' : 'Enroll First Player'}</span>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold text-start">{t('common.player')}</th>
                      <th className="py-2.5 px-3 font-semibold text-start">{t('common.branch')}</th>
                      <th className="py-2.5 px-3 font-semibold text-start">
                        {t('common.guardian')}
                      </th>
                      <th className="py-2.5 px-3 font-semibold text-start">{t('common.status')}</th>
                      <th className="py-2.5 px-3 font-semibold text-end">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {players.map((p) => {
                      const currentBranch = p.currentBranch;
                      const primaryGuardian = p.primaryGuardian;

                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-[var(--bg-surface-subtle)]/60 transition-colors"
                        >
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--badge-bg)] text-[var(--accent-primary)] font-bold text-xs shadow-inner">
                                {p.firstName.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-[var(--text-main)] truncate">
                                  {p.firstName} {p.lastName}
                                </div>
                                <div className="text-[10px] text-[var(--text-muted)]">
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
                            <span className="text-[var(--text-main)] font-medium">
                              {currentBranch?.name || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {primaryGuardian ? (
                              <div>
                                <span className="text-[var(--text-main)] font-medium block">
                                  {primaryGuardian.firstName} {primaryGuardian.lastName}
                                </span>
                                <span className="text-[10px] text-[var(--text-muted)] font-mono flex items-center gap-1">
                                  <Phone className="h-2.5 w-2.5" /> {primaryGuardian.phone}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[var(--text-muted)]">-</span>
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
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-main)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-all"
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
          <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-[var(--accent-primary)]" />
                <h2 className="text-base font-bold text-[var(--text-main)]">
                  {t('nav.branches', 'الفروع')}
                </h2>
              </div>
              <Link
                href="/branches"
                className="text-xs font-semibold text-[var(--accent-primary)] hover:underline"
              >
                {t('common.edit', 'إدارة')}
              </Link>
            </div>

            {branches.length === 0 ? (
              <div className="py-6 text-center text-[var(--text-muted)] text-xs">
                {t('common.noResults')}
              </div>
            ) : (
              <div className="space-y-2.5">
                {branches.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3 space-y-1.5 hover:border-emerald-500/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-[var(--text-main)] text-xs truncate">
                        {b.name}
                      </h4>
                      {b.code && (
                        <span className="rounded bg-[var(--badge-bg)] px-1.5 py-0.5 text-[9px] font-mono font-bold text-[var(--badge-fg)]">
                          {b.code}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] flex items-center justify-between">
                      <span>{b.city || (locale === 'ar' ? 'المدينة' : 'Site')}</span>
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
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--accent-primary)]/40 bg-[var(--badge-bg)]/50 py-2.5 text-xs font-bold text-[var(--accent-primary)] hover:bg-[var(--badge-bg)] transition-colors"
              >
                <GitBranch className="h-4 w-4" />
                <span>{locale === 'ar' ? 'إضافة أو تعديل الفروع' : 'Manage Branches'}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
