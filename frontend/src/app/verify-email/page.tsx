'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '../../components/Navbar';
import { useLocale } from '../../lib/locale-context';
import { api } from '../../lib/api-client';
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

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
  const [cooldown, setCooldown] = useState(0);

  // Handle countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

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
          err instanceof Error
            ? err.message
            : locale === 'ar'
              ? 'فشل تأكيد البريد الإلكتروني. قد يكون الرابط منتهي الصلاحية أو مستخدماً بالفعل.'
              : 'Email verification failed. The link may be expired or already used.',
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
      setCooldown(60);
    } catch (err: unknown) {
      setResendError(
        err instanceof Error
          ? err.message
          : locale === 'ar'
            ? 'تعذر إرسال رابط التحقق. يرجى المحاولة لاحقاً.'
            : 'Failed to send verification link. Please try again later.',
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-3xl border border-[var(--border-app)] bg-[var(--bg-surface)]/95 p-5 sm:p-8 shadow-float backdrop-blur-xl relative overflow-hidden animate-scale-up">
        {/* Sportexus ambient glows */}
        <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[var(--accent-blue)]/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-[var(--accent-primary)]/10 blur-3xl pointer-events-none" />

        <div className="text-center mb-8 relative z-10">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#0A3BFF] to-[#00D6FF] shadow-lg shadow-blue-600/25">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
            {locale === 'ar' ? 'تأكيد البريد الإلكتروني' : 'Verify Email Address'}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {locale === 'ar'
              ? 'تفعيل وتأكيد حسابك على منصة سبورتكسس الرياضية'
              : 'Activate and verify your Sportexus account'}
          </p>
        </div>

        {/* Loading state during verification */}
        {isVerifying && (
          <div className="my-8 flex flex-col items-center justify-center gap-3 text-center relative z-10">
            <Loader2 className="h-10 w-10 animate-spin text-[var(--accent-primary)]" />
            <p className="text-sm font-medium text-slate-300">
              {locale === 'ar'
                ? 'جارٍ التحقق من صحة الرمز وتأكيد بريدك الإلكتروني...'
                : 'Verifying your token and confirming your email address...'}
            </p>
          </div>
        )}

        {/* Success State */}
        {success && (
          <div className="space-y-6 relative z-10">
            <div className="flex items-start gap-3 rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/10 p-5 text-sm text-[#4ADE80]">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-[#22C55E] mt-0.5" />
              <div>
                <h3 className="font-bold text-[#4ADE80]">
                  {locale === 'ar'
                    ? 'تم تأكيد البريد الإلكتروني بنجاح!'
                    : 'Email Verified Successfully!'}
                </h3>
                <p className="mt-1 text-xs text-[#86EFAC] leading-relaxed">
                  {locale === 'ar'
                    ? 'أصبح حسابك مفعلاً ومؤكداً الآن بالكامل على المنصة. يمكنك تسجيل الدخول والبدء في استخدام جميع المزايا.'
                    : 'Your account is now fully verified and activated. You can sign in and start using the platform.'}
                </p>
              </div>
            </div>

            <Link
              href="/login"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0A3BFF] via-[#0077FF] to-[#00D6FF] py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/30 hover:brightness-110 active:scale-[0.99] transition-all"
            >
              <span>{locale === 'ar' ? 'الانتقال إلى تسجيل الدخول' : 'Proceed to Sign In'}</span>
              <ArrowRight className="h-4 w-4 rotate-180" />
            </Link>
          </div>
        )}

        {/* Error State or Manual Entry */}
        {!success && !isVerifying && (
          <div className="space-y-6 relative z-10">
            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
                <div>{error}</div>
              </div>
            )}

            {/* Manual Token Form */}
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label
                  className="block text-xs font-semibold text-[var(--text-sub)] mb-1.5"
                  htmlFor="token"
                >
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
                  className="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] py-2.5 px-3 text-xs font-mono text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] outline-none transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isVerifying || !token.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0A3BFF] via-[#0077FF] to-[#00D6FF] py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/30 hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <span>{locale === 'ar' ? 'تأكيد الحساب' : 'Verify Account'}</span>
                <ArrowRight className="h-4 w-4 rotate-180" />
              </button>
            </form>

            {/* Resend Link Section */}
            <div className="border-t border-[var(--border-subtle)] pt-6">
              <h2 className="text-xs font-semibold text-[var(--text-sub)] mb-2">
                {locale === 'ar'
                  ? 'لم تستلم رسالة التحقق؟'
                  : 'Didn’t receive the verification email?'}
              </h2>

              {resendError && (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                  <div>{resendError}</div>
                </div>
              )}

              {resendSuccess && (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-[#22C55E]/30 bg-[#22C55E]/10 p-3 text-xs text-[#4ADE80]">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#22C55E] mt-0.5" />
                  <div>{resendSuccess}</div>
                </div>
              )}

              <form onSubmit={handleResend} className="space-y-3">
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="user@example.com"
                    dir="ltr"
                    className="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] py-2 pl-9 pr-3 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] outline-none transition-all"
                  />
                  <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                </div>

                <button
                  type="submit"
                  disabled={isResending || cooldown > 0 || !resendEmail.trim()}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] py-2.5 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface-subtle)]/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isResending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
                      <RefreshCw className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
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

        <div className="mt-8 border-t border-[var(--border-subtle)] pt-6 text-center text-xs text-[var(--text-muted)] relative z-10">
          <Link
            href="/login"
            className="font-semibold text-[var(--accent-primary)] hover:underline transition-colors"
          >
            {locale === 'ar' ? 'العودة إلى تسجيل الدخول' : 'Back to sign in'}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-main)] flex flex-col overflow-x-hidden animate-fade-in">
      <Navbar />
      <main className="flex-1 flex items-center justify-center p-3 sm:p-6 lg:p-8">
        <Suspense
          fallback={
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--accent-primary)]" />
              <span>جارٍ تحميل الصفحة...</span>
            </div>
          }
        >
          <VerifyEmailContent />
        </Suspense>
      </main>
    </div>
  );
}
