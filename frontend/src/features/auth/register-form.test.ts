import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/http/api-error';
import {
  firstInvalidField,
  resolveRegisterError,
  validateRegisterForm,
  type RegisterFormValues,
} from './register-form';

const valid: RegisterFormValues = {
  academyName: 'Stars Academy',
  sport: 'FOOTBALL',
  city: 'Cairo',
  ownerName: 'Owner Name',
  email: 'Owner@Example.com',
  phone: '+20 100-123-4567',
  password: 'Str0ng!Pass',
  confirmPassword: 'Str0ng!Pass',
};

describe('validateRegisterForm', () => {
  it('accepts a complete, valid form', () => {
    expect(validateRegisterForm(valid, 'en')).toEqual({});
  });

  it('enforces the shared password policy (uppercase, digit, symbol)', () => {
    const errs = validateRegisterForm(
      { ...valid, password: 'weakpass', confirmPassword: 'weakpass' },
      'en',
    );
    expect(errs.password).toBeTruthy();
  });

  it('localizes field errors in Arabic', () => {
    const errs = validateRegisterForm({ ...valid, academyName: 'A', ownerName: 'B' }, 'ar');
    expect(errs.academyName).toBe('اسم الأكاديمية يجب أن يحتوي على حرفين على الأقل.');
    expect(errs.ownerName).toBe('اسم المالك يجب أن يحتوي على حرفين على الأقل.');
  });

  it('requires and matches the confirmation', () => {
    expect(validateRegisterForm({ ...valid, confirmPassword: '' }, 'en').confirmPassword).toBe(
      'Please confirm your password.',
    );
    expect(
      validateRegisterForm({ ...valid, confirmPassword: 'Other1!x' }, 'en').confirmPassword,
    ).toBe('Passwords do not match.');
  });

  it('focuses fields in form order', () => {
    expect(firstInvalidField({ password: 'x', email: 'y' })).toBe('email');
    expect(firstInvalidField({ confirmPassword: 'x' })).toBe('confirmPassword');
    expect(firstInvalidField({})).toBeNull();
  });
});

describe('resolveRegisterError', () => {
  it('maps duplicate email to the email field', () => {
    const err = new ApiError('An account with this email address already exists', 409);
    expect(resolveRegisterError(err, 'en')).toEqual({
      kind: 'field',
      field: 'email',
      message: 'This email address is already registered.',
    });
  });

  it('maps slug conflicts to the academy name field', () => {
    const err = new ApiError('Academy slug is taken', 409);
    expect(resolveRegisterError(err, 'en')).toMatchObject({ kind: 'field', field: 'academyName' });
  });

  it('shows other API messages as the form error', () => {
    expect(resolveRegisterError(new ApiError('Too many requests', 429), 'en')).toEqual({
      kind: 'form',
      message: 'Too many requests',
    });
  });

  it('never exposes raw runtime error text', () => {
    expect(resolveRegisterError(new Error('Unexpected token < in JSON'), 'en')).toEqual({
      kind: 'form',
      message: 'Registration failed. Please review your details and try again.',
    });
  });
});
