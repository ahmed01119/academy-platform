'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '../../components/Navbar';
import { api } from '../../lib/api-client';
import { KeyRound, Mail, AlertCircle, CheckCircle2, ArrowRight, Loader2, Copy } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [debugToken, setDebugToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const res = await api.auth.forgotPassword({ email: email.trim().toLowerCase() });
      setSuccessMessage(
        res.message ||
          'إذا كان البريد الإلكتروني مسجلاً لدينا، فستتلقى رمزاً صالحاً للاستخدام لمرة واحدة لإعادة ضبط كلمة المرور.',
      );
      if (res.debugToken) {
        setDebugToken(res.debugToken);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'حدث خطأ أثناء معالجة الطلب. يرجى المحاولة لاحقاً.',
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
    <div className="min-h-screen bg-[#0f1c18] text-[#e8f0ec] flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            <div className="text-center mb-8">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#2f9e6b] to-[#45c387] shadow-lg shadow-[#2f9e6b]/25">
                <KeyRound className="h-6 w-6 text-[#062016]" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">استعادة كلمة المرور</h1>
              <p className="mt-2 text-sm text-[#9bb5a8]">
                أدخل بريدك الإلكتروني وسنرسل لك رمز أمان صالح للاستخدام مرة واحدة
              </p>
            </div>

            {error && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
                <div>{error}</div>
              </div>
            )}

            {successMessage && (
              <div className="mb-6 space-y-4">
                <div className="flex items-start gap-3 rounded-xl border border-[#2f9e6b]/30 bg-[#2f9e6b]/10 p-4 text-xs text-[#45c387]">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[#2f9e6b] mt-0.5" />
                  <div className="leading-relaxed">{successMessage}</div>
                </div>

                {debugToken && (
                  <div className="rounded-xl border border-[#2b4c3e] bg-[#0f1c18] p-4 text-xs space-y-2">
                    <div className="flex items-center justify-between text-[#9bb5a8]">
                      <span>رمز الاستعادة (بيئة التطوير المحلية):</span>
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="flex items-center gap-1 text-[#45c387] hover:underline"
                      >
                        <Copy className="h-3 w-3" />
                        <span>{copied ? 'تم النسخ!' : 'نسخ'}</span>
                      </button>
                    </div>
                    <code className="block bg-[#162821] p-2 rounded text-[#e8f0ec] break-all font-mono text-[11px]">
                      {debugToken}
                    </code>
                    <Link
                      href={`/reset-password?token=${encodeURIComponent(debugToken)}`}
                      className="inline-block mt-2 font-semibold text-[#45c387] hover:underline"
                    >
                      الانتقال مباشرة لإعادة تعيين كلمة المرور ←
                    </Link>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
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
                    placeholder="user@example.com"
                    dir="ltr"
                    className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18]/90 py-2.5 pr-4 pl-10 text-sm text-white placeholder-[#5a7a6c] focus:border-[#2f9e6b] focus:ring-1 focus:ring-[#2f9e6b] outline-none transition-all"
                  />
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-[#5a7a6c]" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] py-3 text-sm font-semibold text-[#062016] shadow-lg shadow-[#2f9e6b]/25 hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>جارٍ الإرسال...</span>
                  </>
                ) : (
                  <>
                    <span>طلب رمز الاستعادة</span>
                    <ArrowRight className="h-4 w-4 rotate-180" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 border-t border-[#234235] pt-6 text-center text-xs text-[#9bb5a8]">
              <Link href="/login" className="font-semibold text-[#45c387] hover:underline">
                العودة إلى صفحة تسجيل الدخول
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
