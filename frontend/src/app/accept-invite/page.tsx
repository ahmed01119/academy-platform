'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLocale } from '@/contexts/locale-context';
import { useAuth } from '@/contexts/auth-context';
import { api, getErrorMessage } from '@/api/client';
import { AuthPageLayout, AuthPageSuspense } from '@/features/auth/components/AuthPageLayout';
import { AuthCard, BackToSignInLink } from '@/features/auth/components/AuthCard';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import {
  AUTH_LABEL,
  AUTH_PRIMARY_ACTION,
  AUTH_TOKEN_INPUT,
} from '@/features/auth/components/auth-styles';
import { Users, ArrowRight, Loader2, Building2, LogIn, UserPlus } from 'lucide-react';

/**
 * Builds the sign-in / register links that carry the invitation back.
 * NOTE: `/login` and `/register` currently ignore `?redirect=` (documented as F14).
 */
function withInviteRedirect(base: '/login' | '/register', token: string): string {
  return `${base}?redirect=${encodeURIComponent(`/accept-invite?token=${token}`)}`;
}

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
      setError(
        getErrorMessage(
          err,
          locale === 'ar'
            ? 'فشل قبول الدعوة. قد يكون الرمز منتهي الصلاحية أو مستخدماً بالفعل.'
            : 'Failed to accept invitation. The token may be expired or already used.',
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthCard
      icon={Users}
      title={locale === 'ar' ? 'دعوة للانضمام إلى أكاديمية' : 'Academy Staff Invitation'}
      subtitle={
        locale === 'ar'
          ? 'تفعيل عضويتك والانضمام إلى فريق عمل الأكاديمية'
          : 'Activate your membership and join the academy staff'
      }
      footer={
        <BackToSignInLink label={locale === 'ar' ? 'العودة إلى تسجيل الدخول' : 'Back to sign in'} />
      }
    >
      {/* Loading auth state */}
      {isAuthLoading && (
        <div
          role="status"
          className="my-8 flex flex-col items-center justify-center gap-3 text-center relative z-10"
        >
          <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-(--accent-primary)" />
          <p className="text-xs text-(--text-muted)">
            {locale === 'ar' ? 'جارٍ التحقق من بيانات الحساب...' : 'Checking session status...'}
          </p>
        </div>
      )}

      {/* Success State */}
      {successMessage && (
        <div className="space-y-6 relative z-10">
          <AuthAlert
            tone="success"
            size="panel"
            title={locale === 'ar' ? 'تهانينا! تم تفعيل العضوية بنجاح' : 'Membership Activated!'}
          >
            {successMessage}
          </AuthAlert>

          <Link href="/dashboard" className={AUTH_PRIMARY_ACTION}>
            <Building2 aria-hidden="true" className="h-4 w-4" />
            <span>{locale === 'ar' ? 'الدخول إلى لوحة التحكم' : 'Go to Dashboard'}</span>
            <ArrowRight aria-hidden="true" className="h-4 w-4 rotate-180" />
          </Link>
        </div>
      )}

      {/* Not Logged In State */}
      {!isAuthLoading && !successMessage && !user && (
        <div className="space-y-6 relative z-10">
          <div className="rounded-xl border border-(--border-app) bg-(--bg-surface-subtle) p-4 text-xs text-(--text-muted) leading-relaxed">
            <p>
              {locale === 'ar'
                ? 'لقبول هذه الدعوة، يرجى تسجيل الدخول أو إنشاء حساب بالبريد الإلكتروني الذي استلمت عليه الدعوة.'
                : 'To accept this invitation, please sign in or register with the email address that received the invitation.'}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href={withInviteRedirect('/login', token)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-[#0A3BFF] to-[#00D6FF] py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/30 hover:brightness-110 active:scale-[0.99] transition-all"
            >
              <LogIn aria-hidden="true" className="h-4 w-4" />
              <span>{locale === 'ar' ? 'تسجيل الدخول بحسابي' : 'Sign In to Accept'}</span>
            </Link>

            <Link
              href={withInviteRedirect('/register', token)}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-(--border-app) bg-(--bg-surface-subtle) py-2.5 text-xs font-semibold text-(--text-main) hover:bg-(--bg-surface) transition-all"
            >
              <UserPlus aria-hidden="true" className="h-4 w-4 text-(--accent-primary)" />
              <span>{locale === 'ar' ? 'إنشاء حساب جديد' : 'Create New Account'}</span>
            </Link>
          </div>
        </div>
      )}

      {/* Logged In State -> Ready to Accept */}
      {!isAuthLoading && !successMessage && user && (
        <form onSubmit={handleAccept} className="space-y-6 relative z-10">
          {error && <AuthAlert tone="error">{error}</AuthAlert>}

          <div className="rounded-xl border border-(--border-app) bg-(--bg-surface-subtle) p-4 space-y-2 text-xs">
            <div className="text-(--text-muted)">
              {locale === 'ar' ? 'الحساب المسجل حالياً:' : 'Current signed-in account:'}
            </div>
            <div className="font-semibold text-(--text-main) font-mono break-all">{user.email}</div>
            <p className="text-[11px] text-(--text-muted) pt-1">
              {locale === 'ar'
                ? 'يجب أن يطابق بريدك الحالي البريد الذي أُرسلت إليه الدعوة.'
                : 'Your signed-in email must match the recipient of this invitation.'}
            </p>
          </div>

          <div>
            <label className={AUTH_LABEL} htmlFor="token">
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
              className={AUTH_TOKEN_INPUT}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !token.trim()}
            className={AUTH_PRIMARY_ACTION}
          >
            {isSubmitting ? (
              <>
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                <span>{locale === 'ar' ? 'جارٍ الانضمام...' : 'Accepting...'}</span>
              </>
            ) : (
              <>
                <span>
                  {locale === 'ar' ? 'قبول الدعوة وتفعيل العضوية' : 'Accept Invitation & Join'}
                </span>
                <ArrowRight aria-hidden="true" className="h-4 w-4 rotate-180" />
              </>
            )}
          </button>
        </form>
      )}
    </AuthCard>
  );
}

export default function AcceptInvitePage() {
  return (
    <AuthPageLayout>
      <AuthPageSuspense>
        <AcceptInviteContent />
      </AuthPageSuspense>
    </AuthPageLayout>
  );
}
