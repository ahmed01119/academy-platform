'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { useLocale } from '../../lib/locale-context';
import { apiClient } from '../../lib/api-client';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader, StatCard, EmptyState, StatusBadge } from '../../components/ui';
import {
  UserCheck,
  CalendarCheck,
  Users,
  Award,
  Clock,
  Play,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  MapPin,
  Calendar,
} from 'lucide-react';
import type { SessionSummary, TrainingGroupSummary } from '@academy/shared';

export default function CoachWorkspacePage() {
  const { user, activeTenant, isLoading: authLoading } = useAuth();
  const { t, isRtl } = useLocale();
  const router = useRouter();

  const [todaySessions, setTodaySessions] = useState<SessionSummary[]>([]);
  const [assignedGroups, setAssignedGroups] = useState<TrainingGroupSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCoachData = async () => {
    setIsLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0]!;
      const [sessionsRes, groupsRes] = await Promise.all([
        apiClient.attendance
          .listSessions({ dateFrom: todayStr, dateTo: todayStr })
          .catch(() => ({ items: [] })),
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

  const ChevronIcon = isRtl ? ChevronLeft : ChevronRight;

  if (authLoading || isLoading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-[var(--brand-primary)]" />
            <p className="text-sm text-[var(--text-muted)]">
              {t('common.loading', 'جارٍ تحميل مساحة عمل المدرب...')}
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumbs={[{ label: t('nav.coachWorkspace', 'مساحة عمل المدرب') }]}>
      <div className="space-y-8">
        {/* Welcome Coach Header */}
        <PageHeader
          title={`مساحة المدرب: كابتن ${user?.name || ''} ⚽`}
          description="إدارة الحصص التدريبية اليومية، التحضير الفوري بالباركود، وتقييم أداء وتطور اللاعبين ميدانياً."
          icon={UserCheck}
          badge={
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--brand-primary)] bg-[var(--brand-primary)]/10 px-3 py-1 rounded-full border border-[var(--brand-primary)]/20">
              {activeTenant?.tenantName || 'الأكاديمية'}
            </span>
          }
          actions={
            <div className="flex items-center gap-3">
              <Link
                href="/evaluations"
                className="flex items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[var(--brand-primary)]/20 hover:opacity-90 transition-all"
              >
                <Award className="h-4 w-4" />
                <span>تقييمات اللاعبين</span>
              </Link>
              <Link
                href="/sessions"
                className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text-main)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-all"
              >
                <CalendarCheck className="h-4 w-4 text-[var(--brand-primary)]" />
                <span>جدول الحصص</span>
              </Link>
            </div>
          }
        />

        {/* Quick Stat Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="حصص اليوم الميدانية"
            value={todaySessions.length}
            icon={CalendarCheck}
            subtitle="حصص تدريبية مبرمجة لليوم في الفروع"
          />
          <StatCard
            title="فرق التدريب المعتمدة"
            value={assignedGroups.length}
            icon={Users}
            subtitle="مجموعات وفئات عمرية مسندة إليك"
          />
          <StatCard
            title="الذكاء الرياضي والتطوير"
            value="4 محاور"
            icon={Award}
            subtitle="فني، تكتيكي، بدني وسلوكي"
          />
        </div>

        {/* Section 1: Today's Training Sessions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
              <Clock className="h-5 w-5 text-[var(--brand-primary)]" />
              <span>جدول حصص اليوم التدريبية</span>
            </h2>
            <Link
              href="/sessions"
              className="text-xs font-semibold text-[var(--brand-primary)] hover:underline flex items-center gap-1"
            >
              <span>عرض كل الحصص</span>
              <ChevronIcon className="h-3.5 w-3.5" />
            </Link>
          </div>

          {todaySessions.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title="لا توجد حصص تدريبية مجدولة لليوم"
              description="يمكنك الاطلاع على جدول الحصص القادمة أو مراجعة الحصص المسجلة عبر صفحة الحصص."
              action={
                <Link
                  href="/sessions"
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-all"
                >
                  <Calendar className="h-4 w-4" />
                  <span>الانتقال لجدول الحصص</span>
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {todaySessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 hover:border-[var(--brand-primary)]/50 transition-all flex flex-col justify-between shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-[var(--text-main)]">
                        {session.groupName}
                      </span>
                      <StatusBadge
                        status={session.status}
                        label={
                          session.status === 'IN_PROGRESS'
                            ? 'جارية الآن'
                            : session.status === 'CLOSED'
                              ? 'مكتملة'
                              : 'مجدولة'
                        }
                      />
                    </div>

                    <div className="text-xs text-[var(--text-muted)] flex items-center gap-4 mb-4">
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

                  <div className="flex items-center gap-2 pt-3 border-t border-[var(--border-subtle)]">
                    <Link
                      href={`/attendance/sessions/${session.id}`}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 transition-all shadow-sm"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>بدء تحضير الحضور</span>
                    </Link>
                    <Link
                      href={`/evaluations?sessionId=${session.id}`}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs font-semibold text-[var(--text-main)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-all"
                    >
                      <Award className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
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
            <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
              <Users className="h-5 w-5 text-[var(--brand-primary)]" />
              <span>المجموعات والفرق المسندة</span>
            </h2>
            <Link
              href="/groups"
              className="text-xs font-semibold text-[var(--brand-primary)] hover:underline flex items-center gap-1"
            >
              <span>عرض كل المجموعات</span>
              <ChevronIcon className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assignedGroups.map((group) => (
              <div
                key={group.id}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 hover:border-[var(--brand-primary)]/40 transition-colors shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-sm text-[var(--text-main)]">{group.name}</h4>
                  {group.ageCategory && (
                    <span className="rounded bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/20 px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-primary)]">
                      {group.ageCategory}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)] mb-3">
                  {group.description || 'فريق تدريبي معتمد بالأكاديمية'}
                </p>
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-3 border-t border-[var(--border-subtle)]">
                  <span>{group.branchName}</span>
                  <Link
                    href={`/groups/${group.id}`}
                    className="text-[var(--brand-primary)] font-semibold hover:underline flex items-center gap-1"
                  >
                    <span>كشف الفريق</span>
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
