import type { CreatePlayerRequest } from '@academy/shared';
import { DEFAULT_SPORT, type SportCode } from '@academy/shared';
import {
  birthYearToDate,
  validatePlayerProfileFields,
  type PlayerProfileFieldValues,
} from './player-profile-fields';

type Locale = 'ar' | 'en';

/** Values of the `/players/new` enrollment form: the shared player fields plus the branch enrollment. */
export interface NewPlayerFormValues extends PlayerProfileFieldValues {
  branchId: string;
  /** "Enrollment Start Date" input (YYYY-MM-DD); empty → server default (today). */
  enrollmentStartDate: string;
}

const pick = (locale: Locale, ar: string, en: string) => (locale === 'ar' ? ar : en);

/**
 * Client checks (the API re-validates with `CreatePlayerSchema`).
 * Order: shared player fields (names → birth year → guardian) → branch.
 */
export function validateNewPlayerForm(
  values: NewPlayerFormValues,
  locale: Locale,
  currentYear: number = new Date().getFullYear(),
): string | null {
  const fieldError = validatePlayerProfileFields(values, locale, currentYear);
  if (fieldError) return fieldError;

  if (!values.branchId) {
    return pick(
      locale,
      'يرجى اختيار الفرع المراد قيد اللاعب به',
      'Please select a branch to enroll the player in',
    );
  }
  return null;
}

/**
 * `POST /players` body. The birth date is January 1st of the birth year. The guardian's name and phone are also the
 * player's emergency contact (the form no longer asks for a separate one). The guardian full name is split into
 * first/last.
 */
export function buildCreatePlayerPayload(
  values: NewPlayerFormValues,
  locale: Locale,
  /** The academy's sport for the player's enrollment (its main sport). */
  sport: SportCode = DEFAULT_SPORT,
): CreatePlayerRequest {
  const guardianName = values.guardianName.trim();
  const guardianPhone = values.guardianPhone.trim();
  const guardianParts = guardianName.split(/\s+/);
  const guardianFirstName = guardianParts[0] || pick(locale, 'ولي', 'Guardian');
  const guardianLastName = guardianParts.slice(1).join(' ') || pick(locale, 'أمر', 'Contact');

  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    gender: values.gender,
    dateOfBirth: birthYearToDate(values.birthYear),
    birthYear: parseInt(values.birthYear.trim(), 10),
    jerseyNumber: values.jerseyNumber.trim() ? parseInt(values.jerseyNumber.trim(), 10) : undefined,
    nationalId: values.nationalId.trim() || undefined,
    emergencyContactName: guardianName,
    emergencyContactPhone: guardianPhone,
    medicalNotes: values.medicalNotes.trim() || undefined,
    initialBranchId: values.branchId,
    initialEnrollmentStartDate: values.enrollmentStartDate || undefined,
    sport,
    primaryGuardian: {
      firstName: guardianFirstName,
      lastName: guardianLastName,
      relationship: 'FATHER',
      phone: guardianPhone,
      isPrimary: true,
    },
  };
}
