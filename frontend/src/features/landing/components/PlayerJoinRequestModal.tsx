'use client';

import { Skeleton } from '@/components/ui/skeleton';
import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Building2, CheckCircle2, KeyRound, Save, UserPlus, X } from 'lucide-react';
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
import { EmailCodeVerification } from '@/features/auth/components/EmailCodeVerification';
import { emailNotConfirmedMessage, signupEmailErrorMessage } from '@/features/auth/email-code';
import { PlayerProfileFields } from '@/features/players/components/PlayerProfileFields';
import {
  EMPTY_PLAYER_PROFILE,
  type PlayerProfileFieldValues,
} from '@/features/players/player-profile-fields';

export interface PlayerJoinRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Who is applying, chosen by the button that opened the form: PLAYER ("join as a player") or GUARDIAN ("register my
   * child"). The two are separate forms; the applicant does not switch inside the form.
   */
  defaultRequesterType?: JoinRequesterType;
  /** Called after a request was accepted by the API (e.g. to refresh the portal's request list). */
  onSubmitted?: () => void;
}

/**
 * Public "join an academy" request form (landing page). Moved verbatim from app/landing/page.tsx.
 * Stays mounted while closed so typed values survive close/re-open, as before.
 *
 * Every field of the shared player form is stored with the request (owner decision 2026-11-25).
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
  // Sections 2-3: the shared player fields (same as the staff enrollment form)
  const [profile, setProfile] = useState<PlayerProfileFieldValues>(EMPTY_PLAYER_PROFILE);
  // GUARDIAN request: the guardian's own e-mail is the sign-in.
  const [joinEmail, setJoinEmail] = useState('');
  // PLAYER request: the player's own e-mail is the sign-in.
  const [joinPlayerEmail, setJoinPlayerEmail] = useState('');
  // Section 5: new account (only when not signed in)
  const [joinPassword, setJoinPassword] = useState('');
  const [joinConfirmPassword, setJoinConfirmPassword] = useState('');
  // Proof that the new account's e-mail was confirmed with a code (only when not signed in).
  const [joinEmailProof, setJoinEmailProof] = useState<string | null>(null);
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
    if (user?.email) {
      if (defaultRequesterType === 'PLAYER') setJoinPlayerEmail((current) => current || user.email);
      else setJoinEmail((current) => current || user.email);
    }
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
      ...profile,
      tenantId: joinTenantId,
      requesterType,
      email: joinEmail,
      playerEmail: joinPlayerEmail,
      password: joinPassword,
      confirmPassword: joinConfirmPassword,
    };

    const validationError = validatePlayerJoinForm(values, locale, isSignedIn);
    if (validationError) {
      setJoinError(validationError);
      return;
    }

    const { payload } = buildPlayerJoinRequest(values, isSignedIn);
    if (!isSignedIn && !joinEmailProof) {
      setJoinError(emailNotConfirmedMessage(locale));
      return;
    }

    setIsSubmittingJoin(true);
    setJoinError(null);
    try {
      await portalApi.submitPlayerJoinRequest(
        isSignedIn ? payload : { ...payload, emailProof: joinEmailProof ?? undefined },
      );
      setJoinSubmitted(true);
      // The password is not kept once the account exists.
      setJoinPassword('');
      setJoinConfirmPassword('');
      onSubmitted?.();
    } catch (err: unknown) {
      setJoinError(
        signupEmailErrorMessage(err, locale) ??
          getErrorMessage(err, 'Failed to submit player join request'),
      );
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
                    {requesterType === 'PLAYER'
                      ? isAr
                        ? 'طلب انضمام كلاعب'
                        : 'Join as a player'
                      : isAr
                        ? 'تسجيل ابن / ابنة (ولي الأمر)'
                        : 'Register my child (guardian)'}
                  </h3>
                  <p className="text-xs text-(--text-muted)">
                    {requesterType === 'PLAYER'
                      ? isAr
                        ? 'سجّل بياناتك وبريدك الإلكتروني الخاص بك، وتابع تدريبك من بوابة اللاعب بعد موافقة الأكاديمية.'
                        : 'Enter your details and your own e-mail; follow your training in the player portal once approved.'
                      : isAr
                        ? 'سجّل بيانات ابنك/ابنتك وبياناتك كولي أمر، وتابعه من بوابة ولي الأمر بعد موافقة الأكاديمية.'
                        : "Enter your child's details and yours; follow them in the guardian portal once approved."}
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
                      <Skeleton className="h-10 w-full" />
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

                {/* Sections 2-3: the shared player fields (same component as the staff enrollment form) */}
                <PlayerProfileFields
                  values={profile}
                  onChange={(patch) => setProfile((current) => ({ ...current, ...patch }))}
                  locale={isAr ? 'ar' : 'en'}
                  idPrefix="join"
                  tone="modal"
                  sectionNumbers={{ athlete: 2, guardian: 3 }}
                  guardianTitle={
                    requesterType === 'GUARDIAN'
                      ? isAr
                        ? 'بياناتك (ولي الأمر)'
                        : 'Your Details (Guardian)'
                      : undefined
                  }
                  disabled={isSubmittingJoin}
                  athleteExtra={
                    requesterType === 'PLAYER' ? (
                      <div>
                        <label
                          htmlFor="join-player-email"
                          className="block text-xs font-semibold text-(--text-muted) mb-1.5"
                        >
                          {isAr
                            ? 'بريدك الإلكتروني (للدخول إلى المنصة) *'
                            : 'Your e-mail (your sign-in) *'}
                        </label>
                        <input
                          id="join-player-email"
                          type="email"
                          required
                          autoComplete="email"
                          value={joinPlayerEmail}
                          onChange={(e) => setJoinPlayerEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="w-full rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none transition-colors font-mono"
                        />
                        {!isSignedIn && (
                          <EmailCodeVerification
                            email={joinPlayerEmail}
                            locale={locale}
                            onProofChange={setJoinEmailProof}
                            disabled={isSubmittingJoin}
                            idPrefix="join-player"
                          />
                        )}
                      </div>
                    ) : undefined
                  }
                  guardianExtra={
                    requesterType === 'GUARDIAN' ? (
                      <div>
                        <label
                          htmlFor="join-guardian-email"
                          className="block text-xs font-semibold text-(--text-muted) mb-1.5"
                        >
                          {isAr
                            ? 'بريدك الإلكتروني (للدخول إلى المنصة) *'
                            : 'Your e-mail (your sign-in) *'}
                        </label>
                        <input
                          id="join-guardian-email"
                          type="email"
                          required
                          autoComplete="email"
                          value={joinEmail}
                          onChange={(e) => setJoinEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="w-full rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none transition-colors font-mono"
                        />
                        {!isSignedIn && (
                          <EmailCodeVerification
                            email={joinEmail}
                            locale={locale}
                            onProofChange={setJoinEmailProof}
                            disabled={isSubmittingJoin}
                            idPrefix="join-guardian"
                          />
                        )}
                      </div>
                    ) : undefined
                  }
                />

                {/* Section 5 (K6): the applicant's account */}
                <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface-subtle)/40 p-5 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 border-b border-(--border-subtle) pb-3 text-sm font-bold text-(--text-main)">
                    <KeyRound className="h-4 w-4 text-[var(--accent-primary)]" />
                    <span>{isAr ? '4. حسابك على المنصة' : '4. Your Account'}</span>
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
                          ? `سيتم إنشاء حساب ${requesterType === 'PLAYER' ? 'للاعب ببريده الإلكتروني' : 'لولي الأمر ببريده الإلكتروني'} وكلمة المرور التالية. يبقى الحساب قيد المراجعة ولا يمكن تسجيل الدخول به حتى توافق الأكاديمية على الطلب. لديك حساب بالفعل؟ سجّل الدخول أولاً ثم أرسل الطلب.`
                          : `An account is created for ${requesterType === 'PLAYER' ? "the player's e-mail" : "the guardian's e-mail"} with this password. It stays pending and cannot sign in until the academy approves the request. Already have an account? Sign in first, then send the request.`}
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
