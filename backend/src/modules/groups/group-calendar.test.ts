import { describe, expect, it } from 'vitest';
import {
  addDays,
  buildGroupCalendar,
  dayOfWeek,
  todayInCairo,
  type TimetableChange,
  type WeeklySlot,
} from './group-calendar';

// 2026-11-29 is a Sunday.
const SUN = {
  id: 's-sun',
  dayOfWeek: 0,
  startTime: '17:00',
  endTime: '18:30',
  location: 'Pitch 1',
  status: 'ACTIVE',
} as WeeklySlot;
const TUE = {
  id: 's-tue',
  dayOfWeek: 2,
  startTime: '18:00',
  endTime: '19:00',
  location: null,
  status: 'ACTIVE',
} as WeeklySlot;
const OFF = {
  id: 's-off',
  dayOfWeek: 1,
  startTime: '10:00',
  endTime: '11:00',
  location: null,
  status: 'INACTIVE',
} as WeeklySlot;

const change = (
  c: Partial<TimetableChange> & Pick<TimetableChange, 'id' | 'kind'>,
): TimetableChange => ({
  scheduleId: null,
  originalDate: null,
  sessionDate: null,
  startTime: null,
  endTime: null,
  location: null,
  reason: null,
  ...c,
});

describe('date helpers', () => {
  it('weekday and day arithmetic on calendar dates', () => {
    expect(dayOfWeek('2026-11-29')).toBe(0);
    expect(dayOfWeek('2026-12-01')).toBe(2);
    expect(addDays('2026-11-29', 7)).toBe('2026-12-06');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it("today is the academies' day (Cairo), not the server's UTC day", () => {
    // 23:30 UTC on 30 Nov is already 1 Dec in Cairo (UTC+2)
    expect(todayInCairo(new Date('2026-11-30T23:30:00Z'))).toBe('2026-12-01');
  });
});

describe('buildGroupCalendar', () => {
  it('repeats every active weekly slot, sorted, and skips inactive ones', () => {
    const occ = buildGroupCalendar([TUE, SUN, OFF], [], '2026-11-29', '2026-12-12');
    expect(occ.map((o) => `${o.date} ${o.startTime} ${o.status}`)).toEqual([
      '2026-11-29 17:00 SCHEDULED',
      '2026-12-01 18:00 SCHEDULED',
      '2026-12-06 17:00 SCHEDULED',
      '2026-12-08 18:00 SCHEDULED',
    ]);
  });

  it('marks a cancelled occurrence and keeps the rest of the week as usual', () => {
    const occ = buildGroupCalendar(
      [SUN, TUE],
      [
        change({
          id: 'c1',
          kind: 'CANCELLED',
          scheduleId: 's-sun',
          originalDate: '2026-11-29',
          reason: 'Rain',
        }),
      ],
      '2026-11-29',
      '2026-12-05',
    );
    expect(occ[0]).toMatchObject({
      date: '2026-11-29',
      status: 'CANCELLED',
      exceptionId: 'c1',
      reason: 'Rain',
    });
    expect(occ[1]).toMatchObject({ date: '2026-12-01', status: 'SCHEDULED' });
  });

  it('a moved occurrence shows where it went, and appears at its new time', () => {
    const occ = buildGroupCalendar(
      [SUN],
      [
        change({
          id: 'm1',
          kind: 'MOVED',
          scheduleId: 's-sun',
          originalDate: '2026-11-29',
          sessionDate: '2026-11-30',
          startTime: '19:00',
          endTime: '20:00',
        }),
      ],
      '2026-11-29',
      '2026-12-05',
    );
    expect(occ).toHaveLength(2);
    expect(occ[0]).toMatchObject({
      date: '2026-11-29',
      status: 'MOVED',
      movedTo: { date: '2026-11-30', startTime: '19:00', endTime: '20:00' },
    });
    expect(occ[1]).toMatchObject({
      date: '2026-11-30',
      status: 'RESCHEDULED',
      originalDate: '2026-11-29',
      location: 'Pitch 1', // the slot's place unless the move names another
    });
  });

  it('adds extra sessions inside the range only', () => {
    const extra = (id: string, date: string) =>
      change({
        id,
        kind: 'EXTRA',
        sessionDate: date,
        startTime: '09:00',
        endTime: '10:00',
        location: 'Hall',
      });
    const occ = buildGroupCalendar(
      [],
      [extra('e1', '2026-12-02'), extra('e2', '2027-01-20')],
      '2026-11-29',
      '2026-12-12',
    );
    expect(occ).toEqual([
      expect.objectContaining({
        date: '2026-12-02',
        status: 'EXTRA',
        exceptionId: 'e1',
        location: 'Hall',
      }),
    ]);
  });
});
