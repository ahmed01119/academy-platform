'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { canAccessAdminRoutes, getRoleHomeRoute } from '../../lib/role-routing';
import { Navbar } from '../../components/Navbar';
import { api } from '../../lib/api-client';
import type { BranchSummary, PlayerSummary } from '@academy/shared';
import {
  Users,
  GitBranch,
  ShieldCheck,
  RefreshCw,
  Trophy,
  UserPlus,
  ArrowUpRight,
  ChevronLeft,
  Phone,
  Layers,
  CalendarCheck,
  BarChart3,
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { user, activeTenant, isLoading, refreshUser } = useAuth();

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
      <div className="min-h-screen bg-[#0f1c18] flex items-center justify-center text-[#9bb5a8]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-[#2f9e6b]" />
          <p className="text-sm font-medium">جارٍ التحقق من الجلسة الآمنة...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0f1c18] text-[#e8f0ec] flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Welcome and Identity Hero Card */}
        <div className="rounded-2xl border border-[#234235] bg-gradient-to-r from-[#162821] via-[#12231c] to-[#162821] p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-96 h-96 bg-[#2f9e6b]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#45c387] bg-[#2f9e6b]/15 px-2.5 py-1 rounded-full border border-[#2f9e6b]/30">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  لوحة تحكم الأكاديمية والعمليات الرياضية
                </span>
                <span className="text-xs text-[#9bb5a8]">
                  {activeTenant?.tenantName || 'الأكاديمية النشطة'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                أهلاً بك، {user.name} 👋
              </h1>
              <p className="mt-1 text-sm text-[#9bb5a8]">
                لوحة الإدارة المركزية للأكاديمية واللاعبين والمجموعات وحصص الحضور الذكية.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                id="btn-refresh-dashboard"
                onClick={() => void refreshUser()}
                className="flex items-center gap-2 rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-4 py-2.5 text-xs font-medium text-[#e8f0ec] hover:border-[#2f9e6b] transition-colors cursor-pointer"
              >
                <RefreshCw className={`h-4 w-4 ${isFetchingData ? 'animate-spin' : ''}`} />
                <span>تحديث</span>
              </button>

              <Link
                href="/sessions"
                id="btn-quick-sessions"
                className="flex items-center gap-2 rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-4 py-2.5 text-xs font-semibold text-[#45c387] hover:border-[#2f9e6b] transition-all cursor-pointer"
              >
                <CalendarCheck className="h-4 w-4" />
                <span>شاشة التحضير</span>
              </Link>

              <Link
                href="/players/new"
                id="btn-new-player"
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] px-4 py-2.5 text-xs font-semibold text-[#062016] shadow-md shadow-[#2f9e6b]/20 hover:brightness-110 transition-all"
              >
                <UserPlus className="h-4 w-4" />
                <span>تسجيل لاعب جديد</span>
              </Link>
            </div>
          </div>
        </div>

        {/* KPI Metrics Cards (6-item Grid for Sprint 3) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Card 1: Players */}
          <Link
            href="/players"
            id="kpi-players"
            className="group rounded-2xl border border-[#234235] bg-[#162821]/80 p-5 hover:border-[#2f9e6b]/60 transition-all shadow-lg hover:shadow-[#2f9e6b]/10"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[#9bb5a8]">إجمالي اللاعبين المسجلين</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2f9e6b]/15 text-[#45c387] group-hover:scale-110 transition-transform">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold text-white">{totalPlayers}</span>
              <span className="text-xs text-[#45c387] flex items-center gap-0.5">
                عرض اللاعبين <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </Link>

          {/* Card 2: Training Groups */}
          <Link
            href="/groups"
            id="kpi-groups"
            className="group rounded-2xl border border-[#234235] bg-[#162821]/80 p-5 hover:border-[#2f9e6b]/60 transition-all shadow-lg hover:shadow-[#2f9e6b]/10"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[#9bb5a8]">المجموعات التدريبية</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2f9e6b]/15 text-[#45c387] group-hover:scale-110 transition-transform">
                <Layers className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold text-white">{groupCount}</span>
              <span className="text-xs text-[#45c387] flex items-center gap-0.5">
                إدارة المجموعات <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </Link>

          {/* Card 3: Training Sessions */}
          <Link
            href="/sessions"
            id="kpi-sessions"
            className="group rounded-2xl border border-[#234235] bg-[#162821]/80 p-5 hover:border-[#2f9e6b]/60 transition-all shadow-lg hover:shadow-[#2f9e6b]/10"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[#9bb5a8]">الحصص وسجلات الحضور</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3b82f6]/15 text-[#60a5fa] group-hover:scale-110 transition-transform">
                <CalendarCheck className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold text-white">{sessionCount}</span>
              <span className="text-xs text-[#60a5fa] flex items-center gap-0.5">
                سجل الحصص <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </Link>

          {/* Card 4: Attendance Reports */}
          <Link
            href="/attendance/reports"
            id="kpi-reports"
            className="group rounded-2xl border border-[#234235] bg-[#162821]/80 p-5 hover:border-[#2f9e6b]/60 transition-all shadow-lg hover:shadow-[#2f9e6b]/10"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[#9bb5a8]">تقارير الانضباط والحضور</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eab308]/15 text-[#facc15] group-hover:scale-110 transition-transform">
                <BarChart3 className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold text-white">التحليلات</span>
              <span className="text-xs text-[#facc15] flex items-center gap-0.5">
                عرض التقارير <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </Link>

          {/* Card 5: Branches */}
          <Link
            href="/branches"
            id="kpi-branches"
            className="group rounded-2xl border border-[#234235] bg-[#162821]/80 p-5 hover:border-[#2f9e6b]/60 transition-all shadow-lg hover:shadow-[#2f9e6b]/10"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[#9bb5a8]">الفروع التشغيلية</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3b82f6]/15 text-[#60a5fa] group-hover:scale-110 transition-transform">
                <GitBranch className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold text-white">
                {branches.length}
              </span>
              <span className="text-xs text-[#60a5fa] flex items-center gap-0.5">
                إدارة الفروع <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </Link>

          {/* Card 6: Staff */}
          <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[#9bb5a8]">الكادر الفني والإداري</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#8b5cf6]/15 text-[#a78bfa]">
                <Trophy className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold text-white">{staffCount}</span>
              <span className="text-xs text-[#9bb5a8]">عضو معتمد</span>
            </div>
          </div>
        </div>

        {/* Main Content Grid: Recent Players & Branches List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left / Center 2 Cols: Recent Players */}
          <div className="lg:col-span-2 rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 backdrop-blur-md space-y-5">
            <div className="flex items-center justify-between border-b border-[#234235] pb-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-[#2f9e6b]" />
                <h2 className="text-lg font-bold text-white">أحدث اللاعبين المسجلين</h2>
              </div>
              <Link
                href="/players"
                id="link-view-all-players"
                className="text-xs font-semibold text-[#45c387] hover:underline flex items-center gap-1"
              >
                عرض كل اللاعبين ({totalPlayers})
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </div>

            {players.length === 0 ? (
              <div className="py-12 text-center text-[#9bb5a8]">
                <Users className="h-12 w-12 mx-auto text-[#234235] mb-3" />
                <p className="text-sm font-medium text-[#e8f0ec]">
                  لم يتم تسجيل أي لاعبين حتى الآن
                </p>
                <p className="text-xs text-[#9bb5a8] mt-1 mb-4">
                  ابدأ بتسجيل أول لاعب في الأكاديمية وربطه بالفرع وولي الأمر.
                </p>
                <Link
                  href="/players/new"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] px-4 py-2 text-xs font-semibold text-[#062016] shadow hover:brightness-110"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>تسجيل أول لاعب</span>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-[#234235] text-[#9bb5a8]">
                      <th className="py-2.5 px-3 font-semibold">اللاعب</th>
                      <th className="py-2.5 px-3 font-semibold">الفرع</th>
                      <th className="py-2.5 px-3 font-semibold">ولي الأمر</th>
                      <th className="py-2.5 px-3 font-semibold">الحالة</th>
                      <th className="py-2.5 px-3 font-semibold text-left">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#234235]">
                    {players.map((p) => {
                      const currentBranch = p.currentBranch;
                      const primaryGuardian = p.primaryGuardian;

                      return (
                        <tr key={p.id} className="hover:bg-[#1a3328]/40 transition-colors">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2f9e6b]/20 text-[#45c387] font-bold text-xs">
                                {p.firstName.charAt(0)}
                              </div>
                              <div>
                                <div className="font-semibold text-white">
                                  {p.firstName} {p.lastName}
                                </div>
                                <div className="text-[11px] text-[#9bb5a8]">
                                  {p.gender === 'MALE' ? 'ذكر' : 'أنثى'} •{' '}
                                  {p.dateOfBirth.slice(0, 10)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-[#e8f0ec]">
                              {currentBranch?.name || 'غير مسجل بفرع'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {primaryGuardian ? (
                              <div>
                                <span className="text-[#e8f0ec] block">
                                  {primaryGuardian.firstName} {primaryGuardian.lastName}
                                </span>
                                <span className="text-[10px] text-[#9bb5a8] font-mono flex items-center gap-1">
                                  <Phone className="h-3 w-3" /> {primaryGuardian.phone}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[#9bb5a8]">-</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                p.status === 'ACTIVE'
                                  ? 'bg-[#2f9e6b]/20 text-[#45c387] border border-[#2f9e6b]/30'
                                  : 'bg-[#ef4444]/20 text-[#fca5a5] border border-[#ef4444]/30'
                              }`}
                            >
                              {p.status === 'ACTIVE' ? 'نشط' : 'غير نشط'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-left">
                            <Link
                              href={`/players/${p.id}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#2b4c3e] bg-[#0f1c18] px-2.5 py-1 text-[11px] font-medium text-[#e8f0ec] hover:border-[#2f9e6b] hover:text-[#45c387] transition-all"
                            >
                              الملف
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

          {/* Right 1 Col: Operational Branches List */}
          <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between border-b border-[#234235] pb-4">
              <div className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-[#2f9e6b]" />
                <h2 className="text-lg font-bold text-white">فروع الأكاديمية</h2>
              </div>
              <Link
                href="/branches"
                className="text-xs font-semibold text-[#45c387] hover:underline"
              >
                إدارة
              </Link>
            </div>

            {branches.length === 0 ? (
              <div className="py-8 text-center text-[#9bb5a8]">
                <GitBranch className="h-8 w-8 mx-auto text-[#234235] mb-2" />
                <p className="text-xs">لم يتم تسجيل فروع حتى الآن</p>
              </div>
            ) : (
              <div className="space-y-3">
                {branches.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-xl border border-[#234235] bg-[#0f1c18]/60 p-3.5 space-y-2 hover:border-[#2f9e6b]/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white text-sm">{b.name}</h4>
                      {b.code && (
                        <span className="rounded bg-[#234235] px-1.5 py-0.5 text-[10px] font-mono text-[#45c387]">
                          {b.code}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#9bb5a8] flex items-center justify-between">
                      <span>{b.city || 'المدينة غير محددة'}</span>
                      <span className="text-[#45c387] font-semibold">
                        {b.activePlayersCount || 0} لاعب
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
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#2f9e6b]/40 bg-[#2f9e6b]/5 py-2.5 text-xs font-medium text-[#45c387] hover:bg-[#2f9e6b]/10 transition-colors"
              >
                <GitBranch className="h-4 w-4" />
                <span>إضافة أو تعديل فرع</span>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
