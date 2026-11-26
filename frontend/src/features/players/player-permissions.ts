import { hasPermission, Permission, type TenantRole } from '@academy/shared';

/**
 * Player-page UI permissions, derived from the shared RBAC matrix (`ROLE_PERMISSIONS`) instead of
 * hard-coded role lists. These only decide what the UI shows; the API enforces the same permissions.
 */

/** May see/edit national ID and medical notes (`players.sensitive.read`). */
export function canViewSensitivePlayerData(role: TenantRole | null | undefined): boolean {
  return Boolean(role && hasPermission(role, Permission.PLAYERS_SENSITIVE_READ));
}

/** May hand guardians a link code for the guardian portal (`players.update`, as the API requires). */
export function canIssueGuardianLinkCode(role: TenantRole | null | undefined): boolean {
  return Boolean(role && hasPermission(role, Permission.PLAYERS_UPDATE));
}

/** May archive (safe-delete) a player (`players.delete`). */
export function canArchivePlayer(role: TenantRole | null | undefined): boolean {
  return Boolean(role && hasPermission(role, Permission.PLAYERS_DELETE));
}
