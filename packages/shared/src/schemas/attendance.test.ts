import { describe, expect, it } from 'vitest';
import { AttendanceMutationSchema } from './attendance';

const validMutation = {
  sessionId: '00000000-0000-4000-8000-000000000101',
  playerId: '00000000-0000-4000-8000-000000000102',
  status: 'PRESENT',
  idempotencyKey: '00000000-0000-4000-8000-000000000103',
};

describe('attendance mutation validation', () => {
  it('accepts a valid check-in request', () => {
    expect(AttendanceMutationSchema.safeParse(validMutation).success).toBe(true);
  });

  it('rejects unmarked as a submitted attendance state', () => {
    expect(
      AttendanceMutationSchema.safeParse({ ...validMutation, status: 'UNMARKED' }).success,
    ).toBe(false);
  });

  it('requires a valid idempotency key', () => {
    expect(
      AttendanceMutationSchema.safeParse({ ...validMutation, idempotencyKey: 'duplicate' }).success,
    ).toBe(false);
  });

  it('rejects negative record versions', () => {
    expect(
      AttendanceMutationSchema.safeParse({ ...validMutation, expectedVersion: -1 }).success,
    ).toBe(false);
  });
});
