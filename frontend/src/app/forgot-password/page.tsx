'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '../../components/Navbar';
import { useLocale } from '@/contexts/locale-context';
import { api } from '@/api/client';
import { KeyRound, Mail, AlertCircle, CheckCircle2, ArrowRight, Loader2, Copy, Lock, Eye, EyeOff } from 'lucide-react';

// Security guard: debug OTP is ONLY shown when accessed via localhost/127.0.0.1.
const isLocalDevAccess =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export default function ForgotPasswordPage() {
  const { locale } = useLocale();
  const router = useRouter();

  // Step 1: email entry. Step 2: OTP + new password.
  const [step, setStep] = useState<'email' | 'otp'>('email');

  // Step 1 state
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Step 2 state
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await api.auth.forgotPassword({ email: email.trim().toLowerCase() });
      // Only store debugOtp when on localhost — never on public URLs
      const otpCode = (res as { debugOtp?: string }).debugOtp;
      if (otpCode && isLocalDevAccess) {
        setDebugOtp(otpCode);
      }
      setCooldown(60);
      setStep('otp');
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : locale === 'ar'
            ? 'حدث خطأ أثناء معالجة الطلب. يرجى المحاولة لاحقاً.'
            : 'An error occurred. Please try again later.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!otp.trim() || otp.trim().length !== 6 || !/^\d+$/.test(otp.trim())) {
      setError(
        locale === 'ar'
          ? 'يرجى إدخال رمز التحقق المكوّن من 6 أرقام.'
          : 'Please enter the 6-digit verification code.',
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(
        locale === 'ar' ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.',
      );
      return;
    }
    if (newPassword.length < 8) {
      setError(
        locale === 'ar'
          ? 'يجب ألا تقل كلمة المرور عن 8 أحرف.'
          : 'Password must be at least 8 characters.',
      );
      return;
    }

    setIsResetting(true);
    try {
      await api.auth.resetPassword({
        token: otp.trim(),
        newPassword,
      });
      setResetSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : locale === 'ar'
            ? 'فشل إعادة تعيين كلمة المرور. قد يكون الرمز غير صحيح أو منتهي الصلاحية.'
            : 'Failed to reset password. The code may be incorrect or expired.',
      );
    } finally {
      setIsResetting(false);
    }
  };

  const handleCopy = () => {
    if (debugOtp) {
      navigator.clipboard.writeText(debugOtp);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleResendCode = async () => {
    if (cooldown > 0) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await api.auth.forgotPassword({ email: email.trim().toLowerCase() });
      const otpCode = (res as { debugOtp?: string }).debugOtp;
      if (otpCode && isLocalDevAccess) {
        setDebugOtp(otpCode);
      }
      setCooldown(60);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to resend code.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[var(--bg-base)] text-[var(--text-main)] flex flex-col transition-colors overflow-x-hidden animate-fade-in"
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
    >
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-3 sm:p-6 lg:p-8">
        <div className="w-full max-w-md mx-auto">
          <div className="rounded-3xl border border-[var(--border-app)] bg-[var(--bg-surface)]/95 p-5 sm:p-8 shadow-float backdrop-blur-xl relative overflow-hidden animate-scale-up">
            {/* Ambient glows */}
            <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[var(--accent-blue)]/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-[var(--accent-primary)]/10 blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="text-center mb-8 relative z-10 flex flex-col items-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#0A3BFF] to-[#00D6FF] shadow-lg shadow-blue-600/25">
                <KeyRound className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
                {locale === 'ar' ? 'استعادة كلمة المرور' : 'Reset Password'}
              </h1>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                {step === 'email'
                  ? locale === 'ar'
                    ? 'أدخل بريدك الإلكتروني وسنرسل لك رمز تحقق مكوّن من 6 أرقام'
                    : 'Enter your email and we will send you a 6-digit verification code'
                  : locale === 'ar'
                    ? 'أدخل الرمز المرسل إلى بريدك الإلكتروني وكلمة المرور الجديدة'
                    : 'Enter the code sent to your email and your new password'}
              </p>
            </div>

            {/* Progress indicator */}
            <div className="flex gap-2 mb-6 relative z-10">
              <div className={`h-1 flex-1 rounded-full transition-colors ${step === 'email' ? 'bg-[var(--accent-primary)]' : 'bg-[var(--accent-primary)]'}`} />
              <div className={`h-1 flex-1 rounded-full transition-colors ${step === 'otp' ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-app)]'}`} />
            </div>

            {/* Error */}
            {error && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300 relative z-10">
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
                <div>{error}</div>
              </div>
            )}

            {/* Success */}
            {resetSuccess && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-xs text-green-300 relative z-10">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-400 mt-0.5" />
                <div>
                  {locale === 'ar'
                    ? 'تم إعادة تعيين كلمة المرور بنجاح! جارٍ التوجيه إلى صفحة تسجيل الدخول...'
                    : 'Password reset successfully! Redirecting to login...'}
                </div>
              </div>
            )}

            {/* STEP 1: Email entry */}
            {step === 'email' && (
              <form onSubmit={handleSendCode} className="space-y-5 relative z-10">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-sub)] mb-1.5" htmlFor="email">
                    {locale === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@example.com"
                      dir="ltr"
                      className="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] py-2.5 px-4 ps-10 text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] outline-none transition-all"
                    />
                    <Mail className="absolute start-3 top-3 h-4 w-4 text-slate-500" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || cooldown > 0}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0A3BFF] via-[#0077FF] to-[#00D6FF] py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/30 hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{locale === 'ar' ? 'جارٍ الإرسال...' : 'Sending...'}</span>
                    </>
                  ) : cooldown > 0 ? (
                    <span>
                      {locale === 'ar'
                        ? `إعادة الإرسال بعد ${cooldown} ثانية`
                        : `Resend available in ${cooldown}s`}
                    </span>
                  ) : (
                    <>
                      <span>{locale === 'ar' ? 'إرسال رمز التحقق' : 'Send Verification Code'}</span>
                      <ArrowRight className={`h-4 w-4 ${locale === 'ar' ? 'rotate-180' : ''}`} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* STEP 2: OTP + new password */}
            {step === 'otp' && !resetSuccess && (
              <form onSubmit={handleResetPassword} className="space-y-5 relative z-10">
                {/* Debug OTP: localhost only */}
                {debugOtp && isLocalDevAccess && (
                  <div className="rounded-xl border border-amber-600/30 bg-amber-500/10 p-4 text-xs space-y-2">
                    <div className="flex items-center justify-between text-amber-400">
                      <span className="font-semibold">🔒 {locale === 'ar' ? 'للتطوير المحلي فقط' : 'Local Dev Only'}</span>
                      <button type="button" onClick={handleCopy} className="flex items-center gap-1 text-[var(--accent-primary)] hover:underline">
                        <Copy className="h-3 w-3" />
                        <span>{copied ? (locale === 'ar' ? 'تم!' : 'Copied!') : (locale === 'ar' ? 'نسخ' : 'Copy')}</span>
                      </button>
                    </div>
                    <div className="text-center py-2">
                      <span className="font-mono text-2xl font-bold tracking-[0.5em] text-amber-300">{debugOtp}</span>
                    </div>
                    <p className="text-amber-300/70 text-[10px]">
                      {locale === 'ar'
                        ? 'هذا الرمز لا يظهر في بيئة الإنتاج، يُرسَل عبر البريد الإلكتروني فقط.'
                        : 'This code is never shown in production. Delivered via email only.'}
                    </p>
                  </div>
                )}

                {/* OTP input */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-sub)] mb-1.5" htmlFor="otp">
                    {locale === 'ar' ? 'رمز التحقق (6 أرقام)' : 'Verification Code (6 digits)'}
                  </label>
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    dir="ltr"
                    className="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] py-3 px-4 text-center text-xl font-mono font-bold tracking-[0.5em] text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] outline-none transition-all"
                  />
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-xs text-[var(--text-muted)]">
                      {locale === 'ar' ? `أُرسل إلى ${email}` : `Sent to ${email}`}
                    </p>
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={cooldown > 0 || isSubmitting}
                      className="text-xs text-[var(--accent-primary)] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cooldown > 0
                        ? locale === 'ar' ? `إعادة الإرسال بعد ${cooldown}s` : `Resend in ${cooldown}s`
                        : locale === 'ar' ? 'إعادة إرسال الرمز' : 'Resend code'}
                    </button>
                  </div>
                </div>

                {/* New password */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-sub)] mb-1.5" htmlFor="newPassword">
                    {locale === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}
                  </label>
                  <div className="relative">
                    <input
                      id="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={locale === 'ar' ? 'كلمة مرور قوية (8+ أحرف)' : 'Strong password (8+ chars)'}
                      dir="ltr"
                      className="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] py-2.5 px-4 ps-10 text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] outline-none transition-all"
                    />
                    <Lock className="absolute start-3 top-3 h-4 w-4 text-slate-500" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute end-3 top-3 text-slate-400 hover:text-[var(--text-main)]"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-sub)] mb-1.5" htmlFor="confirmPassword">
                    {locale === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm Password'}
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={locale === 'ar' ? 'أعد كتابة كلمة المرور' : 'Re-enter password'}
                    dir="ltr"
                    className="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] py-2.5 px-4 text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] outline-none transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isResetting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0A3BFF] via-[#0077FF] to-[#00D6FF] py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/30 hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isResetting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{locale === 'ar' ? 'جارٍ إعادة التعيين...' : 'Resetting...'}</span>
                    </>
                  ) : (
                    <>
                      <span>{locale === 'ar' ? 'تأكيد وإعادة التعيين' : 'Confirm & Reset Password'}</span>
                      <ArrowRight className={`h-4 w-4 ${locale === 'ar' ? 'rotate-180' : ''}`} />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep('email'); setError(null); setOtp(''); }}
                  className="w-full text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                >
                  {locale === 'ar' ? '← تغيير البريد الإلكتروني' : '← Change email address'}
                </button>
              </form>
            )}

            <div className="mt-8 border-t border-[var(--border-subtle)] pt-6 text-center text-xs text-[var(--text-muted)] relative z-10">
              <Link
                href="/login"
                className="font-semibold text-[var(--accent-primary)] hover:underline transition-colors"
              >
                {locale === 'ar' ? 'العودة إلى صفحة تسجيل الدخول' : 'Back to sign in'}
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
