'use client';

import React, { useEffect, useState } from 'react';
import { CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import type { PaymentDueItem } from '@academy/shared';
import { api, getErrorMessage } from '@/api/client';
import { useLocale } from '@/contexts/locale-context';

/**
 * Subscription balances the signed-in player or guardian can pay online. Renders nothing when nothing is due, so the
 * portals stay clean for families who are up to date.
 */
export function PaymentDues() {
  const { locale } = useLocale();
  const ar = locale === 'ar';
  const [dues, setDues] = useState<PaymentDueItem[] | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.payments
      .listDues()
      .then((items) => {
        if (!cancelled) setDues(items);
      })
      .catch(() => {
        if (!cancelled) setDues([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pay = async (due: PaymentDueItem) => {
    setError(null);
    setPayingId(due.subscriptionId);
    try {
      const { checkoutUrl } = await api.payments.startOnlinePayment(due.subscriptionId);
      window.location.assign(checkoutUrl);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          ar ? 'تعذر بدء الدفع، حاول مرة أخرى.' : 'Could not start the payment, please try again.',
        ),
      );
      setPayingId(null);
    }
  };

  if (!dues || dues.length === 0) return null;

  const format = (amount: number, currency: string) =>
    `${amount.toLocaleString(ar ? 'ar-EG' : 'en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;

  return (
    <section
      aria-labelledby="payment-dues-title"
      className="rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] p-5 shadow-sm space-y-4"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2
          id="payment-dues-title"
          className="text-base font-bold text-(--text-main) flex items-center gap-2"
        >
          <CreditCard className="h-5 w-5 text-[var(--accent-primary)]" />
          <span>{ar ? 'المستحقات' : 'Amounts due'}</span>
        </h2>
        <span className="text-xs text-(--text-muted) flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5" />
          {ar ? 'دفع آمن عبر Paymob' : 'Secure payment by Paymob'}
        </span>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-700 dark:text-rose-300"
        >
          {error}
        </p>
      )}

      <ul className="divide-y divide-(--border-subtle)">
        {dues.map((due) => (
          <li
            key={due.subscriptionId}
            className="py-3 flex items-center justify-between gap-4 flex-wrap"
          >
            <div className="min-w-0">
              <div className="text-sm font-semibold text-(--text-main)">
                {due.playerName}
                {due.planName ? (
                  <span className="text-(--text-muted) font-normal"> · {due.planName}</span>
                ) : null}
              </div>
              <div className="text-xs text-(--text-muted)">
                {due.academyName} · {ar ? 'مستحق في' : 'due'} {due.dueDate}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span dir="ltr" className="text-base font-extrabold text-(--text-main)">
                {format(due.outstandingBalance, due.currency)}
              </span>
              {due.canPayOnline ? (
                <button
                  type="button"
                  onClick={() => void pay(due)}
                  disabled={payingId !== null}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-bold text-white shadow hover:brightness-110 disabled:opacity-60 transition-all cursor-pointer"
                >
                  {payingId === due.subscriptionId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  <span>{ar ? 'ادفع الآن' : 'Pay now'}</span>
                </button>
              ) : (
                <span className="text-xs text-(--text-muted)">
                  {ar ? 'السداد لدى الأكاديمية' : 'Pay at the academy'}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default PaymentDues;
