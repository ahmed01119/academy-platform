import { describe, expect, it } from 'vitest';
import { Permission, type TenantRole } from '@academy/shared';
import { buildPlayerSearchConditions, canViewSensitivePlayerData } from './player-sensitive-data';

describe('canViewSensitivePlayerData', () => {
  it.each([
    ['OWNER', true],
    ['MANAGER', true],
    ['BRANCH_MANAGER', true],
    ['RECEPTIONIST', false],
    ['COACH', false],
    ['ACCOUNTANT', false],
    ['VIEWER', false],
  ] as Array<[TenantRole, boolean]>)('role %s → %s', (role, expected) => {
    expect(canViewSensitivePlayerData({ role, permissions: [] })).toBe(expected);
  });

  it('honours an explicit permission grant and denies when nothing is known', () => {
    expect(canViewSensitivePlayerData({ permissions: [Permission.PLAYERS_SENSITIVE_READ] })).toBe(
      true,
    );
    expect(canViewSensitivePlayerData({})).toBe(false);
  });
});

describe('buildPlayerSearchConditions', () => {
  it('excludes nationalId for restricted actors, includes it for privileged ones', () => {
    expect(JSON.stringify(buildPlayerSearchConditions('123', false))).not.toContain('nationalId');
    expect(JSON.stringify(buildPlayerSearchConditions('123', true))).toContain('nationalId');
  });

  it('keeps every other search key unchanged', () => {
    const restricted = buildPlayerSearchConditions('x', false);
    const privileged = buildPlayerSearchConditions('x', true);
    expect(privileged.length - restricted.length).toBe(1);
    for (const key of ['firstName', 'lastName', 'emergencyContactPhone', 'guardians']) {
      expect(JSON.stringify(restricted)).toContain(key);
    }
  });
});
