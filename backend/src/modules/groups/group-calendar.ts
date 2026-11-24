import type { GroupOccurrence } from '@academy/shared';

/** A weekly slot of the timetable (training_schedules). `dayOfWeek`: 0 = Sunday … 6 = Saturday. */
export interface WeeklySlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}

/** A one-off change (schedule_exceptions), dates as YYYY-MM-DD. */
export interface TimetableChange {
  id: string;
  kind: 'CANCELLED' | 'MOVED' | 'EXTRA';
  scheduleId: string | null;
  originalDate: string | null;
  sessionDate: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  reason: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD → UTC midnight (calendar dates carry no time zone). */
export function parseDay(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

export function formatDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return formatDay(parseDay(date) + days * DAY_MS);
}

/** 0 = Sunday … 6 = Saturday, as in training_schedules.day_of_week. */
export function dayOfWeek(date: string): number {
  return new Date(parseDay(date)).getUTCDay();
}

/** Today in Cairo (the academies' time zone) as YYYY-MM-DD. */
export function todayInCairo(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(now);
}

/**
 * The planned sessions of a group between `from` and `to` (inclusive): every weekly occurrence of the ACTIVE slots,
 * marked CANCELLED or MOVED when a change names it, plus the new times of moved occurrences (RESCHEDULED) and the extra
 * sessions. Sorted by date and start time.
 */
export function buildGroupCalendar(
  slots: WeeklySlot[],
  changes: TimetableChange[],
  from: string,
  to: string,
): GroupOccurrence[] {
  const byOccurrence = new Map<string, TimetableChange>();
  for (const c of changes) {
    if (c.scheduleId && c.originalDate) byOccurrence.set(`${c.scheduleId}|${c.originalDate}`, c);
  }

  const occurrences: GroupOccurrence[] = [];
  const active = slots.filter((s) => s.status === 'ACTIVE');
  for (let day = parseDay(from); day <= parseDay(to); day += DAY_MS) {
    const date = formatDay(day);
    const weekday = new Date(day).getUTCDay();
    for (const slot of active) {
      if (slot.dayOfWeek !== weekday) continue;
      const change = byOccurrence.get(`${slot.id}|${date}`);
      occurrences.push({
        date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        location: slot.location,
        status: change ? (change.kind === 'CANCELLED' ? 'CANCELLED' : 'MOVED') : 'SCHEDULED',
        scheduleId: slot.id,
        exceptionId: change?.id ?? null,
        reason: change?.reason ?? null,
        originalDate: null,
        movedTo:
          change?.kind === 'MOVED' && change.sessionDate && change.startTime && change.endTime
            ? { date: change.sessionDate, startTime: change.startTime, endTime: change.endTime }
            : null,
      });
    }
  }

  for (const c of changes) {
    if (c.kind === 'CANCELLED' || !c.sessionDate || !c.startTime || !c.endTime) continue;
    if (c.sessionDate < from || c.sessionDate > to) continue;
    const slot = c.scheduleId ? slots.find((s) => s.id === c.scheduleId) : undefined;
    occurrences.push({
      date: c.sessionDate,
      startTime: c.startTime,
      endTime: c.endTime,
      location: c.location ?? slot?.location ?? null,
      status: c.kind === 'MOVED' ? 'RESCHEDULED' : 'EXTRA',
      scheduleId: c.scheduleId,
      exceptionId: c.id,
      reason: c.reason,
      originalDate: c.kind === 'MOVED' ? c.originalDate : null,
      movedTo: null,
    });
  }

  return occurrences.sort(
    (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
  );
}
