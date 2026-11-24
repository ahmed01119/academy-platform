import { describe, expect, it } from 'vitest';
import { CreatePlayerSchema, type PlayerDetails, type TenantRole } from '@academy/shared';
import { canArchivePlayer, canViewSensitivePlayerData } from './player-permissions';
import {
  buildPlayerUpdatePayload,
  editFormFromPlayer,
  pastEnrollmentStatusLabel,
  playerGenderLabel,
  playerStatusLabel,
  validateBranchTransfer,
} from './player-profile';
import {
  buildCreatePlayerPayload,
  validateNewPlayerForm,
  type NewPlayerFormValues,
} from './new-player-form';
import { buildPlayersQuery, PLAYERS_PAGE_SIZE } from './hooks/usePlayersList';

const ROLES: TenantRole[] = [
  'OWNER',
  'MANAGER',
  'BRANCH_MANAGER',
  'RECEPTIONIST',
  'COACH',
  'ACCOUNTANT',
  'VIEWER',
];

describe('player permissions follow the documented matrix', () => {
  // docs/security/ROLE_PERMISSION_MATRIX.md: players.sensitive.read and players.delete.
  const legacySensitive = (role?: TenantRole) =>
    role === 'OWNER' || role === 'MANAGER' || role === 'BRANCH_MANAGER';
  const legacyDelete = (role?: TenantRole) => role === 'OWNER' || role === 'MANAGER';

  it.each([...ROLES, undefined])('role %s', (role) => {
    expect(canViewSensitivePlayerData(role)).toBe(legacySensitive(role));
    expect(canArchivePlayer(role)).toBe(legacyDelete(role));
  });

  it('handles a missing tenant membership', () => {
    expect(canViewSensitivePlayerData(null)).toBe(false);
    expect(canArchivePlayer(null)).toBe(false);
  });
});

const player = {
  id: 'p1',
  firstName: 'Omar',
  lastName: 'Ali',
  emergencyContactName: 'Uncle',
  emergencyContactPhone: '0100',
  medicalNotes: null,
  status: 'ACTIVE',
  enrollments: [
    { id: 'en-active', status: 'ACTIVE', branchId: 'b1' },
    { id: 'en-old', status: 'TRANSFERRED', branchId: 'b0' },
  ],
} as unknown as PlayerDetails;

describe('validateBranchTransfer', () => {
  it('requires an active enrollment', () => {
    const noActive = { ...player, enrollments: [] } as unknown as PlayerDetails;
    expect(validateBranchTransfer(noActive, 'b2', 'en')).toEqual({
      error: 'No active branch enrollment to transfer',
    });
    expect(validateBranchTransfer(null, 'b2', 'ar')).toEqual({
      error: 'لا يوجد اشتراك نشط حالياً لنقله',
    });
  });

  it('requires a target branch different from the current one', () => {
    expect(validateBranchTransfer(player, '', 'en')).toEqual({
      error: 'Please select target branch',
    });
    expect(validateBranchTransfer(player, 'b1', 'en')).toEqual({
      error: 'Athlete is already enrolled in this branch',
    });
  });

  it('returns the active enrollment id to transfer', () => {
    expect(validateBranchTransfer(player, 'b2', 'en')).toEqual({ enrollmentId: 'en-active' });
  });
});

describe('buildPlayerUpdatePayload', () => {
  const form = { ...editFormFromPlayer(player), firstName: ' Omar ', medicalNotes: ' Asthma ' };

  it('pre-fills from the player (null notes → empty string)', () => {
    expect(editFormFromPlayer(player).medicalNotes).toBe('');
  });

  it('F24 contract: never sends nationalId, and medicalNotes only with sensitive access', () => {
    // The API now rejects these fields (403) for roles without players.sensitive.read whenever
    // they are present, so a restricted user's edit must not contain them at all.
    for (const canViewSensitive of [true, false]) {
      expect(buildPlayerUpdatePayload(form, canViewSensitive)).not.toHaveProperty('nationalId');
    }
    expect(Object.keys(buildPlayerUpdatePayload(form, false))).not.toContain('medicalNotes');
  });

  it('includes medical notes only for users with sensitive access', () => {
    expect(buildPlayerUpdatePayload(form, true)).toEqual({
      firstName: 'Omar',
      lastName: 'Ali',
      emergencyContactName: 'Uncle',
      emergencyContactPhone: '0100',
      status: 'ACTIVE',
      medicalNotes: 'Asthma',
    });
    expect(buildPlayerUpdatePayload(form, false)).not.toHaveProperty('medicalNotes');
  });

  it('sends null to clear notes when emptied by an authorized user', () => {
    expect(buildPlayerUpdatePayload({ ...form, medicalNotes: '  ' }, true).medicalNotes).toBeNull();
  });
});

describe('player labels keep the existing Arabic and add English', () => {
  it.each([
    ['ACTIVE', 'نشط', 'Active'],
    ['SUSPENDED', 'موقوف', 'Suspended'],
    ['INACTIVE', 'غير نشط', 'Inactive'],
  ] as const)('%s', (status, ar, en) => {
    expect(playerStatusLabel(status, 'ar')).toBe(ar);
    expect(playerStatusLabel(status, 'en')).toBe(en);
  });

  it('gender and enrollment history', () => {
    expect(playerGenderLabel('MALE', 'ar')).toBe('ذكر');
    expect(playerGenderLabel('FEMALE', 'en')).toBe('Female');
    expect(pastEnrollmentStatusLabel('TRANSFERRED', 'ar')).toBe('تم النقل');
    expect(pastEnrollmentStatusLabel('COMPLETED', 'en')).toBe('Completed');
    expect(pastEnrollmentStatusLabel('CANCELLED', 'en')).toBe('Cancelled');
  });
});

const newForm: NewPlayerFormValues = {
  firstName: ' Omar ',
  lastName: ' Ali ',
  gender: 'MALE',
  birthYear: '2012',
  jerseyNumber: ' 10 ',
  nationalId: '',
  medicalNotes: '',
  guardianName: ' Ali  Hassan Omar ',
  guardianPhone: ' 01000000002 ',
  branchId: '33333333-3333-4333-8333-333333333333',
  enrollmentStartDate: '2026-09-01',
};

describe('F21: enrollment start date is sent to the API', () => {
  it('maps the form value to initialEnrollmentStartDate (accepted by the shared schema)', () => {
    const payload = buildCreatePlayerPayload(newForm, 'en');
    expect(payload.initialEnrollmentStartDate).toBe('2026-09-01');
    expect(CreatePlayerSchema.safeParse(payload).success).toBe(true);
  });

  it('omits it when empty so the API keeps its default (today)', () => {
    const payload = buildCreatePlayerPayload({ ...newForm, enrollmentStartDate: '' }, 'en');
    expect(payload).not.toHaveProperty('initialEnrollmentStartDate', expect.anything());
    expect(payload.initialEnrollmentStartDate).toBeUndefined();
  });
});

describe('validateNewPlayerForm (names → birth year → guardian → branch)', () => {
  it('accepts a complete form', () => {
    expect(validateNewPlayerForm(newForm, 'en', 2026)).toBeNull();
  });

  it.each([
    [{ firstName: '' }, "Please enter the player's first and last name"],
    [{ birthYear: '' }, 'Please enter a valid birth year between 1950 and 2026'],
    [{ birthYear: '1949' }, 'Please enter a valid birth year between 1950 and 2026'],
    [{ birthYear: '2027' }, 'Please enter a valid birth year between 1950 and 2026'],
    [{ birthYear: '12' }, 'Please enter a valid birth year between 1950 and 2026'],
    [{ guardianName: ' ' }, "Please enter the guardian's name"],
    [{ guardianPhone: '' }, "Please enter the guardian's phone"],
    [{ branchId: '' }, 'Please select a branch to enroll the player in'],
  ])('%j → %s', (patch, message) => {
    expect(validateNewPlayerForm({ ...newForm, ...patch }, 'en', 2026)).toBe(message);
  });
});

describe('buildCreatePlayerPayload', () => {
  it('produces a payload the API schema accepts', () => {
    expect(buildCreatePlayerPayload(newForm, 'en', 'SWIMMING').sport).toBe('SWIMMING');
    const payload = buildCreatePlayerPayload(newForm, 'en');
    expect(CreatePlayerSchema.safeParse(payload).success).toBe(true);
    expect(payload).toMatchObject({
      firstName: 'Omar',
      lastName: 'Ali',
      dateOfBirth: '2012-01-01',
      birthYear: 2012,
      jerseyNumber: 10,
      nationalId: undefined,
      medicalNotes: undefined,
      initialBranchId: newForm.branchId,
      sport: 'FOOTBALL',
      primaryGuardian: {
        firstName: 'Ali',
        lastName: 'Hassan Omar',
        relationship: 'FATHER',
        phone: '01000000002',
        isPrimary: true,
      },
    });
  });

  it("uses the guardian's name and phone as the emergency contact", () => {
    const payload = buildCreatePlayerPayload(newForm, 'en');
    expect(payload.emergencyContactName).toBe('Ali  Hassan Omar');
    expect(payload.emergencyContactPhone).toBe('01000000002');
  });

  it('sends January 1st and the numeric year of the birth year', () => {
    const payload = buildCreatePlayerPayload({ ...newForm, birthYear: '2013' }, 'en');
    expect(payload.dateOfBirth).toBe('2013-01-01');
    expect(payload.birthYear).toBe(2013);
  });

  it('falls back to localized placeholder guardian last name for single-word names', () => {
    expect(
      buildCreatePlayerPayload({ ...newForm, guardianName: 'Ali' }, 'ar').primaryGuardian,
    ).toMatchObject({
      firstName: 'Ali',
      lastName: 'أمر',
    });
    expect(
      buildCreatePlayerPayload({ ...newForm, guardianName: 'Ali' }, 'en').primaryGuardian.lastName,
    ).toBe('Contact');
  });
});

describe('buildPlayersQuery', () => {
  it('omits empty filters and uses the fixed page size', () => {
    expect(buildPlayersQuery(2, { searchTerm: '  ', branchId: '', status: '' })).toEqual({
      page: 2,
      limit: PLAYERS_PAGE_SIZE,
      search: undefined,
      branchId: undefined,
      status: undefined,
    });
    expect(
      buildPlayersQuery(1, { searchTerm: ' omar ', branchId: 'b1', status: 'ACTIVE' }),
    ).toMatchObject({
      search: 'omar',
      branchId: 'b1',
      status: 'ACTIVE',
    });
  });
});
