import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/http/api-error';
import { resolveLoginError, validateLoginForm } from './login-form';

describe('validateLoginForm', () => {
  it('requires an email', () => {
    expect(validateLoginForm({ email: '  ', password: 'Abcdef1!' }, false, 'en').email).toBe(
      'Email address is required',
    );
  });

  it('rejects a malformed email (localized)', () => {
    expect(validateLoginForm({ email: 'nope', password: 'Abcdef1!' }, false, 'en').email).toBe(
      'Please enter a valid email address',
    );
    expect(validateLoginForm({ email: 'nope', password: 'Abcdef1!' }, false, 'ar').email).toBe(
      'يرجى إدخال بريد إلكتروني صالح (مثال: user@example.com)',
    );
  });

  it('requires a password', () => {
    expect(validateLoginForm({ email: 'a@b.co', password: '' }, false, 'en').password).toBe(
      'Password is required',
    );
  });

  it('applies the 8–128 length helpers', () => {
    expect(validateLoginForm({ email: 'a@b.co', password: 'short' }, false, 'en').password).toBe(
      'Password must be at least 8 characters',
    );
    expect(
      validateLoginForm({ email: 'a@b.co', password: 'x'.repeat(129) }, false, 'en').password,
    ).toBe('Password cannot exceed 128 characters');
  });

  it('accepts valid credentials', () => {
    expect(
      validateLoginForm({ email: ' user@example.com ', password: 'whatever8' }, true, 'en'),
    ).toEqual({});
  });
});

describe('resolveLoginError', () => {
  it('maps 401 to the generic credentials message (no account enumeration)', () => {
    const err = new ApiError('User does not exist', 401, 'INVALID_CREDENTIALS');
    expect(resolveLoginError(err, 'en')).toEqual({
      formError: 'Invalid email address or password.',
    });
  });

  it.each([
    ['ACADEMY_PENDING_APPROVAL', 'under review by the platform'],
    ['PLAYER_PENDING_APPROVAL', 'Your join request is under review by the academy'],
    ['GUARDIAN_PENDING_APPROVAL', "Your child's join request is under review"],
    ['JOIN_MORE_INFO_REQUESTED', 'needs more information'],
    ['GUARDIAN_REJECTED', 'rejected by the academy'],
  ])('shows the applicant state for 401 %s instead of "wrong password"', (code, text) => {
    const err = new ApiError('server text', 401, code);
    expect(resolveLoginError(err, 'en').formError).toContain(text);
    expect(resolveLoginError(err, 'ar').formError).not.toContain('غير صحيحة');
  });

  it('maps backend validation issues to field errors', () => {
    const err = new ApiError('Validation failed', 400, 'VALIDATION_FAILED', {
      issues: [
        { path: ['email'], message: 'Invalid email' },
        { field: 'password', message: 'Required' },
      ],
    });
    expect(resolveLoginError(err, 'en')).toEqual({
      formError: 'Please review and correct the errors below.',
      fieldErrors: { email: 'Invalid email', password: 'Required' },
    });
  });

  it('shows the API business message for other API errors', () => {
    const err = new ApiError('Account suspended', 403, 'FORBIDDEN');
    expect(resolveLoginError(err, 'en').formError).toBe('Account suspended');
  });

  it('maps fetch/network failures to the connectivity message', () => {
    expect(resolveLoginError(new TypeError('Failed to fetch'), 'en').formError).toBe(
      'Could not connect to server. Please check your network connection and try again.',
    );
  });

  it('never exposes raw runtime error text', () => {
    const leak = new Error('Cannot read properties of undefined (reading "token")');
    expect(resolveLoginError(leak, 'en').formError).toBe(
      'Login failed. Please check your credentials and try again.',
    );
    expect(resolveLoginError('weird', 'ar').formError).toBe(
      'فشل تسجيل الدخول. يرجى التحقق من بياناتك والمحاولة مرة أخرى.',
    );
  });
});
