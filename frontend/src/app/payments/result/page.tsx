'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import type { OnlinePaymentStatusResponse } from '@academy/shared';
import { api } from '@/api/client';
import { useAuth } from '@/contexts/auth-context';
import { useLocale } from '@/contexts/locale-context';
import { useAccessGuard } from '@/hooks/useAccessGuard';
import { getRoleHomeRoute } from '@/utils/role-routing';
import { AppShell } from '@/components/layout/AppShell';

/** How long to wait for the provider's confirmation before saying it is still being confirmed. */
const POLL_MS = 2000;
const POLL_LIMIT = 15;

/**
 * Where the payment provider sends the payer back. The query string it adds is not trusted: the page asks our API,
 * which only says "paid" after the provider's signed confirmation arrived.
 */
function PaymentResult() {
  const params = useSearchParams();
  const paymentId = params.get('payment');
  const { user, activeTenant } = useAuth();
  const { locale } = useLocale();
  const ar = locale === 'ar';
  const [payment, setPayment] = useState<OnlinePaymentStatusResponse | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [polls, setPolls] = useState(0);

  useAccessGuard('authenticated');

  useEffect(() => {
    if (!user || !paymentId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const p = await api.payments.getOnlinePayment(paymentId);
        if (cancelled) return;
        setPayment(p);
        if (p.status === 'PENDING') setPolls((n) => n + 1);
      } catch {
        if (!cancelled) setNotFound(true);
      }
    };
    if (polls === 0) void load();
    else if (payment?.status === 'PENDING' && polls < POLL_LIMIT) {
      const timer = setTimeout(() => void load(), POLL_MS);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [user, paymentId, polls, payment?.status]);

  const home = user ? getRoleHomeRoute(user, activeTenant) : '/';
  const amount = payment
    ? `${payment.amount.toLocaleString(ar ? 'ar-EG' : 'en-US')} ${payment.currency}`
    : '';

  let icon = <Loader2 className="h-12 w-12 animate-spin text-[var(--accent-primary)]" />;
  let title = ar ? 'جاري التحقق من الدفع…' : 'Checking your payment…';
  let body: React.ReactNode = null;
  if (notFound || !paymentId) {
    icon = <XCircle className="h-12 w-12 text-rose-500" />;
    title = ar ? 'لم نعثر على هذه العملية' : 'Payment not found';
  } else if (payment?.status === 'PAID') {
    icon = <CheckCircle2 className="h-12 w-12 text-emerald-500" />;
    title = ar ? 'تم الدفع بنجاح' : 'Payment successful';
    const paidAmount = <bdi dir="ltr">{amount}</bdi>;
    body = ar ? (
      <>
        تم سداد {paidAmount} إلى {payment.academyName}
        {payment.playerName ? <> عن {payment.playerName}</> : null}.
      </>
    ) : (
      <>
        {paidAmount} paid to {payment.academyName}
        {payment.playerName ? <> for {payment.playerName}</> : null}.
      </>
    );
  } else if (payment?.status === 'FAILED') {
    icon = <XCircle className="h-12 w-12 text-rose-500" />;
    title = ar ? 'لم تتم عملية الدفع' : 'Payment was not completed';
    body = ar
      ? 'لم يُخصم أي مبلغ. يمكنك المحاولة مرة أخرى من صفحة المستحقات.'
      : 'No money was taken. You can try again from your dues.';
  } else if (payment && polls >= POLL_LIMIT) {
    icon = <Clock className="h-12 w-12 text-amber-500" />;
    title = ar ? 'جاري تأكيد الدفع' : 'Your payment is being confirmed';
    body = ar
      ? 'قد يستغرق التأكيد بضع دقائق. ستظهر العملية في حسابك فور اكتمالها.'
      : 'Confirmation can take a few minutes; it will appear in your account once complete.';
  }

  return (
    <div className="max-w-lg mx-auto rounded-2xl border border-(--border-subtle) bg-[var(--bg-surface)] p-8 shadow-sm text-center space-y-4">
      <div className="flex justify-center">{icon}</div>
      <h1 className="text-xl font-bold text-(--text-main)">{title}</h1>
      {body && <p className="text-sm text-(--text-muted)">{body}</p>}
      {payment?.status === 'PAID' && payment.receiptNumber && (
        <p className="text-xs text-(--text-muted)">
          {ar ? 'رقم الإيصال: ' : 'Receipt number: '}
          <span dir="ltr" className="font-mono font-semibold text-(--text-main)">
            {payment.receiptNumber}
          </span>
        </p>
      )}
      <Link
        href={home}
        className="inline-flex items-center justify-center rounded-xl bg-[var(--accent-primary)] px-5 py-2.5 text-xs font-bold text-white hover:brightness-110"
      >
        {ar ? 'العودة إلى حسابي' : 'Back to my account'}
      </Link>
    </div>
  );
}

export default function PaymentResultPage() {
  const { locale } = useLocale();
  return (
    <AppShell breadcrumbs={[{ label: locale === 'ar' ? 'نتيجة الدفع' : 'Payment result' }]}>
      <Suspense fallback={null}>
        <PaymentResult />
      </Suspense>
    </AppShell>
  );
}
