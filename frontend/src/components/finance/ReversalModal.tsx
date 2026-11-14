'use client';

import React, { useState } from 'react';
import { useLocale } from '@/contexts/locale-context';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/api/client';
import type { FinancialTransactionItem } from '@academy/shared';
import { RotateCcw } from 'lucide-react';

export interface ReversalModalProps {
  transaction: FinancialTransactionItem | null;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

export function ReversalModal({ transaction, onClose, onSuccess }: ReversalModalProps) {
  const { locale } = useLocale();
  const isAr = locale === 'ar';
  const { toast } = useToast();

  const [reversalReason, setReversalReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction || reversalReason.trim().length < 5) return;
    setIsSubmitting(true);
    try {
      await apiClient.finance.reverseTransaction(transaction.id, {
        reason: reversalReason.trim(),
      });
      toast.success(
        isAr
          ? 'تم عكس المعاملة المالية وتوثيق السبب في سجل التدقيق'
          : 'Transaction reversed and audited successfully',
      );
      setReversalReason('');
      onClose();
      await onSuccess();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : isAr
            ? 'فشل عكس المعاملة'
            : 'Failed to reverse transaction',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!transaction) return null;

  return (
    <Modal
      isOpen={Boolean(transaction)}
      onClose={onClose}
      title={isAr ? 'عكس المعاملة وإلغاء القيد' : 'Reverse Transaction'}
      description={transaction.receiptNumber || transaction.id.slice(0, 8)}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
          {isAr
            ? `سيتم إلغاء هذه المعاملة (${transaction.amount} ر.س) وعكس أثرها المالي على رصيد اللاعب وسجل الأكاديمية فوراً مع توثيق سبب الإلغاء في سجل التدقيق.`
            : `This transaction (${transaction.amount} SAR) will be voided and reversed immediately on athlete ledger and audited in security logs.`}
        </div>

        <div>
          <label className="block text-xs font-semibold text-(--text-main) mb-1">
            {isAr ? 'سبب الإلغاء وعكس القيد (إلزامي) *' : 'Reversal Reason (Mandatory) *'}
          </label>
          <textarea
            required
            rows={3}
            value={reversalReason}
            onChange={(e) => setReversalReason(e.target.value)}
            placeholder={
              isAr
                ? 'يرجى كتابة سبب الإلغاء بالتفصيل (مثل: خطأ في إدخال المبلغ، دفع مكرر، طلب ولي الأمر...)'
                : 'Please describe reason (e.g., duplicate charge, clerk error, refund request)...'
            }
            className="w-full rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) p-3 text-xs text-(--text-main) placeholder-(--text-muted) focus:border-(--accent-primary) focus:outline-none resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-(--border-subtle)">
          <Button type="button" variant="ghost" onClick={onClose}>
            {isAr ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            type="submit"
            variant="danger"
            isLoading={isSubmitting}
            disabled={isSubmitting || reversalReason.trim().length < 5}
            startIcon={<RotateCcw className="h-3.5 w-3.5" />}
          >
            {isAr ? 'تأكيد عكس القيد' : 'Confirm Reversal'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
