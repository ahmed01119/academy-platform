'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { Navbar } from '../../../components/Navbar';
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
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

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
      <div className="min-h-screen bg-[#0f1c18] flex items-center justify-center text-[#9bb5a8]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-[#2f9e6b]" />
          <p className="text-sm font-medium">جارٍ تحميل تقارير الحضور...</p>
        </div>
      </div>
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
    <div className="min-h-screen bg-[#0f1c18] text-[#e8f0ec] flex flex-col font-sans pb-16">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#234235] pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#45c387] bg-[#2f9e6b]/15 px-2.5 py-1 rounded-full border border-[#2f9e6b]/30">
                <BarChart3 className="h-3.5 w-3.5" />
                تحليلات الأداء التشغيلي
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              تقارير الحضور والانضباط الرياضي
            </h1>
            <p className="text-sm text-[#9bb5a8]">
              تحليل نسب الحضور والالتزام بالتمارين عبر الفروع والمجموعات التدريبية في الفترات
              المحددة.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              id="btn-print-report"
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-xl border border-[#2b4c3e] bg-[#162821] px-4 py-2.5 text-xs font-semibold text-[#e8f0ec] hover:border-[#2f9e6b] transition-all cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>طباعة التقرير</span>
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-4 shadow-lg backdrop-blur-md">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Branch */}
            <select
              id="report-select-branch"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              aria-label="تصفية حسب الفرع"
              className="rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3 py-2 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
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
              className="rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3 py-2 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
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
              className="rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3 py-2 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
            />

            {/* Date To & Refresh */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="إلى تاريخ"
                aria-label="إلى تاريخ"
                className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3 py-2 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
              />

              <button
                type="button"
                id="btn-report-refresh"
                onClick={() => void loadReportData()}
                className="p-2 rounded-xl border border-[#2b4c3e] bg-[#12231c] text-[#9bb5a8] hover:text-white hover:border-[#2f9e6b] transition-colors cursor-pointer"
                title="تحديث البيانات"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* PRIMARY OVERVIEW METRICS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* 1. Overall Attendance Rate */}
          <div className="rounded-2xl border border-[#234235] bg-gradient-to-br from-[#162821] to-[#12231c] p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[#9bb5a8]">نسبة الحضور الإجمالية</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2f9e6b]/20 text-[#45c387]">
                <BarChart3 className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-white">
                {report?.attendanceRate || 0}%
              </span>
              <span className="text-xs text-[#45c387] font-semibold">
                (حاضر {report?.presentCount || 0} + متأخر {report?.lateCount || 0})
              </span>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-[#0f1c18] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#2f9e6b] transition-all duration-500"
                style={{ width: `${report?.attendanceRate || 0}%` }}
              />
            </div>
            <p className="text-[11px] text-[#9bb5a8] mt-2">
              محسوب من السجلات المؤهلة ({report?.eligibleRecords ?? report?.totalRecords ?? 0})، باستثناء غير المحدد ({report?.unmarkedCount || 0})
            </p>
          </div>

          {/* 2. Total Sessions */}
          <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[#9bb5a8]">إجمالي الحصص المنفذة</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3b82f6]/15 text-[#60a5fa]">
                <Calendar className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-white">
                {report?.totalSessions || 0}
              </span>
              <span className="text-xs text-[#9bb5a8]">حصة تدريبية</span>
            </div>
          </div>

          {/* 3. Total Attendance Records */}
          <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[#9bb5a8]">إجمالي عمليات التحضير</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eab308]/15 text-[#facc15]">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-white">
                {report?.totalRecords || 0}
              </span>
              <span className="text-xs text-[#9bb5a8]">سجل حضور</span>
            </div>
          </div>

          {/* 4. Active Groups Monitored */}
          <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[#9bb5a8]">المجموعات المشمولة</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8b5cf6]/15 text-[#a78bfa]">
                <Layers className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-white">
                {report?.byGroup?.length || 0}
              </span>
              <span className="text-xs text-[#9bb5a8]">مجموعة نشطة</span>
            </div>
          </div>
        </div>

        {/* STATUS DISTRIBUTION BREAKDOWN */}
        <div className="rounded-2xl border border-[#234235] bg-[#162821]/90 p-6 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-white">توزيع حالات الحضور الإجمالية</h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Present */}
            <div className="rounded-xl border border-[#2f9e6b]/30 bg-[#2f9e6b]/10 p-4 space-y-1 text-center">
              <span className="text-xs text-[#45c387] font-semibold flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                حاضر (Present)
              </span>
              <div className="text-2xl font-black text-white">{report?.presentCount || 0}</div>
              <span className="text-xs text-[#45c387] font-semibold">{presentPct}% من السجلات</span>
            </div>

            {/* Late */}
            <div className="rounded-xl border border-[#facc15]/30 bg-[#facc15]/10 p-4 space-y-1 text-center">
              <span className="text-xs text-[#facc15] font-semibold flex items-center justify-center gap-1">
                <Clock4 className="h-3.5 w-3.5" />
                متأخر (Late)
              </span>
              <div className="text-2xl font-black text-white">{report?.lateCount || 0}</div>
              <span className="text-xs text-[#facc15] font-semibold">{latePct}% من السجلات</span>
            </div>

            {/* Absent */}
            <div className="rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/10 p-4 space-y-1 text-center">
              <span className="text-xs text-[#f87171] font-semibold flex items-center justify-center gap-1">
                <XCircle className="h-3.5 w-3.5" />
                غائب (Absent)
              </span>
              <div className="text-2xl font-black text-white">{report?.absentCount || 0}</div>
              <span className="text-xs text-[#f87171] font-semibold">{absentPct}% من السجلات</span>
            </div>

            {/* Excused */}
            <div className="rounded-xl border border-[#38bdf8]/30 bg-[#38bdf8]/10 p-4 space-y-1 text-center">
              <span className="text-xs text-[#38bdf8] font-semibold flex items-center justify-center gap-1">
                <HelpCircle className="h-3.5 w-3.5" />
                غياب بعذر (Excused)
              </span>
              <div className="text-2xl font-black text-white">{report?.excusedCount || 0}</div>
              <span className="text-xs text-[#38bdf8] font-semibold">{excusedPct}% من السجلات</span>
            </div>
          </div>
        </div>

        {/* PERFORMANCE BY TRAINING GROUP */}
        <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="h-5 w-5 text-[#2f9e6b]" />
              <span>معدل الحضور والانضباط حسب المجموعة التدريبية</span>
            </h3>
          </div>

          {!report?.byGroup || report.byGroup.length === 0 ? (
            <p className="text-xs text-[#9bb5a8] py-4 text-center">
              لا توجد سجلات حضور للمجموعات في هذه الفترة.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-[#234235] text-[#9bb5a8]">
                    <th className="py-3 px-4 font-semibold">المجموعة التدريبية</th>
                    <th className="py-3 px-4 font-semibold">عدد الحصص</th>
                    <th className="py-3 px-4 font-semibold">إجمالي الحضور والغياب</th>
                    <th className="py-3 px-4 font-semibold">نسبة الحضور</th>
                    <th className="py-3 px-4 font-semibold">التقييم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#234235]">
                  {report.byGroup.map((g, idx) => (
                    <tr key={idx} className="hover:bg-[#12231c]/50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white">{g.groupName}</td>
                      <td className="py-3.5 px-4 text-[#e8f0ec]">{g.totalSessions} حصة</td>
                      <td className="py-3.5 px-4 text-[#e8f0ec]">{g.totalRecords} تسجيل</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#45c387] w-10">{g.attendanceRate}%</span>
                          <div className="h-1.5 w-24 rounded-full bg-[#0f1c18] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#2f9e6b]"
                              style={{ width: `${g.attendanceRate}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            g.attendanceRate >= 80
                              ? 'bg-[#2f9e6b]/20 text-[#45c387]'
                              : g.attendanceRate >= 60
                                ? 'bg-[#facc15]/20 text-[#facc15]'
                                : 'bg-[#ef4444]/20 text-[#f87171]'
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
        <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#2f9e6b]" />
              <span>معدل الحضور حسب الفروع</span>
            </h3>
          </div>

          {!report?.byBranch || report.byBranch.length === 0 ? (
            <p className="text-xs text-[#9bb5a8] py-4 text-center">
              لا توجد بيانات فروع مسجلة لهذه الفترة.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-[#234235] text-[#9bb5a8]">
                    <th className="py-3 px-4 font-semibold">الفرع</th>
                    <th className="py-3 px-4 font-semibold">عدد الحصص</th>
                    <th className="py-3 px-4 font-semibold">إجمالي السجلات</th>
                    <th className="py-3 px-4 font-semibold">نسبة الحضور</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#234235]">
                  {report.byBranch.map((b) => (
                    <tr key={b.branchId} className="hover:bg-[#12231c]/50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white">{b.branchName}</td>
                      <td className="py-3.5 px-4 text-[#e8f0ec]">{b.totalSessions}</td>
                      <td className="py-3.5 px-4 text-[#e8f0ec]">{b.totalRecords}</td>
                      <td className="py-3.5 px-4 font-bold text-[#45c387]">{b.attendanceRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
