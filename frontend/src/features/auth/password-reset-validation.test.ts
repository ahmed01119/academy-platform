import { describe, expect, it } from 'vitest';
import {
  validateForgotPasswordReset,
  validateResetPasswordForm,
} from './password-reset-validation';

const OTP_MSG = 'Please enter the 6-digit verification code.';

describe('validateForgotPasswordReset (/forgot-password step 2)', () => {
  it.each(['', '12345', '1234567', '12a456', '  '])('rejects OTP %j', (otp) => {
    expect(validateForgotPasswordReset({ otp, newPassword: 'x', confirmPassword: 'x' }, 'en')).toBe(
      OTP_MSG,
    );
  });

  it('checks match before length (existing order)', () => {
    expect(
      validateForgotPasswordReset({ otp: '123456', newPassword: 'a', confirmPassword: 'b' }, 'en'),
    ).toBe('Passwords do not match.');
    expect(
      validateForgotPasswordReset(
        { otp: '123456', newPassword: 'short', confirmPassword: 'short' },
        'en',
      ),
    ).toBe('Password must be at least 8 characters.');
  });

  it('only requires length ≥ 8 (weaker than /reset-password — documented discrepancy)', () => {
    expect(
      validateForgotPasswordReset(
        { otp: '123456', newPassword: 'lowercase', confirmPassword: 'lowercase' },
        'en',
      ),
    ).toBeNull();
  });
});

describe('validateResetPasswordForm (/reset-password)', () => {
  it('rejects a bad OTP first', () => {
    expect(
      validateResetPasswordForm({ token: 'abc', password: '', confirmPassword: '' }, 'en'),
    ).toBe(OTP_MSG);
  });

  it('requires every strength rule before checking the match', () => {
    expect(
      validateResetPasswordForm(
        { token: '123456', password: 'lowercase', confirmPassword: 'x' },
        'en',
      ),
    ).toMatch(/strong password requirements/);
  });

  it('then checks the confirmation', () => {
    expect(
      validateResetPasswordForm(
        { token: '123456', password: 'Str0ng!Pass', confirmPassword: 'x' },
        'ar',
      ),
    ).toBe('كلمة المرور وتأكيد كلمة المرور غير متطابقين.');
  });

  it('accepts a strong, matching password', () => {
    expect(
      validateResetPasswordForm(
        { token: ' 123456 ', password: 'Str0ng!Pass', confirmPassword: 'Str0ng!Pass' },
        'en',
      ),
    ).toBeNull();
  });
});
