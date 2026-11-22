'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLocale } from '@/contexts/locale-context';
import { api, getErrorMessage } from '@/api/client';
import { useCooldown } from '@/hooks/useCooldown';
import { AuthPageLayout, AuthPageSuspense } from '@/features/auth/components/AuthPageLayout';
import { AuthCard, BackToSignInLink } from '@/features/auth/components/AuthCard';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import {
  AUTH_INPUT_BASE,
  AUTH_LABEL,
  AUTH_PRIMARY_ACTION,
  AUTH_TOKEN_INPUT,
} from '@/features/auth/components/auth-styles';
import { ShieldCheck, ArrowRight, Loader2, Mail, RefreshCw } from 'lucide-react';

const RESEND_COOLDOWN_SECONDS = 60;

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const { locale } = useLocale();

  const [token, setToken] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resend state
  const [resendEmail, setResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const { remaining: cooldown, start: startCooldown } = useCooldown();

  const performVerification = useCallback(
    async (tokenToVerify: string) => {
      if (!tokenToVerify.trim()) {
        setError(
          locale === 'ar'
            ? 'رمز التحقق مفقود أو غير مكتمل.'
            : 'Verification token is missing or invalid.',
        );
        return;
      }

      setIsVerifying(true);
      setError(null);

      try {
        await api.auth.verifyEmail(tokenToVerify.trim());
        setSuccess(true);
      } catch (err: unknown) {
        setError(
          getErrorMessage(
            err,
            locale === 'ar'
              ? 'فشل تأكيد البريد الإلكتروني. قد يكون الرابط منتهي الصلاحية أو مستخدماً بالفعل.'
              : 'Email verification failed. The link may be expired or already used.',
          ),
        );
      } finally {
        setIsVerifying(false);
      }
    },
    [locale],
  );

  // Read token from search params and auto-verify
  useEffect(() => {
    const queryToken = searchParams.get('token');
    if (queryToken && !success && !isVerifying && !error) {
      setToken(queryToken);
      performVerification(queryToken);
    }
  }, [searchParams, success, isVerifying, error, performVerification]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performVerification(token);
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown > 0 || isResending) return;

    setIsResending(true);
    setResendError(null);
    setResendSuccess(null);

    try {
      const res = await api.auth.resendVerification(resendEmail.trim().toLowerCase());
      setResendSuccess(
        res.message ||
          (locale === 'ar'
            ? 'إذا كان البريد مسجلاً وغير مؤكد، فسيصلك رابط تحقق جديد.'
            : 'If registered and unverified, a new verification link has been sent.'),
      );
      startCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err: unknown) {
      setResendError(
        getErrorMessage(
          err,
          locale === 'ar'
            ? 'تعذر إرسال رابط التحقق. يرجى المحاولة لاحقاً.'
            : 'Failed to send verification link. Please try again later.',
        ),
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthCard
      icon={ShieldCheck}
      title={locale === 'ar' ? 'تأكيد البريد الإلكتروني' : 'Verify Email Address'}
      subtitle={
        locale === 'ar'
          ? 'تفعيل وتأكيد حسابك على منصة سبورتكسس الرياضية'
          : 'Activate and verify your Sportexus account'
      }
      footer={
        <BackToSignInLink label={locale === 'ar' ? 'العودة إلى تسجيل الدخول' : 'Back to sign in'} />
      }
    >
      {/* Loading state during verification */}
      {isVerifying && (
        <div
          role="status"
          className="my-8 flex flex-col items-center justify-center gap-3 text-center relative z-10"
        >
          <Loader2 aria-hidden="true" className="h-10 w-10 animate-spin text-(--accent-primary)" />
          <p className="text-sm font-medium text-(--text-sub)">
            {locale === 'ar'
              ? 'جارٍ التحقق من صحة الرمز وتأكيد بريدك الإلكتروني...'
              : 'Verifying your token and confirming your email address...'}
          </p>
        </div>
      )}

      {/* Success State */}
      {success && (
        <div className="space-y-6 relative z-10">
          <AuthAlert
            tone="success"
            size="panel"
            title={
              locale === 'ar' ? 'تم تأكيد البريد الإلكتروني بنجاح!' : 'Email Verified Successfully!'
            }
          >
            {locale === 'ar'
              ? 'أصبح حسابك مفعلاً ومؤكداً الآن بالكامل على المنصة. يمكنك تسجيل الدخول والبدء في استخدام جميع المزايا.'
              : 'Your account is now fully verified and activated. You can sign in and start using the platform.'}
          </AuthAlert>

          <Link href="/login" className={AUTH_PRIMARY_ACTION}>
            <span>{locale === 'ar' ? 'الانتقال إلى تسجيل الدخول' : 'Proceed to Sign In'}</span>
            <ArrowRight aria-hidden="true" className="h-4 w-4 rotate-180" />
          </Link>
        </div>
      )}

      {/* Error State or Manual Entry */}
      {!success && !isVerifying && (
        <div className="space-y-6 relative z-10">
          {error && <AuthAlert tone="error">{error}</AuthAlert>}

          {/* Manual Token Form */}
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className={AUTH_LABEL} htmlFor="token">
                {locale === 'ar' ? 'رمز التحقق (Token)' : 'Verification Token'}
              </label>
              <input
                id="token"
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={
                  locale === 'ar'
                    ? 'الصق رمز التحقق من رسالة البريد...'
                    : 'Paste the verification token from your email...'
                }
                dir="ltr"
                className={AUTH_TOKEN_INPUT}
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying || !token.trim()}
              className={AUTH_PRIMARY_ACTION}
            >
              <span>{locale === 'ar' ? 'تأكيد الحساب' : 'Verify Account'}</span>
              <ArrowRight aria-hidden="true" className="h-4 w-4 rotate-180" />
            </button>
          </form>

          {/* Resend Link Section */}
          <div className="border-t border-(--border-subtle) pt-6">
            <h2 className="text-xs font-semibold text-(--text-sub) mb-2">
              {locale === 'ar'
                ? 'لم تستلم رسالة التحقق؟'
                : 'Didn’t receive the verification email?'}
            </h2>

            {resendError && (
              <AuthAlert tone="error" size="compact" className="mb-3">
                {resendError}
              </AuthAlert>
            )}

            {resendSuccess && (
              <AuthAlert tone="success" size="compact" className="mb-3">
                {resendSuccess}
              </AuthAlert>
            )}

            <form onSubmit={handleResend} className="space-y-3">
              <div className="relative">
                <input
                  type="email"
                  required
                  autoComplete="email"
                  aria-label={locale === 'ar' ? 'البريد الإلكتروني' : 'Email address'}
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="name@example.com"
                  dir="ltr"
                  className={`${AUTH_INPUT_BASE} py-2 pl-9 pr-3 text-xs`}
                />
                <Mail
                  aria-hidden="true"
                  className="absolute left-2.5 top-2.5 h-4 w-4 text-(--text-muted)"
                />
              </div>

              <button
                type="submit"
                disabled={isResending || cooldown > 0 || !resendEmail.trim()}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-(--border-app) bg-(--bg-surface-subtle) py-2.5 text-xs font-semibold text-(--text-main) hover:bg-(--bg-surface-subtle)/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isResending ? (
                  <>
                    <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                    <span>{locale === 'ar' ? 'جارٍ الإرسال...' : 'Sending...'}</span>
                  </>
                ) : cooldown > 0 ? (
                  <span>
                    {locale === 'ar'
                      ? `إعادة الإرسال بعد ${cooldown} ثانية`
                      : `Resend in ${cooldown}s`}
                  </span>
                ) : (
                  <>
                    <RefreshCw aria-hidden="true" className="h-3.5 w-3.5 text-(--accent-primary)" />
                    <span>
                      {locale === 'ar' ? 'إعادة إرسال رابط التحقق' : 'Resend Verification Link'}
                    </span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthPageLayout>
      <AuthPageSuspense>
        <VerifyEmailContent />
      </AuthPageSuspense>
    </AuthPageLayout>
  );
}
