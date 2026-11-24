'use client';

import React from 'react';
import { User, Users } from 'lucide-react';
import type { PlayerGender } from '@academy/shared';
import { MIN_BIRTH_YEAR, type PlayerProfileFieldValues } from '../player-profile-fields';

export interface PlayerProfileFieldsProps {
  values: PlayerProfileFieldValues;
  onChange: (patch: Partial<PlayerProfileFieldValues>) => void;
  locale: 'ar' | 'en';
  /** Prefix of every element id, so two forms on one page never share ids. */
  idPrefix: string;
  /** `page`: fields on a page surface; `modal`: fields inside a dialog (one shade lighter inputs). */
  tone?: 'page' | 'modal';
  /** Section numbers shown in the headings (the forms put their own sections around these two). */
  sectionNumbers?: { athlete: number; guardian: number };
  /** Heading of the guardian section; defaults to "Guardian details". */
  guardianTitle?: string;
  /** Rendered at the end of the athlete section (e.g. the player's own sign-in e-mail). */
  athleteExtra?: React.ReactNode;
  /** Rendered at the end of the guardian section (e.g. the guardian's sign-in e-mail). */
  guardianExtra?: React.ReactNode;
  disabled?: boolean;
}

/**
 * The athlete and guardian fields of every player form (landing join form and staff enrollment form). The forms
 * differ only around these sections (academy choice and account on the landing, branch on the staff form).
 */
export function PlayerProfileFields({
  values,
  onChange,
  locale,
  idPrefix,
  tone = 'page',
  sectionNumbers = { athlete: 1, guardian: 2 },
  guardianTitle,
  athleteExtra,
  guardianExtra,
  disabled = false,
}: PlayerProfileFieldsProps) {
  const isAr = locale === 'ar';
  const t = (ar: string, en: string) => (isAr ? ar : en);
  const id = (name: string) => `${idPrefix}-${name}`;
  const currentYear = new Date().getFullYear();

  const sectionClass =
    tone === 'modal'
      ? 'rounded-2xl border border-(--border-subtle) bg-(--bg-surface-subtle)/40 p-5 shadow-xs space-y-4'
      : 'rounded-2xl border border-(--border-subtle) bg-[var(--bg-surface)] p-6 shadow-sm space-y-4';
  const inputClass = `w-full rounded-xl border border-(--border-subtle) ${
    tone === 'modal' ? 'bg-[var(--bg-surface)]' : 'bg-(--bg-surface-subtle)'
  } px-3.5 py-2.5 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none transition-colors disabled:opacity-60`;
  const labelClass = 'block text-xs font-semibold text-(--text-muted) mb-1.5';
  const headingClass =
    'flex items-center gap-2 border-b border-(--border-subtle) pb-3 text-sm font-bold text-(--text-main)';

  return (
    <>
      <div className={sectionClass}>
        <div className={headingClass}>
          <User className="h-4 w-4 text-[var(--accent-primary)]" aria-hidden="true" />
          <span>
            {sectionNumbers.athlete}. {t('البيانات الشخصية للاعب', 'Athlete Personal Information')}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={id('first-name')} className={labelClass}>
              {t('الاسم الأول *', 'First Name *')}
            </label>
            <input
              id={id('first-name')}
              type="text"
              required
              disabled={disabled}
              autoComplete="given-name"
              value={values.firstName}
              onChange={(e) => onChange({ firstName: e.target.value })}
              placeholder={t('الاسم الأول', 'First name')}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor={id('last-name')} className={labelClass}>
              {t('اسم العائلة *', 'Last Name *')}
            </label>
            <input
              id={id('last-name')}
              type="text"
              required
              disabled={disabled}
              autoComplete="family-name"
              value={values.lastName}
              onChange={(e) => onChange({ lastName: e.target.value })}
              placeholder={t('اسم العائلة', 'Last name')}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor={id('gender')} className={labelClass}>
              {t('الجنس *', 'Gender *')}
            </label>
            <select
              id={id('gender')}
              disabled={disabled}
              value={values.gender}
              onChange={(e) => onChange({ gender: e.target.value as PlayerGender })}
              className={inputClass}
            >
              <option value="MALE">{t('ذكر', 'Male')}</option>
              <option value="FEMALE">{t('أنثى', 'Female')}</option>
            </select>
          </div>

          <div>
            <label htmlFor={id('birth-year')} className={labelClass}>
              {t('سنة الميلاد *', 'Birth Year *')}
            </label>
            <input
              id={id('birth-year')}
              type="number"
              inputMode="numeric"
              required
              disabled={disabled}
              min={MIN_BIRTH_YEAR}
              max={currentYear}
              value={values.birthYear}
              onChange={(e) => onChange({ birthYear: e.target.value })}
              placeholder={t('مثال: 2014', 'e.g. 2014')}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor={id('jersey-number')} className={labelClass}>
              {t('رقم القميص (اختياري)', 'Jersey Number (Optional)')}
            </label>
            <input
              id={id('jersey-number')}
              type="number"
              min="1"
              max="99"
              disabled={disabled}
              value={values.jerseyNumber}
              onChange={(e) => onChange({ jerseyNumber: e.target.value })}
              placeholder="--"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor={id('national-id')} className={labelClass}>
              {t('الرقم القومي / جواز السفر (اختياري)', 'National ID / Passport (Optional)')}
            </label>
            <input
              id={id('national-id')}
              type="text"
              disabled={disabled}
              value={values.nationalId}
              onChange={(e) => onChange({ nationalId: e.target.value })}
              placeholder={t('14 رقم للرقم القومي', 'National ID or Passport number')}
              className={`${inputClass} font-mono`}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor={id('medical-notes')} className={labelClass}>
              {t('ملاحظات طبية أو حساسية (اختياري)', 'Medical Notes or Allergies (Optional)')}
            </label>
            <textarea
              id={id('medical-notes')}
              rows={2}
              disabled={disabled}
              value={values.medicalNotes}
              onChange={(e) => onChange({ medicalNotes: e.target.value })}
              placeholder={t(
                'أي حساسيات أو حالات صحية ينبغي للمدربين مراعاتها...',
                'Any medical conditions, allergies, or notes for coaches...',
              )}
              className={inputClass}
            />
          </div>

          {athleteExtra && <div className="sm:col-span-2">{athleteExtra}</div>}
        </div>
      </div>

      <div className={sectionClass}>
        <div className={headingClass}>
          <Users className="h-4 w-4 text-[var(--accent-primary)]" aria-hidden="true" />
          <span>
            {sectionNumbers.guardian}. {guardianTitle ?? t('بيانات ولي الأمر', 'Guardian Details')}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={id('guardian-name')} className={labelClass}>
              {t('اسم ولي الأمر *', 'Guardian Name *')}
            </label>
            <input
              id={id('guardian-name')}
              type="text"
              required
              disabled={disabled}
              value={values.guardianName}
              onChange={(e) => onChange({ guardianName: e.target.value })}
              placeholder={t('الاسم الثلاثي لولي الأمر', 'Guardian full name')}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor={id('guardian-phone')} className={labelClass}>
              {t('رقم هاتف ولي الأمر *', 'Guardian Phone *')}
            </label>
            <input
              id={id('guardian-phone')}
              type="tel"
              required
              disabled={disabled}
              autoComplete="tel"
              value={values.guardianPhone}
              onChange={(e) => onChange({ guardianPhone: e.target.value })}
              placeholder="01XXXXXXXXX"
              className={`${inputClass} font-mono`}
            />
          </div>

          {guardianExtra && <div className="sm:col-span-2">{guardianExtra}</div>}
        </div>
      </div>
    </>
  );
}
