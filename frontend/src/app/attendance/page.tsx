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
  const { isRtl } = useLocale();

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
            { label: 'الرئيسية', href: '/dashboard' },
            { label: 'إدارة الحضور والغياب' },
          ]}
          title="منظومة الحضور والغياب الميداني"
          description="تسجيل الحضور السريع، المسح الذكي لبطاقات QR، ومطابقة التحصيلات المالية الميدانية."
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
                فوري وبنقرة واحدة
              </span>
            </div>
            <h3 className="text-lg font-bold text-[var(--text-main)] mb-2 group-hover:text-emerald-600 transition-colors">
              التحضير السريع (Quick Attendance)
            </h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-4">
              تسجيل كشف الحضور بنقرة واحدة لجميع اللاعبين، تبديل الحالة فورياً، وحفظ أوفلاين مع
              المزامنة التلقائية.
            </p>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <span>بدء التحضير الفوري</span>
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
                كاميرا الهاتف
              </span>
            </div>
            <h3 className="text-lg font-bold text-[var(--text-main)] mb-2 group-hover:text-blue-600 transition-colors">
              ماسح باركود QR الذكي
            </h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-4">
              مسح فوري لبطاقات وهوية اللاعبين، التحقق من سريان الاشتراك والرسوم المتأخرة، مع مؤشرات
              صوتية وتنبيهات.
            </p>
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
              <span>تشغيل ماسح الكاميرا</span>
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
                تقارير وإحصائيات
              </span>
            </div>
            <h3 className="text-lg font-bold text-[var(--text-main)] mb-2 group-hover:text-purple-600 transition-colors">
              تقارير الحضور والالتزام
            </h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-4">
              تحليلات نسب الحضور والغياب، مقارنة الفروع والمجموعات، وسجل تفصيلي قابل للطباعة
              والتصدير.
            </p>
            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400">
              <span>عرض تقارير الحضور</span>
              <ArrowIcon className="h-4 w-4 transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>

        {/* Today's Sessions Section */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Calendar className="h-5 w-5 text-[var(--accent-primary)]" />
              <h3 className="text-base font-bold text-[var(--text-main)]">حصص اليوم التدريبية</h3>
            </div>
            <Link
              href="/sessions"
              className="text-xs font-bold text-[var(--accent-primary)] hover:underline"
            >
              عرض جدول الحصص الكامل
            </Link>
          </div>

          {isFetching ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)]">
              جارٍ تحميل جدول الحصص...
            </div>
          ) : todaySessions.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)] space-y-3">
              <p>لا توجد حصص مجدولة لهذا اليوم.</p>
              <Link
                href="/sessions"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-bold text-white shadow-sm"
              >
                <span>جدولة حصة جديدة</span>
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
                        ? 'جارية'
                        : s.status === 'SCHEDULED'
                          ? 'مجدولة'
                          : 'مغلقة'}
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
                        <span>المدرب: {s.coachName}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
                    <span className="text-[11px] text-[var(--text-muted)]">
                      حاضر: {s.totalPresent} / {s.totalExpected}
                    </span>
                    <Link
                      href={`/attendance/sessions/${s.id}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-primary)]/10 px-3 py-1.5 text-xs font-bold text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-white transition-all"
                    >
                      <span>فتح الكشف</span>
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
