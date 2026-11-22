'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowUpFromLine, RefreshCw, Wallet } from 'lucide-react';
import type { AcademyPayoutBalanceItem, AcademyPayoutItem } from '@academy/shared';
import { api, getErrorMessage } from '@/api/client';
import { useAuth } from '@/contexts/auth-context';
import { useLocale } from '@/contexts/locale-context';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { ErrorState } from '../ui/ErrorState';
import { useToast } from '../ui/Toast';

/** Today's date in the viewer's own time zone (YYYY-MM-DD), not UTC. */
const today = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Families pay academy subscriptions online into the platform's account; this tab shows, per academy, what was
 * collected, what the platform already transferred, and what it still owes. Only the platform owner records a
 * transfer (enforced by the API); platform admins see the figures.
 */
export function PlatformPayoutsTab() {
  const { user } = useAuth();
  const { locale } = useLocale();
  const { toast } = useToast();
  const ar = locale === 'ar';
  const isOwner = Boolean(user?.isPlatformOwner);

  const [balances, setBalances] = useState<AcademyPayoutBalanceItem[]>([]);
  const [payouts, setPayouts] = useState<AcademyPayoutItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [target, setTarget] = useState<AcademyPayoutBalanceItem | null>(null);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [paidAt, setPaidAt] = useState(today());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [b, p] = await Promise.all([
        api.payments.listPayoutBalances(),
        api.payments.listPayouts(),
      ]);
      setBalances(b);
      setPayouts(p);
    } catch (err) {
      setLoadError(getErrorMessage(err, ar ? 'تعذر تحميل التحويلات' : 'Could not load payouts'));
    } finally {
      setIsLoading(false);
    }
  }, [ar]);

  useEffect(() => {
    void load();
  }, [load]);

  const fmt = (n: number, currency: string) =>
    `${n.toLocaleString(ar ? 'ar-EG' : 'en-US', { maximumFractionDigits: 2 })} ${currency}`;

  const openPayout = (row: AcademyPayoutBalanceItem) => {
    setTarget(row);
    setAmount(String(row.balance));
    setReference('');
    setNotes('');
    setPaidAt(today());
    setFormError(null);
  };

  const submit = async () => {
    if (!target) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setFormError(ar ? 'أدخل مبلغاً صحيحاً أكبر من صفر.' : 'Enter an amount greater than zero.');
      return;
    }
    if (value > target.balance) {
      setFormError(
        ar
          ? `المبلغ أكبر من المستحق (${fmt(target.balance, target.currency)}).`
          : `The amount exceeds what is owed (${fmt(target.balance, target.currency)}).`,
      );
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await api.payments.recordPayout({
        tenantId: target.tenantId,
        amount: Math.round(value * 100) / 100,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        paidAt,
      });
      toast.success(ar ? 'تم تسجيل التحويل' : 'Transfer recorded');
      setTarget(null);
      await load();
    } catch (err) {
      setFormError(
        getErrorMessage(err, ar ? 'تعذر تسجيل التحويل' : 'Could not record the transfer'),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loadError) return <ErrorState message={loadError} onRetry={() => void load()} />;

  const owedTotal = balances.reduce<Record<string, number>>((acc, b) => {
    acc[b.currency] = (acc[b.currency] ?? 0) + b.balance;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-(--text-main) flex items-center gap-2">
            <Wallet className="h-5 w-5 text-(--accent-primary)" />
            {ar ? 'مستحقات الأكاديميات والتحويلات' : 'Academy balances and transfers'}
          </h2>
          <p className="text-xs text-(--text-muted) mt-0.5">
            {ar
              ? 'ما دفعه أولياء الأمور أونلاين لكل أكاديمية، وما حوّلته لها، والمتبقي عليك.'
              : 'What families paid each academy online, what you transferred, and what you still owe.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {Object.entries(owedTotal).map(([currency, total]) => (
            <span
              key={currency}
              className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300"
            >
              {ar ? 'إجمالي المستحق: ' : 'Total owed: '}
              <bdi dir="ltr" className="whitespace-nowrap">
                {fmt(total, currency)}
              </bdi>
            </span>
          ))}
          <Button variant="outline" size="sm" onClick={() => void load()} isLoading={isLoading}>
            <RefreshCw className="h-4 w-4" />
            <span>{ar ? 'تحديث' : 'Refresh'}</span>
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface) overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-(--bg-surface-subtle) text-xs text-(--text-muted)">
            <tr>
              <th className="p-3 text-start">{ar ? 'الأكاديمية' : 'Academy'}</th>
              <th className="p-3 text-start">{ar ? 'محصّل أونلاين' : 'Collected online'}</th>
              <th className="p-3 text-start">{ar ? 'تم تحويله' : 'Transferred'}</th>
              <th className="p-3 text-start">{ar ? 'المستحق للأكاديمية' : 'Owed to academy'}</th>
              <th className="p-3 text-start">{ar ? 'آخر تحويل' : 'Last transfer'}</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-(--border-subtle)">
            {!isLoading && balances.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-xs text-(--text-muted)">
                  {ar ? 'لا توجد مدفوعات أونلاين بعد.' : 'No online payments yet.'}
                </td>
              </tr>
            )}
            {balances.map((b) => (
              <tr key={`${b.tenantId}-${b.currency}`}>
                <td className="p-3 font-semibold text-(--text-main)">
                  {b.academyName}
                  <div className="text-[11px] font-normal text-(--text-muted)">
                    {ar ? `${b.paymentsCount} عملية دفع` : `${b.paymentsCount} payment(s)`}
                  </div>
                </td>
                <td className="p-3" dir="ltr">
                  {fmt(b.collectedOnline, b.currency)}
                </td>
                <td className="p-3" dir="ltr">
                  {fmt(b.paidOut, b.currency)}
                </td>
                <td className="p-3 font-extrabold text-(--text-main)" dir="ltr">
                  {fmt(b.balance, b.currency)}
                </td>
                <td className="p-3 text-xs text-(--text-muted)" dir="ltr">
                  {b.lastPayoutAt ? b.lastPayoutAt.slice(0, 10) : '—'}
                </td>
                <td className="p-3 text-end">
                  {isOwner && b.balance > 0 && (
                    <Button size="sm" onClick={() => openPayout(b)}>
                      <ArrowUpFromLine className="h-4 w-4" />
                      <span>{ar ? 'تسجيل تحويل' : 'Record transfer'}</span>
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-bold text-(--text-main)">
          {ar ? 'سجل التحويلات' : 'Transfer history'}
        </h3>
        {payouts.length === 0 ? (
          <p className="text-xs text-(--text-muted)">
            {ar ? 'لم يُسجَّل أي تحويل بعد.' : 'No transfers recorded yet.'}
          </p>
        ) : (
          <ul className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface) divide-y divide-(--border-subtle) text-xs">
            {payouts.map((p) => (
              <li key={p.id} className="p-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-(--text-main)">{p.academyName}</div>
                  <div className="text-(--text-muted)">
                    <bdi dir="ltr" className="whitespace-nowrap">
                      {p.paidAt.slice(0, 10)}
                    </bdi>
                    {p.reference ? <> · {p.reference}</> : null}
                    {p.recordedByName ? (
                      <>
                        {' '}
                        · {ar ? 'سجّله' : 'by'} {p.recordedByName}
                      </>
                    ) : null}
                  </div>
                  {p.notes && <div className="text-(--text-muted) mt-0.5">{p.notes}</div>}
                </div>
                <span dir="ltr" className="font-bold text-(--text-main)">
                  {fmt(p.amount, p.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        isOpen={target !== null}
        onClose={() => (saving ? undefined : setTarget(null))}
        title={
          ar
            ? `تسجيل تحويل إلى ${target?.academyName ?? ''}`
            : `Record a transfer to ${target?.academyName ?? ''}`
        }
        description={
          target
            ? ar
              ? `المستحق حالياً: ${fmt(target.balance, target.currency)}. سجّل التحويل بعد إرساله فعلياً من حسابك.`
              : `Currently owed: ${fmt(target.balance, target.currency)}. Record it after you actually sent the money.`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setTarget(null)} disabled={saving}>
              {ar ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={() => void submit()} isLoading={saving} disabled={saving}>
              {ar ? 'تسجيل التحويل' : 'Record transfer'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input
            label={ar ? `المبلغ (${target?.currency ?? ''})` : `Amount (${target?.currency ?? ''})`}
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <Input
            label={ar ? 'تاريخ التحويل' : 'Transfer date'}
            type="date"
            value={paidAt}
            max={today()}
            onChange={(e) => setPaidAt(e.target.value)}
            required
          />
          <Input
            label={
              ar
                ? 'المرجع (رقم الحوالة البنكية أو المحفظة)'
                : 'Reference (bank or wallet transfer no.)'
            }
            value={reference}
            maxLength={120}
            onChange={(e) => setReference(e.target.value)}
          />
          <Input
            label={ar ? 'ملاحظات' : 'Notes'}
            value={notes}
            maxLength={500}
            onChange={(e) => setNotes(e.target.value)}
          />
          {formError && (
            <p
              role="alert"
              className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs text-rose-700 dark:text-rose-300"
            >
              {formError}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default PlatformPayoutsTab;
