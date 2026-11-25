'use client';

import React from 'react';
import { CalendarClock } from 'lucide-react';
import type { GroupOccurrenceStatus } from '@academy/shared';
import { occurrenceStatusLabel } from '@/features/groups/components/GroupCalendarPanel';

export interface UpcomingSessionItem {
  id: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  groupName: string;
  branchName?: string;
  status?: GroupOccurrenceStatus;
  note?: string | null;
}

/**
 * Next sessions from the group timetable, with cancelled / moved / extra sessions marked (guardian portal; the player
 * portal renders its own cards with the same status labels).
 */
export function UpcomingSessionsList({
  sessions,
  locale,
}: {
  sessions: UpcomingSessionItem[];
  locale: 'ar' | 'en';
}) {
  const ar = locale === 'ar';
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-(--text-main) flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-purple-500" aria-hidden="true" />
        <span>{ar ? 'الحصص القادمة' : 'Upcoming sessions'}</span>
      </h2>
      {sessions.length === 0 ? (
        <div className="rounded-xl border border-(--border-subtle) bg-(--bg-surface) p-6 text-center text-xs text-(--text-muted)">
          {ar ? 'لا توجد حصص في الأسبوعين القادمين.' : 'No sessions in the next two weeks.'}
        </div>
      ) : (
        <ul className="rounded-xl border border-(--border-subtle) bg-(--bg-surface) divide-y divide-(--border-subtle)">
          {sessions.map((s) => {
            const off = s.status === 'CANCELLED' || s.status === 'MOVED';
            return (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3 text-xs"
              >
                <div>
                  <div
                    className={`font-semibold ${off ? 'line-through text-(--text-muted)' : 'text-(--text-main)'}`}
                  >
                    <span dir="ltr">{s.sessionDate}</span> ·{' '}
                    <span dir="ltr">
                      {s.startTime}-{s.endTime}
                    </span>{' '}
                    · {s.groupName}
                  </div>
                  {s.note && (
                    <div className="text-[11px] text-(--text-muted)">
                      {s.status === 'MOVED' ? (ar ? 'إلى ' : 'to ') : ''}
                      {s.note}
                    </div>
                  )}
                </div>
                {s.status && s.status !== 'SCHEDULED' && (
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                      off
                        ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {occurrenceStatusLabel(s.status, locale)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
