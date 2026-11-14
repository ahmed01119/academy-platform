import type { CreatePlayerJoinRequest } from '@academy/shared';

type Locale = 'ar' | 'en';

/** Every value the public "join an academy" form collects. */
export interface PlayerJoinFormValues {
  tenantId: string;
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
  email: string;
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

/** Sensitive fields that need protected storage and role-based access in the backend phase. */
export const SENSITIVE_JOIN_FIELDS: readonly PendingJoinField[] = ['nationalId', 'medicalNotes'];

export interface PlayerJoinRequestBuild {
  /** Exactly what the current API contract accepts — this is what gets sent. */
  payload: CreatePlayerJoinRequest;
  /** Collected values the API cannot store yet (explicit, never sent). */
  pendingBackendSupport: Record<PendingJoinField, string>;
}

/** Client-side checks moved verbatim from the landing page. Order: academy → name → guardian → email. */
export function validatePlayerJoinForm(
  values: PlayerJoinFormValues,
  locale: Locale,
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
  if (!values.email.trim()) {
    return locale === 'ar'
      ? 'يرجى إدخال البريد الإلكتروني للتواصل'
      : 'Please enter contact email address';
  }
  return null;
}

/** Maps the form to the API payload (unchanged mapping) and the explicitly-held fields. */
export function buildPlayerJoinRequest(values: PlayerJoinFormValues): PlayerJoinRequestBuild {
  const dateOfBirth = values.birthYearOnly
    ? values.birthYear.trim()
      ? `${values.birthYear.trim()}-01-01`
      : undefined
    : values.dateOfBirth || undefined;

  return {
    payload: {
      tenantId: values.tenantId,
      playerName: `${values.firstName.trim()} ${values.lastName.trim()}`.trim(),
      contactEmail: values.email.trim(),
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
