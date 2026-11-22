'use client';

import React, { useEffect, useState } from 'react';
import { ArrowDownToLine, CreditCard, Wallet } from 'lucide-react';
import type { AcademyOnlineCollectionsSummary } from '@academy/shared';
import { api } from '@/api/client';
import { useLocale } from '@/contexts/locale-context';

/**
 * The academy's view of online payments: families pay into the platform's account, and the platform transfers the
 * money to the academy. Shows what was collected, what was transferred, and what the platform still owes. Hidden until
 * the academy has its first online payment or transfer.
 */
export function OnlineCollectionsCard() {
  const { locale } = useLocale();
  const ar = locale === 'ar';
  const [summary, setSummary] = useState<AcademyOnlineCollectionsSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.payments
      .getAcademyOnlineSummary()
      .then((s) => {
        if (!cancelled) setSummary(s);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!summary || (summary.paymentsCount === 0 && summary.payouts.length === 0)) return null;

  const fmt = (n: number) =>
    `${n.toLocaleString(ar ? 'ar-EG' : 'en-US', { maximumFractionDigits: 2 })} ${summary.currency}`;
  const stats = [
    {
      icon: CreditCard,
      label: ar
        ? `مدفوعات أونلاين من أولياء الأمور (${summary.paymentsCount})`
        : `Paid online by families (${summary.paymentsCount})`,
      value: summary.collectedOnline,
    },
    {
      icon: ArrowDownToLine,
      label: ar ? 'تم تحويله للأكاديمية' : 'Transferred to the academy',
      value: summary.paidOut,
    },
    {
      icon: Wallet,
      label: ar ? 'متبقٍ لدى المنصة' : 'Still held by the platform',
      value: summary.balance,
    },
  ];

  return (
    <section
      aria-labelledby="online-collections-title"
      className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface) p-5 shadow-xs space-y-4"
    >
      <div>
        <h3 id="online-collections-title" className="text-sm font-bold text-(--text-main)">
          {ar ? 'الدفع الإلكتروني والتحويلات' : 'Online payments and transfers'}
        </h3>
        <p className="text-xs text-(--text-muted)">
          {ar
            ? 'المبالغ المدفوعة أونلاين تُحصَّل في حساب المنصة ثم تُحوَّل للأكاديمية.'
            : 'Online payments are collected by the platform and then transferred to the academy.'}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl bg-(--bg-surface-subtle) p-3">
            <div className="text-xs text-(--text-muted) flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </div>
            <div dir="ltr" className="text-lg font-extrabold text-(--text-main) mt-1 text-start">
              {fmt(value)}
            </div>
          </div>
        ))}
      </div>
      {summary.payouts.length > 0 && (
        <div>
          <div className="text-xs font-bold text-(--text-main) mb-2">
            {ar ? 'آخر التحويلات' : 'Latest transfers'}
          </div>
          <ul className="divide-y divide-(--border-subtle) text-xs">
            {summary.payouts.slice(0, 5).map((p) => (
              <li key={p.id} className="py-2 flex items-center justify-between gap-3">
                <span className="text-(--text-muted)">
                  <bdi dir="ltr" className="whitespace-nowrap">
                    {p.paidAt.slice(0, 10)}
                  </bdi>
                  {p.reference ? <> · {p.reference}</> : null}
                </span>
                <span dir="ltr" className="font-bold text-(--text-main)">
                  {fmt(p.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default OnlineCollectionsCard;
