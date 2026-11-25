import type { PlayerDetails, PlayerStatus, UpdatePlayerRequest } from '@academy/shared';
import type { PlayerProfileFieldValues } from './player-profile-fields';

type Locale = 'ar' | 'en';
const pick = (locale: Locale, ar: string, en: string) => (locale === 'ar' ? ar : en);

// ─── Transfer ────────────────────────────────────────────────────────────────

/** Client checks before `POST /enrollments/:id/transfer` (moved verbatim; API re-validates). */
export function validateBranchTransfer(
  player: PlayerDetails | null,
  targetBranchId: string,
  locale: Locale,
): { error: string } | { enrollmentId: string } {
  const activeEnrollment = player?.enrollments.find((en) => en.status === 'ACTIVE');
  if (!activeEnrollment) {
    return {
      error: pick(
        locale,
        'لا يوجد اشتراك نشط حالياً لنقله',
        'No active branch enrollment to transfer',
      ),
    };
  }
  if (!targetBranchId) {
    return { error: pick(locale, 'يرجى اختيار الفرع المستهدف', 'Please select target branch') };
  }
  if (targetBranchId === activeEnrollment.branchId) {
    return {
      error: pick(
        locale,
        'اللاعب مسجل بالفعل في هذا الفرع',
        'Athlete is already enrolled in this branch',
      ),
    };
  }
  return { enrollmentId: activeEnrollment.id };
}

// ─── Edit ────────────────────────────────────────────────────────────────────

/**
 * The edit dialog uses the same fields as every player form (`PlayerProfileFieldValues`: names, gender, birth year,
 * jersey number, national ID, medical notes, guardian name and phone; owner decision 2026-11-25), plus the status.
 */
export interface PlayerEditForm extends PlayerProfileFieldValues {
  status: PlayerStatus;
}

export function editFormFromPlayer(player: PlayerDetails): PlayerEditForm {
  const guardian =
    (player.guardians ?? []).find((g) => g.isPrimary) ??
    (player.guardians ?? [])[0] ??
    player.primaryGuardian ??
    null;
  return {
    firstName: player.firstName,
    lastName: player.lastName,
    gender: player.gender,
    birthYear: player.dateOfBirth ? player.dateOfBirth.slice(0, 4) : '',
    jerseyNumber: player.jerseyNumber ? String(player.jerseyNumber) : '',
    nationalId: player.nationalId ?? '',
    medicalNotes: player.medicalNotes ?? '',
    guardianName: guardian
      ? `${guardian.firstName} ${guardian.lastName === '-' ? '' : guardian.lastName}`.trim()
      : player.emergencyContactName,
    guardianPhone: guardian?.phone ?? player.emergencyContactPhone,
    status: player.status,
  };
}

/**
 * `PATCH /players/:id` body. National ID and medical notes are only included for users allowed to see them, so other
 * roles can never overwrite (or clear) values they cannot read. The guardian's name and phone are also the emergency
 * contact (the API updates both).
 */
export function buildPlayerUpdatePayload(
  form: PlayerEditForm,
  canViewSensitive: boolean,
): UpdatePlayerRequest {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    gender: form.gender,
    birthYear: parseInt(form.birthYear.trim(), 10),
    jerseyNumber: form.jerseyNumber.trim() ? parseInt(form.jerseyNumber.trim(), 10) : null,
    guardianName: form.guardianName.trim(),
    guardianPhone: form.guardianPhone.trim(),
    status: form.status,
    ...(canViewSensitive
      ? {
          nationalId: form.nationalId.trim() || null,
          medicalNotes: form.medicalNotes.trim() || null,
        }
      : {}),
  };
}

// ─── Labels (Arabic kept exactly as before; English added) ───────────────────

export function playerStatusLabel(status: PlayerStatus, locale: Locale): string {
  if (status === 'ACTIVE') return pick(locale, 'نشط', 'Active');
  if (status === 'SUSPENDED') return pick(locale, 'موقوف', 'Suspended');
  return pick(locale, 'غير نشط', 'Inactive');
}

export function playerStatusTone(status: PlayerStatus): string {
  if (status === 'ACTIVE') {
    return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
  }
  if (status === 'SUSPENDED') {
    return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30';
  }
  return 'bg-red-500/10 text-red-500 border border-red-500/30';
}

export function playerGenderLabel(gender: string, locale: Locale): string {
  return gender === 'MALE' ? pick(locale, 'ذكر', 'Male') : pick(locale, 'أنثى', 'Female');
}

export function pastEnrollmentStatusLabel(status: string, locale: Locale): string {
  if (status === 'TRANSFERRED') return pick(locale, 'تم النقل', 'Transferred');
  if (status === 'COMPLETED') return pick(locale, 'مكتمل', 'Completed');
  return pick(locale, 'ملغي', 'Cancelled');
}
