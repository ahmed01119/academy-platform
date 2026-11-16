'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Heart,
  KeyRound,
  Save,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type { JoinRequesterType } from '@academy/shared';
import { useLocale } from '@/contexts/locale-context';
import { useAuth } from '@/contexts/auth-context';
import { getErrorMessage } from '@/lib/http/api-error';
import { portalApi } from '@/features/portal/api';
import {
  JOIN_PASSWORD_MIN_LENGTH,
  buildPlayerJoinRequest,
  validatePlayerJoinForm,
  type PlayerJoinFormValues,
} from '@/features/landing/player-join-request';
import { UnsavedFieldsNotice } from './UnsavedFieldsNotice';

export interface PlayerJoinRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-selected "who is applying" (e.g. GUARDIAN from the guardian portal). Defaults to GUARDIAN. */
  defaultRequesterType?: JoinRequesterType;
  /** Called after a request was accepted by the API (e.g. to refresh the portal's request list). */
  onSubmitted?: () => void;
}

/**
 * Public "join an academy" request form (landing page). Moved verbatim from app/landing/page.tsx.
 * Stays mounted while closed so typed values survive close/re-open, as before.
 *
 * F17 (owner decision 2026-11-14): all fields are kept. Fields the API does not accept yet
 * are listed in `JOIN_FIELDS_PENDING_BACKEND_SUPPORT` (features/landing/player-join-request.ts)
 * and will be supported in the backend phase; until then only the contract payload is sent.
 *
 * K6 (owner decision 2026-11-16) — who is applying:
 *  - PLAYER: the athlete for themself; after approval their account opens the player portal (/player).
 *  - GUARDIAN: a parent/guardian for a child; after approval their account opens the guardian portal (/guardian).
 *  (Academy owners/coaches apply with the academy registration form, /register.)
 * Not signed in: the form also asks for a password and the API creates a pending account for the e-mail; it cannot
 * sign in until the academy approves. Signed in: the request is linked to the current account and shows as pending
 * in the portal.
 */
export function PlayerJoinRequestModal({
  isOpen,
  onClose,
  defaultRequesterType = 'GUARDIAN',
  onSubmitted,
}: PlayerJoinRequestModalProps) {
  const { locale } = useLocale();
  const { user } = useAuth();
  const isSignedIn = Boolean(user);
  const isAr = locale === 'ar';
  // Section 0: who is applying (K6)
  const [requesterType, setRequesterType] = useState<JoinRequesterType>(defaultRequesterType);
  const [publicAcademies, setPublicAcademies] = useState<
    Array<{ id: string; name: string; slug: string }>
  >([]);
  const [isLoadingAcademies, setIsLoadingAcademies] = useState(false);
  const [joinTenantId, setJoinTenantId] = useState('');
  // Section 1: Athlete Personal Information
  const [joinFirstName, setJoinFirstName] = useState('');
  const [joinLastName, setJoinLastName] = useState('');
  const [joinGender, setJoinGender] = useState<'MALE' | 'FEMALE'>('MALE');
  const [joinBirthYearOnly, setJoinBirthYearOnly] = useState(false);
  const [joinBirthYear, setJoinBirthYear] = useState('');
  const [joinDob, setJoinDob] = useState('');
  const [joinJerseyNumber, setJoinJerseyNumber] = useState('');
  const [joinNationalId, setJoinNationalId] = useState('');
  // Section 2: Emergency & Health
  const [joinEmergencyName, setJoinEmergencyName] = useState('');
  const [joinEmergencyPhone, setJoinEmergencyPhone] = useState('');
  const [joinMedicalNotes, setJoinMedicalNotes] = useState('');
  // Section 3: Primary Guardian
  const [joinGuardianName, setJoinGuardianName] = useState('');
  const [joinGuardianRelationship, setJoinGuardianRelationship] = useState('FATHER');
  const [joinPhone, setJoinPhone] = useState('');
  const [joinEmail, setJoinEmail] = useState('');
  // Section 5: new account (only when not signed in)
  const [joinPassword, setJoinPassword] = useState('');
  const [joinConfirmPassword, setJoinConfirmPassword] = useState('');
  // Submission Status
  const [isSubmittingJoin, setIsSubmittingJoin] = useState(false);
  const [joinSubmitted, setJoinSubmitted] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // On each open: clear previous result/error and load academies if not loaded yet.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!justOpened) return;

    setJoinSubmitted(false);
    setJoinError(null);
    setRequesterType(defaultRequesterType);
    // A signed-in applicant's request is linked to their account; their e-mail is the natural contact address.
    if (user?.email) setJoinEmail((current) => current || user.email);
    if (publicAcademies.length > 0) return;

    let cancelled = false;
    setIsLoadingAcademies(true);
    portalApi
      .listPublicAcademies()
      .then((list) => {
        if (cancelled) return;
        setPublicAcademies(list);
        const first = list[0];
        if (first) setJoinTenantId((current) => current || first.id);
      })
      .catch(() => {
        // Fallback gracefully
      })
      .finally(() => {
        if (!cancelled) setIsLoadingAcademies(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, publicAcademies.length, defaultRequesterType, user?.email]);

  const handlePlayerJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const values: PlayerJoinFormValues = {
      tenantId: joinTenantId,
      requesterType,
      firstName: joinFirstName,
      lastName: joinLastName,
      gender: joinGender,
      birthYearOnly: joinBirthYearOnly,
      birthYear: joinBirthYear,
      dateOfBirth: joinDob,
      jerseyNumber: joinJerseyNumber,
      nationalId: joinNationalId,
      emergencyContactName: joinEmergencyName,
      emergencyContactPhone: joinEmergencyPhone,
      medicalNotes: joinMedicalNotes,
      guardianName: joinGuardianName,
      guardianRelationship: joinGuardianRelationship,
      phone: joinPhone,
      email: joinEmail,
      password: joinPassword,
      confirmPassword: joinConfirmPassword,
    };

    const validationError = validatePlayerJoinForm(values, locale, isSignedIn);
    if (validationError) {
      setJoinError(validationError);
      return;
    }

    // F17: `pendingBackendSupport` (gender, jersey, national ID, emergency contact name,
    // medical notes, relationship) is intentionally not sent until the API supports it.
    const { payload } = buildPlayerJoinRequest(values, isSignedIn);

    setIsSubmittingJoin(true);
    setJoinError(null);
    try {
      await portalApi.submitPlayerJoinRequest(payload);
      setJoinSubmitted(true);
      // The password is not kept once the account exists.
      setJoinPassword('');
      setJoinConfirmPassword('');
      onSubmitted?.();
    } catch (err: unknown) {
      setJoinError(getErrorMessage(err, 'Failed to submit player join request'));
    } finally {
      setIsSubmittingJoin(false);
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-3xl rounded-3xl border border-(--border-app) bg-[var(--bg-surface)] shadow-2xl p-4 sm:p-6 sm:p-8 space-y-6 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-(--border-subtle) pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--accent-primary)/10 text-[var(--accent-primary)]">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-(--text-main)">
                    {locale === 'ar'
                      ? 'استمارة طلب انضمام لاعب جديد'
                      : 'New Player Join Request Form'}
                  </h3>
                  <p className="text-xs text-(--text-muted)">
                    {locale === 'ar'
                      ? 'تسجيل بيانات اللاعب الرياضية ومعلومات ولي الأمر لإرسالها لإدارة الأكاديمية فوراً.'
                      : 'Fill in athlete sports details and guardian contact to submit your application.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onClose()}
                className="rounded-xl p-2 text-(--text-muted) hover:bg-(--bg-surface-subtle) hover:text-(--text-main) transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {joinSubmitted ? (
              <div className="text-center py-8 space-y-4">
                <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
                <h4 className="text-xl font-extrabold text-(--text-main)">
                  {locale === 'ar'
                    ? 'تم إرسال طلب الانضمام بنجاح!'
                    : 'Join Request Submitted Successfully!'}
                </h4>
                <p className="text-sm text-(--text-muted) max-w-md mx-auto leading-relaxed">
                  {locale === 'ar'
                    ? 'سيقوم الجهاز الإداري للأكاديمية بمراجعة طلبك وتسكين اللاعب في المجموعة والفرع المناسب وتوليد بطاقة العضوية الذكية.'
                    : 'The academy administration will review your request, assign the appropriate team and branch, and issue the digital membership pass.'}
                </p>
                <p className="text-sm font-semibold text-(--text-main) max-w-md mx-auto leading-relaxed">
                  {isSignedIn
                    ? isAr
                      ? 'تم ربط الطلب بحسابك ويظهر في بوابتك بحالة "قيد المراجعة".'
                      : 'The request is linked to your account and shows as "pending" in your portal.'
                    : isAr
                      ? 'تم إنشاء حسابك وهو قيد المراجعة: يمكنك تسجيل الدخول بنفس البريد وكلمة المرور بعد موافقة الأكاديمية، وستصلك رسالة على بريدك الإلكتروني.'
                      : 'Your account was created and is pending: you can sign in with the same e-mail and password once the academy approves; you will be notified by e-mail.'}
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => onClose()}
                    className="rounded-xl bg-(--accent-primary) px-8 py-2.5 text-xs font-bold text-white shadow-md hover:brightness-110 transition-all cursor-pointer"
                  >
                    {locale === 'ar' ? 'حسناً، تم' : 'Done'}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePlayerJoinSubmit} className="space-y-6">
                {joinError && (
                  <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 text-xs text-red-500 flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                    <span className="font-medium">{joinError}</span>
                  </div>
                )}

                {/* F17: fields that are not submitted/saved yet — shown before the applicant types */}
                <UnsavedFieldsNotice locale={locale === 'ar' ? 'ar' : 'en'} />

                {/* Section 0 (K6): who is applying. Academy owners/coaches use the academy registration form. */}
                <fieldset className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface-subtle)/40 p-5 shadow-xs space-y-3">
                  <legend className="px-1 text-sm font-bold text-(--text-main)">
                    {isAr ? 'من يقدّم الطلب؟ *' : 'Who is applying? *'}
                  </legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(
                      [
                        {
                          value: 'GUARDIAN',
                          title: isAr ? 'أنا ولي الأمر' : 'I am the guardian',
                          hint: isAr
                            ? 'أسجّل ابني / ابنتي، وأتابعه من بوابة ولي الأمر.'
                            : 'I am registering my child and will follow them in the guardian portal.',
                        },
                        {
                          value: 'PLAYER',
                          title: isAr ? 'أنا اللاعب نفسه' : 'I am the player',
                          hint: isAr
                            ? 'أسجّل نفسي، وأتابع تدريبي من بوابة اللاعب.'
                            : 'I am registering myself and will follow my training in the player portal.',
                        },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={requesterType === option.value}
                        onClick={() => setRequesterType(option.value)}
                        className={`rounded-xl border p-3 text-start transition-colors cursor-pointer ${
                          requesterType === option.value
                            ? 'border-(--accent-primary) bg-(--accent-primary)/10'
                            : 'border-(--border-subtle) bg-[var(--bg-surface)] hover:border-(--accent-primary)/50'
                        }`}
                      >
                        <span className="block text-xs font-bold text-(--text-main)">
                          {option.title}
                        </span>
                        <span className="block text-[11px] text-(--text-muted) mt-1">
                          {option.hint}
                        </span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                {/* Section 1: Target Sports Academy */}
                <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface-subtle)/40 p-5 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 border-b border-(--border-subtle) pb-3 text-sm font-bold text-(--text-main)">
                    <Building2 className="h-4 w-4 text-[var(--accent-primary)]" />
                    <span>
                      {locale === 'ar'
                        ? '1. الأكاديمية الرياضية المستهدفة'
                        : '1. Target Sports Academy'}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-(--text-muted) mb-1.5">
                      {locale === 'ar'
                        ? 'اختر الأكاديمية المراد الانضمام إليها *'
                        : 'Select Target Academy *'}
                    </label>
                    {isLoadingAcademies ? (
                      <div className="text-xs text-(--text-muted) py-2">
                        {locale === 'ar'
                          ? 'جارٍ تحميل الأكاديميات المتاحة...'
                          : 'Loading academies...'}
                      </div>
                    ) : publicAcademies.length === 0 ? (
                      <div className="text-xs text-amber-500 py-1">
                        {locale === 'ar'
                          ? 'لا توجد أكاديميات نشطة متاحة حالياً'
                          : 'No active academies available at the moment'}
                      </div>
                    ) : (
                      <select
                        value={joinTenantId}
                        onChange={(e) => setJoinTenantId(e.target.value)}
                        required
                        className="w-full rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none transition-colors"
                      >
                        {publicAcademies.map((ac) => (
                          <option key={ac.id} value={ac.id}>
                            {ac.name} ({ac.slug})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Section 2: Athlete Personal Information */}
                <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface-subtle)/40 p-5 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 border-b border-(--border-subtle) pb-3 text-sm font-bold text-(--text-main)">
                    <User className="h-4 w-4 text-[var(--accent-primary)]" />
                    <span>
                      {locale === 'ar'
                        ? '2. البيانات الشخصية للاعب'
                        : '2. Athlete Personal Information'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-(--text-muted) mb-1.5">
                        {locale === 'ar' ? 'الاسم الأول *' : 'First Name *'}
                      </label>
                      <input
                        type="text"
                        required
                        value={joinFirstName}
                        onChange={(e) => setJoinFirstName(e.target.value)}
                        placeholder={locale === 'ar' ? 'مثال: يوسف' : 'e.g. Youssef'}
                        className="w-full rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-(--text-muted) mb-1.5">
                        {locale === 'ar' ? 'اسم العائلة *' : 'Last Name *'}
                      </label>
                      <input
                        type="text"
                        required
                        value={joinLastName}
                        onChange={(e) => setJoinLastName(e.target.value)}
                        placeholder={locale === 'ar' ? 'مثال: الشريف' : 'e.g. El-Sharif'}
                        className="w-full rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-(--text-muted) mb-1.5">
                        {locale === 'ar' ? 'الجنس *' : 'Gender *'}
                      </label>
                      <select
                        value={joinGender}
                        onChange={(e) => setJoinGender(e.target.value as 'MALE' | 'FEMALE')}
                        className="w-full rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none transition-colors"
                      >
                        <option value="MALE">{locale === 'ar' ? 'ذكر' : 'Male'}</option>
                        <option value="FEMALE">{locale === 'ar' ? 'أنثى' : 'Female'}</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-(--text-muted)">
                          {joinBirthYearOnly
                            ? locale === 'ar'
                              ? 'سنة الميلاد *'
                              : 'Birth Year *'
                            : locale === 'ar'
                              ? 'تاريخ الميلاد *'
                              : 'Date of Birth *'}
                        </label>
                        <button
                          type="button"
                          onClick={() => setJoinBirthYearOnly(!joinBirthYearOnly)}
                          className="text-[11px] text-[var(--accent-primary)] hover:underline font-medium cursor-pointer"
                        >
                          {joinBirthYearOnly
                            ? locale === 'ar'
                              ? 'استخدام تاريخ كامل'
                              : 'Use Full Date'
                            : locale === 'ar'
                              ? 'سنة الميلاد فقط'
                              : 'Year Only'}
                        </button>
                      </div>
                      {joinBirthYearOnly ? (
                        <input
                          type="number"
                          required
                          min="1950"
                          max={new Date().getFullYear()}
                          value={joinBirthYear}
                          onChange={(e) => setJoinBirthYear(e.target.value)}
                          placeholder={locale === 'ar' ? 'مثال: 2015' : 'e.g. 2015'}
                          className="w-full rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none transition-colors"
                        />
                      ) : (
                        <input
                          type="date"
                          required
                          value={joinDob}
                          onChange={(e) => setJoinDob(e.target.value)}
                          className="w-full rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none transition-colors"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-(--text-muted) mb-1.5">
                        {locale === 'ar'
                          ? 'رقم القميص المفضل (اختياري)'
                          : 'Jersey Number (Optional)'}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={joinJerseyNumber}
                        onChange={(e) => setJoinJerseyNumber(e.target.value)}
                        placeholder={locale === 'ar' ? 'مثال: 10' : 'e.g. 10'}
                        className="w-full rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-(--text-muted) mb-1.5">
                        {locale === 'ar'
                          ? 'الرقم القومي / جواز السفر (اختياري)'
                          : 'National ID / Passport (Optional)'}
                      </label>
                      <input
                        type="text"
                        value={joinNationalId}
                        onChange={(e) => setJoinNationalId(e.target.value)}
                        placeholder={
                          locale === 'ar' ? '14 رقم للرقم القومي' : 'National ID or Passport number'
                        }
                        className="w-full rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none transition-colors font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Emergency & Health */}
                <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface-subtle)/40 p-5 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 border-b border-(--border-subtle) pb-3 text-sm font-bold text-(--text-main)">
                    <Heart className="h-4 w-4 text-red-500" />
                    <span>
                      {locale === 'ar'
                        ? '3. بيانات الطوارئ والملاحظات الطبية'
                        : '3. Emergency & Medical Information'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-(--text-muted) mb-1.5">
                        {locale === 'ar' ? 'اسم جهة الاتصال للطوارئ' : 'Emergency Contact Name'}
                      </label>
                      <input
                        type="text"
                        value={joinEmergencyName}
                        onChange={(e) => setJoinEmergencyName(e.target.value)}
                        placeholder={
                          locale === 'ar'
                            ? 'مثال: أحمد الشريف (الأب)'
                            : 'e.g. Ahmed El-Sharif (Father)'
                        }
                        className="w-full rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-(--text-muted) mb-1.5">
                        {locale === 'ar' ? 'هاتف الطوارئ' : 'Emergency Phone'}
                      </label>
                      <input
                        type="tel"
                        value={joinEmergencyPhone}
                        onChange={(e) => setJoinEmergencyPhone(e.target.value)}
                        placeholder={locale === 'ar' ? 'مثال: +201012345678' : 'e.g. +201012345678'}
                        className="w-full rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none transition-colors font-mono"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-(--text-muted) mb-1.5">
                        {locale === 'ar'
                          ? 'ملاحظات طبية أو حساسية (اختياري)'
                          : 'Medical Notes or Allergies (Optional)'}
                      </label>
                      <textarea
                        rows={2}
                        value={joinMedicalNotes}
                        onChange={(e) => setJoinMedicalNotes(e.target.value)}
                        placeholder={
                          locale === 'ar'
                            ? 'أي حساسيات أو حالات صحية ينبغي للمدربين مراعاتها...'
                            : 'Any medical conditions, allergies, or notes for coaches...'
                        }
                        className="w-full rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 4: Primary Guardian Information */}
                <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface-subtle)/40 p-5 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 border-b border-(--border-subtle) pb-3 text-sm font-bold text-(--text-main)">
                    <Users className="h-4 w-4 text-[var(--accent-primary)]" />
                    <span>
                      {requesterType === 'GUARDIAN'
                        ? isAr
                          ? '4. بياناتك (ولي الأمر)'
                          : '4. Your Details (Guardian)'
                        : isAr
                          ? '4. بيانات ولي الأمر الأساسي'
                          : '4. Primary Guardian Information'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-(--text-muted) mb-1.5">
                        {locale === 'ar' ? 'الاسم الكامل لولي الأمر *' : 'Guardian Full Name *'}
                      </label>
                      <input
                        type="text"
                        required
                        value={joinGuardianName}
                        onChange={(e) => setJoinGuardianName(e.target.value)}
                        placeholder={
                          locale === 'ar' ? 'الاسم الثلاثي لولي الأمر' : 'Guardian full name'
                        }
                        className="w-full rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-(--text-muted) mb-1.5">
                        {locale === 'ar' ? 'صلة القرابة *' : 'Relationship *'}
                      </label>
                      <select
                        value={joinGuardianRelationship}
                        onChange={(e) => setJoinGuardianRelationship(e.target.value)}
                        className="w-full rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none transition-colors"
                      >
                        <option value="FATHER">{locale === 'ar' ? 'الأب' : 'Father'}</option>
                        <option value="MOTHER">{locale === 'ar' ? 'الأم' : 'Mother'}</option>
                        <option value="GUARDIAN">
                          {locale === 'ar' ? 'وصي قانوني' : 'Legal Guardian'}
                        </option>
                        <option value="RELATIVE">{locale === 'ar' ? 'أقارب' : 'Relative'}</option>
                        <option value="OTHER">{locale === 'ar' ? 'أخرى' : 'Other'}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-(--text-muted) mb-1.5">
                        {locale === 'ar' ? 'رقم الهاتف / الواتساب *' : 'Phone / WhatsApp *'}
                      </label>
                      <input
                        type="tel"
                        required
                        value={joinPhone}
                        onChange={(e) => setJoinPhone(e.target.value)}
                        placeholder={
                          locale === 'ar'
                            ? 'رقم الهاتف المحمول لولي الأمر'
                            : 'Guardian mobile number'
                        }
                        className="w-full rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none transition-colors font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-(--text-muted) mb-1.5">
                        {locale === 'ar' ? 'البريد الإلكتروني للتواصل *' : 'Contact Email *'}
                      </label>
                      <input
                        type="email"
                        required
                        value={joinEmail}
                        onChange={(e) => setJoinEmail(e.target.value)}
                        placeholder="parent@example.com"
                        className="w-full rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none transition-colors font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 5 (K6): the applicant's account */}
                <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface-subtle)/40 p-5 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 border-b border-(--border-subtle) pb-3 text-sm font-bold text-(--text-main)">
                    <KeyRound className="h-4 w-4 text-[var(--accent-primary)]" />
                    <span>{isAr ? '5. حسابك على المنصة' : '5. Your Account'}</span>
                  </div>

                  {isSignedIn ? (
                    <p className="text-xs text-(--text-muted) leading-relaxed">
                      {isAr
                        ? `سيتم ربط الطلب بحسابك الحالي (${user?.email ?? ''}) ويظهر في بوابتك بحالة "قيد المراجعة".`
                        : `The request will be linked to your current account (${user?.email ?? ''}) and shows as "pending" in your portal.`}
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-(--text-muted) leading-relaxed">
                        {isAr
                          ? 'سيتم إنشاء حساب بالبريد الإلكتروني أعلاه وكلمة المرور التالية. يبقى الحساب قيد المراجعة ولا يمكن تسجيل الدخول به حتى توافق الأكاديمية على الطلب. لديك حساب بالفعل؟ سجّل الدخول أولاً ثم أرسل الطلب.'
                          : 'An account is created with the e-mail above and this password. It stays pending and cannot sign in until the academy approves the request. Already have an account? Sign in first, then send the request.'}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label
                            htmlFor="join-password"
                            className="block text-xs font-semibold text-(--text-muted) mb-1.5"
                          >
                            {isAr ? 'كلمة المرور *' : 'Password *'}
                          </label>
                          <input
                            id="join-password"
                            type="password"
                            required
                            minLength={JOIN_PASSWORD_MIN_LENGTH}
                            autoComplete="new-password"
                            value={joinPassword}
                            onChange={(e) => setJoinPassword(e.target.value)}
                            className="w-full rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none transition-colors"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="join-confirm-password"
                            className="block text-xs font-semibold text-(--text-muted) mb-1.5"
                          >
                            {isAr ? 'تأكيد كلمة المرور *' : 'Confirm Password *'}
                          </label>
                          <input
                            id="join-confirm-password"
                            type="password"
                            required
                            minLength={JOIN_PASSWORD_MIN_LENGTH}
                            autoComplete="new-password"
                            value={joinConfirmPassword}
                            onChange={(e) => setJoinConfirmPassword(e.target.value)}
                            className="w-full rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none transition-colors"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Actions Bar */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-(--border-subtle)">
                  <button
                    type="button"
                    onClick={() => onClose()}
                    className="rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-5 py-2.5 text-xs font-semibold text-(--text-muted) hover:text-(--text-main) transition-colors cursor-pointer"
                  >
                    {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmittingJoin || !joinTenantId}
                    className="inline-flex items-center gap-2 rounded-xl bg-(--accent-primary) text-white px-6 py-2.5 text-xs font-semibold shadow-sm hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    <span>
                      {isSubmittingJoin
                        ? locale === 'ar'
                          ? 'جارٍ الإرسال...'
                          : 'Submitting...'
                        : locale === 'ar'
                          ? 'إرسال طلب الانضمام'
                          : 'Submit Join Application'}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
