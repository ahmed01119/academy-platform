'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MessageSquareReply, Send } from 'lucide-react';
import type { AcademyApplicationReplyView } from '@academy/shared';
import { useLocale } from '@/contexts/locale-context';
import { ApiError } from '@/lib/http/api-error';
import { AuthPageLayout, AuthPageSuspense } from '@/features/auth/components/AuthPageLayout';
import { AuthCard, BackToSignInLink } from '@/features/auth/components/AuthCard';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import {
  AUTH_INPUT_BASE,
  AUTH_LABEL,
  AUTH_PRIMARY_ACTION,
} from '@/features/auth/components/auth-styles';
import { Skeleton } from '@/components/ui/skeleton';
import { applicationReplyApi } from '@/features/application-reply/api';
import { governorateLabel, EGYPT_GOVERNORATES } from '@/features/auth/egypt-governorates';
import { translateSport } from '@/utils/data-translator';

type Locale = 'ar' | 'en';

/** The page's message for a failed load or send; never a raw server message. */
function replyErrorMessage(err: unknown, locale: Locale): string {
  const code = err instanceof ApiError ? err.code : undefined;
  if (code === 'TOKEN_EXPIRED') {
    return locale === 'ar'
      ? 'تم الرد على هذا الطلب بالفعل، أو أرسلنا طلباً أحدث. استخدم الرابط في آخر رسالة وصلتك.'
      : 'This request was already answered, or a newer one replaced it. Use the link in the latest e-mail.';
  }
  if (code === 'TOKEN_INVALID') {
    return locale === 'ar'
      ? 'رابط الرد غير صالح. افتح الرابط من الرسالة كما هو.'
      : 'This reply link is not valid. Open the link from the e-mail as it is.';
  }
  return locale === 'ar'
    ? 'تعذر الاتصال بالمنصة. حاول مرة أخرى بعد قليل.'
    : 'Could not reach the platform. Please try again shortly.';
}

function ApplicationReplyContent() {
  const searchParams = useSearchParams();
  const { locale: rawLocale } = useLocale();
  const locale: Locale = rawLocale === 'ar' ? 'ar' : 'en';
  const isAr = locale === 'ar';
  const token = searchParams.get('token') ?? '';

  const [view, setView] = useState<AcademyApplicationReplyView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadError(replyErrorMessage(new ApiError('', 400, 'TOKEN_INVALID'), locale));
      return;
    }
    let cancelled = false;
    applicationReplyApi
      .get(token)
      .then((data) => {
        if (cancelled) return;
        setView(data);
        setCity(data.city ?? '');
        setPhone(data.contactPhone ?? '');
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(replyErrorMessage(err, locale));
      });
    return () => {
      cancelled = true;
    };
    // The language can change while the page is open; the request itself does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reply.trim().length < 2) {
      setSendError(isAr ? 'اكتب ردك على المطلوب.' : 'Please write your answer.');
      return;
    }
    setIsSending(true);
    setSendError(null);
    try {
      await applicationReplyApi.submit({
        token,
        reply: reply.trim(),
        city: city.trim() || undefined,
        contactPhone: phone.trim() || undefined,
      });
      setSent(true);
    } catch (err: unknown) {
      setSendError(replyErrorMessage(err, locale));
    } finally {
      setIsSending(false);
    }
  };

  const cityIsGovernorate = EGYPT_GOVERNORATES.some((g) => g.value === city);

  return (
    <AuthCard
      icon={MessageSquareReply}
      title={isAr ? 'الرد على طلب التفاصيل' : 'Answer the requested details'}
      subtitle={
        isAr
          ? 'اكتب المطلوب وصحّح بياناتك إن لزم؛ سيعود طلبك للمراجعة فور الإرسال.'
          : 'Write what was asked and correct your details if needed; your application goes back to review once sent.'
      }
      footer={<BackToSignInLink label={isAr ? 'العودة إلى تسجيل الدخول' : 'Back to sign in'} />}
    >
      <div className="relative z-10 space-y-5">
        {loadError && <AuthAlert tone="error">{loadError}</AuthAlert>}

        {!loadError && !view && (
          <div role="status" aria-label={isAr ? 'جارٍ التحميل' : 'Loading'} className="space-y-4">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        )}

        {view && sent && (
          <AuthAlert
            tone="success"
            size="panel"
            title={isAr ? 'تم إرسال ردك' : 'Your answer was sent'}
          >
            {isAr
              ? `عاد طلب "${view.academyName}" للمراجعة، وسيصلك بريد بالقرار.`
              : `"${view.academyName}" is back in review; you will get an e-mail with the decision.`}
          </AuthAlert>
        )}

        {view && !sent && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-xl border border-(--border-app) bg-(--bg-surface-subtle) p-3.5 text-xs leading-relaxed">
              <div className="font-bold text-(--text-main)">
                {view.academyName}{' '}
                <span className="font-normal text-(--text-muted)">
                  · {translateSport(view.sport, locale)}
                </span>
              </div>
              <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-700 dark:text-amber-300">
                <span className="font-semibold">{isAr ? 'المطلوب: ' : 'Requested: '}</span>
                <span className="whitespace-pre-line">
                  {view.reviewNotes || (isAr ? 'بيانات إضافية.' : 'More details.')}
                </span>
              </div>
            </div>

            {sendError && <AuthAlert tone="error">{sendError}</AuthAlert>}

            <div>
              <label htmlFor="reply" className={AUTH_LABEL}>
                {isAr ? 'ردك *' : 'Your answer *'}
              </label>
              <textarea
                id="reply"
                required
                rows={5}
                maxLength={2000}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={
                  isAr ? 'اكتب البيانات أو التوضيح المطلوب...' : 'Write the requested details...'
                }
                className={`${AUTH_INPUT_BASE} px-3 py-2.5 text-sm`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="reply-city" className={AUTH_LABEL}>
                  {isAr ? 'المحافظة' : 'Governorate'}
                </label>
                <select
                  id="reply-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={`${AUTH_INPUT_BASE} px-3 py-2.5 text-sm`}
                >
                  <option value="">{isAr ? 'اختر المحافظة' : 'Choose a governorate'}</option>
                  {!cityIsGovernorate && city && (
                    <option value={city}>{governorateLabel(city, locale)}</option>
                  )}
                  {EGYPT_GOVERNORATES.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g[locale]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="reply-phone" className={AUTH_LABEL}>
                  {isAr ? 'رقم الهاتف' : 'Phone'}
                </label>
                <input
                  id="reply-phone"
                  type="tel"
                  dir="ltr"
                  maxLength={30}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className={`${AUTH_INPUT_BASE} px-3 py-2.5 text-sm font-mono`}
                />
              </div>
            </div>

            <button type="submit" disabled={isSending} className={AUTH_PRIMARY_ACTION}>
              <Send aria-hidden="true" className="h-4 w-4" />
              <span>
                {isSending
                  ? isAr
                    ? 'جارٍ الإرسال...'
                    : 'Sending...'
                  : isAr
                    ? 'إرسال الرد'
                    : 'Send answer'}
              </span>
            </button>
          </form>
        )}
      </div>
    </AuthCard>
  );
}

export default function ApplicationReplyPage() {
  return (
    <AuthPageLayout>
      <AuthPageSuspense>
        <ApplicationReplyContent />
      </AuthPageSuspense>
    </AuthPageLayout>
  );
}
