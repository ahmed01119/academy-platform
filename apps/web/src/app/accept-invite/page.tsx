'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '../../components/Navbar';
import { useLocale } from '../../lib/locale-context';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api-client';
import {
  Users,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  Building2,
  LogIn,
  UserPlus,
} from 'lucide-react';

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const { user, isLoading: isAuthLoading, refreshUser } = useAuth();

  const [token, setToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const queryToken = searchParams.get('token');
    if (queryToken) {
      setToken(queryToken);
    }
  }, [searchParams]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError(
        locale === 'ar'
          ? 'رمز الدعوة مفقود أو غير صالح.'
          : 'Invitation token is missing or invalid.',
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.tenancy.acceptInvitation({ token: token.trim() });
      setSuccessMessage(
        res.message ||
          (locale === 'ar'
            ? 'تم قبول الدعوة بنجاح وتفعيل عضويتك!'
            : 'Invitation accepted successfully!'),
      );
      await refreshUser();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : locale === 'ar'
            ? 'فشل قبول الدعوة. قد يكون الرمز منتهي الصلاحية أو مستخدماً بالفعل.'
            : 'Failed to accept invitation. The token may be expired or already used.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const loginRedirectUrl = `/login?redirect=${encodeURIComponent(`/accept-invite?token=${token}`)}`;
  const registerRedirectUrl = `/register?redirect=${encodeURIComponent(`/accept-invite?token=${token}`)}`;

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-3xl border border-[var(--border-app)] bg-[var(--bg-surface)]/95 p-5 sm:p-8 shadow-float backdrop-blur-xl relative overflow-hidden animate-scale-up">
        {/* Sportexus ambient glows */}
        <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[var(--accent-blue)]/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-[var(--accent-primary)]/10 blur-3xl pointer-events-none" />

        <div className="text-center mb-8 relative z-10">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#0A3BFF] to-[#00D6FF] shadow-lg shadow-blue-600/25">
            <Users className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
            {locale === 'ar' ? 'دعوة للانضمام إلى أكاديمية' : 'Academy Staff Invitation'}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {locale === 'ar'
              ? 'تفعيل عضويتك والانضمام إلى فريق عمل الأكاديمية'
              : 'Activate your membership and join the academy staff'}
          </p>
        </div>

        {/* Loading auth state */}
        {isAuthLoading && (
          <div className="my-8 flex flex-col items-center justify-center gap-3 text-center relative z-10">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--accent-primary)]" />
            <p className="text-xs text-slate-400">
              {locale === 'ar' ? 'جارٍ التحقق من بيانات الحساب...' : 'Checking session status...'}
            </p>
          </div>
        )}

        {/* Success State */}
        {successMessage && (
          <div className="space-y-6 relative z-10">
            <div className="flex items-start gap-3 rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/10 p-5 text-sm text-[#4ADE80]">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-[#22C55E] mt-0.5" />
              <div>
                <h3 className="font-bold text-[#4ADE80]">
                  {locale === 'ar' ? 'تهانينا! تم تفعيل العضوية بنجاح' : 'Membership Activated!'}
                </h3>
                <p className="mt-1 text-xs text-[#86EFAC] leading-relaxed">{successMessage}</p>
              </div>
            </div>

            <Link
              href="/dashboard"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0A3BFF] via-[#0077FF] to-[#00D6FF] py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/30 hover:brightness-110 active:scale-[0.99] transition-all"
            >
              <Building2 className="h-4 w-4" />
              <span>{locale === 'ar' ? 'الدخول إلى لوحة التحكم' : 'Go to Dashboard'}</span>
              <ArrowRight className="h-4 w-4 rotate-180" />
            </Link>
          </div>
        )}

        {/* Not Logged In State */}
        {!isAuthLoading && !successMessage && !user && (
          <div className="space-y-6 relative z-10">
            <div className="rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] p-4 text-xs text-slate-300 leading-relaxed">
              <p>
                {locale === 'ar'
                  ? 'لقبول هذه الدعوة، يرجى تسجيل الدخول أو إنشاء حساب بالبريد الإلكتروني الذي استلمت عليه الدعوة.'
                  : 'To accept this invitation, please sign in or register with the email address that received the invitation.'}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Link
                href={loginRedirectUrl}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0A3BFF] to-[#00D6FF] py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/30 hover:brightness-110 active:scale-[0.99] transition-all"
              >
                <LogIn className="h-4 w-4" />
                <span>{locale === 'ar' ? 'تسجيل الدخول بحسابي' : 'Sign In to Accept'}</span>
              </Link>

              <Link
                href={registerRedirectUrl}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] py-2.5 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface)] transition-all"
              >
                <UserPlus className="h-4 w-4 text-[var(--accent-primary)]" />
                <span>{locale === 'ar' ? 'إنشاء حساب جديد' : 'Create New Account'}</span>
              </Link>
            </div>
          </div>
        )}

        {/* Logged In State -> Ready to Accept */}
        {!isAuthLoading && !successMessage && user && (
          <form onSubmit={handleAccept} className="space-y-6 relative z-10">
            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
                <div>{error}</div>
              </div>
            )}

            <div className="rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] p-4 space-y-2 text-xs">
              <div className="text-slate-400">
                {locale === 'ar' ? 'الحساب المسجل حالياً:' : 'Current signed-in account:'}
              </div>
              <div className="font-semibold text-white font-mono break-all">{user.email}</div>
              <p className="text-[11px] text-slate-400 pt-1">
                {locale === 'ar'
                  ? 'يجب أن يطابق بريدك الحالي البريد الذي أُرسلت إليه الدعوة.'
                  : 'Your signed-in email must match the recipient of this invitation.'}
              </p>
            </div>

            <div>
              <label
                className="block text-xs font-semibold text-[var(--text-sub)] mb-1.5"
                htmlFor="token"
              >
                {locale === 'ar' ? 'رمز الدعوة (Invitation Token)' : 'Invitation Token'}
              </label>
              <input
                id="token"
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={locale === 'ar' ? 'أدخل رمز الدعوة...' : 'Enter invitation token...'}
                dir="ltr"
                className="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] py-2.5 px-3 text-xs font-mono text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !token.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0A3BFF] via-[#0077FF] to-[#00D6FF] py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/30 hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{locale === 'ar' ? 'جارٍ الانضمام...' : 'Accepting...'}</span>
                </>
              ) : (
                <>
                  <span>
                    {locale === 'ar' ? 'قبول الدعوة وتفعيل العضوية' : 'Accept Invitation & Join'}
                  </span>
                  <ArrowRight className="h-4 w-4 rotate-180" />
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

export default function AcceptInvitePage() {
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
          <AcceptInviteContent />
        </Suspense>
      </main>
    </div>
  );
}
