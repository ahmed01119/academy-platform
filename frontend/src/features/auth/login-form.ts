import { LoginRequestSchema } from '@academy/shared';
import { ApiError } from '@/lib/http/api-error';
import { validateWithSchema } from '@/utils/validation';

type Locale = 'ar' | 'en';

export interface LoginValues {
  email: string;
  password: string;
}

export type LoginFieldErrors = { email?: string; password?: string };

/**
 * Client-side login validation (moved verbatim from the login page).
 * Schema check first, then the UI length helpers (8–128), which take precedence for `password`.
 */
export function validateLoginForm(
  values: LoginValues,
  rememberMe: boolean,
  locale: Locale,
): LoginFieldErrors {
  const trimmedEmail = values.email.trim();
  const validation = validateWithSchema(LoginRequestSchema, {
    email: trimmedEmail,
    password: values.password,
    rememberMe,
  });

  const errors: LoginFieldErrors = {};

  if (!validation.success && validation.errors) {
    if (validation.errors.email) {
      errors.email = !trimmedEmail
        ? locale === 'ar'
          ? 'يرجى إدخال البريد الإلكتروني'
          : 'Email address is required'
        : locale === 'ar'
          ? 'يرجى إدخال بريد إلكتروني صالح (مثال: user@example.com)'
          : 'Please enter a valid email address';
    }
    if (validation.errors.password) {
      errors.password = locale === 'ar' ? 'يرجى إدخال كلمة المرور' : 'Password is required';
    }
  }

  if (values.password && values.password.length < 8) {
    errors.password =
      locale === 'ar'
        ? 'كلمة المرور يجب ألا تقل عن 8 أحرف'
        : 'Password must be at least 8 characters';
  }

  if (values.password && values.password.length > 128) {
    errors.password =
      locale === 'ar'
        ? 'كلمة المرور لا يمكن أن تتجاوز 128 حرفاً'
        : 'Password cannot exceed 128 characters';
  }

  return errors;
}

export interface LoginErrorResolution {
  formError: string;
  fieldErrors?: LoginFieldErrors;
}

type BackendIssue = { field?: string; path?: (string | number)[]; message?: string };

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes('fetch') || msg.includes('network');
}

/**
 * Login refusals that describe the account's state, by API error code. Each applicant kind has its own pending state:
 * COACH / academy owner (academy application, reviewed by the platform), PLAYER and GUARDIAN (join request, reviewed
 * by the academy). See `AuthService.assertApplicantMayLogIn` in the backend.
 */
const LOGIN_ACCOUNT_STATE_MESSAGES: Record<string, { ar: string; en: string }> = {
  ACADEMY_PENDING_APPROVAL: {
    ar: 'طلب تسجيل الأكاديمية قيد المراجعة من إدارة المنصة. ستصلك رسالة على بريدك الإلكتروني فور الموافقة.',
    en: 'Your academy application is under review by the platform. You will be notified by e-mail once it is approved.',
  },
  ACADEMY_REJECTED: {
    ar: 'تم رفض طلب تسجيل الأكاديمية. يرجى التواصل مع إدارة المنصة.',
    en: 'Your academy application was rejected. Please contact the platform team.',
  },
  PLAYER_PENDING_APPROVAL: {
    ar: 'طلب انضمامك قيد المراجعة من إدارة الأكاديمية. يمكنك تسجيل الدخول بعد الموافقة.',
    en: 'Your join request is under review by the academy. You can sign in once it is approved.',
  },
  GUARDIAN_PENDING_APPROVAL: {
    ar: 'طلب انضمام طفلك قيد المراجعة من إدارة الأكاديمية. يمكنك تسجيل الدخول بعد الموافقة.',
    en: "Your child's join request is under review by the academy. You can sign in once it is approved.",
  },
  JOIN_MORE_INFO_REQUESTED: {
    ar: 'طلبت الأكاديمية معلومات إضافية عن طلب الانضمام. يرجى مراجعة بريدك الإلكتروني أو التواصل مع الأكاديمية.',
    en: 'The academy needs more information about your join request. Please check your e-mail or contact the academy.',
  },
  PLAYER_REJECTED: {
    ar: 'تم رفض طلب الانضمام من إدارة الأكاديمية.',
    en: 'Your join request was rejected by the academy.',
  },
  GUARDIAN_REJECTED: {
    ar: 'تم رفض طلب الانضمام من إدارة الأكاديمية.',
    en: 'The join request was rejected by the academy.',
  },
  ACADEMY_SUSPENDED: {
    ar: 'تم إيقاف الأكاديمية مؤقتاً من إدارة المنصة. يرجى التواصل مع إدارة الأكاديمية.',
    en: 'This academy is currently suspended by the platform. Please contact the academy.',
  },
  RATE_LIMIT_EXCEEDED: {
    ar: 'محاولات تسجيل دخول كثيرة. يرجى المحاولة لاحقاً.',
    en: 'Too many sign-in attempts. Please try again later.',
  },
};

/**
 * Maps a failed `login()` call to user-facing feedback.
 *
 * - 400 with validation issues → per-field messages + summary
 *   (NOTE: checks `code === 'VALIDATION_ERROR'`; the API emits `VALIDATION_FAILED`, so mapping
 *   currently relies on `details.issues` — preserved as-is, see DEVELOPMENT_STATUS F15)
 * - 401 with an account-state code (pending / rejected applicant, rate limit) → that state's message
 * - other 401 → generic invalid-credentials message (no account enumeration)
 * - other API errors → the API's own user-facing message (e.g. pending approval, suspended)
 * - network failures → connectivity message
 * - anything else → generic failure message (raw runtime error text is never shown)
 */
export function resolveLoginError(err: unknown, locale: Locale): LoginErrorResolution {
  if (err instanceof ApiError) {
    const details = err.details as Record<string, unknown> | undefined;

    if (err.statusCode === 400 && (err.code === 'VALIDATION_ERROR' || details?.issues)) {
      const backendIssues = (details?.issues ||
        (details?.error as Record<string, unknown>)?.details ||
        []) as BackendIssue[];
      const mapped: LoginFieldErrors = {};

      for (const issue of backendIssues) {
        const field = issue.field || (Array.isArray(issue.path) ? String(issue.path[0]) : '');
        if (field === 'email') {
          mapped.email =
            locale === 'ar'
              ? 'صيغة البريد الإلكتروني غير صالحة'
              : issue.message || 'Invalid email address';
        }
        if (field === 'password') {
          mapped.password =
            locale === 'ar' ? 'كلمة المرور مطلوبة' : issue.message || 'Password is required';
        }
      }

      if (Object.keys(mapped).length > 0) {
        return {
          fieldErrors: mapped,
          formError:
            locale === 'ar'
              ? 'يرجى مراجعة وتصحيح البيانات المدخلة أدناه.'
              : 'Please review and correct the errors below.',
        };
      }
    }

    // Account-state refusals (pending/rejected applicant, rate limit). The API sends these only AFTER the password was
    // verified (or, for the rate limit, regardless of the account), so showing them reveals nothing to a guesser.
    const accountState = err.code ? LOGIN_ACCOUNT_STATE_MESSAGES[err.code] : undefined;
    if (err.statusCode === 401 && accountState) {
      return { formError: locale === 'ar' ? accountState.ar : accountState.en };
    }

    if (err.statusCode === 401) {
      return {
        formError:
          locale === 'ar'
            ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
            : 'Invalid email address or password.',
      };
    }

    if (err.message && err.message !== 'Unauthorized') {
      return { formError: err.message };
    }
  }

  if (isNetworkError(err)) {
    return {
      formError:
        locale === 'ar'
          ? 'تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت والمحاولة مجدداً.'
          : 'Could not connect to server. Please check your network connection and try again.',
    };
  }

  if (err instanceof ApiError && err.message) {
    return { formError: err.message };
  }

  return {
    formError:
      locale === 'ar'
        ? 'فشل تسجيل الدخول. يرجى التحقق من بياناتك والمحاولة مرة أخرى.'
        : 'Login failed. Please check your credentials and try again.',
  };
}
