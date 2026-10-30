'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { useLocale } from '../../lib/locale-context';
import { getRoleHomeRoute } from '../../lib/role-routing';
import { Navbar } from '../../components/Navbar';
import { SportexusLogo } from '../../components/brand/SportexusLogo';
import { Mail, Eye, EyeOff, AlertCircle, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { user, activeTenant, login } = useAuth();
  const { locale, isRtl } = useLocale();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      router.push(getRoleHomeRoute(user, activeTenant));
    }
  }, [user, activeTenant, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const { user: freshUser, activeTenant: freshTenant } = await login({
        email: email.trim().toLowerCase(),
        password,
        rememberMe,
      });
      // Use fresh data from response, not stale React state
      router.push(getRoleHomeRoute(freshUser, freshTenant));
    } catch (err: unknown) {
      let message =
        locale === 'ar'
          ? 'فشل تسجيل الدخول. يرجى التحقق من بياناتك والمحاولة مرة أخرى.'
          : 'Login failed. Please check your credentials and try again.';

      if (err instanceof Error) {
        if (
          err.message.toLowerCase().includes('fetch') ||
          err.message.toLowerCase().includes('network')
        ) {
          message =
            locale === 'ar'
              ? 'تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت والمحاولة مجدداً.'
              : 'Could not connect to server. Please check your network connection and try again.';
        } else {
          message = err.message;
        }
      }
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-main)] flex flex-col transition-colors overflow-x-hidden">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 animate-fade-in">
        <div className="w-full max-w-md mx-auto">
          {/* Card container */}
          <div className="rounded-3xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-6 sm:p-8 shadow-float relative overflow-hidden backdrop-blur-xl animate-scale-up">
            {/* Sportexus decorative ambient glows */}
            <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[var(--ambient-glow-1)] blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-[var(--ambient-glow-2)] blur-3xl pointer-events-none" />

            {/* Header with Sportexus Logo */}
            <div className="text-center mb-8 relative z-10 flex flex-col items-center">
              <SportexusLogo size="lg" className="mb-4" />
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[var(--text-main)]">
                {locale === 'ar' ? 'تسجيل الدخول إلى سبورتكسس' : 'Sign In to Sportexus'}
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-[var(--text-muted)] font-medium">
                {locale === 'ar' ? 'منصة واحدة. لكل أكاديمية.' : 'One Platform. Every Academy.'}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-500 dark:text-rose-400 relative z-10">
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-500 mt-0.5" />
                <div className="leading-relaxed font-medium">{error}</div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
              <div>
                <label
                  className="block text-xs font-bold text-[var(--text-main)] mb-1.5"
                  htmlFor="email"
                >
                  {locale === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
                </label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@academy.sa"
                    dir="ltr"
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] py-2.5 pr-4 pl-10 text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] outline-none transition-all"
                  />
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-[var(--text-muted)]" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    className="block text-xs font-bold text-[var(--text-main)]"
                    htmlFor="password"
                  >
                    {locale === 'ar' ? 'كلمة المرور' : 'Password'}
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-[var(--accent-primary)] hover:underline font-semibold"
                  >
                    {locale === 'ar' ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    dir="ltr"
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] py-2.5 pr-4 pl-10 text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-3 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                    title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] cursor-pointer"
                />
                <label
                  htmlFor="rememberMe"
                  className="text-xs text-[var(--text-muted)] cursor-pointer select-none font-medium"
                >
                  {locale === 'ar'
                    ? 'تذكر بيانات الجلسة على هذا الجهاز'
                    : 'Remember me on this device'}
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] py-3 text-sm font-bold text-[var(--accent-primary-fg)] shadow-sm hover:opacity-90 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{locale === 'ar' ? 'جارٍ التحقق...' : 'Signing in...'}</span>
                  </>
                ) : (
                  <>
                    <span>{locale === 'ar' ? 'تسجيل الدخول' : 'Sign In'}</span>
                    <ArrowRight className={`h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
                  </>
                )}
              </button>
            </form>

            {/* Footer link */}
            <div className="mt-8 border-t border-[var(--border-subtle)] pt-6 text-center text-xs text-[var(--text-muted)] relative z-10">
              <span>
                {locale === 'ar' ? 'ليس لديك أكاديمية مسجلة بعد؟ ' : "Don't have an academy yet? "}
              </span>
              <Link
                href="/register"
                className="font-bold text-[var(--accent-primary)] hover:underline"
              >
                {locale === 'ar' ? 'سجّل أكاديميتك الآن' : 'Register your academy'}
              </Link>
            </div>
          </div>

          {/* Security badge note */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-[var(--text-muted)] text-center px-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
            <span className="leading-relaxed">
              {locale === 'ar'
                ? 'حماية مشددة: تشفير Argon2id • تدوير الجلسات • عزل كامل للبيانات'
                : 'Enterprise Security: Argon2id Encryption • Session Rotation • Tenant Isolation'}
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
