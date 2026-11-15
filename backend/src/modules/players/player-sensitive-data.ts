import type { Prisma } from '@prisma/client';
import { hasPermission, Permission, type TenantContext } from '@academy/shared';

/**
 * Server-side protection of sensitive player data (national ID, medical notes).
 *
 * Single source of truth for every player response and search: callers without
 * `players.sensitive.read` never receive these values and cannot match on them.
 * (Previously the detail/update paths masked, but the list response and list search did not.)
 */

/** True when the actor holds `players.sensitive.read` (explicit permission or via role). */
export function canViewSensitivePlayerData(
  ctx: Pick<TenantContext, 'role' | 'permissions'>,
): boolean {
  return Boolean(
    ctx.permissions?.includes(Permission.PLAYERS_SENSITIVE_READ) ||
    (ctx.role && hasPermission(ctx.role, Permission.PLAYERS_SENSITIVE_READ)),
  );
}

/**
 * Roster search conditions. National ID is a search key only for actors who may see it;
 * otherwise a search would reveal whether a given ID exists (enumeration oracle).
 */
export function buildPlayerSearchConditions(
  term: string,
  canViewSensitive: boolean,
): Prisma.PlayerWhereInput[] {
  return [
    { firstName: { contains: term, mode: 'insensitive' } },
    { lastName: { contains: term, mode: 'insensitive' } },
    ...(canViewSensitive ? [{ nationalId: { contains: term } }] : []),
    { emergencyContactPhone: { contains: term } },
    {
      guardians: {
        some: {
          OR: [
            { firstName: { contains: term, mode: 'insensitive' } },
            { lastName: { contains: term, mode: 'insensitive' } },
            { phone: { contains: term } },
          ],
        },
      },
    },
  ];
}
