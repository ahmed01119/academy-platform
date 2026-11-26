import { evaluatePassword } from '@/components/ui/PasswordStrengthMeter';

type Locale = 'ar' | 'en';

/**
 * Client-side checks for the two OTP password-reset forms, moved verbatim from the pages.
 * The backend (PasswordSchema) remains the authority; these only give early feedback.
 *
 * NOTE (documented discrepancy, owner decision pending): the two forms intentionally keep
 * their existing, different rules — `/forgot-password` step 2 checks length ≥ 8 only, while
 * `/reset-password` requires every strength rule. Do not unify without approval.
 */

const OTP_PATTERN = /^\d{6}$/;

function otpError(otp: string, locale: Locale): string | null {
  const clean = otp.trim();
  if (!clean || clean.length !== 6 || !OTP_PATTERN.test(clean)) {
    return locale === 'ar'
      ? 'يرجى إدخال رمز التحقق المكوّن من 6 أرقام.'
      : 'Please enter the 6-digit verification code.';
  }
  return null;
}

/** `/forgot-password` step 2. Order: OTP → match → length. */
export function validateForgotPasswordReset(
  input: { otp: string; newPassword: string; confirmPassword: string },
  locale: Locale,
): string | null {
  const otp = otpError(input.otp, locale);
  if (otp) return otp;
  if (input.newPassword !== input.confirmPassword) {
    return locale === 'ar' ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.';
  }
  if (input.newPassword.length < 8) {
    return locale === 'ar'
      ? 'يجب ألا تقل كلمة المرور عن 8 أحرف.'
      : 'Password must be at least 8 characters.';
  }
  return null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * `/reset-password`. Order: code + e-mail (code mode only) → full strength → match.
 * With a link token (`linkToken`) no code or e-mail is needed: the link itself identifies the reset (K1).
 */
export function validateResetPasswordForm(
  input: {
    token: string;
    password: string;
    confirmPassword: string;
    linkToken?: string;
    email?: string;
  },
  locale: Locale,
): string | null {
  if (!input.linkToken) {
    const otp = otpError(input.token, locale);
    if (otp) return otp;
    // The API only accepts a 6-digit code together with the e-mail address it was sent to.
    if (!EMAIL_PATTERN.test((input.email ?? '').trim())) {
      return locale === 'ar'
        ? 'يرجى إدخال البريد الإلكتروني الذي أُرسل إليه رمز التحقق.'
        : 'Please enter the email address the code was sent to.';
    }
  }
  if (evaluatePassword(input.password).score < 5) {
    return locale === 'ar'
      ? 'يرجى استيفاء كافة شروط كلمة المرور القوية (8 أحرف، حرف كبير، حرف صغير، رقم، ورمز خاص).'
      : 'Please satisfy all strong password requirements (8+ chars, uppercase, lowercase, number, and special symbol).';
  }
  if (input.password !== input.confirmPassword) {
    return locale === 'ar'
      ? 'كلمة المرور وتأكيد كلمة المرور غير متطابقين.'
      : 'Passwords do not match.';
  }
  return null;
}
