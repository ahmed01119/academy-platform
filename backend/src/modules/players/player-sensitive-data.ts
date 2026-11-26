import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  type HttpException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ErrorCode, hasPermission, Permission, type TenantContext } from '@academy/shared';

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

// ─── F23: duplicate national ID without an existence oracle ─────────────────────────

/** Generic message for actors who may not read national IDs (reveals nothing about existence). */
export const GENERIC_PLAYER_SAVE_ERROR =
  'The player could not be saved. Please review the entered details and try again.';

/**
 * Error for a national ID that is already registered in the tenant.
 * - With `players.sensitive.read`: 409 CONFLICT with the specific duplicate message (unchanged).
 * - Without it: a generic 400 VALIDATION_FAILED that does not mention the national ID.
 */
export function duplicateNationalIdError(canViewSensitive: boolean): HttpException {
  if (canViewSensitive) {
    return new ConflictException({
      code: ErrorCode.CONFLICT,
      message: 'A player with this National ID is already registered in this academy',
    });
  }
  return new BadRequestException({
    code: ErrorCode.VALIDATION_FAILED,
    message: GENERIC_PLAYER_SAVE_ERROR,
  });
}

/** Name of the partial unique index on (tenant_id, national_id) — see migration 20261021040000. */
const NATIONAL_ID_UNIQUE_INDEX = 'unique_player_national_id_per_tenant';

/**
 * True for a Prisma unique-constraint violation (P2002) on the per-tenant national ID index.
 * Covers the race where two writes pass the pre-check; without this, the global filter would
 * answer `409 "A record with this tenant_id, national_id already exists"` to any role.
 */
export function isNationalIdUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; meta?: { target?: unknown } };
  if (e.code !== 'P2002') return false;
  const target = e.meta?.target;
  const parts = Array.isArray(target) ? target.map(String) : [String(target ?? '')];
  return parts.some(
    (t) => t === NATIONAL_ID_UNIQUE_INDEX || t === 'national_id' || t === 'nationalId',
  );
}

// ─── F24: sensitive fields are write-protected on update ─────────────────────────────

/**
 * Rejects any attempt by an actor without `players.sensitive.read` to change national ID or
 * medical notes. Presence-based on purpose: comparing with the stored value would let a caller
 * confirm a guess (request succeeds only when the guess matches).
 * Creating a player with a national ID stays allowed (owner decision 2026-11-15).
 */
export function assertMaySetSensitiveFieldsOnUpdate(
  dto: { nationalId?: unknown; medicalNotes?: unknown },
  canViewSensitive: boolean,
): void {
  if (canViewSensitive) return;
  if (dto.nationalId !== undefined) {
    throw new ForbiddenException({
      code: ErrorCode.FORBIDDEN,
      message: 'You do not have permission to modify the national ID',
    });
  }
  if (dto.medicalNotes !== undefined) {
    throw new ForbiddenException({
      code: ErrorCode.FORBIDDEN,
      message: 'You do not have permission to modify sensitive medical notes',
    });
  }
}
