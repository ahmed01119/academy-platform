'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { useLocale } from '../../../lib/locale-context';
import { translateDataString } from '../../../lib/data-translator';
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
  const { locale, t } = useLocale();
  const ar = locale === 'ar';

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
              {ar ? 'جارٍ تحميل تقارير الحضور...' : 'Loading attendance reports...'}
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
            { label: t('common.home', 'الرئيسية'), href: '/dashboard' },
            { label: t('nav.sessions', 'الحصص التدريبية'), href: '/sessions' },
            { label: t('nav.reports', 'تقارير الحضور') },
          ]}
          title={ar ? 'تقارير الحضور والانضباط الرياضي' : 'Attendance & Discipline Reports'}
          description={
            ar
              ? 'تحليل نسب الحضور والالتزام بالتمارين عبر الفروع والمجموعات التدريبية في الفترات المحددة.'
              : 'Detailed breakdown of attendance rates, compliance, and discipline metrics across branches and training groups.'
          }
          actions={
            <button
              type="button"
              id="btn-print-report"
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-semibold text-[var(--text-main)] hover:border-[var(--accent-primary)] transition-all cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>{ar ? 'طباعة التقرير' : 'Print Report'}</span>
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
              aria-label={ar ? 'تصفية حسب الفرع' : 'Filter by branch'}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none cursor-pointer"
            >
              <option value="">{ar ? 'جميع الفروع' : 'All Branches'}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {locale === 'en' ? translateDataString(b.name, 'en') : b.name}
                </option>
              ))}
            </select>

            {/* Group */}
            <select
              id="report-select-group"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              aria-label={ar ? 'تصفية حسب المجموعة' : 'Filter by group'}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none cursor-pointer"
            >
              <option value="">{ar ? 'جميع المجموعات' : 'All Squads & Groups'}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {locale === 'en' ? translateDataString(g.name, 'en') : g.name}
                </option>
              ))}
            </select>

            {/* Date From */}
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder={ar ? 'من تاريخ' : 'From date'}
              aria-label={ar ? 'من تاريخ' : 'From date'}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
            />

            {/* Date To & Refresh */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder={ar ? 'إلى تاريخ' : 'To date'}
                aria-label={ar ? 'إلى تاريخ' : 'To date'}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
              />

              <button
                type="button"
                id="btn-report-refresh"
                onClick={() => void loadReportData()}
                className="p-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--accent-primary)] transition-colors cursor-pointer"
                title={ar ? 'تحديث البيانات' : 'Refresh report data'}
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
                {ar ? 'نسبة الحضور الإجمالية' : 'Overall Attendance Rate'}
              </span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--badge-bg)] text-[var(--accent-primary)]">
                <BarChart3 className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-[var(--text-main)]">
                {report?.attendanceRate || 0}%
              </span>
              <span className="text-xs text-[var(--accent-primary)] font-semibold">
                {ar
                  ? `(حاضر ${report?.presentCount || 0} + متأخر ${report?.lateCount || 0})`
                  : `(Present ${report?.presentCount || 0} + Late ${report?.lateCount || 0})`}
              </span>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-[var(--bg-surface-subtle)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--accent-primary)] transition-all duration-500"
                style={{ width: `${report?.attendanceRate || 0}%` }}
              />
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-2">
              {ar
                ? `محسوب من السجلات المؤهلة (${report?.eligibleRecords ?? report?.totalRecords ?? 0})، باستثناء غير المحدد (${report?.unmarkedCount || 0})`
                : `Calculated from eligible records (${report?.eligibleRecords ?? report?.totalRecords ?? 0}), excluding unmarked (${report?.unmarkedCount || 0})`}
            </p>
          </div>

          {/* 2. Total Sessions */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                {ar ? 'إجمالي الحصص المنفذة' : 'Completed Sessions'}
              </span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                <Calendar className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-[var(--text-main)]">
                {report?.totalSessions || 0}
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                {ar ? 'حصة تدريبية' : 'sessions'}
              </span>
            </div>
          </div>

          {/* 3. Total Attendance Records */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                {ar ? 'إجمالي عمليات التحضير' : 'Total Check-in Events'}
              </span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-[var(--text-main)]">
                {report?.totalRecords || 0}
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                {ar ? 'سجل حضور' : 'records'}
              </span>
            </div>
          </div>

          {/* 4. Active Groups Monitored */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                {ar ? 'المجموعات المشمولة' : 'Monitored Groups'}
              </span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
                <Layers className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-[var(--text-main)]">
                {report?.byGroup?.length || 0}
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                {ar ? 'مجموعة نشطة' : 'active groups'}
              </span>
            </div>
          </div>
        </div>

        {/* STATUS DISTRIBUTION BREAKDOWN */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-[var(--text-main)]">
            {ar ? 'توزيع حالات الحضور الإجمالية' : 'Attendance Status Distribution'}
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Present */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-1 text-center">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {ar ? 'حاضر (Present)' : 'Present'}
              </span>
              <div className="text-2xl font-black text-[var(--text-main)]">
                {report?.presentCount || 0}
              </div>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                {ar ? `${presentPct}% من السجلات` : `${presentPct}% of records`}
              </span>
            </div>

            {/* Late */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-1 text-center">
              <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center justify-center gap-1">
                <Clock4 className="h-3.5 w-3.5" />
                {ar ? 'متأخر (Late)' : 'Late'}
              </span>
              <div className="text-2xl font-black text-[var(--text-main)]">
                {report?.lateCount || 0}
              </div>
              <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                {ar ? `${latePct}% من السجلات` : `${latePct}% of records`}
              </span>
            </div>

            {/* Absent */}
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-1 text-center">
              <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center justify-center gap-1">
                <XCircle className="h-3.5 w-3.5" />
                {ar ? 'غائب (Absent)' : 'Absent'}
              </span>
              <div className="text-2xl font-black text-[var(--text-main)]">
                {report?.absentCount || 0}
              </div>
              <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                {ar ? `${absentPct}% من السجلات` : `${absentPct}% of records`}
              </span>
            </div>

            {/* Excused */}
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 space-y-1 text-center">
              <span className="text-xs text-sky-600 dark:text-sky-400 font-semibold flex items-center justify-center gap-1">
                <HelpCircle className="h-3.5 w-3.5" />
                {ar ? 'غياب بعذر (Excused)' : 'Excused'}
              </span>
              <div className="text-2xl font-black text-[var(--text-main)]">
                {report?.excusedCount || 0}
              </div>
              <span className="text-xs text-sky-600 dark:text-sky-400 font-semibold">
                {ar ? `${excusedPct}% من السجلات` : `${excusedPct}% of records`}
              </span>
            </div>
          </div>
        </div>

        {/* PERFORMANCE BY TRAINING GROUP */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[var(--text-main)] flex items-center gap-2">
              <Layers className="h-5 w-5 text-[var(--accent-primary)]" />
              <span>
                {ar
                  ? 'معدل الحضور والانضباط حسب المجموعة التدريبية'
                  : 'Attendance & Compliance by Training Group'}
              </span>
            </h3>
          </div>

          {!report?.byGroup || report.byGroup.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-4 text-center">
              {ar
                ? 'لا توجد سجلات حضور للمجموعات في هذه الفترة.'
                : 'No attendance records found for squads during this time window.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                    <th className="py-3 px-4 font-semibold text-start">
                      {ar ? 'المجموعة التدريبية' : 'Training Group'}
                    </th>
                    <th className="py-3 px-4 font-semibold text-start">
                      {ar ? 'عدد الحصص' : 'Sessions'}
                    </th>
                    <th className="py-3 px-4 font-semibold text-start">
                      {ar ? 'إجمالي الحضور والغياب' : 'Total Check-ins'}
                    </th>
                    <th className="py-3 px-4 font-semibold text-start">
                      {ar ? 'نسبة الحضور' : 'Rate'}
                    </th>
                    <th className="py-3 px-4 font-semibold text-start">
                      {ar ? 'التقييم' : 'Performance'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {report.byGroup.map((g, idx) => (
                    <tr key={idx} className="hover:bg-[var(--bg-surface-subtle)] transition-colors">
                      <td className="py-3.5 px-4 font-bold text-[var(--text-main)]">
                        {locale === 'en' ? translateDataString(g.groupName, 'en') : g.groupName}
                      </td>
                      <td className="py-3.5 px-4 text-[var(--text-muted)]">
                        {g.totalSessions} {ar ? 'حصة' : 'sessions'}
                      </td>
                      <td className="py-3.5 px-4 text-[var(--text-muted)]">
                        {g.totalRecords} {ar ? 'تسجيل' : 'records'}
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
                            ? ar
                              ? 'ممتاز'
                              : 'Excellent'
                            : g.attendanceRate >= 60
                              ? ar
                                ? 'متوسط'
                                : 'Average'
                              : ar
                                ? 'يحتاج متابعة'
                                : 'Needs Attention'}
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
              <span>{ar ? 'معدل الحضور حسب الفروع' : 'Attendance Rate by Branch'}</span>
            </h3>
          </div>

          {!report?.byBranch || report.byBranch.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-4 text-center">
              {ar
                ? 'لا توجد بيانات فروع مسجلة لهذه الفترة.'
                : 'No branch attendance data recorded for this period.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                    <th className="py-3 px-4 font-semibold text-start">
                      {ar ? 'الفرع' : 'Branch'}
                    </th>
                    <th className="py-3 px-4 font-semibold text-start">
                      {ar ? 'عدد الحصص' : 'Sessions'}
                    </th>
                    <th className="py-3 px-4 font-semibold text-start">
                      {ar ? 'إجمالي السجلات' : 'Total Records'}
                    </th>
                    <th className="py-3 px-4 font-semibold text-start">
                      {ar ? 'نسبة الحضور' : 'Rate'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {report.byBranch.map((b) => (
                    <tr
                      key={b.branchId}
                      className="hover:bg-[var(--bg-surface-subtle)] transition-colors"
                    >
                      <td className="py-3.5 px-4 font-bold text-[var(--text-main)]">
                        {locale === 'en' ? translateDataString(b.branchName, 'en') : b.branchName}
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
