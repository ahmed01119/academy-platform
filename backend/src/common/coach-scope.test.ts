import { describe, expect, it } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import type { TenantContext } from '@academy/shared';
import {
  assertCoachCanSee,
  coachGroupWhere,
  coachPlayerWhere,
  coachSessionWhere,
  isCoachContext,
} from './coach-scope';

const ctx = (role: TenantContext['role']): TenantContext =>
  ({ tenantId: 't', actorUserId: 'coach-1', role }) as TenantContext;

describe('coach scope (owner decision 2026-11-24: a coach sees only their own groups)', () => {
  it('applies to coaches only', () => {
    expect(isCoachContext(ctx('COACH'))).toBe(true);
    expect(isCoachContext(ctx('MANAGER'))).toBe(false);
    expect(isCoachContext(ctx('OWNER'))).toBe(false);
  });

  it('narrows groups, sessions and players to the coach', () => {
    expect(coachGroupWhere('coach-1')).toEqual({ coaches: { some: { coachUserId: 'coach-1' } } });
    expect(coachSessionWhere('coach-1')).toEqual({
      OR: [
        { coachUserId: 'coach-1' },
        { group: { coaches: { some: { coachUserId: 'coach-1' } } } },
      ],
    });
    expect(coachPlayerWhere('coach-1')).toEqual({
      groupMemberships: {
        some: { status: 'ACTIVE', group: { coaches: { some: { coachUserId: 'coach-1' } } } },
      },
    });
  });

  it('answers 404 to a coach for records outside their groups, and never blocks other roles', () => {
    expect(() => assertCoachCanSee(ctx('COACH'), false, 'Player')).toThrow(NotFoundException);
    expect(() => assertCoachCanSee(ctx('COACH'), true, 'Player')).not.toThrow();
    expect(() => assertCoachCanSee(ctx('MANAGER'), false, 'Player')).not.toThrow();
  });
});
