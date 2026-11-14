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
 * Maps a failed `login()` call to user-facing feedback.
 *
 * - 400 with validation issues → per-field messages + summary
 *   (NOTE: checks `code === 'VALIDATION_ERROR'`; the API emits `VALIDATION_FAILED`, so mapping
 *   currently relies on `details.issues` — preserved as-is, see DEVELOPMENT_STATUS F15)
 * - 401 → generic invalid-credentials message (no account enumeration)
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
