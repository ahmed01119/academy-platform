import { NotFoundException } from '@nestjs/common';
import { ErrorCode, type TenantContext } from '@academy/shared';
import type { Prisma } from '@academy/database';

/**
 * A coach sees only their own groups (owner decision 2026-11-24): the groups they coach, the sessions of those groups
 * (or sessions they lead), and the players who are active members of those groups. Other academy roles are not
 * narrowed here. Lists add these filters; single records are checked with `assertCoachCanSee`, which answers 404 so a
 * coach cannot learn that a record exists.
 */
export function isCoachContext(tenantContext: TenantContext): boolean {
  return tenantContext.role === 'COACH';
}

export function coachGroupWhere(coachUserId: string): Prisma.TrainingGroupWhereInput {
  return { coaches: { some: { coachUserId } } };
}

export function coachSessionWhere(coachUserId: string): Prisma.AttendanceSessionWhereInput {
  return { OR: [{ coachUserId }, { group: coachGroupWhere(coachUserId) }] };
}

export function coachPlayerWhere(coachUserId: string): Prisma.PlayerWhereInput {
  return {
    groupMemberships: { some: { status: 'ACTIVE', group: coachGroupWhere(coachUserId) } },
  };
}

/** Throws 404 when a coach asks for a record outside their groups; does nothing for other roles. */
export function assertCoachCanSee(
  tenantContext: TenantContext,
  visible: boolean,
  what: 'Group' | 'Session' | 'Player',
): void {
  if (isCoachContext(tenantContext) && !visible) {
    throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: `${what} not found` });
  }
}
