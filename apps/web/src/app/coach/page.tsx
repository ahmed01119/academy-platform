'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiClient } from '../../lib/api-client';
import {
  UserCheck,
  CalendarCheck,
  Users,
  Award,
  Clock,
  Play,
  ChevronLeft,
  RefreshCw,
} from 'lucide-react';
import type { SessionSummary, TrainingGroupSummary } from '@academy/shared';

export default function CoachWorkspacePage() {
  const { user, activeTenant, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [todaySessions, setTodaySessions] = useState<SessionSummary[]>([]);
  const [assignedGroups, setAssignedGroups] = useState<TrainingGroupSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCoachData = async () => {
    setIsLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0]!;
      const [sessionsRes, groupsRes] = await Promise.all([
        apiClient.attendance.listSessions({ dateFrom: todayStr, dateTo: todayStr }).catch(() => ({ items: [] })),
        apiClient.groups.list().catch(() => ({ items: [] })),
      ]);
      setTodaySessions(sessionsRes.items || []);
      setAssignedGroups(groupsRes.items || []);
    } catch {
      // Handled gracefully
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user) {
      loadCoachData();
    }
  }, [user, authLoading, router]);

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-[#45c387]" />
          <p className="text-sm text-[#9bb5a8]">جارٍ تحميل مساحة عمل المدرب...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1410] text-[#e8f0ec] py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Welcome Coach Hero */}
        <div className="rounded-2xl border border-[#2b4c3e] bg-gradient-to-r from-[#12231c] via-[#162821] to-[#12231c] p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#45c387] bg-[#2f9e6b]/15 px-3 py-1 rounded-full border border-[#2f9e6b]/30">
                  <UserCheck className="h-4 w-4" />
                  Coach Training Field Workspace
                </span>
                <span className="text-xs text-[#9bb5a8]">
                  {activeTenant?.tenantName || 'الأكاديمية'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                مساحة المدرب: كابتن {user?.name} ⚽
              </h1>
              <p className="mt-1 text-sm text-[#9bb5a8]">
                إدارة الحصص التدريبية اليومية، التحضير السريع بالباركود، وتقييم أداء وتطور اللاعبين ميدانياً.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/evaluations"
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] px-4 py-2.5 text-sm font-semibold text-[#062016] shadow-md shadow-[#2f9e6b]/20 hover:brightness-110 transition-all"
              >
                <Award className="h-4 w-4" />
                <span>تقييمات اللاعبين</span>
              </Link>
              <Link
                href="/sessions"
                className="flex items-center gap-2 rounded-xl border border-[#2b4c3e] bg-[#162821] px-4 py-2.5 text-sm font-semibold text-white hover:border-[#2f9e6b] hover:text-[#45c387] transition-all"
              >
                <CalendarCheck className="h-4 w-4 text-[#2f9e6b]" />
                <span>جدول الحصص</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Action Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-[#234235] bg-[#12231c] p-5 hover:border-[#2f9e6b]/40 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-lg bg-[#2f9e6b]/15 border border-[#2f9e6b]/30 flex items-center justify-center text-[#45c387]">
                <CalendarCheck className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold text-[#45c387] bg-[#2f9e6b]/10 px-2 py-0.5 rounded">
                اليوم
              </span>
            </div>
            <h3 className="font-bold text-white text-base">حصص اليوم الميدانية</h3>
            <p className="text-xs text-[#9bb5a8] mt-1">
              لديك {todaySessions.length} حصة تدريبية مبرمجة لليوم في مختلف الفروع.
            </p>
          </div>

          <div className="rounded-xl border border-[#234235] bg-[#12231c] p-5 hover:border-[#2f9e6b]/40 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Users className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                المجموعات
              </span>
            </div>
            <h3 className="font-bold text-white text-base">فرق التدريب المعتمدة</h3>
            <p className="text-xs text-[#9bb5a8] mt-1">
              مجموعات التدريب والفئات العمرية المسندة إليك ({assignedGroups.length} مجموعة).
            </p>
          </div>

          <div className="rounded-xl border border-[#234235] bg-[#12231c] p-5 hover:border-[#2f9e6b]/40 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Award className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                الذكاء الرياضي
              </span>
            </div>
            <h3 className="font-bold text-white text-base">تقييمات الأداء الرباعية</h3>
            <p className="text-xs text-[#9bb5a8] mt-1">
              تقييم المهارات الفنية، التكتيكية، البدنية والسلوكية مع إمكانية كتابة ملاحظات خاصة وملاحظات لأولياء الأمور.
            </p>
          </div>
        </div>

        {/* Section 1: Today's Training Sessions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#2f9e6b]" />
              <span>جدول حصص اليوم التدريبية</span>
            </h2>
            <Link
              href="/sessions"
              className="text-xs font-semibold text-[#45c387] hover:underline flex items-center gap-1"
            >
              <span>عرض كل الحصص</span>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Link>
          </div>

          {todaySessions.length === 0 ? (
            <div className="rounded-xl border border-[#234235] bg-[#12231c] p-8 text-center text-[#9bb5a8]">
              <CalendarCheck className="h-10 w-10 text-[#2f9e6b] mx-auto mb-2 opacity-60" />
              <div className="font-semibold text-white">لا توجد حصص تدريبية مجدولة لليوم</div>
              <p className="text-xs mt-1">
                يمكنك الاطلاع على جدول الحصص القادمة أو إنشاء حصة جديدة عبر صفحة الحصص.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {todaySessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-xl border border-[#234235] bg-[#12231c] p-5 hover:border-[#2f9e6b] transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-white">{session.groupName}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          session.status === 'IN_PROGRESS'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : session.status === 'CLOSED'
                            ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}
                      >
                        {session.status === 'IN_PROGRESS'
                          ? 'جارية الآن'
                          : session.status === 'CLOSED'
                          ? 'مكتملة'
                          : 'مجدولة'}
                      </span>
                    </div>

                    <div className="text-xs text-[#9bb5a8] flex items-center gap-4 mb-4">
                      <span>⏰ {session.startTime} - {session.endTime}</span>
                      <span>📍 {session.branchName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-[#234235]">
                    <Link
                      href={`/attendance/sessions/${session.id}`}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#2f9e6b] px-3 py-2 text-xs font-semibold text-[#062016] hover:bg-[#36b379] transition-all"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>بدء تحضير الحضور</span>
                    </Link>
                    <Link
                      href={`/evaluations?sessionId=${session.id}`}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-[#2b4c3e] bg-[#162821] px-3 py-2 text-xs font-semibold text-white hover:border-[#2f9e6b] hover:text-[#45c387] transition-all"
                    >
                      <Award className="h-3.5 w-3.5 text-[#2f9e6b]" />
                      <span>تقييم اللاعبين</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Assigned Training Groups */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-[#2f9e6b]" />
              <span>المجموعات والفرق المسندة</span>
            </h2>
            <Link
              href="/groups"
              className="text-xs font-semibold text-[#45c387] hover:underline flex items-center gap-1"
            >
              <span>عرض كل المجموعات</span>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assignedGroups.map((group) => (
              <div
                key={group.id}
                className="rounded-xl border border-[#234235] bg-[#12231c] p-4 hover:border-[#2f9e6b]/40 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-sm text-white">{group.name}</h4>
                  {group.ageCategory && (
                    <span className="rounded bg-[#234235] px-2 py-0.5 text-[10px] font-semibold text-[#45c387]">
                      {group.ageCategory}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#9bb5a8] mb-3">
                  {group.description || 'فريق تدريبي معتمد بالأكاديمية'}
                </p>
                <div className="flex items-center justify-between text-xs text-[#9bb5a8] pt-3 border-t border-[#234235]">
                  <span>{group.branchName}</span>
                  <Link
                    href={`/groups/${group.id}`}
                    className="text-[#45c387] font-semibold hover:underline flex items-center gap-1"
                  >
                    <span>كشف الفريق</span>
                    <ChevronLeft className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
