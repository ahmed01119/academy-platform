'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useLocale } from '@/contexts/locale-context';
import { getRoleHomeRoute } from '@/utils/role-routing';
import { Navbar } from '../../components/Navbar';
import { SportexusLogo } from '../../components/brand/SportexusLogo';
import { resolveLoginError, validateLoginForm, type LoginValues } from '@/features/auth/login-form';
import { PasswordVisibilityToggle } from '@/features/auth/components/PasswordVisibilityToggle';
import { Mail, Lock, AlertCircle, ArrowRight, ShieldCheck, Loader2, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { locale, isRtl } = useLocale();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = useCallback(
    (values: LoginValues) => validateLoginForm(values, rememberMe, locale),
    [locale, rememberMe],
  );

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);
    if (touched.email) {
      const errs = validate({ email: val, password });
      setFieldErrors((prev) => ({ ...prev, email: errs.email }));
    }
    if (error) setError(null);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPassword(val);
    if (touched.password) {
      const errs = validate({ email, password: val });
      setFieldErrors((prev) => ({ ...prev, password: errs.password }));
    }
    if (error) setError(null);
  };

  const handleBlur = (field: 'email' | 'password') => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errs = validate({ email, password });
    setFieldErrors((prev) => ({ ...prev, [field]: errs[field] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTouched({ email: true, password: true });

    const clientErrors = validate({ email, password });
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      if (clientErrors.email) {
        document.getElementById('email')?.focus();
      } else if (clientErrors.password) {
        document.getElementById('password')?.focus();
      }
      return;
    }

    setFieldErrors({});
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
      const { formError, fieldErrors: mapped } = resolveLoginError(err, locale);
      if (mapped) setFieldErrors(mapped);
      setError(formError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-(--bg-base) text-(--text-main) flex flex-col transition-colors overflow-x-hidden">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 animate-fade-in">
        <div className="w-full max-w-md mx-auto">
          {/* Card container */}
          <div className="rounded-3xl border border-(--border-app) bg-[var(--bg-surface)] p-6 sm:p-8 shadow-float relative overflow-hidden backdrop-blur-xl animate-scale-up">
            {/* Sportexus decorative ambient glows */}
            <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[var(--ambient-glow-1)] blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-[var(--ambient-glow-2)] blur-3xl pointer-events-none" />

            {/* Header with Sportexus Logo */}
            <div className="text-center mb-8 relative z-10 flex flex-col items-center">
              <SportexusLogo size="lg" className="mb-4" />
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-(--text-main)">
                {locale === 'ar' ? 'تسجيل الدخول إلى سبورتكسس' : 'Sign In to Sportexus'}
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-(--text-muted) font-medium">
                {locale === 'ar' ? 'منصة واحدة. لكل أكاديمية.' : 'One Platform. Every Academy.'}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div
                role="alert"
                className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-500 dark:text-rose-400 relative z-10"
              >
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-500 mt-0.5" />
                <div className="leading-relaxed font-medium">{error}</div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate className="space-y-5 relative z-10">
              {/* Account Credentials Section matching Register Design */}
              <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface-subtle)/50 p-4 sm:p-5 space-y-4">
                <div>
                  <label
                    className="block text-xs font-semibold text-(--text-sub) mb-1.5"
                    htmlFor="email"
                  >
                    {locale === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={handleEmailChange}
                      onBlur={() => handleBlur('email')}
                      placeholder="admin@academy.sa"
                      dir="ltr"
                      aria-invalid={Boolean(touched.email && fieldErrors.email)}
                      aria-describedby={
                        touched.email && fieldErrors.email ? 'email-error' : undefined
                      }
                      className={`w-full rounded-xl border bg-(--bg-surface-subtle) py-2.5 pr-4 pl-10 text-sm text-(--text-main) placeholder-(--text-muted) outline-none transition-all ${
                        touched.email && fieldErrors.email
                          ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 bg-rose-500/5'
                          : 'border-(--border-app) focus:border-(--accent-primary) focus:ring-1 focus:ring-(--accent-primary)'
                      }`}
                    />
                    <Mail
                      className={`absolute left-3 top-3 h-4 w-4 ${touched.email && fieldErrors.email ? 'text-rose-500' : 'text-(--text-muted)'}`}
                    />
                  </div>
                  {touched.email && fieldErrors.email && (
                    <p
                      id="email-error"
                      className="flex items-center gap-1.5 text-xs text-rose-500 font-medium mt-1.5 animate-fade-in"
                      role="alert"
                    >
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{fieldErrors.email}</span>
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      className="block text-xs font-semibold text-(--text-sub)"
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
                      value={password}
                      onChange={handlePasswordChange}
                      onBlur={() => handleBlur('password')}
                      placeholder="••••••••••••"
                      dir="ltr"
                      aria-invalid={Boolean(touched.password && fieldErrors.password)}
                      aria-describedby={
                        touched.password && fieldErrors.password ? 'password-error' : undefined
                      }
                      className={`w-full rounded-xl border bg-(--bg-surface-subtle) py-2.5 pr-10 pl-10 text-sm text-(--text-main) placeholder-(--text-muted) outline-none transition-all ${
                        touched.password && fieldErrors.password
                          ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 bg-rose-500/5'
                          : 'border-(--border-app) focus:border-(--accent-primary) focus:ring-1 focus:ring-(--accent-primary)'
                      }`}
                    />
                    <Lock
                      className={`absolute left-3 top-3 h-4 w-4 ${touched.password && fieldErrors.password ? 'text-rose-500' : 'text-(--text-muted)'}`}
                    />
                    <PasswordVisibilityToggle
                      visible={showPassword}
                      onToggle={() => setShowPassword(!showPassword)}
                      controls="password"
                      className="absolute right-3 top-3 text-(--text-muted) hover:text-(--text-main) transition-colors p-0.5 focus:outline-none"
                    />
                  </div>
                  {touched.password && fieldErrors.password && (
                    <p
                      id="password-error"
                      className="flex items-center gap-1.5 text-xs text-rose-500 font-medium mt-1.5 animate-fade-in"
                      role="alert"
                    >
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{fieldErrors.password}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    id="rememberMe"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-(--border-subtle) bg-(--bg-surface-subtle) text-[var(--accent-primary)] focus:ring-(--accent-primary) cursor-pointer"
                  />
                  <label
                    htmlFor="rememberMe"
                    className="text-xs text-(--text-muted) cursor-pointer select-none font-medium"
                  >
                    {locale === 'ar'
                      ? 'تذكر بيانات الجلسة على هذا الجهاز'
                      : 'Remember me on this device'}
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0A3BFF] via-[#0077FF] to-[#00D6FF] py-3.5 text-sm font-bold text-white shadow-xl shadow-blue-600/30 hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{locale === 'ar' ? 'جارٍ التحقق...' : 'Signing in...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>{locale === 'ar' ? 'تسجيل الدخول' : 'Sign In'}</span>
                    <ArrowRight className={`h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
                  </>
                )}
              </button>
            </form>

            {/* Footer link */}
            <div className="mt-8 border-t border-(--border-subtle) pt-6 text-center text-xs text-(--text-muted) relative z-10">
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
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-(--text-muted) text-center px-2 -mx-4 sm:-mx-8">
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
