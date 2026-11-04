'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '../../components/Navbar';
import { useLocale } from '@/contexts/locale-context';
import { api } from '@/api/client';
import {
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Lock,
  Mail,
} from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, isRtl } = useLocale();

  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Handle token, otp, or code query params
    const queryToken =
      searchParams.get('token') ||
      searchParams.get('otp') ||
      searchParams.get('code');
    if (queryToken) {
      setToken(queryToken.replace(/\D/g, '').slice(0, 6));
    }

    // Handle optional email query param
    const queryEmail = searchParams.get('email');
    if (queryEmail) {
      setEmail(queryEmail.trim());
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanToken = token.trim();
    if (!cleanToken || cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) {
      setError(
        locale === 'ar'
          ? 'يرجى إدخال رمز التحقق المكوّن من 6 أرقام.'
          : 'Please enter the 6-digit verification code.',
      );
      return;
    }

    if (password.length < 8) {
      setError(
        locale === 'ar'
          ? 'يجب ألا تقل كلمة المرور عن 8 أحرف.'
          : 'Password must be at least 8 characters.',
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        locale === 'ar'
          ? 'كلمة المرور وتأكيد كلمة المرور غير متطابقين.'
          : 'Passwords do not match.',
      );
      return;
    }

    setIsSubmitting(true);

    try {
      await api.auth.resetPassword({
        token: cleanToken,
        newPassword: password,
      });
      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : locale === 'ar'
            ? 'فشل إعادة ضبط كلمة المرور. قد يكون الرمز غير صحيح أو منتهي الصلاحية.'
            : 'Failed to reset password. The token may be invalid or expired.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-3xl border border-[var(--border-app)] bg-[var(--bg-surface)]/95 p-5 sm:p-8 shadow-float backdrop-blur-xl relative overflow-hidden animate-scale-up">
        {/* Sportexus ambient glows */}
        <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[var(--accent-blue)]/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-[var(--accent-primary)]/10 blur-3xl pointer-events-none" />

        <div className="text-center mb-8 relative z-10 flex flex-col items-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#0A3BFF] to-[#00D6FF] shadow-lg shadow-blue-600/25">
            <KeyRound className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
            {locale === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Reset Password'}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {locale === 'ar'
              ? 'أدخل رمز التحقق (OTP) المكوّن من 6 أرقام وكلمة المرور الجديدة'
              : 'Enter your 6-digit verification code (OTP) and new password'}
          </p>
          {email && (
            <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] font-mono">
              <Mail className="h-3 w-3 text-[var(--accent-primary)]" />
              <span>{email}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300 relative z-10">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {success && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/10 p-4 text-xs text-[#4ADE80] relative z-10">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-[#22C55E] mt-0.5" />
            <div className="leading-relaxed">
              {locale === 'ar'
                ? 'تم تغيير كلمة المرور بنجاح! يتم تحويلك تلقائياً لصفحة تسجيل الدخول...'
                : 'Password changed successfully! Redirecting to sign in...'}
            </div>
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
            {/* OTP Code */}
            <div>
              <label
                className="block text-xs font-semibold text-[var(--text-sub)] mb-1.5"
                htmlFor="token"
              >
                {locale === 'ar' ? 'رمز التحقق (6 أرقام) *' : 'Verification Code (6 digits) *'}
              </label>
              <input
                id="token"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                dir="ltr"
                className="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] py-3 px-4 text-center text-xl font-mono font-bold tracking-[0.5em] text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] outline-none transition-all"
              />
            </div>

            {/* New Password */}
            <div>
              <label
                className="block text-xs font-semibold text-[var(--text-sub)] mb-1.5"
                htmlFor="password"
              >
                {locale === 'ar' ? 'كلمة المرور الجديدة *' : 'New Password *'}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            {/* Confirm Password */}
            <div>
              <label
                className="block text-xs font-semibold text-[var(--text-sub)] mb-1.5"
                htmlFor="confirmPassword"
              >
                {locale === 'ar' ? 'تأكيد كلمة المرور الجديدة *' : 'Confirm New Password *'}
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={locale === 'ar' ? 'أعد كتابة كلمة المرور' : 'Re-enter password'}
                  dir="ltr"
                  className="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] py-2.5 px-4 ps-10 text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] outline-none transition-all"
                />
                <Lock className="absolute start-3 top-3 h-4 w-4 text-slate-500" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute end-3 top-3 text-slate-400 hover:text-[var(--text-main)]"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0A3BFF] via-[#0077FF] to-[#00D6FF] py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/30 hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{locale === 'ar' ? 'جارٍ الحفظ...' : 'Saving...'}</span>
                </>
              ) : (
                <>
                  <span>
                    {locale === 'ar' ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password'}
                  </span>
                  <ArrowRight className={`h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
                </>
              )}
            </button>
          </form>
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

function ResetPasswordLoadingFallback() {
  const { locale } = useLocale();
  return <span>{locale === 'ar' ? 'جارٍ تحميل الصفحة...' : 'Loading page...'}</span>;
}

export default function ResetPasswordPage() {
  const { locale } = useLocale();
  return (
    <div
      className="min-h-screen bg-[var(--bg-base)] text-[var(--text-main)] flex flex-col overflow-x-hidden animate-fade-in"
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
    >
      <Navbar />
      <main className="flex-1 flex items-center justify-center p-3 sm:p-6 lg:p-8">
        <Suspense
          fallback={
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--accent-primary)]" />
              <ResetPasswordLoadingFallback />
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </main>
    </div>
  );
}
