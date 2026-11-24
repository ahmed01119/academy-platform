import type { PlayerGender } from '@academy/shared';

type Locale = 'ar' | 'en';

/**
 * The athlete and guardian fields shared by every player form: the public "join an academy" form (landing) and the
 * staff "enroll a new player" form. One definition so a change to the fields reaches both forms (owner decision
 * 2026-11-24).
 *
 * The birth date is collected as a year only; it is stored as January 1st of that year. The guardian is the father
 * (or whoever registers the child): name and phone only. There is no separate emergency contact: the guardian's name
 * and phone are the player's emergency contact.
 */
export interface PlayerProfileFieldValues {
  firstName: string;
  lastName: string;
  gender: PlayerGender;
  birthYear: string;
  jerseyNumber: string;
  nationalId: string;
  medicalNotes: string;
  guardianName: string;
  guardianPhone: string;
}

export const EMPTY_PLAYER_PROFILE: PlayerProfileFieldValues = {
  firstName: '',
  lastName: '',
  gender: 'MALE',
  birthYear: '',
  jerseyNumber: '',
  nationalId: '',
  medicalNotes: '',
  guardianName: '',
  guardianPhone: '',
};

/** Youngest and oldest birth years accepted (same lower bound as the API's `birthYear`). */
export const MIN_BIRTH_YEAR = 1950;

/** `YYYY-01-01` for a valid year, else an empty string. */
export function birthYearToDate(birthYear: string): string {
  const year = birthYear.trim();
  return /^\d{4}$/.test(year) ? `${year}-01-01` : '';
}

const pick = (locale: Locale, ar: string, en: string) => (locale === 'ar' ? ar : en);

/**
 * Checks of the shared fields, in form order: names → birth year → guardian name → guardian phone.
 * Returns the first problem as a message in the page language, or null.
 */
export function validatePlayerProfileFields(
  values: PlayerProfileFieldValues,
  locale: Locale,
  currentYear: number = new Date().getFullYear(),
): string | null {
  if (!values.firstName.trim() || !values.lastName.trim()) {
    return pick(
      locale,
      'يرجى ملء الاسم الأول واسم العائلة للاعب',
      "Please enter the player's first and last name",
    );
  }

  const year = Number(values.birthYear.trim());
  if (!/^\d{4}$/.test(values.birthYear.trim()) || year < MIN_BIRTH_YEAR || year > currentYear) {
    return pick(
      locale,
      `يرجى إدخال سنة ميلاد صحيحة بين ${MIN_BIRTH_YEAR} و ${currentYear}`,
      `Please enter a valid birth year between ${MIN_BIRTH_YEAR} and ${currentYear}`,
    );
  }

  if (!values.guardianName.trim()) {
    return pick(locale, 'يرجى إدخال اسم ولي الأمر', "Please enter the guardian's name");
  }
  if (!values.guardianPhone.trim()) {
    return pick(locale, 'يرجى إدخال رقم هاتف ولي الأمر', "Please enter the guardian's phone");
  }
  return null;
}
