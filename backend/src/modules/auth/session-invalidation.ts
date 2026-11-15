import type { Prisma } from '@academy/database';

/**
 * Immediately invalidates every session of a user (K13b).
 *
 * Order matters: the user row is updated FIRST (incrementing session_version takes its row lock, which serialises
 * against refresh-token rotation's `FOR SHARE`), THEN all refresh tokens are revoked in a new statement, so a token
 * created by a rotation that ran just before is also revoked. Access tokens carrying an older version are rejected by
 * JwtStrategy on their next request. Call inside the caller's transaction so it commits atomically with any other
 * change passed in `extraUserData` (e.g. a new password hash).
 */
export async function invalidateUserSessions(
  tx: Prisma.TransactionClient,
  userId: string,
  extraUserData: Prisma.UserUpdateInput = {},
): Promise<{ sessionVersion: number; revokedCount: number }> {
  const updated = await tx.user.update({
    where: { id: userId },
    data: { ...extraUserData, sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  const revoked = await tx.refreshToken.updateMany({
    where: { userId, isRevoked: false },
    data: { isRevoked: true },
  });
  return { sessionVersion: updated.sessionVersion, revokedCount: revoked.count };
}
