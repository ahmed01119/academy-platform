import { describe, expect, it } from 'vitest';
import { Permission, type TenantRole } from '@academy/shared';
import {
  buildPlayerSearchConditions,
  canViewSensitivePlayerData,
  duplicateNationalIdError,
  isNationalIdUniqueViolation,
} from './player-sensitive-data';

describe('canViewSensitivePlayerData', () => {
  it.each([
    ['OWNER', true],
    ['MANAGER', true],
    ['BRANCH_MANAGER', false], // retired 2026-11-24: grants nothing
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

describe('isNationalIdUniqueViolation', () => {
  const err = (code: string, target: unknown) => ({ code, meta: { target } });

  it.each([
    [['tenant_id', 'national_id']],
    ['unique_player_national_id_per_tenant'],
    [['nationalId']],
  ])('detects P2002 on the national ID constraint (%j)', (target) => {
    expect(isNationalIdUniqueViolation(err('P2002', target))).toBe(true);
  });

  it.each([
    [err('P2002', ['qr_card_code'])],
    [err('P2002', 'players_user_id_key')],
    [err('P2025', ['national_id'])],
    [new Error('boom')],
    [null],
    ['P2002'],
  ])('ignores anything else (%j)', (value) => {
    expect(isNationalIdUniqueViolation(value)).toBe(false);
  });
});

describe('duplicateNationalIdError', () => {
  it('is a generic 400 without the permission', () => {
    const e = duplicateNationalIdError(false);
    expect(e.getStatus()).toBe(400);
    expect(JSON.stringify(e.getResponse())).not.toMatch(/national/i);
  });

  it('is the specific 409 with the permission', () => {
    const e = duplicateNationalIdError(true);
    expect(e.getStatus()).toBe(409);
    expect(JSON.stringify(e.getResponse())).toContain('National ID is already registered');
  });
});
