'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { canAccessAdminRoutes, getRoleHomeRoute } from '../../../lib/role-routing';
import { AppShell } from '../../../components/layout/AppShell';
import { PageHeader } from '../../../components/ui/PageHeader';
import { api } from '../../../lib/api-client';
import type { AttendanceReportSummary, BranchSummary, TrainingGroupSummary } from '@academy/shared';
import {
  BarChart3,
  Calendar,
  Building2,
  Users,
  Layers,
  Printer,
  RefreshCw,
  CheckCircle2,
  Clock4,
  XCircle,
  HelpCircle,
} from 'lucide-react';

export default function AttendanceReportsPage() {
  const router = useRouter();
  const { user, activeTenant, isLoading } = useAuth();

  const [report, setReport] = useState<AttendanceReportSummary | null>(null);
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [groups, setGroups] = useState<TrainingGroupSummary[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  // Filters
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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

  const loadReportData = useCallback(async () => {
    if (!user || !activeTenant) return;
    setIsFetching(true);
    try {
      const data = await api.attendance.getReports({
        branchId: selectedBranchId || undefined,
        groupId: selectedGroupId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setReport(data);
    } catch (err) {
      console.error('Failed to load attendance report:', err);
    } finally {
      setIsFetching(false);
    }
  }, [user, activeTenant, selectedBranchId, selectedGroupId, dateFrom, dateTo]);

  useEffect(() => {
    if (user && activeTenant) {
      void Promise.all([
        api.branches.list().then(setBranches),
        api.groups.list({ limit: 100 }).then((g) => setGroups(g.items)),
      ]).catch(() => []);
      void loadReportData();
    }
  }, [user, activeTenant, selectedBranchId, selectedGroupId, loadReportData]);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading || !user) {
    return (
      <AppShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-[var(--accent-primary)]" />
            <p className="text-sm font-medium text-[var(--text-muted)]">
              جارٍ تحميل تقارير الحضور...
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  const totalRecords = report?.totalRecords || 0;
  const presentPct =
    totalRecords > 0 ? Math.round(((report?.presentCount || 0) / totalRecords) * 100) : 0;
  const latePct =
    totalRecords > 0 ? Math.round(((report?.lateCount || 0) / totalRecords) * 100) : 0;
  const absentPct =
    totalRecords > 0 ? Math.round(((report?.absentCount || 0) / totalRecords) * 100) : 0;
  const excusedPct =
    totalRecords > 0 ? Math.round(((report?.excusedCount || 0) / totalRecords) * 100) : 0;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={[
            { label: 'الرئيسية', href: '/dashboard' },
            { label: 'جلسات الحضور', href: '/sessions' },
            { label: 'تقارير الحضور والانضباط' },
          ]}
          title="تقارير الحضور والانضباط الرياضي"
          description="تحليل نسب الحضور والالتزام بالتمارين عبر الفروع والمجموعات التدريبية في الفترات المحددة."
          actions={
            <button
              type="button"
              id="btn-print-report"
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-semibold text-[var(--text-main)] hover:border-[var(--accent-primary)] transition-all cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>طباعة التقرير</span>
            </button>
          }
        />

        {/* Filter Controls */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Branch */}
            <select
              id="report-select-branch"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              aria-label="تصفية حسب الفرع"
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
            >
              <option value="">جميع الفروع</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            {/* Group */}
            <select
              id="report-select-group"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              aria-label="تصفية حسب المجموعة"
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
            >
              <option value="">جميع المجموعات</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>

            {/* Date From */}
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="من تاريخ"
              aria-label="من تاريخ"
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
            />

            {/* Date To & Refresh */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="إلى تاريخ"
                aria-label="إلى تاريخ"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
              />

              <button
                type="button"
                id="btn-report-refresh"
                onClick={() => void loadReportData()}
                className="p-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--accent-primary)] transition-colors cursor-pointer"
                title="تحديث البيانات"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isFetching ? 'animate-spin text-[var(--accent-primary)]' : ''}`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* PRIMARY OVERVIEW METRICS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* 1. Overall Attendance Rate */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                نسبة الحضور الإجمالية
              </span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-surface)] text-[var(--accent-primary)]">
                <BarChart3 className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-[var(--text-main)]">
                {report?.attendanceRate || 0}%
              </span>
              <span className="text-xs text-[var(--accent-primary)] font-semibold">
                (حاضر {report?.presentCount || 0} + متأخر {report?.lateCount || 0})
              </span>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-[var(--bg-surface-subtle)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--accent-primary)] transition-all duration-500"
                style={{ width: `${report?.attendanceRate || 0}%` }}
              />
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-2">
              محسوب من السجلات المؤهلة ({report?.eligibleRecords ?? report?.totalRecords ?? 0})،
              باستثناء غير المحدد ({report?.unmarkedCount || 0})
            </p>
          </div>

          {/* 2. Total Sessions */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                إجمالي الحصص المنفذة
              </span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                <Calendar className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-[var(--text-main)]">
                {report?.totalSessions || 0}
              </span>
              <span className="text-xs text-[var(--text-muted)]">حصة تدريبية</span>
            </div>
          </div>

          {/* 3. Total Attendance Records */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                إجمالي عمليات التحضير
              </span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-[var(--text-main)]">
                {report?.totalRecords || 0}
              </span>
              <span className="text-xs text-[var(--text-muted)]">سجل حضور</span>
            </div>
          </div>

          {/* 4. Active Groups Monitored */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                المجموعات المشمولة
              </span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
                <Layers className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-[var(--text-main)]">
                {report?.byGroup?.length || 0}
              </span>
              <span className="text-xs text-[var(--text-muted)]">مجموعة نشطة</span>
            </div>
          </div>
        </div>

        {/* STATUS DISTRIBUTION BREAKDOWN */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-[var(--text-main)]">
            توزيع حالات الحضور الإجمالية
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Present */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-1 text-center">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                حاضر (Present)
              </span>
              <div className="text-2xl font-black text-[var(--text-main)]">
                {report?.presentCount || 0}
              </div>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                {presentPct}% من السجلات
              </span>
            </div>

            {/* Late */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-1 text-center">
              <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center justify-center gap-1">
                <Clock4 className="h-3.5 w-3.5" />
                متأخر (Late)
              </span>
              <div className="text-2xl font-black text-[var(--text-main)]">
                {report?.lateCount || 0}
              </div>
              <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                {latePct}% من السجلات
              </span>
            </div>

            {/* Absent */}
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-1 text-center">
              <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center justify-center gap-1">
                <XCircle className="h-3.5 w-3.5" />
                غائب (Absent)
              </span>
              <div className="text-2xl font-black text-[var(--text-main)]">
                {report?.absentCount || 0}
              </div>
              <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                {absentPct}% من السجلات
              </span>
            </div>

            {/* Excused */}
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 space-y-1 text-center">
              <span className="text-xs text-sky-600 dark:text-sky-400 font-semibold flex items-center justify-center gap-1">
                <HelpCircle className="h-3.5 w-3.5" />
                غياب بعذر (Excused)
              </span>
              <div className="text-2xl font-black text-[var(--text-main)]">
                {report?.excusedCount || 0}
              </div>
              <span className="text-xs text-sky-600 dark:text-sky-400 font-semibold">
                {excusedPct}% من السجلات
              </span>
            </div>
          </div>
        </div>

        {/* PERFORMANCE BY TRAINING GROUP */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[var(--text-main)] flex items-center gap-2">
              <Layers className="h-5 w-5 text-[var(--accent-primary)]" />
              <span>معدل الحضور والانضباط حسب المجموعة التدريبية</span>
            </h3>
          </div>

          {!report?.byGroup || report.byGroup.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-4 text-center">
              لا توجد سجلات حضور للمجموعات في هذه الفترة.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                    <th className="py-3 px-4 font-semibold">المجموعة التدريبية</th>
                    <th className="py-3 px-4 font-semibold">عدد الحصص</th>
                    <th className="py-3 px-4 font-semibold">إجمالي الحضور والغياب</th>
                    <th className="py-3 px-4 font-semibold">نسبة الحضور</th>
                    <th className="py-3 px-4 font-semibold">التقييم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {report.byGroup.map((g, idx) => (
                    <tr key={idx} className="hover:bg-[var(--bg-surface-subtle)] transition-colors">
                      <td className="py-3.5 px-4 font-bold text-[var(--text-main)]">
                        {g.groupName}
                      </td>
                      <td className="py-3.5 px-4 text-[var(--text-muted)]">
                        {g.totalSessions} حصة
                      </td>
                      <td className="py-3.5 px-4 text-[var(--text-muted)]">
                        {g.totalRecords} تسجيل
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[var(--accent-primary)] w-10">
                            {g.attendanceRate}%
                          </span>
                          <div className="h-1.5 w-24 rounded-full bg-[var(--bg-surface-subtle)] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[var(--accent-primary)]"
                              style={{ width: `${g.attendanceRate}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            g.attendanceRate >= 80
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : g.attendanceRate >= 60
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {g.attendanceRate >= 80
                            ? 'ممتاز'
                            : g.attendanceRate >= 60
                              ? 'متوسط'
                              : 'يحتاج متابعة'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* PERFORMANCE BY BRANCH */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[var(--text-main)] flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[var(--accent-primary)]" />
              <span>معدل الحضور حسب الفروع</span>
            </h3>
          </div>

          {!report?.byBranch || report.byBranch.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-4 text-center">
              لا توجد بيانات فروع مسجلة لهذه الفترة.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                    <th className="py-3 px-4 font-semibold">الفرع</th>
                    <th className="py-3 px-4 font-semibold">عدد الحصص</th>
                    <th className="py-3 px-4 font-semibold">إجمالي السجلات</th>
                    <th className="py-3 px-4 font-semibold">نسبة الحضور</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {report.byBranch.map((b) => (
                    <tr
                      key={b.branchId}
                      className="hover:bg-[var(--bg-surface-subtle)] transition-colors"
                    >
                      <td className="py-3.5 px-4 font-bold text-[var(--text-main)]">
                        {b.branchName}
                      </td>
                      <td className="py-3.5 px-4 text-[var(--text-muted)]">{b.totalSessions}</td>
                      <td className="py-3.5 px-4 text-[var(--text-muted)]">{b.totalRecords}</td>
                      <td className="py-3.5 px-4 font-bold text-[var(--accent-primary)]">
                        {b.attendanceRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
