'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '../../components/Navbar';
import { useLocale } from '../../lib/locale-context';
import { api } from '../../lib/api-client';
import {
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Loader2,
} from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useLocale();

  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const queryToken = searchParams.get('token');
    if (queryToken) {
      setToken(queryToken);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(
        locale === 'ar'
          ? 'كلمة المرور وتأكيد كلمة المرور غير متطابقين.'
          : 'Passwords do not match.',
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

    setIsSubmitting(true);

    try {
      await api.auth.resetPassword({
        token: token.trim(),
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
            ? 'فشل إعادة ضبط كلمة المرور. قد يكون الرمز منتهي الصلاحية أو مستخدماً بالفعل.'
            : 'Failed to reset password. The token may be expired or already used.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-2xl border border-slate-800 bg-[#0f172a]/90 p-5 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        {/* Sportexus ambient glows */}
        <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[#0A3BFF]/25 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-[#00D6FF]/15 blur-3xl pointer-events-none" />

        <div className="text-center mb-8 relative z-10">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#0A3BFF] to-[#00D6FF] shadow-lg shadow-blue-600/25">
            <KeyRound className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {locale === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Reset Password'}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {locale === 'ar'
              ? 'أدخل رمز الاستعادة وكلمة المرور الجديدة لحسابك'
              : 'Enter your recovery code and new password'}
          </p>
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
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="token">
                {locale === 'ar' ? 'رمز الاستعادة *' : 'Recovery Code *'}
              </label>
              <input
                id="token"
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={locale === 'ar' ? 'أدخل الرمز المرسل...' : 'Enter the recovery token...'}
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/90 py-2.5 px-3 text-xs font-mono text-white placeholder-slate-500 focus:border-[#00D6FF] focus:ring-1 focus:ring-[#00D6FF] outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="password">
                {locale === 'ar' ? 'كلمة المرور الجديدة *' : 'New Password *'}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 py-2.5 pr-4 pl-10 text-sm text-white placeholder-slate-500 focus:border-[#00D6FF] focus:ring-1 focus:ring-[#00D6FF] outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-3 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="confirmPassword">
                {locale === 'ar' ? 'تأكيد كلمة المرور الجديدة *' : 'Confirm New Password *'}
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/90 py-2.5 px-3 text-sm text-white placeholder-slate-500 focus:border-[#00D6FF] focus:ring-1 focus:ring-[#00D6FF] outline-none transition-all"
              />
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
                  <ArrowRight className="h-4 w-4 rotate-180" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="mt-8 border-t border-slate-800 pt-6 text-center text-xs text-slate-400 relative z-10">
          <Link href="/login" className="font-semibold text-[#00D6FF] hover:underline">
            {locale === 'ar' ? 'العودة إلى تسجيل الدخول' : 'Back to sign in'}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-main)] flex flex-col overflow-x-hidden">
      <Navbar />
      <main className="flex-1 flex items-center justify-center p-3 sm:p-6 lg:p-8">
        <Suspense
          fallback={
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin text-[#00D6FF]" />
              <span>جارٍ تحميل الصفحة...</span>
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </main>
    </div>
  );
}
