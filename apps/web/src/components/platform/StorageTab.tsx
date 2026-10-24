'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useLocale } from '../../lib/locale-context';
import apiClient from '../../lib/api-client';
import { useToast } from '../ui/Toast';
import {
  Database,
  HardDrive,
  ShieldCheck,
  RefreshCw,
  Play,
  Eye,
  Layers,
} from 'lucide-react';
import type {
  StorageMetrics,
  StorageMaintenanceDryRunResponse,
} from '@academy/shared';

export function StorageTab() {
  const { locale } = useLocale();
  const { toast } = useToast();

  const [metrics, setMetrics] = useState<StorageMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dryRunData, setDryRunData] = useState<StorageMaintenanceDryRunResponse | null>(null);
  const [isDryRunLoading, setIsDryRunLoading] = useState(false);
  const [isDryRunModalOpen, setIsDryRunModalOpen] = useState(false);

  // Execution modal
  const [isExecuteModalOpen, setIsExecuteModalOpen] = useState(false);
  const [purgeExpiredTokens, setPurgeExpiredTokens] = useState(true);
  const [archiveOlderThanDays, setArchiveOlderThanDays] = useState(90);
  const [enableLogPurge, setEnableLogPurge] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);

  const fetchMetrics = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.platform.getStorageMetrics();
      setMetrics(data);
    } catch (err: unknown) {
      toast.error(
        (err as Error)?.message ||
          (locale === 'ar' ? 'فشل تحميل بيانات التخزين' : 'Failed to fetch storage metrics'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [locale, toast]);

  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  const handleRunDryRun = async () => {
    setIsDryRunLoading(true);
    try {
      const res = await apiClient.platform.dryRunStorageMaintenance();
      setDryRunData(res);
      setIsDryRunModalOpen(true);
    } catch (err: unknown) {
      toast.error(
        (err as Error)?.message ||
          (locale === 'ar' ? 'فشل إجراء الفحص المسبق' : 'Dry run check failed'),
      );
    } finally {
      setIsDryRunLoading(false);
    }
  };

  const handleExecuteMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsExecuting(true);
    try {
      const res = await apiClient.platform.executeStorageMaintenance({
        confirm: true,
        purgeExpiredSessions: purgeExpiredTokens,
        purgeExpiredTokens,
        archiveOperationalLogsOlderThanDays: enableLogPurge ? archiveOlderThanDays : undefined,
      });

      toast.success(res.message);
      setIsExecuteModalOpen(false);
      await fetchMetrics();
    } catch (err: unknown) {
      toast.error(
        (err as Error)?.message ||
          (locale === 'ar' ? 'فشل تنفيذ عمليات الصيانة' : 'Storage maintenance failed'),
      );
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm space-y-1">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="text-xs font-semibold">
              {locale === 'ar' ? 'حجم قاعدة البيانات PostgreSQL' : 'Database Size'}
            </span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-[var(--text-main)] font-mono">
            {metrics?.formattedDatabaseSize || '0 B'}
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">
            {metrics?.totalTables || 0} {locale === 'ar' ? 'جدول بيانات مسجل' : 'tables registered'}
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm space-y-1">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="text-xs font-semibold">
              {locale === 'ar' ? 'سجلات التدقيق والأمان' : 'Audit Logs Size'}
            </span>
            <ShieldCheck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-[var(--text-main)] font-mono">
            {metrics?.auditLogsCount.toLocaleString() || '0'}
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">
            ~{Math.round((metrics?.auditLogsSizeBytes || 0) / 1024)} KB{' '}
            {locale === 'ar' ? 'سجلات تشغيلية ومالية' : 'operational records'}
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm space-y-1">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="text-xs font-semibold">
              {locale === 'ar' ? 'النمو الشهري التقديري' : 'Monthly Growth'}
            </span>
            <HardDrive className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-[var(--text-main)] font-mono">
            ~{Math.round((metrics?.estimatedMonthlyGrowthBytes || 0) / 1024)} KB/mo
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">
            {locale === 'ar' ? 'بناءً على وتيرة النشاط الحالية' : 'Based on recent throughput'}
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm space-y-1">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="text-xs font-semibold">
              {locale === 'ar' ? 'مفاتيح التخزين المؤقت Redis' : 'Cache & Session Keys'}
            </span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-[var(--text-main)] font-mono">
            {metrics?.cacheKeysCount || 0}
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">
            {locale === 'ar' ? 'جلسات ومفاتيح تحديد المعدل' : 'Active rate-limits & tokens'}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-[var(--text-main)]">
            {locale === 'ar'
              ? 'إدارة دورة حياة البيانات والتنظيف الآمن'
              : 'Data Lifecycle & Safe Maintenance'}
          </h4>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {locale === 'ar'
              ? 'فحص وحذف الجلسات المنتهية وتنظيف السجلات التشغيلية القديمة دون المساس بالسجلات المالية أو اللاعبين.'
              : 'Safely purge expired sessions and aged operational logs without touching financial or player records.'}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleRunDryRun}
            disabled={isDryRunLoading}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-card-hover)] text-xs font-semibold text-[var(--text-main)] transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-blue-400" />
            {isDryRunLoading
              ? locale === 'ar'
                ? 'جاري الفحص...'
                : 'Evaluating...'
              : locale === 'ar'
                ? 'فحص تجريبي (Dry-Run)'
                : 'Dry-Run Preview'}
          </button>

          <button
            type="button"
            onClick={() => setIsExecuteModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-sm transition-all"
          >
            <Play className="w-3.5 h-3.5" />
            {locale === 'ar' ? 'تنفيذ الصيانة الآمنة' : 'Execute Maintenance'}
          </button>
        </div>
      </div>

      {/* Tables breakdown */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h4 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            {locale === 'ar' ? 'أكبر جداول قاعدة البيانات حجماً' : 'Largest Tables Breakdown'}
          </h4>
          <button
            type="button"
            onClick={fetchMetrics}
            disabled={isLoading}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            {locale === 'ar' ? 'تحديث' : 'Refresh'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="bg-[var(--bg-surface-subtle)] border-b border-[var(--border-subtle)] text-[var(--text-muted)] font-semibold uppercase">
              <tr>
                <th className="px-4 py-3 text-start">
                  {locale === 'ar' ? 'اسم الجدول' : 'Table Name'}
                </th>
                <th className="px-4 py-3 text-start">
                  {locale === 'ar' ? 'عدد الصفوف التقديري' : 'Estimated Rows'}
                </th>
                <th className="px-4 py-3 text-start">
                  {locale === 'ar' ? 'الحجم الإجمالي' : 'Total Size'}
                </th>
                <th className="px-4 py-3 text-start">
                  {locale === 'ar' ? 'حجم الفهارس (Indexes)' : 'Index Size'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {metrics?.tables.map((t) => (
                <tr key={t.tableName} className="hover:bg-[var(--bg-surface-subtle)]/50 transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-[var(--text-main)]">
                    {t.tableName}
                  </td>
                  <td className="px-4 py-3 font-mono text-[var(--text-muted)]">
                    {t.rowCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-emerald-400 font-semibold">
                    {t.formattedSize}
                  </td>
                  <td className="px-4 py-3 font-mono text-[var(--text-muted)]">
                    {Math.round(t.indexBytes / 1024)} KB
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dry Run Preview Modal */}
      {isDryRunModalOpen && dryRunData && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsDryRunModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-[var(--border-app)] bg-[var(--bg-card)] p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-[var(--border-subtle)] pb-3">
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-400" />
                {locale === 'ar' ? 'نتائج الفحص التجريبي المسبق' : 'Dry-Run Maintenance Evaluation'}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {locale === 'ar'
                  ? 'تم تقييم المرشحين للتنظيف دون إجراء أي تعديل فعلي على البيانات.'
                  : 'Cleanup candidates evaluated safely without making any changes to data.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-[var(--bg-surface-subtle)] space-y-1">
                <span className="text-[11px] text-[var(--text-secondary)]">
                  {locale === 'ar' ? 'جلسات ورموز منتهية' : 'Expired Sessions'}
                </span>
                <div className="text-lg font-bold text-emerald-400 font-mono">
                  {dryRunData.expiredTokensCount}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--bg-surface-subtle)] space-y-1">
                <span className="text-[11px] text-[var(--text-secondary)]">
                  {locale === 'ar' ? 'سجلات تدقيق تشغيلية قديمة' : 'Purgeable Audit Logs'}
                </span>
                <div className="text-lg font-bold text-emerald-400 font-mono">
                  {dryRunData.purgeableAuditLogsCount}
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-medium">
              {locale === 'ar' ? 'المساحة التقديرية القابلة للاسترداد:' : 'Estimated Reclaimable Space:'}{' '}
              <span className="font-bold font-mono text-sm">{dryRunData.formattedReclaimableSize}</span>
            </div>

            {/* Protected Records Safeguards Box */}
            <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-2">
              <h5 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                {locale === 'ar' ? 'سجلات محمية بالكامل بموجب السياسات' : 'Strictly Protected Records (Fail-Safe)'}
              </h5>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-lg bg-[var(--bg-card)]">
                  <div className="font-bold text-[var(--text-primary)] font-mono">
                    {dryRunData.protectedRecordsSummary.financialTransactionsCount}
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                    {locale === 'ar' ? 'معاملات مالية' : 'Financial Tx'}
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-[var(--bg-card)]">
                  <div className="font-bold text-[var(--text-primary)] font-mono">
                    {dryRunData.protectedRecordsSummary.activePlayersCount}
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                    {locale === 'ar' ? 'لاعبين نشطين' : 'Active Players'}
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-[var(--bg-card)]">
                  <div className="font-bold text-[var(--text-primary)] font-mono">
                    {dryRunData.protectedRecordsSummary.activeSubscriptionsCount}
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                    {locale === 'ar' ? 'اشتراكات نشطة' : 'Active Subs'}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setIsDryRunModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--bg-card-hover)] text-[var(--text-secondary)]"
              >
                {locale === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Execute Maintenance Modal */}
      {isExecuteModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsExecuteModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--border-app)] bg-[var(--bg-card)] p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-[var(--border-subtle)] pb-3">
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Play className="w-5 h-5 text-emerald-400" />
                {locale === 'ar' ? 'تأكيد إجراء الصيانة الآمنة' : 'Execute Storage Maintenance'}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {locale === 'ar'
                  ? 'اختر العمليات المطلوب تنفيذها بأمان تام مع توثيق العملية في سجل التدقيق.'
                  : 'Select approved cleanup operations. All actions are strictly audit logged.'}
              </p>
            </div>

            <form onSubmit={handleExecuteMaintenance} className="space-y-4">
              <label className="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-surface-subtle)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={purgeExpiredTokens}
                  onChange={(e) => setPurgeExpiredTokens(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-500 focus:ring-emerald-500"
                />
                <div>
                  <span className="text-xs font-bold text-[var(--text-primary)] block">
                    {locale === 'ar' ? 'حذف الجلسات والرموز المنتهية' : 'Purge Expired Refresh Tokens'}
                  </span>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    {locale === 'ar'
                      ? 'تنظيف الرموز المنتهية أو الملغاة لتحرير مساحة الجلسات.'
                      : 'Remove expired and revoked tokens to reclaim auth storage.'}
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-surface-subtle)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableLogPurge}
                  onChange={(e) => setEnableLogPurge(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-500 focus:ring-emerald-500"
                />
                <div className="space-y-2 flex-1">
                  <div>
                    <span className="text-xs font-bold text-[var(--text-primary)] block">
                      {locale === 'ar'
                        ? 'أرشفة السجلات التشغيلية غير المالية القديمة'
                        : 'Archive Aged Operational Logs'}
                    </span>
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      {locale === 'ar'
                        ? 'تنظيف سجلات الأحداث الروتينية الأقدم من 90 يوماً. السجلات المالية لا تُحذف أبداً.'
                        : 'Purges non-financial audit logs older than threshold. Financial records are never deleted.'}
                    </span>
                  </div>

                  {enableLogPurge && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] text-[var(--text-secondary)]">
                        {locale === 'ar' ? 'الأقدم من (أيام):' : 'Older than (days):'}
                      </span>
                      <input
                        type="number"
                        min={30}
                        max={365}
                        value={archiveOlderThanDays}
                        onChange={(e) => setArchiveOlderThanDays(Number(e.target.value))}
                        className="w-20 px-2 py-1 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs text-center font-mono"
                      />
                    </div>
                  )}
                </div>
              </label>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setIsExecuteModalOpen(false)}
                  disabled={isExecuting}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--bg-card-hover)] text-[var(--text-secondary)]"
                >
                  {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isExecuting || (!purgeExpiredTokens && !enableLogPurge)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                >
                  {isExecuting
                    ? locale === 'ar'
                      ? 'جاري التنفيذ...'
                      : 'Executing...'
                    : locale === 'ar'
                      ? 'تأكيد وبدء الصيانة'
                      : 'Confirm & Run'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
