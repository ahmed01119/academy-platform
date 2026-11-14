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
  firstName: ' Omar ',
  lastName: ' Ali ',
  gender: 'MALE',
  birthYearOnly: false,
  birthYear: '',
  dateOfBirth: '2012-05-04',
  jerseyNumber: ' 10 ',
  nationalId: ' 29901011234567 ',
  emergencyContactName: ' Uncle Sami ',
  emergencyContactPhone: '0100000001',
  medicalNotes: ' Asthma ',
  guardianName: ' Ali Hassan ',
  guardianRelationship: 'FATHER',
  phone: '',
  email: ' parent@example.com ',
};

describe('buildPlayerJoinRequest', () => {
  it('produces exactly the current API contract (unchanged mapping)', () => {
    const { payload } = buildPlayerJoinRequest(form);
    expect(payload).toEqual({
      tenantId: form.tenantId,
      playerName: 'Omar Ali',
      contactEmail: 'parent@example.com',
      contactPhone: '0100000001', // falls back to the emergency phone
      dateOfBirth: '2012-05-04',
      guardianName: 'Ali Hassan',
    });
    expect(CreatePlayerJoinRequestSchema.safeParse(payload).success).toBe(true);
  });

  it('uses Jan 1st when only the birth year is known', () => {
    const { payload } = buildPlayerJoinRequest({ ...form, birthYearOnly: true, birthYear: '2013' });
    expect(payload.dateOfBirth).toBe('2013-01-01');
  });

  it('keeps every unsupported field explicitly instead of discarding it (F17)', () => {
    const { pendingBackendSupport } = buildPlayerJoinRequest(form);
    expect(pendingBackendSupport).toEqual({
      gender: 'MALE',
      jerseyNumber: '10',
      nationalId: '29901011234567',
      emergencyContactName: 'Uncle Sami',
      medicalNotes: 'Asthma',
      guardianRelationship: 'FATHER',
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
    const contractKeys = Object.keys(CreatePlayerJoinRequestSchema.shape);
    for (const field of JOIN_FIELDS_PENDING_BACKEND_SUPPORT) {
      expect(contractKeys).not.toContain(field);
    }
  });
});

describe('validatePlayerJoinForm (order: academy → name → guardian → email)', () => {
  it('accepts a complete form', () => {
    expect(validatePlayerJoinForm(form, 'en')).toBeNull();
  });

  it.each([
    [{ tenantId: '' }, 'Please select an academy'],
    [{ firstName: ' ', lastName: '' }, 'Please enter player first and last name'],
    [{ guardianName: ' ' }, 'Please enter guardian name'],
    [{ email: '' }, 'Please enter contact email address'],
  ])('%j → %s', (patch, message) => {
    expect(validatePlayerJoinForm({ ...form, ...patch }, 'en')).toBe(message);
  });

  it('does not require the pending fields', () => {
    expect(
      validatePlayerJoinForm(
        { ...form, nationalId: '', medicalNotes: '', jerseyNumber: '', emergencyContactName: '' },
        'ar',
      ),
    ).toBeNull();
  });
});
