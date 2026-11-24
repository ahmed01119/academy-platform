import { describe, expect, it } from 'vitest';
import { CreatePlayerJoinRequestSchema } from '@academy/shared';
import {
  JOIN_FIELDS_PENDING_BACKEND_SUPPORT,
  SENSITIVE_JOIN_FIELDS,
  buildPlayerJoinRequest,
  validatePlayerJoinForm,
  type PlayerJoinFormValues,
} from './player-join-request';

const form: PlayerJoinFormValues = {
  tenantId: '22222222-2222-4222-8222-222222222222',
  requesterType: 'GUARDIAN',
  firstName: ' Omar ',
  lastName: ' Ali ',
  gender: 'MALE',
  birthYear: ' 2012 ',
  jerseyNumber: ' 10 ',
  nationalId: ' 29901011234567 ',
  medicalNotes: ' Asthma ',
  guardianName: ' Ali Hassan ',
  guardianPhone: ' 0100000001 ',
  email: ' parent@example.com ',
  password: 'Str0ng-Passw0rd!',
  confirmPassword: 'Str0ng-Passw0rd!',
};

describe('buildPlayerJoinRequest', () => {
  it('produces exactly the API contract, with the password for a new account', () => {
    const { payload } = buildPlayerJoinRequest(form);
    expect(payload).toEqual({
      tenantId: form.tenantId,
      requesterType: 'GUARDIAN',
      password: 'Str0ng-Passw0rd!',
      playerName: 'Omar Ali',
      contactEmail: 'parent@example.com',
      contactPhone: '0100000001', // the guardian's phone
      dateOfBirth: '2012-01-01', // the birth year only
      guardianName: 'Ali Hassan',
    });
    expect(CreatePlayerJoinRequestSchema.safeParse(payload).success).toBe(true);
  });

  it('never sends a password for a signed-in applicant (the API links their account)', () => {
    const { payload } = buildPlayerJoinRequest(form, true);
    expect(payload).not.toHaveProperty('password');
    expect(payload.requesterType).toBe('GUARDIAN');
  });

  it('sends January 1st of the birth year', () => {
    const { payload } = buildPlayerJoinRequest({ ...form, birthYear: '2013' });
    expect(payload.dateOfBirth).toBe('2013-01-01');
  });

  it('keeps every unsupported field explicitly instead of discarding it (F17)', () => {
    const { pendingBackendSupport } = buildPlayerJoinRequest(form);
    expect(pendingBackendSupport).toEqual({
      gender: 'MALE',
      jerseyNumber: '10',
      nationalId: '29901011234567',
      medicalNotes: 'Asthma',
    });
    expect(Object.keys(pendingBackendSupport).sort()).toEqual(
      [...JOIN_FIELDS_PENDING_BACKEND_SUPPORT].sort(),
    );
  });

  it('never sends sensitive or unsupported fields in the request payload', () => {
    const { payload } = buildPlayerJoinRequest(form);
    const serialized = JSON.stringify(payload);
    for (const field of JOIN_FIELDS_PENDING_BACKEND_SUPPORT) {
      expect(payload).not.toHaveProperty(field);
    }
    expect(serialized).not.toContain('29901011234567');
    expect(serialized).not.toContain('Asthma');
  });

  it('flags national ID and medical notes as sensitive for the backend phase', () => {
    expect([...SENSITIVE_JOIN_FIELDS].sort()).toEqual(['medicalNotes', 'nationalId']);
  });

  it('pending list matches what the API contract really lacks (detects contract drift)', () => {
    const contractKeys = Object.keys(CreatePlayerJoinRequestSchema.innerType().shape);
    for (const field of JOIN_FIELDS_PENDING_BACKEND_SUPPORT) {
      expect(contractKeys).not.toContain(field);
    }
  });
});

describe('validatePlayerJoinForm (order: academy → name → birth year → guardian → email → password)', () => {
  it('accepts a complete form', () => {
    expect(validatePlayerJoinForm(form, 'en')).toBeNull();
  });

  it.each([
    [{ tenantId: '' }, 'Please select an academy'],
    [{ firstName: ' ', lastName: '' }, "Please enter the player's first and last name"],
    [{ birthYear: '' }, 'Please enter a valid birth year between 1950 and 2026'],
    [{ birthYear: '2027' }, 'Please enter a valid birth year between 1950 and 2026'],
    [{ guardianName: ' ' }, "Please enter the guardian's name"],
    [{ guardianPhone: ' ' }, "Please enter the guardian's phone"],
    [{ email: '' }, "Please enter your (the guardian's) e-mail"],
    [{ password: 'short', confirmPassword: 'short' }, 'Password must be at least 8 characters'],
    [{ confirmPassword: 'Different-1' }, 'Passwords do not match'],
  ])('%j → %s', (patch, message) => {
    expect(validatePlayerJoinForm({ ...form, ...patch }, 'en', false, 2026)).toBe(message);
  });

  it("PLAYER request: the player's own e-mail is the sign-in; no guardian e-mail is asked", () => {
    const player = {
      ...form,
      requesterType: 'PLAYER' as const,
      playerEmail: ' player@example.com ',
    };
    expect(validatePlayerJoinForm({ ...player, playerEmail: '' }, 'en')).toBe(
      "Please enter your (the player's) e-mail",
    );
    expect(validatePlayerJoinForm({ ...player, email: '' }, 'en')).toBeNull();
    const { payload } = buildPlayerJoinRequest(player);
    expect(payload.contactEmail).toBe('player@example.com');
    expect(payload.guardianEmail).toBeUndefined();
  });

  it('GUARDIAN request: the guardian e-mail is the sign-in and no separate guardian e-mail is sent', () => {
    const { payload } = buildPlayerJoinRequest(form);
    expect(payload.contactEmail).toBe('parent@example.com');
    expect(payload.guardianEmail).toBeUndefined();
  });

  it('does not ask a signed-in applicant for a password', () => {
    expect(
      validatePlayerJoinForm({ ...form, password: '', confirmPassword: '' }, 'en', true),
    ).toBeNull();
  });

  it('does not require the pending fields', () => {
    expect(
      validatePlayerJoinForm({ ...form, nationalId: '', medicalNotes: '', jerseyNumber: '' }, 'ar'),
    ).toBeNull();
  });
});
