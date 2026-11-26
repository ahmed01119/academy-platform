'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, CalendarPlus, MoveRight, RotateCcw, XCircle } from 'lucide-react';
import type {
  GroupOccurrence,
  GroupOccurrenceStatus,
  TrainingScheduleSummary,
} from '@academy/shared';
import { api, getErrorMessage } from '@/api/client';
import { Skeleton } from '@/components/ui/skeleton';

type Locale = 'ar' | 'en';

const DAY_NAMES: Record<Locale, string[]> = {
  ar: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

const STATUS_STYLE: Record<GroupOccurrenceStatus, string> = {
  SCHEDULED: 'bg-(--bg-surface-subtle) text-(--text-muted) border-(--border-subtle)',
  CANCELLED: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
  MOVED: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  RESCHEDULED: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30',
  EXTRA: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
};

export function occurrenceStatusLabel(status: GroupOccurrenceStatus, locale: Locale): string {
  const labels: Record<GroupOccurrenceStatus, [string, string]> = {
    SCHEDULED: ['في موعده', 'As usual'],
    CANCELLED: ['ملغاة', 'Cancelled'],
    MOVED: ['تم نقلها', 'Moved'],
    RESCHEDULED: ['موعد بديل', 'New time'],
    EXTRA: ['حصة إضافية', 'Extra session'],
  };
  return labels[status][locale === 'ar' ? 0 : 1];
}

function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

type Form =
  | { mode: 'cancel'; occurrence: GroupOccurrence; reason: string }
  | {
      mode: 'move';
      occurrence: GroupOccurrence;
      sessionDate: string;
      startTime: string;
      endTime: string;
      reason: string;
    }
  | {
      mode: 'extra';
      sessionDate: string;
      startTime: string;
      endTime: string;
      location: string;
      reason: string;
    }
  | {
      mode: 'slot';
      scheduleId: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      location: string;
    };

/**
 * The group's planned sessions for the coming weeks: the fixed weekly timetable with its one-off changes. The admin
 * (groups.manage) cancels or moves one session, adds an extra one, undoes a change, or changes a weekly slot; the
 * group's coaches and players are notified by the API. Others (e.g. the coach) see the timetable read-only.
 */
export function GroupCalendarPanel({
  groupId,
  schedules,
  locale,
  canManage,
  onSlotsChanged,
}: {
  groupId: string;
  schedules: TrainingScheduleSummary[];
  locale: Locale;
  canManage: boolean;
  onSlotsChanged?: () => void;
}) {
  const ar = locale === 'ar';
  const t = (a: string, e: string) => (ar ? a : e);
  const [occurrences, setOccurrences] = useState<GroupOccurrence[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const calendar = await api.groups.getCalendar(groupId, { weeks: 4 });
      setOccurrences(calendar.occurrences);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, ar ? 'تعذر تحميل الجدول' : 'Could not load the timetable'));
    }
  }, [groupId, ar]);

  useEffect(() => {
    void load();
  }, [load, schedules]);

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setForm(null);
      setMessage({ ok: true, text: done });
      await load();
    } catch (err) {
      setMessage({
        ok: false,
        text: getErrorMessage(err, t('تعذر حفظ التعديل', 'Could not save')),
      });
    } finally {
      setBusy(false);
    }
  };

  const notified = t(' وتم إبلاغ المدرب واللاعبين.', ' The coach and players were notified.');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (form.mode === 'cancel') {
      void run(
        () =>
          api.groups.createScheduleException(groupId, {
            kind: 'CANCELLED',
            scheduleId: form.occurrence.scheduleId!,
            originalDate: form.occurrence.date,
            reason: form.reason.trim() || undefined,
          }),
        t('تم إلغاء الحصة.', 'Session cancelled.') + notified,
      );
    } else if (form.mode === 'move') {
      void run(
        () =>
          api.groups.createScheduleException(groupId, {
            kind: 'MOVED',
            scheduleId: form.occurrence.scheduleId!,
            originalDate: form.occurrence.date,
            sessionDate: form.sessionDate,
            startTime: form.startTime,
            endTime: form.endTime,
            reason: form.reason.trim() || undefined,
          }),
        t('تم نقل الحصة.', 'Session moved.') + notified,
      );
    } else if (form.mode === 'extra') {
      void run(
        () =>
          api.groups.createScheduleException(groupId, {
            kind: 'EXTRA',
            sessionDate: form.sessionDate,
            startTime: form.startTime,
            endTime: form.endTime,
            location: form.location.trim() || undefined,
            reason: form.reason.trim() || undefined,
          }),
        t('تمت إضافة الحصة.', 'Extra session added.') + notified,
      );
    } else {
      void run(
        async () => {
          await api.groups.updateSchedule(groupId, form.scheduleId, {
            dayOfWeek: form.dayOfWeek,
            startTime: form.startTime,
            endTime: form.endTime,
            location: form.location.trim() || null,
          });
          onSlotsChanged?.();
        },
        t('تم تغيير الموعد الأسبوعي الثابت.', 'Weekly time changed.') + notified,
      );
    }
  };

  const undo = (o: GroupOccurrence) =>
    void run(
      () => api.groups.deleteScheduleException(groupId, o.exceptionId!),
      t('تم التراجع عن التعديل.', 'Change undone.') + notified,
    );

  const input =
    'w-full rounded-lg border border-(--border-subtle) bg-(--bg-surface-subtle) px-2.5 py-2 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none';
  const label = 'block text-[11px] font-semibold text-(--text-muted) mb-1';

  return (
    <section className="rounded-2xl border border-(--border-subtle) bg-[var(--bg-surface)] p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-(--text-main)">
            <CalendarClock className="h-4 w-4 text-[var(--accent-primary)]" aria-hidden="true" />
            {t('الحصص القادمة (4 أسابيع)', 'Upcoming sessions (4 weeks)')}
          </h3>
          <p className="text-[11px] text-(--text-muted)">
            {t(
              'الجدول الثابت يتكرر كل أسبوع. أي تعديل على حصة واحدة لا يغيّر الموعد الثابت.',
              'The fixed timetable repeats every week. Changing one session does not change it.',
            )}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              id="btn-extra-session"
              onClick={() =>
                setForm({
                  mode: 'extra',
                  sessionDate: '',
                  startTime: '',
                  endTime: '',
                  location: '',
                  reason: '',
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
            >
              <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
              {t('حصة إضافية', 'Extra session')}
            </button>
            {schedules.length > 0 && (
              <button
                type="button"
                id="btn-change-weekly-slot"
                onClick={() => {
                  const s = schedules[0]!;
                  setForm({
                    mode: 'slot',
                    scheduleId: s.id,
                    dayOfWeek: s.dayOfWeek,
                    startTime: s.startTime,
                    endTime: s.endTime,
                    location: s.location ?? '',
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-(--border-subtle) px-3 py-1.5 text-xs font-semibold text-(--text-main)"
              >
                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                {t('تغيير الموعد الثابت', 'Change the fixed time')}
              </button>
            )}
          </div>
        )}
      </div>

      {message && (
        <div
          role="status"
          className={`rounded-lg border p-2.5 text-xs ${
            message.ok
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {form && (
        <form
          onSubmit={submit}
          className="rounded-xl border border-(--accent-primary)/30 bg-(--accent-primary)/5 p-3.5 space-y-3"
        >
          <p className="text-xs font-bold text-(--text-main)">
            {form.mode === 'cancel'
              ? t(
                  `إلغاء حصة ${form.occurrence.date}`,
                  `Cancel the session of ${form.occurrence.date}`,
                )
              : form.mode === 'move'
                ? t(
                    `نقل حصة ${form.occurrence.date}`,
                    `Move the session of ${form.occurrence.date}`,
                  )
                : form.mode === 'extra'
                  ? t('إضافة حصة إضافية', 'Add an extra session')
                  : t(
                      'تغيير موعد أسبوعي ثابت (يسري كل أسبوع، وتُلغى تعديلات الحصص القادمة لهذا الموعد)',
                      'Change a weekly slot (every week; upcoming changes of this slot are removed)',
                    )}
          </p>

          {form.mode === 'slot' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="col-span-2 sm:col-span-4">
                <label htmlFor="slot-select" className={label}>
                  {t('الموعد', 'Slot')}
                </label>
                <select
                  id="slot-select"
                  className={input}
                  value={form.scheduleId}
                  onChange={(e) => {
                    const s = schedules.find((x) => x.id === e.target.value)!;
                    setForm({
                      mode: 'slot',
                      scheduleId: s.id,
                      dayOfWeek: s.dayOfWeek,
                      startTime: s.startTime,
                      endTime: s.endTime,
                      location: s.location ?? '',
                    });
                  }}
                >
                  {schedules.map((s) => (
                    <option key={s.id} value={s.id}>
                      {DAY_NAMES[locale][s.dayOfWeek]} {s.startTime}-{s.endTime}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="slot-day" className={label}>
                  {t('اليوم', 'Day')}
                </label>
                <select
                  id="slot-day"
                  className={input}
                  value={form.dayOfWeek}
                  onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}
                >
                  {DAY_NAMES[locale].map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="slot-start" className={label}>
                  {t('من', 'From')}
                </label>
                <input
                  id="slot-start"
                  type="time"
                  required
                  className={input}
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="slot-end" className={label}>
                  {t('إلى', 'To')}
                </label>
                <input
                  id="slot-end"
                  type="time"
                  required
                  className={input}
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="slot-location" className={label}>
                  {t('المكان', 'Place')}
                </label>
                <input
                  id="slot-location"
                  className={input}
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
            </div>
          )}

          {(form.mode === 'move' || form.mode === 'extra') && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label htmlFor="occ-date" className={label}>
                  {t('التاريخ', 'Date')}
                </label>
                <input
                  id="occ-date"
                  type="date"
                  required
                  className={input}
                  value={form.sessionDate}
                  onChange={(e) => setForm({ ...form, sessionDate: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="occ-start" className={label}>
                  {t('من', 'From')}
                </label>
                <input
                  id="occ-start"
                  type="time"
                  required
                  className={input}
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="occ-end" className={label}>
                  {t('إلى', 'To')}
                </label>
                <input
                  id="occ-end"
                  type="time"
                  required
                  className={input}
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                />
              </div>
              {form.mode === 'extra' && (
                <div>
                  <label htmlFor="occ-location" className={label}>
                    {t('المكان', 'Place')}
                  </label>
                  <input
                    id="occ-location"
                    className={input}
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                  />
                </div>
              )}
            </div>
          )}

          {form.mode !== 'slot' && (
            <div>
              <label htmlFor="occ-reason" className={label}>
                {t('السبب (يظهر للمدرب واللاعبين)', 'Reason (shown to the coach and players)')}
              </label>
              <input
                id="occ-reason"
                maxLength={300}
                className={input}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-lg border border-(--border-subtle) px-3 py-1.5 text-xs font-semibold text-(--text-muted)"
            >
              {t('إلغاء', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-(--accent-primary) px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {busy ? t('جارٍ الحفظ...', 'Saving...') : t('حفظ وإبلاغ', 'Save and notify')}
            </button>
          </div>
        </form>
      )}

      {loadError && <p className="text-xs text-rose-500">{loadError}</p>}

      {!loadError && occurrences === null && (
        <div className="space-y-2" aria-label={t('جارٍ التحميل', 'Loading')} role="status">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {occurrences && occurrences.length === 0 && (
        <p className="text-xs text-(--text-muted)">
          {t(
            'لا توجد حصص في الأسابيع القادمة. أضف موعداً أسبوعياً أولاً.',
            'No sessions in the coming weeks. Add a weekly slot first.',
          )}
        </p>
      )}

      {occurrences && occurrences.length > 0 && (
        <ul className="divide-y divide-(--border-subtle)">
          {occurrences.map((o) => (
            <li
              key={`${o.scheduleId ?? 'x'}-${o.exceptionId ?? ''}-${o.date}-${o.startTime}-${o.status}`}
              className="flex flex-wrap items-center justify-between gap-2 py-2.5"
            >
              <div className="min-w-0">
                <div
                  className={`text-xs font-semibold ${o.status === 'CANCELLED' || o.status === 'MOVED' ? 'line-through text-(--text-muted)' : 'text-(--text-main)'}`}
                >
                  {DAY_NAMES[locale][weekdayOf(o.date)]} <span dir="ltr">{o.date}</span> ·{' '}
                  <span dir="ltr">
                    {o.startTime}-{o.endTime}
                  </span>
                  {o.location ? ` · ${o.location}` : ''}
                </div>
                {(o.movedTo || o.originalDate || o.reason) && (
                  <div className="text-[11px] text-(--text-muted)">
                    {o.movedTo && (
                      <span className="inline-flex items-center gap-1">
                        <MoveRight className="h-3 w-3" aria-hidden="true" />
                        <span dir="ltr">
                          {o.movedTo.date} {o.movedTo.startTime}-{o.movedTo.endTime}
                        </span>
                      </span>
                    )}
                    {o.originalDate &&
                      t(`بدلاً من حصة ${o.originalDate}`, `Instead of ${o.originalDate}`)}
                    {o.reason && ` · ${o.reason}`}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[o.status]}`}
                >
                  {occurrenceStatusLabel(o.status, locale)}
                </span>
                {canManage && o.status === 'SCHEDULED' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setForm({ mode: 'cancel', occurrence: o, reason: '' })}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-500/10"
                    >
                      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('إلغاء', 'Cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          mode: 'move',
                          occurrence: o,
                          sessionDate: o.date,
                          startTime: o.startTime,
                          endTime: o.endTime,
                          reason: '',
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                    >
                      <MoveRight className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('نقل', 'Move')}
                    </button>
                  </>
                )}
                {canManage && o.exceptionId && o.status !== 'RESCHEDULED' && (
                  <button
                    type="button"
                    onClick={() => undo(o)}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-(--text-muted) hover:bg-(--bg-surface-subtle)"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('تراجع', 'Undo')}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
