'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { useLocale } from '../../lib/locale-context';
import { getRoleHomeRoute } from '../../lib/role-routing';
import { Navbar } from '../../components/Navbar';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Loader2,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { user, activeTenant, login } = useAuth();
  const { locale } = useLocale();

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
      await login({
        email: email.trim().toLowerCase(),
        password,
        rememberMe,
      });
      // Will trigger useEffect or we can push directly
      router.push(getRoleHomeRoute(user, activeTenant));
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

      <main className="flex-1 flex items-center justify-center p-3 sm:p-6 lg:p-8">
        <div className="w-full max-w-md mx-auto">
          {/* Card container */}
          <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-5 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            {/* Top decorative glow */}
            <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-[#2f9e6b]/15 blur-2xl" />
            <div className="absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-[#45c387]/10 blur-2xl" />

            {/* Header */}
            <div className="text-center mb-8 relative z-10">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#2f9e6b] to-[#45c387] shadow-lg shadow-[#2f9e6b]/25">
                <Lock className="h-6 w-6 text-[#062016]" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">تسجيل الدخول للمنصة</h1>
              <p className="mt-2 text-sm text-[#9bb5a8]">
                أدخل بريدك الإلكتروني وكلمة المرور للوصول إلى لوحة التحكم
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
                <div className="leading-relaxed">{error}</div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
              <div>
                <label
                  className="block text-xs font-semibold text-[#9bb5a8] mb-1.5"
                  htmlFor="email"
                >
                  البريد الإلكتروني
                </label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="coach@example.com"
                    dir="ltr"
                    className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18]/90 py-2.5 pr-4 pl-10 text-sm text-white placeholder-[#5a7a6c] focus:border-[#2f9e6b] focus:ring-1 focus:ring-[#2f9e6b] outline-none transition-all"
                  />
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-[#5a7a6c]" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#9bb5a8]" htmlFor="password">
                    كلمة المرور
                  </label>
                  <Link href="/forgot-password" className="text-xs text-[#45c387] hover:underline">
                    نسيت كلمة المرور؟
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
                    className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18]/90 py-2.5 pr-4 pl-10 text-sm text-white placeholder-[#5a7a6c] focus:border-[#2f9e6b] focus:ring-1 focus:ring-[#2f9e6b] outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-3 text-[#5a7a6c] hover:text-[#9bb5a8]"
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
                  className="rounded border-[#2b4c3e] bg-[#0f1c18] text-[#2f9e6b] focus:ring-[#2f9e6b] cursor-pointer"
                />
                <label htmlFor="rememberMe" className="text-xs text-[#9bb5a8] cursor-pointer">
                  تذكر بيانات الجلسة على هذا الجهاز
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] py-3 text-sm font-semibold text-[#062016] shadow-lg shadow-[#2f9e6b]/25 hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>جارٍ التحقق...</span>
                  </>
                ) : (
                  <>
                    <span>تسجيل الدخول</span>
                    <ArrowRight className="h-4 w-4 rotate-180" />
                  </>
                )}
              </button>
            </form>

            {/* Footer link */}
            <div className="mt-8 border-t border-[#234235] pt-6 text-center text-xs text-[#9bb5a8] relative z-10">
              <span>ليس لديك أكاديمية مسجلة بعد؟ </span>
              <Link href="/register" className="font-semibold text-[#45c387] hover:underline">
                سجّل أكاديميتك الآن مجاناً
              </Link>
            </div>
          </div>

          {/* Security badge note */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-[#5a7a6c] text-center px-2">
            <ShieldCheck className="h-4 w-4 text-[#2f9e6b] shrink-0" />
            <span className="leading-relaxed">
              حماية مشددة: تشفير Argon2id • تدوير الجلسات • عزل كامل للبيانات
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
