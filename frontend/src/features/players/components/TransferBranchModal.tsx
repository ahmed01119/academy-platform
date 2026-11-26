'use client';

import React from 'react';
import { ArrowRightLeft, X } from 'lucide-react';
import type { BranchSummary } from '@academy/shared';
import type { PlayerProfileState } from '@/features/players/hooks/usePlayerProfile';

const FIELD =
  'w-full rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-3.5 py-2.5 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none transition-colors';
const LABEL = 'block text-xs font-semibold text-(--text-muted) mb-1.5';

export interface TransferBranchModalProps {
  transfer: PlayerProfileState['transfer'];
  branches: BranchSummary[];
  currentBranchId: string | undefined;
  isAr: boolean;
}

/** Moves the athlete's active enrollment to another branch (`POST /enrollments/:id/transfer`). */
export function TransferBranchModal({
  transfer,
  branches,
  currentBranchId,
  isAr,
}: TransferBranchModalProps) {
  if (!transfer.isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-branch-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-(--border-subtle) bg-(--bg-surface) p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-(--border-subtle) pb-3 mb-4">
          <h3
            id="transfer-branch-title"
            className="font-bold text-(--text-main) text-base flex items-center gap-2"
          >
            <ArrowRightLeft aria-hidden="true" className="h-5 w-5 text-(--accent-primary)" />
            {isAr ? 'نقل اللاعب إلى فرع آخر' : 'Transfer Athlete to Another Branch'}
          </h3>
          <button
            type="button"
            onClick={transfer.close}
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className="rounded-lg p-1 text-(--text-muted) hover:bg-(--bg-surface-subtle) hover:text-(--text-main) transition-colors cursor-pointer"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={transfer.submit} className="space-y-4">
          <div>
            <label htmlFor="select-target-branch" className={LABEL}>
              {isAr ? 'الفرع المستهدف *' : 'Target Branch *'}
            </label>
            <select
              required
              id="select-target-branch"
              value={transfer.targetBranchId}
              onChange={(e) => transfer.setTargetBranchId(e.target.value)}
              className={FIELD}
            >
              <option value="">{isAr ? 'اختر الفرع الجديد...' : 'Select target branch...'}</option>
              {branches
                .filter((b) => b.id !== currentBranchId)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.city ? `(${b.city})` : ''}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label htmlFor="input-transfer-date" className={LABEL}>
              {isAr ? 'تاريخ النقل الفعلي' : 'Effective Transfer Date'}
            </label>
            <input
              type="date"
              id="input-transfer-date"
              value={transfer.transferDate}
              onChange={(e) => transfer.setTransferDate(e.target.value)}
              className={FIELD}
            />
          </div>

          <div>
            <label htmlFor="textarea-transfer-notes" className={LABEL}>
              {isAr ? 'سبب أو ملاحظات النقل' : 'Transfer Reason or Notes'}
            </label>
            <textarea
              rows={2}
              id="textarea-transfer-notes"
              value={transfer.notes}
              onChange={(e) => transfer.setNotes(e.target.value)}
              placeholder={
                isAr
                  ? 'مثال: بناءً على طلب ولي الأمر بسبب تغيير مكان السكن'
                  : 'e.g. Relocation requested by guardian'
              }
              className={FIELD}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-(--border-subtle)">
            <button
              type="button"
              onClick={transfer.close}
              className="rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-4 py-2 text-xs font-medium text-(--text-muted) hover:text-(--text-main) transition-colors cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              id="btn-confirm-transfer"
              disabled={transfer.isSubmitting}
              className="rounded-xl bg-(--accent-primary) text-white px-5 py-2 text-xs font-semibold shadow hover:brightness-110 disabled:opacity-50 cursor-pointer"
            >
              {transfer.isSubmitting
                ? isAr
                  ? 'جارٍ النقل...'
                  : 'Transferring...'
                : isAr
                  ? 'تأكيد النقل'
                  : 'Confirm Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
