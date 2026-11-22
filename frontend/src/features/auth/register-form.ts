import { RegisterRequestSchema } from '@academy/shared';
import { ApiError } from '@/lib/http/api-error';
import { signupEmailErrorMessage } from './email-code';
import { validateWithSchema } from '@/utils/validation';

type Locale = 'ar' | 'en';

export interface RegisterFormValues {
  academyName: string;
  sport: string;
  city: string;
  ownerName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

export type RegisterField =
  'academyName' | 'ownerName' | 'email' | 'phone' | 'password' | 'confirmPassword';

export type RegisterFieldErrors = Partial<Record<RegisterField, string>>;

/** Order in which the first invalid field receives focus. */
export const REGISTER_FOCUS_ORDER: RegisterField[] = [
  'academyName',
  'ownerName',
  'email',
  'phone',
  'password',
  'confirmPassword',
];

/** Client-side registration validation (moved verbatim from the register page). */
export function validateRegisterForm(
  values: RegisterFormValues,
  locale: Locale,
): RegisterFieldErrors {
  const errors: RegisterFieldErrors = {};
  const isAr = locale === 'ar';

  // The e-mail confirmation (emailProof) is a separate step of the form, checked on submit.
  const result = validateWithSchema(RegisterRequestSchema.omit({ emailProof: true }), {
    name: values.ownerName.trim(),
    email: values.email.trim().toLowerCase(),
    password: values.password,
    phone: values.phone.trim() ? values.phone.trim().replace(/[\s-]/g, '') : undefined,
    city: values.city.trim() || undefined,
    academyName: values.academyName.trim(),
    sport: values.sport,
  });

  if (!result.success && result.errors) {
    if (result.errors.academyName) {
      errors.academyName = isAr
        ? 'اسم الأكاديمية يجب أن يحتوي على حرفين على الأقل.'
        : result.errors.academyName;
    }
    if (result.errors.name) {
      errors.ownerName = isAr ? 'اسم المالك يجب أن يحتوي على حرفين على الأقل.' : result.errors.name;
    }
    if (result.errors.email) {
      errors.email = isAr ? 'البريد الإلكتروني غير صحيح.' : result.errors.email;
    }
    if (result.errors.phone) {
      errors.phone = isAr ? 'رقم الهاتف غير صحيح.' : result.errors.phone;
    }
    if (result.errors.password) {
      errors.password = isAr
        ? 'كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل، وحرف كبير وصغير ورقم.'
        : result.errors.password;
    }
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = isAr ? 'يرجى تأكيد كلمة المرور.' : 'Please confirm your password.';
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = isAr ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.';
  }

  return errors;
}

export function firstInvalidField(errors: RegisterFieldErrors): RegisterField | null {
  return REGISTER_FOCUS_ORDER.find((f) => errors[f]) ?? null;
}

export type RegisterErrorResolution =
  | { kind: 'field'; field: 'email' | 'academyName'; message: string }
  | { kind: 'form'; message: string };

/**
 * Maps a failed `register()` call to feedback. Matching is on the API's message text
 * (existing behaviour). Only `ApiError` messages are inspected or shown; any other error
 * (runtime/network) falls back to the generic, localized failure message.
 */
export function resolveRegisterError(err: unknown, locale: Locale): RegisterErrorResolution {
  const message = err instanceof ApiError ? err.message : '';
  const isAr = locale === 'ar';

  const emailProblem = signupEmailErrorMessage(err, locale);
  if (emailProblem) return { kind: 'field', field: 'email', message: emailProblem };

  if (
    message.includes('already exists') ||
    message.includes('already registered') ||
    message.includes('Email')
  ) {
    return {
      kind: 'field',
      field: 'email',
      message: isAr
        ? 'هذا البريد الإلكتروني مسجل بالفعل لدى أكاديمية أخرى أو مستخدم.'
        : 'This email address is already registered.',
    };
  }

  if (message.includes('slug') || message.includes('Academy name')) {
    return {
      kind: 'field',
      field: 'academyName',
      message: isAr
        ? 'اسم الأكاديمية هذا مسجل بالفعل، يرجى اختيار اسم آخر.'
        : 'An academy with this name already exists.',
    };
  }

  return {
    kind: 'form',
    message:
      message ||
      (isAr
        ? 'فشل تسجيل الأكاديمية. يرجى مراجعة البيانات والمحاولة مجدداً.'
        : 'Registration failed. Please review your details and try again.'),
  };
}
