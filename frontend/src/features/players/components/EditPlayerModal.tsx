'use client';

import React from 'react';
import { Edit3, Save, X } from 'lucide-react';
import type { PlayerStatus } from '@academy/shared';
import type { PlayerProfileState } from '@/features/players/hooks/usePlayerProfile';
import { PlayerProfileFields } from '@/features/players/components/PlayerProfileFields';

const FIELD =
  'w-full rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-3.5 py-2 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none transition-colors';
const LABEL = 'block text-xs font-semibold text-(--text-muted) mb-1';

export interface EditPlayerModalProps {
  edit: PlayerProfileState['edit'];
  /** Only users with `players.sensitive.read` may see or change the national ID and medical notes. */
  canViewSensitive: boolean;
  isAr: boolean;
}

/** Edits the athlete with the same fields as every player form, plus the status (`PATCH /players/:id`). */
export function EditPlayerModal({ edit, canViewSensitive, isAr }: EditPlayerModalProps) {
  if (!edit.isOpen) return null;
  const { form, setField } = edit;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-player-title"
    >
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-(--border-subtle) bg-(--bg-surface) p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-(--border-subtle) pb-3 mb-4">
          <h3
            id="edit-player-title"
            className="font-bold text-(--text-main) text-base flex items-center gap-2"
          >
            <Edit3 aria-hidden="true" className="h-5 w-5 text-(--accent-primary)" />
            {isAr ? 'تعديل بيانات اللاعب' : 'Edit Athlete Profile'}
          </h3>
          <button
            type="button"
            onClick={edit.close}
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className="rounded-lg p-1 text-(--text-muted) hover:bg-(--bg-surface-subtle) hover:text-(--text-main) transition-colors cursor-pointer"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={edit.submit} className="space-y-4">
          {edit.error && (
            <div
              role="alert"
              className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-500"
            >
              {edit.error}
            </div>
          )}

          <PlayerProfileFields
            values={form}
            onChange={edit.update}
            locale={isAr ? 'ar' : 'en'}
            idPrefix="edit"
            tone="modal"
            hideSensitive={!canViewSensitive}
            disabled={edit.isSubmitting}
          />

          <div>
            <label htmlFor="edit-player-status" className={LABEL}>
              {isAr ? 'حالة اللاعب' : 'Athlete Status'}
            </label>
            <select
              id="edit-player-status"
              value={form.status}
              onChange={(e) => setField('status', e.target.value as PlayerStatus)}
              className={FIELD}
            >
              <option value="ACTIVE">{isAr ? 'نشط (Active)' : 'Active'}</option>
              <option value="INACTIVE">{isAr ? 'غير نشط (Inactive)' : 'Inactive'}</option>
              <option value="SUSPENDED">{isAr ? 'موقوف (Suspended)' : 'Suspended'}</option>
            </select>
          </div>

          {!canViewSensitive && (
            <div className="rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) p-3 text-[11px] text-(--text-muted)">
              {isAr
                ? 'الرقم القومي والملاحظات الطبية محجوبة ولا يعدّلها إلا المالك أو الإداري.'
                : 'National ID and medical notes are restricted to the owner and the admin.'}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-(--border-subtle)">
            <button
              type="button"
              onClick={edit.close}
              className="rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-4 py-2 text-xs font-medium text-(--text-muted) hover:text-(--text-main) transition-colors cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              id="btn-confirm-update-player"
              disabled={edit.isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-(--accent-primary) text-white px-5 py-2 text-xs font-semibold shadow hover:brightness-110 disabled:opacity-50 cursor-pointer"
            >
              <Save aria-hidden="true" className="h-4 w-4" />
              <span>
                {edit.isSubmitting
                  ? isAr
                    ? 'جارٍ الحفظ...'
                    : 'Saving...'
                  : isAr
                    ? 'حفظ التعديلات'
                    : 'Save Changes'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
