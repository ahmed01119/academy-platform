'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/ui/PageHeader';
import { api } from '../../lib/api-client';
import type { SessionSummary } from '@academy/shared';
import {
  QrCode,
  Calendar,
  BarChart3,
  Clock,
  Building2,
  Users,
  ArrowRight,
  ArrowLeft,
  Zap,
} from 'lucide-react';
import { useLocale } from '../../lib/locale-context';

export default function AttendanceHubPage() {
  const router = useRouter();
  const { user, activeTenant, isLoading } = useAuth();
  const { locale, isRtl } = useLocale();

  const [todaySessions, setTodaySessions] = useState<SessionSummary[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    async function loadSessions() {
      if (!user || !activeTenant) return;
      setIsFetching(true);
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const res = await api.attendance.listSessions({ dateFrom: todayStr, dateTo: todayStr });
        setTodaySessions(res?.items || []);
      } catch (err) {
        console.error('Failed to load today sessions:', err);
      } finally {
        setIsFetching(false);
      }
    }
    loadSessions();
  }, [user, activeTenant]);

  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={[
            { label: locale === 'ar' ? 'الرئيسية' : 'Home', href: '/dashboard' },
            { label: locale === 'ar' ? 'إدارة الحضور والغياب' : 'Attendance Management' },
          ]}
          title={locale === 'ar' ? 'منظومة الحضور والغياب الميداني' : 'Field Attendance System'}
          description={locale === 'ar' ? 'تسجيل الحضور السريع، المسح الذكي لبطاقات QR، ومطابقة التحصيلات المالية الميدانية.' : 'Quick attendance recording, smart QR card scanning, and on-site fee reconciliation.'}
        />

        {/* Feature Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Quick Attendance */}
          <Link
            href="/attendance/quick"
            id="card-quick-attendance"
            className="group relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-[var(--bg-surface)] to-[var(--bg-surface)] p-6 shadow-sm hover:shadow-md hover:border-emerald-500/40 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <Zap className="h-6 w-6" />
              </div>
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {locale === 'ar' ? 'فوري وبنقرة واحدة' : 'One-tap instant'}
              </span>
            </div>
            <h3 className="text-lg font-bold text-[var(--text-main)] mb-2 group-hover:text-emerald-600 transition-colors">
              {locale === 'ar' ? 'التحضير السريع (Quick Attendance)' : 'Quick Attendance'}
            </h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-4">
              {locale === 'ar'
                ? 'تسجيل كشف الحضور بنقرة واحدة لجميع اللاعبين، تبديل الحالة فورياً، وحفظ أوفلاين مع المزامنة التلقائية.'
                : 'One-tap attendance marking for all players, instant status toggle, offline-first with auto-sync.'}
            </p>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <span>{locale === 'ar' ? 'بدء التحضير الفوري' : 'Start Quick Attendance'}</span>
              <ArrowIcon className="h-4 w-4 transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* QR Scanner */}
          <Link
            href="/attendance/scanner"
            id="card-scanner"
            className="group relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-[var(--bg-surface)] to-[var(--bg-surface)] p-6 shadow-sm hover:shadow-md hover:border-blue-500/40 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400">
                <QrCode className="h-6 w-6" />
              </div>
              <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                {locale === 'ar' ? 'كاميرا الهاتف' : 'Phone Camera'}
              </span>
            </div>
            <h3 className="text-lg font-bold text-[var(--text-main)] mb-2 group-hover:text-blue-600 transition-colors">
              {locale === 'ar' ? 'ماسح باركود QR الذكي' : 'Smart QR Scanner'}
            </h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-4">
              {locale === 'ar'
                ? 'مسح فوري لبطاقات وهوية اللاعبين، التحقق من سريان الاشتراك والرسوم المتأخرة، مع مؤشرات صوتية وتنبيهات.'
                : 'Instant scan of player ID cards, subscription & fee verification, with audio cues and alerts.'}
            </p>
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
              <span>{locale === 'ar' ? 'تشغيل ماسح الكاميرا' : 'Open Camera Scanner'}</span>
              <ArrowIcon className="h-4 w-4 transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Reports & Analytics */}
          <Link
            href="/attendance/reports"
            id="card-reports"
            className="group relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-[var(--bg-surface)] to-[var(--bg-surface)] p-6 shadow-sm hover:shadow-md hover:border-purple-500/40 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400">
                <BarChart3 className="h-6 w-6" />
              </div>
              <span className="rounded-full bg-purple-500/15 px-3 py-1 text-xs font-bold text-purple-600 dark:text-purple-400 border border-purple-500/20">
                {locale === 'ar' ? 'تقارير وإحصائيات' : 'Reports & Analytics'}
              </span>
            </div>
            <h3 className="text-lg font-bold text-[var(--text-main)] mb-2 group-hover:text-purple-600 transition-colors">
              {locale === 'ar' ? 'تقارير الحضور والالتزام' : 'Attendance & Commitment Reports'}
            </h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-4">
              {locale === 'ar'
                ? 'تحليلات نسب الحضور والغياب، مقارنة الفروع والمجموعات، وسجل تفصيلي قابل للطباعة والتصدير.'
                : 'Attendance rate analytics by branch and group, with detailed printable and exportable records.'}
            </p>
            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400">
              <span>{locale === 'ar' ? 'عرض تقارير الحضور' : 'View Attendance Reports'}</span>
              <ArrowIcon className="h-4 w-4 transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>

        {/* Today's Sessions Section */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Calendar className="h-5 w-5 text-[var(--accent-primary)]" />
              <h3 className="text-base font-bold text-[var(--text-main)]">
                {locale === 'ar' ? 'حصص اليوم التدريبية' : "Today's Training Sessions"}
              </h3>
            </div>
            <Link
              href="/sessions"
              className="text-xs font-bold text-[var(--accent-primary)] hover:underline"
            >
              {locale === 'ar' ? 'عرض جدول الحصص الكامل' : 'View Full Session Schedule'}
            </Link>
          </div>

          {isFetching ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)]">
              {locale === 'ar' ? 'جارٍ تحميل جدول الحصص...' : 'Loading sessions...'}
            </div>
          ) : todaySessions.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)] space-y-3">
              <p>{locale === 'ar' ? 'لا توجد حصص مجدولة لهذا اليوم.' : 'No sessions scheduled for today.'}</p>
              <Link
                href="/sessions"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-bold text-white shadow-sm"
              >
                <span>{locale === 'ar' ? 'جدولة حصة جديدة' : 'Schedule New Session'}</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {todaySessions.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4 space-y-3 hover:border-[var(--accent-primary)] transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[var(--text-main)]">{s.groupName}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                        s.status === 'IN_PROGRESS'
                          ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                          : s.status === 'SCHEDULED'
                            ? 'bg-blue-500/15 text-blue-600 border-blue-500/30'
                            : 'bg-slate-500/15 text-slate-500 border-slate-500/30'
                      }`}
                    >
                      {s.status === 'IN_PROGRESS'
                        ? locale === 'ar' ? 'جارية' : 'In Progress'
                        : s.status === 'SCHEDULED'
                          ? locale === 'ar' ? 'مجدولة' : 'Scheduled'
                          : locale === 'ar' ? 'مغلقة' : 'Closed'}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-[var(--text-muted)]">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                      <span>{s.branchName}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                      <span>
                        {s.startTime} - {s.endTime}
                      </span>
                    </div>
                    {s.coachName && (
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                        <span>{locale === 'ar' ? 'المدرب: ' : 'Coach: '}{s.coachName}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {locale === 'ar' ? 'حاضر: ' : 'Present: '}{s.totalPresent} / {s.totalExpected}
                    </span>
                    <Link
                      href={`/attendance/sessions/${s.id}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-primary)]/10 px-3 py-1.5 text-xs font-bold text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-white transition-all"
                    >
                      <span>{locale === 'ar' ? 'فتح الكشف' : 'Open Roster'}</span>
                      <ArrowIcon className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
