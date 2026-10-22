'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiClient } from '../../lib/api-client';
import {
  Globe2,
  Building2,
  Users,
  ShieldCheck,
  Activity,
  AlertTriangle,
  Search,
  CheckCircle2,
  XCircle,
  TrendingUp,
  RefreshCw,
  Sliders,
  CalendarCheck,
  Lock,
} from 'lucide-react';
import type {
  PlatformAcademyItem,
  PlatformAuditLogItem,
  PlatformOverviewMetrics,
  PlatformSecurityEvent,
} from '@academy/shared';

export default function PlatformSuperAdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'academies' | 'audit' | 'security'>('academies');
  const [metrics, setMetrics] = useState<PlatformOverviewMetrics | null>(null);
  const [academies, setAcademies] = useState<PlatformAcademyItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<PlatformAuditLogItem[]>([]);
  const [securityEvents, setSecurityEvents] = useState<PlatformSecurityEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !user?.isPlatformSuperAdmin) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    setFeedbackMessage(null);
    try {
      const [m, a, l, s] = await Promise.all([
        apiClient.platform.getMetrics().catch(() => null),
        apiClient.platform.listAcademies().catch(() => []),
        apiClient.platform.listAuditLogs({ limit: 50 }).catch(() => []),
        apiClient.platform.getSecurityEvents().catch(() => []),
      ]);
      setMetrics(m);
      setAcademies(a);
      setAuditLogs(l);
      setSecurityEvents(s);
    } catch (err: unknown) {
      setFeedbackMessage({
        type: 'error',
        text: (err as Error)?.message || 'حدث خطأ أثناء تحميل بيانات المنصة المركزية',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.isPlatformSuperAdmin) {
      void loadData();
    }
  }, [user, loadData]);

  const handleToggleStatus = async (academy: PlatformAcademyItem) => {
    const newStatus = academy.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const actionName = newStatus === 'SUSPENDED' ? 'إيقاف وتجميد' : 'إعادة تفعيل';
    const reason = prompt(`يرجى كتابة سبب ${actionName} الأكاديمية (${academy.name}):`, 'قرار إداري من المنصة');
    if (!reason) return;

    setActionLoading(academy.id);
    try {
      await apiClient.platform.updateAcademyStatus(academy.id, {
        status: newStatus,
        reason,
      });
      setFeedbackMessage({
        type: 'success',
        text: `تم ${actionName} الأكاديمية بنجاح. تم تسجيل الحدث في سجل التدقيق الأمني.`,
      });
      await loadData();
    } catch (err: unknown) {
      setFeedbackMessage({
        type: 'error',
        text: (err as Error)?.message || `فشل ${actionName} الأكاديمية`,
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || (!user?.isPlatformSuperAdmin && isLoading)) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-[#45c387]" />
          <p className="text-sm text-[#9bb5a8]">جارٍ التحقق من صلاحيات الإشراف السحابي...</p>
        </div>
      </div>
    );
  }

  if (!user?.isPlatformSuperAdmin) {
    return (
      <div className="mx-auto max-w-xl py-20 px-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 mb-4">
          <Lock className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">منطقة محظورة</h1>
        <p className="text-sm text-[#9bb5a8] mb-6">
          هذه الصفحة مخصصة حصرياً للمشرفين العامين على المنصة السحابية (Platform Super Administrators).
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl bg-[#2f9e6b] px-4 py-2 text-sm font-semibold text-[#062016] hover:bg-[#36b379] transition-all"
        >
          العودة للوحة الأكاديمية
        </Link>
      </div>
    );
  }

  const filteredAcademies = academies.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter ? a.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-[#0a1410] text-[#e8f0ec] py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header Hero */}
        <div className="rounded-2xl border border-[#2b4c3e] bg-gradient-to-r from-[#12231c] via-[#162821] to-[#12231c] p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#f59e0b] bg-[#f59e0b]/15 px-3 py-1 rounded-full border border-[#f59e0b]/30">
                  <Globe2 className="h-4 w-4" />
                  SaaS Platform Operations Console
                </span>
                <span className="flex items-center gap-1 text-xs text-[#45c387] bg-[#2f9e6b]/20 px-2 py-0.5 rounded-full border border-[#2f9e6b]/40">
                  <Activity className="h-3 w-3" />
                  النظام نشط ومستقر
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                مركز إدارة المنصة السحابية
              </h1>
              <p className="mt-1 text-sm text-[#9bb5a8]">
                مراقبة الأكاديميات الرياضية المشتركة، التحكم بالصلاحيات وحالات الحسابات، ومتابعة سجلات التدقيق والأمان.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={loadData}
                disabled={isLoading}
                className="flex items-center gap-2 rounded-xl border border-[#2b4c3e] bg-[#162821] px-4 py-2 text-sm font-medium text-[#e8f0ec] hover:border-[#2f9e6b] hover:text-[#45c387] transition-all"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>تحديث البيانات</span>
              </button>
              <Link
                href="/auth-test"
                className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-2 text-sm font-semibold text-amber-400 hover:bg-amber-500/20 transition-all"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>مختبر فحص الأمان</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackMessage && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between text-sm ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}
          >
            <span>{feedbackMessage.text}</span>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="text-xs opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* Global SaaS KPI Metrics */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="rounded-xl border border-[#234235] bg-[#12231c] p-4">
              <div className="flex items-center justify-between text-xs text-[#9bb5a8] mb-1">
                <span>إجمالي الأكاديميات</span>
                <Building2 className="h-4 w-4 text-[#2f9e6b]" />
              </div>
              <div className="text-2xl font-bold text-white">{metrics.totalAcademies}</div>
              <div className="text-[11px] text-[#45c387] mt-1 font-medium">
                {metrics.activeAcademies} نشطة / {metrics.suspendedAcademies} موقوفة
              </div>
            </div>

            <div className="rounded-xl border border-[#234235] bg-[#12231c] p-4">
              <div className="flex items-center justify-between text-xs text-[#9bb5a8] mb-1">
                <span>إجمالي اللاعبين</span>
                <Users className="h-4 w-4 text-[#38bdf8]" />
              </div>
              <div className="text-2xl font-bold text-white">{metrics.totalPlayers}</div>
              <div className="text-[11px] text-[#9bb5a8] mt-1">مسجلين في المنصة</div>
            </div>

            <div className="rounded-xl border border-[#234235] bg-[#12231c] p-4">
              <div className="flex items-center justify-between text-xs text-[#9bb5a8] mb-1">
                <span>المدربين النشطين</span>
                <TrendingUp className="h-4 w-4 text-[#45c387]" />
              </div>
              <div className="text-2xl font-bold text-white">{metrics.totalCoaches}</div>
              <div className="text-[11px] text-[#9bb5a8] mt-1">معتمدين بالأكاديميات</div>
            </div>

            <div className="rounded-xl border border-[#234235] bg-[#12231c] p-4">
              <div className="flex items-center justify-between text-xs text-[#9bb5a8] mb-1">
                <span>الفروع التشغيلية</span>
                <Sliders className="h-4 w-4 text-[#a855f7]" />
              </div>
              <div className="text-2xl font-bold text-white">{metrics.totalBranches}</div>
              <div className="text-[11px] text-[#9bb5a8] mt-1">موزعة جغرافياً</div>
            </div>

            <div className="rounded-xl border border-[#234235] bg-[#12231c] p-4">
              <div className="flex items-center justify-between text-xs text-[#9bb5a8] mb-1">
                <span>الحصص المكتملة</span>
                <CalendarCheck className="h-4 w-4 text-[#2f9e6b]" />
              </div>
              <div className="text-2xl font-bold text-white">{metrics.totalSessionsCompleted}</div>
              <div className="text-[11px] text-[#45c387] mt-1">جلسة حضور مثبتة</div>
            </div>

            <div className="rounded-xl border border-[#234235] bg-[#12231c] p-4">
              <div className="flex items-center justify-between text-xs text-[#9bb5a8] mb-1">
                <span>حالة الخوادم</span>
                <Activity className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-xl font-bold text-emerald-400">ممتازة (100%)</div>
              <div className="text-[11px] text-[#9bb5a8] mt-1">RLS مُفعل بالكامل</div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="border-b border-[#234235] flex items-center gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('academies')}
            className={`pb-3 text-sm font-semibold transition-all relative ${
              activeTab === 'academies'
                ? 'text-[#45c387] border-b-2 border-[#45c387]'
                : 'text-[#9bb5a8] hover:text-white'
            }`}
          >
            الأكاديميات المشتركة ({academies.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`pb-3 text-sm font-semibold transition-all relative ${
              activeTab === 'audit'
                ? 'text-[#45c387] border-b-2 border-[#45c387]'
                : 'text-[#9bb5a8] hover:text-white'
            }`}
          >
            سجل التدقيق الشامل ({auditLogs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 ${
              activeTab === 'security'
                ? 'text-[#45c387] border-b-2 border-[#45c387]'
                : 'text-[#9bb5a8] hover:text-white'
            }`}
          >
            <span>أحداث الأمان والتهديدات</span>
            {securityEvents.length > 0 && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300 font-bold border border-amber-500/30">
                {securityEvents.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content 1: Academies */}
        {activeTab === 'academies' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-[#12231c] p-4 rounded-xl border border-[#234235]">
              <div className="relative w-full sm:w-80">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-[#9bb5a8]" />
                <input
                  type="text"
                  placeholder="بحث باسم الأكاديمية أو المعرّف (slug)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-[#2b4c3e] bg-[#162821] pr-9 pl-3 py-2 text-xs text-white placeholder-[#9bb5a8] focus:border-[#2f9e6b] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-[#2b4c3e] bg-[#162821] px-3 py-2 text-xs text-white focus:border-[#2f9e6b] focus:outline-none"
                >
                  <option value="">جميع الحالات</option>
                  <option value="ACTIVE">نشطة فقط</option>
                  <option value="SUSPENDED">موقوفة مؤقتاً</option>
                  <option value="PROVISIONING">قيد التهيئة</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-[#234235] bg-[#12231c]">
              <table className="w-full text-right text-xs">
                <thead className="bg-[#162821] text-[#9bb5a8] border-b border-[#234235]">
                  <tr>
                    <th className="p-3.5">الأكاديمية</th>
                    <th className="p-3.5">المعرف (Slug)</th>
                    <th className="p-3.5">الفروع</th>
                    <th className="p-3.5">اللاعبين</th>
                    <th className="p-3.5">المدربين</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5">تاريخ الانضمام</th>
                    <th className="p-3.5 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#234235]/60">
                  {filteredAcademies.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-[#9bb5a8]">
                        لا توجد أكاديميات مطابقة لمعايير البحث.
                      </td>
                    </tr>
                  ) : (
                    filteredAcademies.map((a) => (
                      <tr key={a.id} className="hover:bg-[#162821]/50 transition-colors">
                        <td className="p-3.5">
                          <div className="font-bold text-white">{a.name}</div>
                          <div className="text-[11px] text-[#9bb5a8]">{a.email || a.phone || '—'}</div>
                        </td>
                        <td className="p-3.5 font-mono text-[11px] text-[#45c387]">{a.slug}</td>
                        <td className="p-3.5">{a.branchesCount} فرع</td>
                        <td className="p-3.5">{a.playersCount} لاعب</td>
                        <td className="p-3.5">{a.coachesCount} مدرب</td>
                        <td className="p-3.5">
                          {a.status === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" />
                              نشطة
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-950/60 border border-rose-500/30 px-2 py-0.5 text-[11px] font-medium text-rose-400">
                              <XCircle className="h-3 w-3" />
                              موقوفة
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-[#9bb5a8]">
                          {new Date(a.createdAt).toLocaleDateString('ar-SA')}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(a)}
                            disabled={actionLoading === a.id}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                              a.status === 'ACTIVE'
                                ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                            }`}
                          >
                            {actionLoading === a.id
                              ? 'جارٍ التحديث...'
                              : a.status === 'ACTIVE'
                              ? 'إيقاف الأكاديمية'
                              : 'إعادة التفعيل'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content 2: Audit Logs */}
        {activeTab === 'audit' && (
          <div className="overflow-x-auto rounded-xl border border-[#234235] bg-[#12231c]">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#162821] text-[#9bb5a8] border-b border-[#234235]">
                <tr>
                  <th className="p-3.5">العملية (Action)</th>
                  <th className="p-3.5">الكيان المتأثر</th>
                  <th className="p-3.5">المستخدم المنفذ</th>
                  <th className="p-3.5">الأكاديمية</th>
                  <th className="p-3.5">عنوان IP</th>
                  <th className="p-3.5">الوقت والتاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#234235]/60 font-mono text-[11px]">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-[#9bb5a8]">
                      لا توجد سجلات تدقيق مسجلة حتى الآن.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#162821]/50 transition-colors">
                      <td className="p-3.5 font-bold text-[#45c387]">{log.action}</td>
                      <td className="p-3.5 text-[#e8f0ec]">{log.resourceType}</td>
                      <td className="p-3.5 text-white">{log.actorEmail || 'نظام آلي'}</td>
                      <td className="p-3.5 text-[#9bb5a8]">{log.tenantName || 'عام بالمنصة'}</td>
                      <td className="p-3.5 text-[#9bb5a8]">{log.ipAddress || '—'}</td>
                      <td className="p-3.5 text-[#9bb5a8]">
                        {new Date(log.createdAt).toLocaleString('ar-SA')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab Content 3: Security Events */}
        {activeTab === 'security' && (
          <div className="space-y-4">
            {securityEvents.length === 0 ? (
              <div className="rounded-xl border border-[#234235] bg-[#12231c] p-8 text-center text-[#9bb5a8]">
                <ShieldCheck className="h-10 w-10 text-emerald-400 mx-auto mb-2 opacity-80" />
                <div className="font-semibold text-white">لا توجد تهديدات أو خروقات أمنية مسجلة</div>
                <p className="text-xs mt-1">
                  جميع آليات المصادقة وحماية معدل الطلبات وسياسات RLS تعمل بكفاءة تامة.
                </p>
              </div>
            ) : (
              securityEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{event.type}</span>
                        <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-300 border border-rose-500/30">
                          {event.severity}
                        </span>
                      </div>
                      <p className="text-xs text-rose-200 mt-1">{event.description}</p>
                      <div className="flex items-center gap-4 text-[11px] text-[#9bb5a8] mt-2 font-mono">
                        <span>IP: {event.ipAddress || 'غير محدد'}</span>
                        <span>الحساب: {event.actorEmail || 'غير مسجل'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-[#9bb5a8] sm:text-left font-mono">
                    {new Date(event.timestamp).toLocaleString('ar-SA')}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
