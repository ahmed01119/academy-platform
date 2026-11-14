import type { CreatePlayerRequest, GuardianRelationship, PlayerGender } from '@academy/shared';

type Locale = 'ar' | 'en';

/** Values of the `/players/new` enrollment form. */
export interface NewPlayerFormValues {
  firstName: string;
  lastName: string;
  gender: PlayerGender;
  dateOfBirth: string;
  useBirthYearOnly: boolean;
  birthYear: string;
  jerseyNumber: string;
  nationalId: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  medicalNotes: string;
  guardianName: string;
  guardianRelationship: GuardianRelationship;
  guardianPhone: string;
  guardianEmail: string;
  branchId: string;
}

const pick = (locale: Locale, ar: string, en: string) => (locale === 'ar' ? ar : en);

/** Date of birth sent to the API: `YYYY-01-01` when only the year is known. */
export function effectiveDateOfBirth(values: NewPlayerFormValues): string {
  if (!values.useBirthYearOnly) return values.dateOfBirth;
  return values.birthYear.trim() ? `${values.birthYear.trim()}-01-01` : '';
}

/**
 * Client checks moved verbatim from the page (API re-validates with `CreatePlayerSchema`).
 * Order: names + DOB → birth year range → emergency contact → guardian → branch.
 */
export function validateNewPlayerForm(
  values: NewPlayerFormValues,
  locale: Locale,
  currentYear: number = new Date().getFullYear(),
): string | null {
  if (!values.firstName.trim() || !values.lastName.trim() || !effectiveDateOfBirth(values)) {
    return values.useBirthYearOnly
      ? pick(
          locale,
          'يرجى ملء بيانات الاسم الأول واسم العائلة وسنة الميلاد',
          'Please fill in first name, last name, and birth year',
        )
      : pick(
          locale,
          'يرجى ملء بيانات الاسم الأول واسم العائلة وتاريخ الميلاد',
          'Please fill in first name, last name, and date of birth',
        );
  }

  if (values.useBirthYearOnly) {
    const parsedYear = parseInt(values.birthYear.trim(), 10);
    if (isNaN(parsedYear) || parsedYear < 1950 || parsedYear > currentYear) {
      return pick(
        locale,
        `يرجى إدخال سنة ميلاد صحيحة بين 1950 و ${currentYear}`,
        `Please enter a valid birth year between 1950 and ${currentYear}`,
      );
    }
  }

  if (!values.emergencyContactName.trim() || !values.emergencyContactPhone.trim()) {
    return pick(
      locale,
      'يرجى ملء اسم ورقم هاتف الطوارئ',
      'Please fill in emergency contact name and phone',
    );
  }

  if (!values.guardianName.trim() || !values.guardianPhone.trim()) {
    return pick(
      locale,
      'يرجى ملء اسم ورقم هاتف ولي الأمر',
      'Please fill in guardian name and phone number',
    );
  }

  if (!values.branchId) {
    return pick(
      locale,
      'يرجى اختيار الفرع المراد قيد اللاعب به',
      'Please select a branch to enroll the player in',
    );
  }

  return null;
}

/** `POST /players` body (mapping unchanged). Guardian full name is split into first/last. */
export function buildCreatePlayerPayload(
  values: NewPlayerFormValues,
  locale: Locale,
): CreatePlayerRequest {
  const guardianParts = values.guardianName.trim().split(/\s+/);
  const guardianFirstName = guardianParts[0] || pick(locale, 'ولي', 'Guardian');
  const guardianLastName = guardianParts.slice(1).join(' ') || pick(locale, 'أمر', 'Contact');

  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    gender: values.gender,
    dateOfBirth: effectiveDateOfBirth(values),
    birthYear: values.useBirthYearOnly ? parseInt(values.birthYear.trim(), 10) : undefined,
    jerseyNumber: values.jerseyNumber.trim() ? parseInt(values.jerseyNumber.trim(), 10) : undefined,
    nationalId: values.nationalId.trim() || undefined,
    emergencyContactName: values.emergencyContactName.trim(),
    emergencyContactPhone: values.emergencyContactPhone.trim(),
    medicalNotes: values.medicalNotes.trim() || undefined,
    initialBranchId: values.branchId,
    sport: 'FOOTBALL',
    primaryGuardian: {
      firstName: guardianFirstName,
      lastName: guardianLastName,
      relationship: values.guardianRelationship,
      phone: values.guardianPhone.trim(),
      email: values.guardianEmail.trim() || undefined,
      isPrimary: true,
    },
  };
}
