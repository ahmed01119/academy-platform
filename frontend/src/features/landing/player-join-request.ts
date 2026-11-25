import type { CreatePlayerJoinRequest, JoinRequesterType } from '@academy/shared';
import {
  birthYearToDate,
  validatePlayerProfileFields,
  type PlayerProfileFieldValues,
} from '@/features/players/player-profile-fields';

type Locale = 'ar' | 'en';

/** Same minimum as the API's PasswordSchema; the API re-validates the full rule. */
export const JOIN_PASSWORD_MIN_LENGTH = 8;

/**
 * Every value the "join an academy" form collects: the shared player fields (same as the staff enrollment form,
 * `PlayerProfileFieldValues`) plus the academy and the applicant's account.
 *
 * Who is asking (K6): `requesterType` PLAYER = the athlete for themself, GUARDIAN = a parent/guardian for a child.
 * (Academy owners/coaches use the separate academy registration form.) Either way the request belongs to an account:
 * a signed-in user's own account, or a new one created from the account e-mail + `password`, which stays pending
 * until the academy reviews the request.
 */
export interface PlayerJoinFormValues extends PlayerProfileFieldValues {
  tenantId: string;
  requesterType: JoinRequesterType;
  /** GUARDIAN request: the guardian's e-mail (sign-in). Unused for PLAYER requests. */
  email: string;
  /** PLAYER request: the player's own e-mail (sign-in). Unused for GUARDIAN requests. */
  playerEmail?: string;
  // New account (only when not signed in)
  password: string;
  confirmPassword: string;
}

/** What the form sends: exactly the API contract (`CreatePlayerJoinRequestSchema`). */
export interface PlayerJoinRequestBuild {
  payload: CreatePlayerJoinRequest;
}

/**
 * Client-side checks. Order: academy → shared player fields (names → birth year → guardian name and phone) →
 * account e-mail → password. The password is checked only when a new account will be created (`isSignedIn` false).
 */
export function validatePlayerJoinForm(
  values: PlayerJoinFormValues,
  locale: Locale,
  isSignedIn = false,
  currentYear: number = new Date().getFullYear(),
): string | null {
  if (!values.tenantId) {
    return locale === 'ar' ? 'يرجى اختيار الأكاديمية الرياضية' : 'Please select an academy';
  }
  const fieldError = validatePlayerProfileFields(values, locale, currentYear);
  if (fieldError) return fieldError;

  if (!accountEmailOf(values)) {
    return values.requesterType === 'PLAYER'
      ? locale === 'ar'
        ? 'يرجى إدخال بريدك الإلكتروني (بريد اللاعب)'
        : "Please enter your (the player's) e-mail"
      : locale === 'ar'
        ? 'يرجى إدخال بريدك الإلكتروني (بريد ولي الأمر)'
        : "Please enter your (the guardian's) e-mail";
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
 * Maps the form to the API payload: every field of the shared player form is stored with the request (owner decision
 * 2026-11-25). The birth date is January 1st of the birth year; the contact phone is the guardian's phone. The password is sent only when a new account is created (`isSignedIn`
 * false); a signed-in user's request is linked to their account by the API.
 */
export function buildPlayerJoinRequest(
  values: PlayerJoinFormValues,
  isSignedIn = false,
): PlayerJoinRequestBuild {
  return {
    payload: {
      tenantId: values.tenantId,
      requesterType: values.requesterType,
      ...(isSignedIn ? {} : { password: values.password }),
      playerName: `${values.firstName.trim()} ${values.lastName.trim()}`.trim(),
      contactEmail: accountEmailOf(values),
      contactPhone: values.guardianPhone.trim() || undefined,
      dateOfBirth: birthYearToDate(values.birthYear) || undefined,
      guardianName: values.guardianName.trim() || undefined,
      gender: values.gender,
      jerseyNumber: values.jerseyNumber.trim()
        ? parseInt(values.jerseyNumber.trim(), 10)
        : undefined,
      nationalId: values.nationalId.trim() || undefined,
      medicalNotes: values.medicalNotes.trim() || undefined,
    },
  };
}
