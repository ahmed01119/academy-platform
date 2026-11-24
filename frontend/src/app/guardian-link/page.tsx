'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, ShieldCheck, X } from 'lucide-react';
import type { GuardianLinkRequestView } from '@academy/shared';
import { useLocale } from '@/contexts/locale-context';
import { ApiError } from '@/lib/http/api-error';
import { AuthPageLayout, AuthPageSuspense } from '@/features/auth/components/AuthPageLayout';
import { AuthCard, BackToSignInLink } from '@/features/auth/components/AuthCard';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AUTH_PRIMARY_ACTION } from '@/features/auth/components/auth-styles';
import { Skeleton } from '@/components/ui/skeleton';
import { portalApi } from '@/features/portal/api';

type Locale = 'ar' | 'en';

function linkErrorMessage(err: unknown, locale: Locale): string {
  const code = err instanceof ApiError ? err.code : undefined;
  if (code === 'TOKEN_EXPIRED') {
    return locale === 'ar'
      ? 'تم الرد على هذا الطلب بالفعل، أو انتهت صلاحية الرابط.'
      : 'This request was already answered, or the link has expired.';
  }
  if (code === 'TOKEN_INVALID') {
    return locale === 'ar'
      ? 'الرابط غير صالح. افتح الرابط من الرسالة كما هو.'
      : 'This link is not valid. Open the link from the e-mail as it is.';
  }
  return locale === 'ar'
    ? 'تعذر الاتصال بالمنصة. حاول مرة أخرى بعد قليل.'
    : 'Could not reach the platform. Please try again shortly.';
}

/** The child approves or declines a guardian's request to be linked to their player profile. */
function GuardianLinkContent() {
  const searchParams = useSearchParams();
  const { locale: rawLocale } = useLocale();
  const locale: Locale = rawLocale === 'ar' ? 'ar' : 'en';
  const ar = locale === 'ar';
  const token = searchParams.get('token') ?? '';

  const [view, setView] = useState<GuardianLinkRequestView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'APPROVE' | 'DECLINE' | null>(null);
  const [done, setDone] = useState<'APPROVED' | 'DECLINED' | null>(null);

  useEffect(() => {
    if (!token) {
      setError(linkErrorMessage(new ApiError('', 400, 'TOKEN_INVALID'), locale));
      return;
    }
    let cancelled = false;
    portalApi
      .getGuardianLinkRequest(token)
      .then((data) => !cancelled && setView(data))
      .catch((err: unknown) => !cancelled && setError(linkErrorMessage(err, locale)));
    return () => {
      cancelled = true;
    };
    // The request does not change with the page language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const decide = async (decision: 'APPROVE' | 'DECLINE') => {
    setBusy(decision);
    setError(null);
    try {
      await portalApi.decideGuardianLink({ token, decision });
      setDone(decision === 'APPROVE' ? 'APPROVED' : 'DECLINED');
    } catch (err: unknown) {
      setError(linkErrorMessage(err, locale));
    } finally {
      setBusy(null);
    }
  };

  return (
    <AuthCard
      icon={ShieldCheck}
      title={ar ? 'طلب ربط ولي أمر' : 'Guardian link request'}
      subtitle={
        ar
          ? 'وافق فقط إذا كان هذا ولي أمرك فعلاً.'
          : 'Approve only if this really is your guardian.'
      }
      footer={<BackToSignInLink label={ar ? 'الذهاب إلى تسجيل الدخول' : 'Go to sign in'} />}
    >
      <div className="relative z-10 space-y-5">
        {error && <AuthAlert tone="error">{error}</AuthAlert>}

        {!error && !view && (
          <div role="status" aria-label={ar ? 'جارٍ التحميل' : 'Loading'} className="space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        )}

        {view && done === 'APPROVED' && (
          <AuthAlert tone="success" size="panel" title={ar ? 'تمت الموافقة' : 'Approved'}>
            {ar
              ? `أصبح ${view.requesterName} ولي أمرك على المنصة في ${view.academyName}، وتم إبلاغ الأكاديمية.`
              : `${view.requesterName} is now your guardian on the platform at ${view.academyName}; the academy was told.`}
          </AuthAlert>
        )}
        {view && done === 'DECLINED' && (
          <AuthAlert tone="success" size="panel" title={ar ? 'تم الرفض' : 'Declined'}>
            {ar ? 'لم يُربط أي حساب بملفك.' : 'No account was linked to your profile.'}
          </AuthAlert>
        )}

        {view && !done && (
          <>
            <div className="rounded-xl border border-(--border-app) bg-(--bg-surface-subtle) p-4 text-sm leading-relaxed text-(--text-main)">
              <p>
                {ar ? (
                  <>
                    مرحباً <strong>{view.playerFirstName}</strong>، صاحب الحساب{' '}
                    <strong>{view.requesterName}</strong> يطلب أن يكون ولي أمرك في{' '}
                    <strong>{view.academyName}</strong>، ليتابع حصصك وحضورك ومستواك.
                  </>
                ) : (
                  <>
                    Hello <strong>{view.playerFirstName}</strong>, the account{' '}
                    <strong>{view.requesterName}</strong> asks to be your guardian at{' '}
                    <strong>{view.academyName}</strong>, to follow your sessions, attendance and
                    progress.
                  </>
                )}
              </p>
              <p className="mt-2 text-xs text-(--text-muted)">
                {ar ? 'ولي الأمر المسجّل لدى الأكاديمية: ' : 'Guardian registered by the academy: '}
                <strong className="text-(--text-main)">{view.guardianName}</strong>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => decide('DECLINE')}
                disabled={busy !== null}
                className="flex items-center justify-center gap-2 rounded-xl border border-(--border-app) bg-(--bg-surface-subtle) py-3 text-sm font-bold text-(--text-main) hover:bg-(--bg-surface-subtle)/70 disabled:opacity-50"
              >
                <X aria-hidden="true" className="h-4 w-4" />
                <span>{busy === 'DECLINE' ? '...' : ar ? 'رفض' : 'Decline'}</span>
              </button>
              <button
                type="button"
                onClick={() => decide('APPROVE')}
                disabled={busy !== null}
                className={AUTH_PRIMARY_ACTION}
              >
                <Check aria-hidden="true" className="h-4 w-4" />
                <span>{busy === 'APPROVE' ? '...' : ar ? 'موافقة' : 'Approve'}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </AuthCard>
  );
}

export default function GuardianLinkPage() {
  return (
    <AuthPageLayout>
      <AuthPageSuspense>
        <GuardianLinkContent />
      </AuthPageSuspense>
    </AuthPageLayout>
  );
}
