import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/http/api-error';
import {
  emailCodeErrorMessage,
  looksLikeEmail,
  retryAfterSeconds,
  signupEmailErrorMessage,
} from './email-code';
import { resolveRegisterError, validateRegisterForm } from './register-form';

describe('e-mail confirmation helpers', () => {
  it('offers "send code" only for addresses that look complete', () => {
    expect(looksLikeEmail('name@example.com')).toBe(true);
    expect(looksLikeEmail(' name@mail.co ')).toBe(true);
    expect(looksLikeEmail('name@example')).toBe(false);
    expect(looksLikeEmail('name@')).toBe(false);
    expect(looksLikeEmail('na me@example.com')).toBe(false);
  });

  it('reads the wait time of a 429 answer', () => {
    const limited = new ApiError('wait', 429, 'RATE_LIMIT_EXCEEDED', { retryAfterSeconds: 42 });
    expect(retryAfterSeconds(limited)).toBe(42);
    expect(retryAfterSeconds(new ApiError('x', 400, 'TOKEN_INVALID'))).toBe(0);
    expect(retryAfterSeconds(new Error('network'))).toBe(0);
  });

  it('explains each failure in the page language', () => {
    expect(emailCodeErrorMessage(new ApiError('x', 400, 'EMAIL_DOMAIN_INVALID'), 'ar')).toContain(
      '@',
    );
    expect(emailCodeErrorMessage(new ApiError('x', 400, 'TOKEN_INVALID'), 'en')).toBe(
      'The code is not correct.',
    );
    expect(emailCodeErrorMessage(new ApiError('x', 400, 'TOKEN_EXPIRED'), 'ar')).toContain(
      'رمزاً جديداً',
    );
    // Unknown and non-API errors never show raw messages.
    expect(emailCodeErrorMessage(new Error('stack trace'), 'en')).not.toContain('stack');
  });

  it("names the guardian's address when that is the one refused", () => {
    const err = new ApiError('x', 400, 'EMAIL_DOMAIN_INVALID', { field: 'guardianEmail' });
    expect(signupEmailErrorMessage(err, 'ar')).toContain('ولي الأمر');
    expect(signupEmailErrorMessage(new ApiError('x', 409, 'EMAIL_ALREADY_EXISTS'), 'en')).toBe(
      null,
    );
  });

  it('registration: the confirmation step is not part of field validation, but its errors land on the e-mail', () => {
    const errors = validateRegisterForm(
      {
        academyName: 'Academy',
        sport: 'FOOTBALL',
        city: '',
        ownerName: 'Owner Name',
        email: 'owner@example.com',
        phone: '',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      },
      'en',
    );
    expect(errors).toEqual({});

    expect(resolveRegisterError(new ApiError('x', 400, 'EMAIL_NOT_VERIFIED'), 'en')).toMatchObject({
      kind: 'field',
      field: 'email',
    });
  });
});
