'use client';

import React from 'react';
import { RefreshCw, ShieldAlert, Trash2, X } from 'lucide-react';
import type { PlayerProfileState } from '@/features/players/hooks/usePlayerProfile';

const STAT = 'rounded-lg bg-(--bg-surface) p-2.5 border border-(--border-subtle)';

export interface ArchivePlayerModalProps {
  archive: PlayerProfileState['archive'];
  isAr: boolean;
}

/**
 * Safe archive confirmation (`DELETE /players/:id`). Shows the server-computed impact report;
 * history (attendance, finance, evaluations) is preserved — nothing is hard-deleted.
 */
export function ArchivePlayerModal({ archive, isAr }: ArchivePlayerModalProps) {
  const impact = archive.impact;
  if (!archive.isOpen || !impact) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="archive-player-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-rose-500/30 bg-(--bg-surface) p-6 shadow-2xl space-y-5 my-8">
        <div className="flex items-center justify-between border-b border-(--border-subtle) pb-4">
          <div className="flex items-center gap-2.5 text-rose-500 font-bold text-base">
            <ShieldAlert aria-hidden="true" className="h-5 w-5" />
            <span id="archive-player-title">
              {isAr ? 'تأكيد أرشفة اللاعب (Safe Player Archive)' : 'Confirm Athlete Safe Archive'}
            </span>
          </div>
          <button
            type="button"
            onClick={archive.close}
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className="rounded-lg p-1.5 text-(--text-muted) hover:bg-(--bg-surface-subtle)"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {isAr ? (
            <p className="text-(--text-muted) leading-relaxed">
              أنت على وشك أرشفة اللاعب{' '}
              <strong className="text-(--text-main)">{impact.playerName}</strong>. تحافظ هذه العملية
              على سلامة الحضور، السجلات المالية، والتقييمات دون حذفها من قاعدة البيانات.
            </p>
          ) : (
            <p className="text-(--text-muted) leading-relaxed">
              You are about to archive athlete{' '}
              <strong className="text-(--text-main)">{impact.playerName}</strong>. This keeps
              attendance, financial records and evaluations intact without deleting them from the
              database.
            </p>
          )}

          {/* Impact Summary */}
          <div className="rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) p-4 space-y-3">
            <h4 className="font-bold text-(--text-main)">
              {isAr ? 'تقرير الأثر والبيانات المرتبطة:' : 'Impact Report & Linked Records:'}
            </h4>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className={STAT}>
                <span className="text-(--text-muted) block">
                  {isAr ? 'تسجيلات الفروع النشطة:' : 'Active Branch Enrollments:'}
                </span>
                <strong className="text-amber-500 text-sm">
                  {impact.activeEnrollments} {isAr ? '(سيتم إلغاؤها)' : '(will be cancelled)'}
                </strong>
              </div>
              <div className={STAT}>
                <span className="text-(--text-muted) block">
                  {isAr ? 'المجموعات التدريبية:' : 'Training Groups:'}
                </span>
                <strong className="text-amber-500 text-sm">
                  {impact.activeGroupMemberships}{' '}
                  {isAr ? '(سيتم إيقافها)' : '(will be deactivated)'}
                </strong>
              </div>
              <div className={STAT}>
                <span className="text-(--text-muted) block">
                  {isAr ? 'سجلات الحضور المحفوظة:' : 'Preserved Attendance Records:'}
                </span>
                <strong className="text-emerald-500 text-sm">
                  {impact.attendanceRecordsCount} {isAr ? 'حصة' : 'sessions'}
                </strong>
              </div>
              <div className={STAT}>
                <span className="text-(--text-muted) block">
                  {isAr ? 'المعاملات المالية المحفوظة:' : 'Preserved Financial Ledgers:'}
                </span>
                <strong className="text-emerald-500 text-sm">
                  {impact.financialTransactionsCount} {isAr ? 'معاملة' : 'transactions'}
                </strong>
              </div>
            </div>
          </div>

          {impact.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
              <span className="font-bold text-amber-500 block">
                {isAr ? 'ملاحظات الأمان:' : 'Safety Notes:'}
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-amber-600 dark:text-amber-400 text-[11px]">
                {impact.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-(--border-subtle)">
          <button
            type="button"
            onClick={archive.close}
            disabled={archive.isSubmitting}
            className="rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-4 py-2 text-xs font-medium text-(--text-muted) hover:text-(--text-main) cursor-pointer"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            id="btn-confirm-safe-delete"
            onClick={archive.confirm}
            disabled={archive.isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 text-xs font-semibold shadow disabled:opacity-50 cursor-pointer"
          >
            {archive.isSubmitting ? (
              <RefreshCw aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            )}
            <span>
              {archive.isSubmitting
                ? isAr
                  ? 'جارٍ الأرشفة...'
                  : 'Archiving...'
                : isAr
                  ? 'تأكيد الأرشفة الآمنة'
                  : 'Confirm Safe Archive'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
