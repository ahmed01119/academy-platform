import React from 'react';
import { Info } from 'lucide-react';
import {
  JOIN_FIELDS_PENDING_BACKEND_SUPPORT,
  PENDING_JOIN_FIELD_LABELS,
} from '@/features/landing/player-join-request';

/**
 * Tells applicants, accurately, which join-form fields are not submitted or saved today (F17).
 * The list is generated from `JOIN_FIELDS_PENDING_BACKEND_SUPPORT`, so it stays in sync with
 * what `buildPlayerJoinRequest` actually sends. Remove a field from that list once the API
 * supports it and this notice updates automatically (and disappears when the list is empty).
 */
export function UnsavedFieldsNotice({ locale }: { locale: 'ar' | 'en' }) {
  // Widened on purpose: the list shrinks as backend support lands (BR-2).
  if ((JOIN_FIELDS_PENDING_BACKEND_SUPPORT as readonly string[]).length === 0) return null;
  const isAr = locale === 'ar';
  const fields = JOIN_FIELDS_PENDING_BACKEND_SUPPORT.map(
    (f) => PENDING_JOIN_FIELD_LABELS[f][locale],
  );

  return (
    <div
      role="note"
      aria-label={isAr ? 'تنبيه حول الحقول غير المحفوظة' : 'Notice about unsaved fields'}
      className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2.5"
    >
      <Info aria-hidden="true" className="h-4 w-4 shrink-0 mt-0.5" />
      <div className="space-y-1.5 leading-relaxed">
        <p className="font-semibold">
          {isAr
            ? 'تنبيه: بعض الحقول في هذا النموذج لا يتم إرسالها أو حفظها حالياً.'
            : 'Please note: some fields in this form are currently not submitted or saved.'}
        </p>
        <p>
          {isAr
            ? 'الحقول التالية لا تُرسل مع الطلب: '
            : 'These fields are not sent with your request: '}
          <span className="font-medium">{fields.join(isAr ? '، ' : ', ')}</span>.
        </p>
        <p>
          {isAr
            ? 'يُرسل مع الطلب فقط: الأكاديمية، مقدّم الطلب (اللاعب أو ولي الأمر)، اسم اللاعب، سنة الميلاد، اسم ولي الأمر ورقم هاتفه، البريد الإلكتروني لصاحب الحساب، وكلمة مرور الحساب الجديد.'
            : 'Only the academy, who is applying (player or guardian), player name, birth year, guardian name and phone, the account e-mail and the new account password are sent.'}
        </p>
      </div>
    </div>
  );
}
