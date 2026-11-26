'use client';

import { useAcademyCurrency } from '@/hooks/useAcademyCurrency';
import React, { useState, useEffect } from 'react';
import { useLocale } from '@/contexts/locale-context';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/api/client';
import type { PlayerSubscriptionItem } from '@academy/shared';
import { CreditCard } from 'lucide-react';

export interface CollectPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: PlayerSubscriptionItem | null;
  branchId?: string;
  onSuccess: () => Promise<void> | void;
}

export function CollectPaymentModal({
  isOpen,
  onClose,
  subscription,
  branchId,
  onSuccess,
}: CollectPaymentModalProps) {
  const { locale } = useLocale();
  const { label: currencyLabel } = useAcademyCurrency();
  const isAr = locale === 'ar';
  const { toast } = useToast();

  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'POS' | 'BANK_TRANSFER'>(
    'CASH',
  );
  const [paymentRefNumber, setPaymentRefNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (subscription) {
      setPaymentAmount(
        subscription.outstandingBalance > 0
          ? subscription.outstandingBalance
          : subscription.feeAmount,
      );
      setPaymentMethod('CASH');
      setPaymentRefNumber('');
      setPaymentNotes('');
    }
  }, [subscription]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscription || paymentAmount <= 0) return;
    setIsSubmitting(true);
    try {
      await apiClient.finance.recordPayment({
        playerId: subscription.playerId,
        subscriptionId: subscription.id,
        branchId: branchId || subscription.tenantId,
        amount: Number(paymentAmount),
        paymentMethod,
        referenceNumber: paymentRefNumber.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
      });
      toast.success(
        isAr
          ? 'تم تسجيل الدفعة بنجاح وتحديث الحساب'
          : 'Payment recorded and account updated successfully',
      );
      onClose();
      await onSuccess();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : isAr ? 'فشل تسجيل الدفعة' : 'Failed to record payment',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!subscription) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isAr ? 'تحصيل دفعة مالية للاعب' : 'Collect Athlete Payment'}
      description={subscription.playerName}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) p-3 text-xs flex justify-between items-center">
          <span className="text-(--text-muted)">
            {isAr ? 'المتبقي على الاشتراك:' : 'Remaining Outstanding:'}
          </span>
          <span className="font-extrabold text-(--accent-primary)">
            {subscription.outstandingBalance} {currencyLabel}
          </span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-(--text-main) mb-1">
            {isAr ? `المبلغ المحصل (${currencyLabel}) *` : `Collected Amount (${currencyLabel}) *`}
          </label>
          <input
            type="number"
            min="1"
            step="0.01"
            required
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
            className="w-full rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-3.5 py-2.5 text-sm font-bold text-(--text-main) focus:border-(--accent-primary) focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-(--text-main) mb-1">
            {isAr ? 'طريقة التحصيل *' : 'Payment Method *'}
          </label>
          <select
            value={paymentMethod}
            onChange={(e) =>
              setPaymentMethod(e.target.value as 'CASH' | 'CARD' | 'POS' | 'BANK_TRANSFER')
            }
            className="w-full rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-3.5 py-2.5 text-xs font-semibold text-(--text-main) focus:border-(--accent-primary) focus:outline-none cursor-pointer"
          >
            <option value="CASH">{isAr ? 'نقدي (كاش بالملعب)' : 'Cash (Pitchside)'}</option>
            <option value="POS">
              {isAr ? 'جهاز نقاط البيع (POS / شبكة)' : 'POS Terminal / Mada'}
            </option>
            <option value="CARD">{isAr ? 'بطاقة مدى / ائتمانية' : 'Credit / Debit Card'}</option>
            <option value="BANK_TRANSFER">{isAr ? 'تحويل بنكي' : 'Bank Transfer'}</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-(--text-main) mb-1">
            {isAr ? 'رقم الإيصال / المرجع' : 'Receipt / Reference No.'}
          </label>
          <input
            type="text"
            placeholder={isAr ? 'رقم الإيصال أو الحوالة...' : 'Receipt or transfer reference...'}
            value={paymentRefNumber}
            onChange={(e) => setPaymentRefNumber(e.target.value)}
            className="w-full rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-3.5 py-2 text-xs text-(--text-main) placeholder-(--text-muted) focus:border-(--accent-primary) focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-(--text-main) mb-1">
            {isAr ? 'ملاحظات' : 'Notes'}
          </label>
          <input
            type="text"
            placeholder={isAr ? 'ملاحظات توثيقية إضافية...' : 'Optional audit notes...'}
            value={paymentNotes}
            onChange={(e) => setPaymentNotes(e.target.value)}
            className="w-full rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-3.5 py-2 text-xs text-(--text-main) placeholder-(--text-muted) focus:border-(--accent-primary) focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-(--border-subtle)">
          <Button type="button" variant="ghost" onClick={onClose}>
            {isAr ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            disabled={isSubmitting || paymentAmount <= 0}
            startIcon={<CreditCard className="h-3.5 w-3.5" />}
          >
            {isAr ? 'تأكيد استلام المبلغ' : 'Confirm Payment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
