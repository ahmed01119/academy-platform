import { ErrorCode } from '@academy/shared';
import { ApiError } from '@/lib/http/api-error';

type Locale = 'ar' | 'en';

/** Loose check before offering "send code"; the server validates the address properly. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/** Seconds to wait before another code may be requested, from a 429 answer (0 when not given). */
export function retryAfterSeconds(err: unknown): number {
  if (!(err instanceof ApiError) || err.code !== ErrorCode.RATE_LIMIT_EXCEEDED) return 0;
  const seconds = (err.details as { retryAfterSeconds?: unknown } | undefined)?.retryAfterSeconds;
  return typeof seconds === 'number' && seconds > 0 ? Math.ceil(seconds) : 0;
}

/** User-facing message for a failed "send code" or "check code" call. */
export function emailCodeErrorMessage(err: unknown, locale: Locale): string {
  const isAr = locale === 'ar';
  const code = err instanceof ApiError ? err.code : undefined;
  switch (code) {
    case ErrorCode.EMAIL_DOMAIN_INVALID:
      return isAr
        ? 'هذا البريد لا يمكنه استقبال رسائل. راجع الجزء بعد @ (مثل gmail.com).'
        : 'This address cannot receive mail. Check the part after the @ (for example gmail.com).';
    case ErrorCode.EMAIL_ALREADY_EXISTS:
      return isAr
        ? 'يوجد حساب بهذا البريد بالفعل. سجّل الدخول بدلاً من ذلك.'
        : 'An account with this email already exists. Please sign in instead.';
    case ErrorCode.TOKEN_INVALID:
      return isAr ? 'الرمز غير صحيح.' : 'The code is not correct.';
    case ErrorCode.TOKEN_EXPIRED:
      return isAr
        ? 'انتهت صلاحية الرمز. اطلب رمزاً جديداً.'
        : 'The code has expired. Please ask for a new one.';
    case ErrorCode.RATE_LIMIT_EXCEEDED: {
      const wait = retryAfterSeconds(err);
      if (err instanceof ApiError && /wrong codes/i.test(err.message)) {
        return isAr
          ? 'محاولات خاطئة كثيرة. اطلب رمزاً جديداً.'
          : 'Too many wrong codes. Please ask for a new one.';
      }
      return isAr
        ? `انتظر ${wait || 60} ثانية قبل طلب رمز جديد.`
        : `Please wait ${wait || 60} seconds before asking for a new code.`;
    }
    case ErrorCode.EMAIL_DELIVERY_FAILED:
      return isAr
        ? 'تعذّر إرسال الرسالة الآن. حاول مرة أخرى بعد قليل.'
        : 'The email could not be sent right now. Please try again shortly.';
    default:
      return isAr
        ? 'تعذّر إتمام العملية. تحقق من الاتصال وحاول مرة أخرى.'
        : 'Something went wrong. Check your connection and try again.';
  }
}

/** Message shown on the e-mail field when the form is submitted before the address was confirmed. */
export function emailNotConfirmedMessage(locale: Locale): string {
  return locale === 'ar'
    ? 'أكّد بريدك الإلكتروني بالرمز الذي يصلك أولاً.'
    : 'Please confirm your email with the code we send you first.';
}

/**
 * Message for the e-mail errors a sign-up form (academy registration, join request) can get back, or null for any
 * other error. `guardianEmail` refers to the optional guardian address of a player's join request.
 */
export function signupEmailErrorMessage(err: unknown, locale: Locale): string | null {
  if (!(err instanceof ApiError)) return null;
  const isAr = locale === 'ar';
  if (err.code === ErrorCode.EMAIL_NOT_VERIFIED) {
    return isAr
      ? 'انتهت صلاحية تأكيد البريد أو لم يتم. أكّد بريدك بالرمز مرة أخرى.'
      : 'Your email confirmation is missing or expired. Please confirm it with a code again.';
  }
  if (err.code === ErrorCode.EMAIL_DOMAIN_INVALID) {
    const field = (err.details as { field?: unknown } | undefined)?.field;
    if (field === 'guardianEmail') {
      return isAr
        ? 'بريد ولي الأمر لا يمكنه استقبال رسائل. راجع الجزء بعد @ أو اتركه فارغاً.'
        : "The guardian's email cannot receive mail. Check the part after the @, or leave it empty.";
    }
    return emailCodeErrorMessage(err, locale);
  }
  return null;
}
