'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '../../components/Navbar';
import { useLocale } from '../../lib/locale-context';
import { api } from '../../lib/api-client';
import { KeyRound, Mail, AlertCircle, CheckCircle2, ArrowRight, Loader2, Copy } from 'lucide-react';

// Security guard: debug token is ONLY shown when accessed via localhost/127.0.0.1.
// This prevents real reset tokens from appearing on public URLs (tunnels, production).
// The API already omits debugToken in production — this is defense-in-depth.
const isLocalDevAccess =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export default function ForgotPasswordPage() {
  const { locale } = useLocale();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [debugToken, setDebugToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const res = await api.auth.forgotPassword({ email: email.trim().toLowerCase() });
      setSuccessMessage(
        res.message ||
          (locale === 'ar'
            ? 'إذا كان البريد الإلكتروني مسجلاً لدينا، فستتلقى رمزاً صالحاً للاستخدام لمرة واحدة لإعادة ضبط كلمة المرور.'
            : 'If this email is registered, you will receive a one-time code to reset your password.'),
      );
      // Only store debugToken when on localhost — never persist on public URLs
      if (res.debugToken && isLocalDevAccess) {
        setDebugToken(res.debugToken);
      }
      setCooldown(60);
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

  const handleCopy = () => {
    if (debugToken) {
      navigator.clipboard.writeText(debugToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-main)] flex flex-col transition-colors overflow-x-hidden">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-3 sm:p-6 lg:p-8">
        <div className="w-full max-w-md mx-auto">
          <div className="rounded-2xl border border-slate-800 bg-[#0f172a]/90 p-5 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            {/* Sportexus ambient glows */}
            <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[#0A3BFF]/25 blur-3xl" />
            <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-[#00D6FF]/15 blur-3xl" />

            <div className="text-center mb-8 relative z-10 flex flex-col items-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#0A3BFF] to-[#00D6FF] shadow-lg shadow-blue-600/25">
                <KeyRound className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {locale === 'ar' ? 'استعادة كلمة المرور' : 'Reset Password'}
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                {locale === 'ar'
                  ? 'أدخل بريدك الإلكتروني وسنرسل لك رمز أمان صالح للاستخدام مرة واحدة'
                  : 'Enter your email and we will send you a one-time security code'}
              </p>
            </div>

            {error && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300 relative z-10">
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
                <div>{error}</div>
              </div>
            )}

            {successMessage && (
              <div className="mb-6 space-y-4 relative z-10">
                <div className="flex items-start gap-3 rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/10 p-4 text-xs text-[#4ADE80]">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[#22C55E] mt-0.5" />
                  <div className="leading-relaxed">{successMessage}</div>
                </div>

                {/* Debug token: only rendered on localhost — NEVER on public URLs */}
                {debugToken && isLocalDevAccess && (
                  <div className="rounded-xl border border-amber-600/30 bg-amber-500/10 p-4 text-xs space-y-2">
                    <div className="flex items-center justify-between text-amber-400">
                      <span className="font-semibold">
                        🔒 {locale === 'ar' ? 'للتطوير المحلي فقط' : 'Local Development Only'}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="flex items-center gap-1 text-[#00D6FF] hover:underline"
                      >
                        <Copy className="h-3 w-3" />
                        <span>
                          {copied
                            ? locale === 'ar'
                              ? 'تم النسخ!'
                              : 'Copied!'
                            : locale === 'ar'
                              ? 'نسخ'
                              : 'Copy'}
                        </span>
                      </button>
                    </div>
                    <p className="text-amber-300/70 text-[10px]">
                      {locale === 'ar'
                        ? 'هذا الرمز لا يظهر على الروابط العامة. في الإنتاج يُرسَل عبر البريد الإلكتروني فقط.'
                        : 'This token is hidden on public URLs. In production it is delivered via email only.'}
                    </p>
                    <code className="block bg-slate-800 p-2 rounded text-white break-all font-mono text-[11px]">
                      {debugToken}
                    </code>
                    <Link
                      href={`/reset-password?token=${encodeURIComponent(debugToken)}`}
                      className="inline-block mt-2 font-semibold text-[#00D6FF] hover:underline"
                    >
                      {locale === 'ar'
                        ? 'الانتقال مباشرة لإعادة تعيين كلمة المرور ←'
                        : 'Go directly to password reset →'}
                    </Link>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
              <div>
                <label
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
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
                    placeholder="user@example.com"
                    dir="ltr"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/90 py-2.5 pr-4 pl-10 text-sm text-white placeholder-slate-500 focus:border-[#00D6FF] focus:ring-1 focus:ring-[#00D6FF] outline-none transition-all"
                  />
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
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
                    <span>{locale === 'ar' ? 'طلب رمز الاستعادة' : 'Send Recovery Code'}</span>
                    <ArrowRight className="h-4 w-4 rotate-180" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 border-t border-slate-800 pt-6 text-center text-xs text-slate-400 relative z-10">
              <Link href="/login" className="font-semibold text-[#00D6FF] hover:underline">
                {locale === 'ar' ? 'العودة إلى صفحة تسجيل الدخول' : 'Back to sign in'}
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
