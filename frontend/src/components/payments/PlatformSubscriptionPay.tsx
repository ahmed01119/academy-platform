'use client';

import React, { useEffect, useState } from 'react';
import { CreditCard, ShieldCheck } from 'lucide-react';
import type { PlatformSubscriptionQuote } from '@academy/shared';
import { api, getErrorMessage } from '@/api/client';
import { useLocale } from '@/contexts/locale-context';
import { Button } from '@/components/ui/Button';

const CYCLE_AR: Record<string, string> = {
  MONTHLY: 'شهر',
  QUARTERLY: '3 أشهر',
  SEMIANNUAL: '6 أشهر',
  ANNUAL: 'سنة',
};

/**
 * The academy owner renews the platform subscription online for one billing cycle. The API decides who may pay (the
 * academy owner) and the amount; for anyone else, or when online payment is off, nothing is shown.
 */
export function PlatformSubscriptionPay() {
  const { locale } = useLocale();
  const ar = locale === 'ar';
  const [quote, setQuote] = useState<PlatformSubscriptionQuote | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.payments
      .getPlatformSubscriptionQuote()
      .then((q) => {
        if (!cancelled) setQuote(q);
      })
      .catch(() => undefined); // not the owner, or no subscription: nothing to offer
    return () => {
      cancelled = true;
    };
  }, []);

  if (!quote || !quote.canPayOnline) return null;

  const pay = async () => {
    setError(null);
    setPaying(true);
    try {
      const { checkoutUrl } = await api.payments.payPlatformSubscription();
      window.location.assign(checkoutUrl);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          ar ? 'تعذر بدء الدفع، حاول مرة أخرى.' : 'Could not start the payment, please try again.',
        ),
      );
      setPaying(false);
    }
  };

  const amount = `${quote.amount.toLocaleString(ar ? 'ar-EG' : 'en-US')} ${quote.currency}`;
  const next = quote.nextRenewalDate.slice(0, 10);
  const period = ar
    ? (CYCLE_AR[quote.billingCycle] ?? `${quote.months} شهر`)
    : `${quote.months} month(s)`;

  return (
    <div className="rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-sm">
          <div className="font-bold text-(--text-main)">
            {ar ? 'جدّد اشتراك المنصة أونلاين' : 'Renew your platform subscription online'}
          </div>
          <div className="text-xs text-(--text-muted) mt-0.5">
            {ar ? (
              <>
                ادفع{' '}
                <bdi dir="ltr" className="whitespace-nowrap">
                  {amount}
                </bdi>{' '}
                عن {period}، ويمتد الاشتراك حتى{' '}
                <bdi dir="ltr" className="whitespace-nowrap">
                  {next}
                </bdi>
                .
              </>
            ) : (
              <>
                Pay{' '}
                <bdi dir="ltr" className="whitespace-nowrap">
                  {amount}
                </bdi>{' '}
                for {period}; the subscription runs until{' '}
                <bdi dir="ltr" className="whitespace-nowrap">
                  {next}
                </bdi>
                .
              </>
            )}
          </div>
        </div>
        <Button
          onClick={() => void pay()}
          isLoading={paying}
          disabled={paying}
          className="shrink-0"
        >
          <CreditCard className="h-4 w-4" />
          <span>{ar ? 'ادفع الآن' : 'Pay now'}</span>
        </Button>
      </div>
      <p className="text-[11px] text-(--text-muted) flex items-center gap-1">
        <ShieldCheck className="h-3.5 w-3.5" />
        {ar
          ? 'دفع آمن ببطاقة أو محفظة عبر Paymob، وتصدر فاتورة مدفوعة تلقائياً.'
          : 'Secure card or wallet payment by Paymob; a paid invoice is issued automatically.'}
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs text-rose-700 dark:text-rose-300"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default PlatformSubscriptionPay;
