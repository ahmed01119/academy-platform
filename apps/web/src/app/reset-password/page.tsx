'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '../../components/Navbar';
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
      setError('كلمة المرور وتأكيد كلمة المرور غير متطابقين.');
      return;
    }

    if (password.length < 8) {
      setError('يجب ألا تقل كلمة المرور عن 8 أحرف.');
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
          : 'فشل إعادة ضبط كلمة المرور. قد يكون الرمز منتهي الصلاحية أو مستخدماً بالفعل.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#2f9e6b] to-[#45c387] shadow-lg shadow-[#2f9e6b]/25">
            <KeyRound className="h-6 w-6 text-[#062016]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">إعادة تعيين كلمة المرور</h1>
          <p className="mt-2 text-sm text-[#9bb5a8]">
            أدخل رمز الاستعادة وكلمة المرور الجديدة لحسابك
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {success && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#2f9e6b]/30 bg-[#2f9e6b]/10 p-4 text-xs text-[#45c387]">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-[#2f9e6b] mt-0.5" />
            <div className="leading-relaxed">
              تم تغيير كلمة المرور بنجاح! يتم تحويلك تلقائياً لصفحة تسجيل الدخول...
            </div>
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[#9bb5a8] mb-1.5" htmlFor="token">
                رمز الاستعادة (Token) *
              </label>
              <input
                id="token"
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="أدخل الرمز المكون من 32+ حرفاً"
                dir="ltr"
                className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18]/90 py-2.5 px-3 text-xs font-mono text-white placeholder-[#5a7a6c] focus:border-[#2f9e6b] focus:ring-1 focus:ring-[#2f9e6b] outline-none transition-all"
              />
            </div>

            <div>
              <label
                className="block text-xs font-semibold text-[#9bb5a8] mb-1.5"
                htmlFor="password"
              >
                كلمة المرور الجديدة *
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
                  className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18]/90 py-2.5 pr-4 pl-10 text-sm text-white placeholder-[#5a7a6c] focus:border-[#2f9e6b] focus:ring-1 focus:ring-[#2f9e6b] outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-3 text-[#5a7a6c] hover:text-[#9bb5a8]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label
                className="block text-xs font-semibold text-[#9bb5a8] mb-1.5"
                htmlFor="confirmPassword"
              >
                تأكيد كلمة المرور الجديدة *
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                dir="ltr"
                className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18]/90 py-2.5 px-3 text-sm text-white placeholder-[#5a7a6c] focus:border-[#2f9e6b] focus:ring-1 focus:ring-[#2f9e6b] outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] py-3 text-sm font-semibold text-[#062016] shadow-lg shadow-[#2f9e6b]/25 hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>جارٍ الحفظ...</span>
                </>
              ) : (
                <>
                  <span>تأكيد كلمة المرور الجديدة</span>
                  <ArrowRight className="h-4 w-4 rotate-180" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="mt-8 border-t border-[#234235] pt-6 text-center text-xs text-[#9bb5a8]">
          <Link href="/login" className="font-semibold text-[#45c387] hover:underline">
            العودة إلى تسجيل الدخول
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[#0f1c18] text-[#e8f0ec] flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <Suspense
          fallback={
            <div className="flex items-center gap-2 text-sm text-[#9bb5a8]">
              <Loader2 className="h-5 w-5 animate-spin text-[#2f9e6b]" />
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
