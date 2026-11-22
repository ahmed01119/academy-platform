import type { CreatePlayerJoinRequest, JoinRequesterType } from '@academy/shared';

type Locale = 'ar' | 'en';

/** Same minimum as the API's PasswordSchema; the API re-validates the full rule. */
export const JOIN_PASSWORD_MIN_LENGTH = 8;

/**
 * Every value the "join an academy" form collects.
 *
 * Who is asking (K6): `requesterType` PLAYER = the athlete for themself, GUARDIAN = a parent/guardian for a child.
 * (Academy owners/coaches use the separate academy registration form.) Either way the request belongs to an account:
 * a signed-in user's own account, or a new one created from `email` + `password`, which stays pending until the
 * academy reviews the request.
 */
export interface PlayerJoinFormValues {
  tenantId: string;
  requesterType: JoinRequesterType;
  // Athlete
  firstName: string;
  lastName: string;
  gender: 'MALE' | 'FEMALE';
  birthYearOnly: boolean;
  birthYear: string;
  dateOfBirth: string;
  jerseyNumber: string;
  nationalId: string;
  // Emergency & health
  emergencyContactName: string;
  emergencyContactPhone: string;
  medicalNotes: string;
  // Primary guardian
  guardianName: string;
  guardianRelationship: string;
  phone: string;
  /** GUARDIAN request: the guardian's e-mail (sign-in). PLAYER request: the guardian's contact e-mail (optional). */
  email: string;
  /** PLAYER request: the player's own e-mail (sign-in). Unused for GUARDIAN requests. */
  playerEmail?: string;
  // New account (only when not signed in)
  password: string;
  confirmPassword: string;
}

/**
 * Form fields the current API contract (`CreatePlayerJoinRequestSchema`) does not accept.
 *
 * F17 — owner decision 2026-11-14: these fields are KEPT in the form and will be supported by
 * the backend refactoring phase (schema + migration + DTO + access control for the sensitive
 * ones: `nationalId`, `medicalNotes`). Until then they are deliberately NOT sent: the API
 * would strip them (Zod object), so sending sensitive data only to have it dropped is avoided.
 */
export const JOIN_FIELDS_PENDING_BACKEND_SUPPORT = [
  'gender',
  'jerseyNumber',
  'nationalId',
  'emergencyContactName',
  'medicalNotes',
  'guardianRelationship',
] as const;

export type PendingJoinField = (typeof JOIN_FIELDS_PENDING_BACKEND_SUPPORT)[number];

/** Form labels of the pending fields (same wording as the form), used by the applicant notice. */
export const PENDING_JOIN_FIELD_LABELS: Record<PendingJoinField, { ar: string; en: string }> = {
  gender: { ar: 'الجنس', en: 'Gender' },
  jerseyNumber: { ar: 'رقم القميص المفضل', en: 'Preferred jersey number' },
  nationalId: { ar: 'الرقم القومي / جواز السفر', en: 'National ID / Passport' },
  emergencyContactName: { ar: 'اسم جهة الاتصال للطوارئ', en: 'Emergency contact name' },
  medicalNotes: { ar: 'الملاحظات الطبية أو الحساسية', en: 'Medical notes / allergies' },
  guardianRelationship: { ar: 'صلة القرابة', en: 'Relationship' },
};

/** Sensitive fields that need protected storage and role-based access in the backend phase. */
export const SENSITIVE_JOIN_FIELDS: readonly PendingJoinField[] = ['nationalId', 'medicalNotes'];

export interface PlayerJoinRequestBuild {
  /** Exactly what the current API contract accepts — this is what gets sent. */
  payload: CreatePlayerJoinRequest;
  /** Collected values the API cannot store yet (explicit, never sent). */
  pendingBackendSupport: Record<PendingJoinField, string>;
}

/**
 * Client-side checks. Order: academy → name → guardian → email → password.
 * The guardian's name is required for a GUARDIAN request (it is the applicant's own name) and stays required for a
 * PLAYER request as the athlete's emergency guardian contact (unchanged). The password is checked only when a new
 * account will be created (`isSignedIn` false).
 */
export function validatePlayerJoinForm(
  values: PlayerJoinFormValues,
  locale: Locale,
  isSignedIn = false,
): string | null {
  if (!values.tenantId) {
    return locale === 'ar' ? 'يرجى اختيار الأكاديمية الرياضية' : 'Please select an academy';
  }
  if (!`${values.firstName.trim()} ${values.lastName.trim()}`.trim()) {
    return locale === 'ar'
      ? 'يرجى ملء الاسم الأول واسم العائلة للاعب'
      : 'Please enter player first and last name';
  }
  if (!values.guardianName.trim()) {
    return locale === 'ar' ? 'يرجى ملء اسم ولي الأمر الأساسي' : 'Please enter guardian name';
  }
  const accountEmail = accountEmailOf(values);
  if (!accountEmail) {
    return values.requesterType === 'PLAYER'
      ? locale === 'ar'
        ? 'يرجى إدخال بريدك الإلكتروني (بريد اللاعب)'
        : "Please enter your (the player's) e-mail"
      : locale === 'ar'
        ? 'يرجى إدخال بريدك الإلكتروني (بريد ولي الأمر)'
        : "Please enter your (the guardian's) e-mail";
  }
  if (
    values.requesterType === 'PLAYER' &&
    values.email.trim() &&
    values.email.trim().toLowerCase() === accountEmail.toLowerCase()
  ) {
    return locale === 'ar'
      ? 'بريد ولي الأمر يجب أن يكون مختلفاً عن بريد اللاعب (أو اتركه فارغاً)'
      : "The guardian's e-mail must differ from the player's (or leave it empty)";
  }
  if (!isSignedIn) {
    if (values.password.length < JOIN_PASSWORD_MIN_LENGTH) {
      return locale === 'ar'
        ? `كلمة المرور يجب ألا تقل عن ${JOIN_PASSWORD_MIN_LENGTH} أحرف`
        : `Password must be at least ${JOIN_PASSWORD_MIN_LENGTH} characters`;
    }
    if (values.password !== values.confirmPassword) {
      return locale === 'ar' ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match';
    }
  }
  return null;
}

/** The applicant's sign-in e-mail: the player's own for a PLAYER request, the guardian's for a GUARDIAN request. */
function accountEmailOf(values: PlayerJoinFormValues): string {
  return (values.requesterType === 'PLAYER' ? (values.playerEmail ?? '') : values.email).trim();
}

/**
 * Maps the form to the API payload and the explicitly-held fields. The password is sent only when a new account is
 * created (`isSignedIn` false); a signed-in user's request is linked to their account by the API.
 */
export function buildPlayerJoinRequest(
  values: PlayerJoinFormValues,
  isSignedIn = false,
): PlayerJoinRequestBuild {
  const dateOfBirth = values.birthYearOnly
    ? values.birthYear.trim()
      ? `${values.birthYear.trim()}-01-01`
      : undefined
    : values.dateOfBirth || undefined;

  return {
    payload: {
      tenantId: values.tenantId,
      requesterType: values.requesterType,
      ...(isSignedIn ? {} : { password: values.password }),
      playerName: `${values.firstName.trim()} ${values.lastName.trim()}`.trim(),
      contactEmail: accountEmailOf(values),
      guardianEmail:
        values.requesterType === 'PLAYER' && values.email.trim() ? values.email.trim() : undefined,
      contactPhone: values.phone.trim() || values.emergencyContactPhone.trim() || undefined,
      dateOfBirth,
      guardianName: values.guardianName.trim() || undefined,
    },
    pendingBackendSupport: {
      gender: values.gender,
      jerseyNumber: values.jerseyNumber.trim(),
      nationalId: values.nationalId.trim(),
      emergencyContactName: values.emergencyContactName.trim(),
      medicalNotes: values.medicalNotes.trim(),
      guardianRelationship: values.guardianRelationship,
    },
  };
}
