import { describe, expect, it } from 'vitest';
import { CreatePlayerSchema, isCalendarDate } from './player';

const base = {
  firstName: 'Omar',
  lastName: 'Ali',
  dateOfBirth: '2012-05-04',
  emergencyContactName: 'Uncle Sami',
  emergencyContactPhone: '01000000001',
  primaryGuardian: { firstName: 'Ali', lastName: 'Hassan', phone: '01000000002' },
  initialBranchId: '33333333-3333-4333-8333-333333333333',
};

describe('isCalendarDate', () => {
  it.each(['2026-01-01', '2024-02-29', '2026-12-31'])('accepts %s', (d) => {
    expect(isCalendarDate(d)).toBe(true);
  });

  it.each([
    '2026-02-29',
    '2026-02-31',
    '2026-13-01',
    '2026-00-10',
    '2026-04-31',
    '26-01-01',
    '2026/01/01',
    '',
  ])('rejects %j', (d) => {
    expect(isCalendarDate(d)).toBe(false);
  });
});

describe('CreatePlayerSchema.initialEnrollmentStartDate (F21)', () => {
  it('is optional — existing clients keep working unchanged', () => {
    const parsed = CreatePlayerSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.initialEnrollmentStartDate).toBeUndefined();
  });

  it('accepts a valid YYYY-MM-DD date', () => {
    const parsed = CreatePlayerSchema.safeParse({
      ...base,
      initialEnrollmentStartDate: '2026-09-01',
    });
    expect(parsed.success).toBe(true);
  });

  it.each(['2026-02-31', '01/09/2026', '2026-9-1', '2026-09-01T00:00:00Z'])(
    'rejects %j',
    (value) => {
      expect(
        CreatePlayerSchema.safeParse({ ...base, initialEnrollmentStartDate: value }).success,
      ).toBe(false);
    },
  );
});
