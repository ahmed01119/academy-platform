'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useLocale } from '@/contexts/locale-context';
import { apiClient } from '@/api/client';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader, StatCard, EmptyState, StatusBadge } from '../../components/ui';
import { PageSkeleton } from '@/components/ui/skeleton';
import {
  UserCheck,
  CalendarCheck,
  Users,
  Award,
  Clock,
  Play,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Calendar,
  UserPlus,
} from 'lucide-react';
import type { SessionSummary, TrainingGroupSummary } from '@academy/shared';

interface CoachCacheData {
  todaySessions: SessionSummary[];
  assignedGroups: TrainingGroupSummary[];
}

function getStoredCoachCache(cacheKey: string): CoachCacheData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(cacheKey);
    return raw ? (JSON.parse(raw) as CoachCacheData) : null;
  } catch {
    return null;
  }
}

export default function CoachWorkspacePage() {
  const { user, activeTenant, isLoading: authLoading } = useAuth();
  const { locale, isRtl } = useLocale();
  const router = useRouter();

  const cacheKey = user ? `sportexus_coach_${user.id}` : 'sportexus_coach';
  // Client-safe state initialization to prevent React hydration mismatch (#418)
  const [cachedData, setCachedData] = useState<CoachCacheData | null>(null);
  const [todaySessions, setTodaySessions] = useState<SessionSummary[]>([]);
  const [assignedGroups, setAssignedGroups] = useState<TrainingGroupSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Hydrate cache on client mount
  useEffect(() => {
    const cached = getStoredCoachCache(cacheKey);
    if (cached) {
      setCachedData(cached);
      if (cached.todaySessions.length > 0) setTodaySessions(cached.todaySessions);
      if (cached.assignedGroups.length > 0) setAssignedGroups(cached.assignedGroups);
      setIsLoading(false);
    }
  }, [cacheKey]);

  const loadCoachData = React.useCallback(async () => {
    if (!cachedData) {
      setIsLoading(true);
    }
    try {
      const todayStr = new Date().toISOString().split('T')[0]!;
      const [sessionsRes, groupsRes] = await Promise.all([
        apiClient.attendance
          .listSessions({ dateFrom: todayStr, dateTo: todayStr })
          .catch(() => ({ items: [] })),
        apiClient.groups.list().catch(() => ({ items: [] })),
      ]);
      const nextSessions = sessionsRes.items || [];
      const nextGroups = groupsRes.items || [];
      setTodaySessions(nextSessions);
      setAssignedGroups(nextGroups);

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(
            cacheKey,
            JSON.stringify({
              todaySessions: nextSessions,
              assignedGroups: nextGroups,
            }),
          );
        } catch {
          // Ignore
        }
      }
    } catch {
      // Handled gracefully
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey, cachedData]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user) {
      void loadCoachData();
    }
  }, [user, authLoading, router, loadCoachData]);

  const ChevronIcon = isRtl ? ChevronLeft : ChevronRight;

  if (authLoading || isLoading) {
    return (
      <AppShell>
        <PageSkeleton hasStats statsCount={3} variant="list" hasFilters />
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumbs={[{ label: locale === 'ar' ? 'مساحة عمل المدرب' : 'Coach Workspace' }]}>
      <div className="space-y-8">
        {/* Welcome Coach Header */}
        <PageHeader
          title={
            locale === 'ar'
              ? `مساحة المدرب: كابتن ${user?.name || ''} ⚽`
              : `Coach Workspace: ${user?.name || ''} ⚽`
          }
          description={
            locale === 'ar'
              ? 'إدارة الحصص التدريبية اليومية، التحضير الفوري بالباركود، وتقييم أداء وتطور اللاعبين ميدانياً.'
              : 'Manage daily training sessions, quick barcode attendance, and on-field player performance evaluation.'
          }
          icon={UserCheck}
          badge={
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)] bg-(--accent-primary)/10 px-3 py-1 rounded-full border border-[var(--accent-primary)]/20">
              {activeTenant?.tenantName || (locale === 'ar' ? 'الأكاديمية' : 'Academy')}
            </span>
          }
          actions={
            <div className="flex items-center gap-3">
              <Link
                href="/evaluations"
                className="flex items-center gap-2 rounded-xl bg-(--accent-primary) px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[var(--accent-primary)]/20 hover:opacity-90 transition-all"
              >
                <Award className="h-4 w-4" />
                <span>{locale === 'ar' ? 'تقييمات اللاعبين' : 'Player Evaluations'}</span>
              </Link>
              <Link
                href="/players?tab=applications"
                className="flex items-center gap-2 rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] px-4 py-2.5 text-sm font-semibold text-(--text-main) hover:border-[var(--accent-primary)] hover:text-(--accent-primary) transition-all"
              >
                <UserPlus className="h-4 w-4 text-[var(--accent-primary)]" />
                <span>{locale === 'ar' ? 'طلبات الانضمام' : 'Join Requests'}</span>
              </Link>
              <Link
                href="/sessions"
                className="flex items-center gap-2 rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] px-4 py-2.5 text-sm font-semibold text-(--text-main) hover:border-[var(--accent-primary)] hover:text-(--accent-primary) transition-all"
              >
                <CalendarCheck className="h-4 w-4 text-[var(--accent-primary)]" />
                <span>{locale === 'ar' ? 'جدول الحصص' : 'Sessions Schedule'}</span>
              </Link>
            </div>
          }
        />

        {/* Quick Stat Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title={locale === 'ar' ? 'حصص اليوم الميدانية' : "Today's Sessions"}
            value={todaySessions.length}
            icon={CalendarCheck}
            subtitle={
              locale === 'ar'
                ? 'حصص تدريبية مبرمجة لليوم في الفروع'
                : 'Training sessions scheduled today across branches'
            }
          />
          <StatCard
            title={locale === 'ar' ? 'فرق التدريب المعتمدة' : 'Assigned Training Groups'}
            value={assignedGroups.length}
            icon={Users}
            subtitle={
              locale === 'ar'
                ? 'مجموعات وفئات عمرية مسندة إليك'
                : 'Groups and age categories assigned to you'
            }
          />
          <StatCard
            title={
              locale === 'ar' ? 'الذكاء الرياضي والتطوير' : 'Sports Intelligence & Development'
            }
            value={locale === 'ar' ? '4 محاور' : '4 Pillars'}
            icon={Award}
            subtitle={
              locale === 'ar'
                ? 'فني، تكتيكي، بدني وسلوكي'
                : 'Technical, Tactical, Physical & Behavioral'
            }
          />
        </div>

        {/* Section 1: Today's Training Sessions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-(--text-main) flex items-center gap-2">
              <Clock className="h-5 w-5 text-[var(--accent-primary)]" />
              <span>
                {locale === 'ar' ? 'جدول حصص اليوم التدريبية' : "Today's Training Schedule"}
              </span>
            </h2>
            <Link
              href="/sessions"
              className="text-xs font-semibold text-[var(--accent-primary)] hover:underline flex items-center gap-1"
            >
              <span>{locale === 'ar' ? 'عرض كل الحصص' : 'View All Sessions'}</span>
              <ChevronIcon className="h-3.5 w-3.5" />
            </Link>
          </div>

          {todaySessions.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title={
                locale === 'ar'
                  ? 'لا توجد حصص تدريبية مجدولة لليوم'
                  : 'No training sessions scheduled today'
              }
              description={
                locale === 'ar'
                  ? 'يمكنك الاطلاع على جدول الحصص القادمة أو مراجعة الحصص المسجلة عبر صفحة الحصص.'
                  : 'You can view upcoming sessions or review recorded sessions in the sessions page.'
              }
              action={
                <Link
                  href="/sessions"
                  className="inline-flex items-center gap-2 rounded-xl bg-(--accent-primary) px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-all"
                >
                  <Calendar className="h-4 w-4" />
                  <span>{locale === 'ar' ? 'الانتقال لجدول الحصص' : 'Go to Sessions'}</span>
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {todaySessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] p-5 hover:border-[var(--accent-primary)]/50 transition-all flex flex-col justify-between shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-(--text-main)">
                        {session.groupName}
                      </span>
                      <StatusBadge status={session.status} />
                    </div>

                    <div className="text-xs text-(--text-muted) flex items-center gap-4 mb-4">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {session.startTime} - {session.endTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {session.branchName}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-(--border-subtle)">
                    <Link
                      href={`/attendance/sessions/${session.id}`}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-(--accent-primary) px-3 py-2 text-xs font-semibold text-white hover:opacity-90 transition-all shadow-sm"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>{locale === 'ar' ? 'بدء تحضير الحضور' : 'Take Attendance'}</span>
                    </Link>
                    <Link
                      href={`/evaluations?sessionId=${session.id}`}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-(--border-subtle) bg-(--bg-base)px-3 py-2 text-xs font-semibold text-(--text-main) hover:border-[var(--accent-primary)] hover:text-(--accent-primary) transition-all"
                    >
                      <Award className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                      <span>{locale === 'ar' ? 'تقييم اللاعبين' : 'Evaluate Players'}</span>
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
            <h2 className="text-lg font-bold text-(--text-main) flex items-center gap-2">
              <Users className="h-5 w-5 text-[var(--accent-primary)]" />
              <span>
                {locale === 'ar' ? 'المجموعات والفرق المسندة' : 'Assigned Groups & Teams'}
              </span>
            </h2>
            <Link
              href="/groups"
              className="text-xs font-semibold text-[var(--accent-primary)] hover:underline flex items-center gap-1"
            >
              <span>{locale === 'ar' ? 'عرض كل المجموعات' : 'View All Groups'}</span>
              <ChevronIcon className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assignedGroups.map((group) => (
              <div
                key={group.id}
                className="rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] p-4 hover:border-[var(--accent-primary)]/40 transition-colors shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-sm text-(--text-main)">{group.name}</h4>
                  {group.ageCategory && (
                    <span className="rounded bg-(--accent-primary)/10 border border-[var(--accent-primary)]/20 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-primary)]">
                      {group.ageCategory}
                    </span>
                  )}
                </div>
                <p className="text-xs text-(--text-muted) mb-3">
                  {group.description ||
                    (locale === 'ar' ? 'فريق تدريبي معتمد بالأكاديمية' : 'Certified training team')}
                </p>
                <div className="flex items-center justify-between text-xs text-(--text-muted) pt-3 border-t border-(--border-subtle)">
                  <span>{group.branchName}</span>
                  <Link
                    href={`/groups/${group.id}`}
                    className="text-[var(--accent-primary)] font-semibold hover:underline flex items-center gap-1"
                  >
                    <span>{locale === 'ar' ? 'كشف الفريق' : 'View Roster'}</span>
                    <ChevronIcon className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
