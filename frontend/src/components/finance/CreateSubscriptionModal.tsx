'use client';

import { useAcademyCurrency } from '@/hooks/useAcademyCurrency';
import React, { useState, useEffect } from 'react';
import { useLocale } from '@/contexts/locale-context';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/api/client';
import type { PlayerSubscriptionPlanItem } from '@academy/shared';
import { PlusCircle } from 'lucide-react';

export interface CreateSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  plans: PlayerSubscriptionPlanItem[];
  onSuccess: () => Promise<void> | void;
}

export function CreateSubscriptionModal({
  isOpen,
  onClose,
  plans,
  onSuccess,
}: CreateSubscriptionModalProps) {
  const { locale } = useLocale();
  const { label: currencyLabel } = useAcademyCurrency();
  const isAr = locale === 'ar';
  const { toast } = useToast();

  const [allPlayers, setAllPlayers] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [subFeeAmount, setSubFeeAmount] = useState<number>(650);
  const [subDiscountAmount, setSubDiscountAmount] = useState<number>(0);
  const [subDiscountReason, setSubDiscountReason] = useState('');
  const [subDueDate, setSubDueDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [subNotes, setSubNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && allPlayers.length === 0) {
      apiClient.players
        .list({ limit: 100 })
        .then((res) => {
          const formatted = res.items.map((p) => ({
            id: p.id,
            name: `${p.firstName} ${p.lastName}`,
          }));
          setAllPlayers(formatted);
          if (formatted.length > 0 && !selectedPlayerId && formatted[0]) {
            setSelectedPlayerId(formatted[0].id);
          }
        })
        .catch(console.error);
    }
  }, [isOpen, allPlayers.length, selectedPlayerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayerId || subFeeAmount <= 0) return;
    setIsSubmitting(true);
    try {
      await apiClient.finance.createPlayerSubscription({
        playerId: selectedPlayerId,
        planId: selectedPlanId || undefined,
        feeAmount: Number(subFeeAmount),
        discountAmount: Number(subDiscountAmount || 0),
        discountReason: subDiscountReason.trim() || undefined,
        dueDate: subDueDate,
        notes: subNotes.trim() || undefined,
      });
      toast.success(
        isAr ? 'تم إنشاء اشتراك اللاعب بنجاح' : 'Athlete subscription created successfully',
      );
      onClose();
      await onSuccess();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : isAr
            ? 'فشل إنشاء الاشتراك'
            : 'Failed to create subscription',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isAr ? 'تسجيل اشتراك جديد للاعب' : 'New Athlete Subscription'}
      description={
        isAr
          ? 'إضافة دورة اشتراك تدريبي وتحديد رسوم العضوية'
          : 'Enroll athlete into training subscription and set dues'
      }
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-(--text-main) mb-1">
            {isAr ? 'اختيار اللاعب *' : 'Select Athlete *'}
          </label>
          <select
            required
            value={selectedPlayerId}
            onChange={(e) => setSelectedPlayerId(e.target.value)}
            className="w-full rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-3.5 py-2.5 text-xs font-semibold text-(--text-main) focus:border-(--accent-primary) focus:outline-none cursor-pointer"
          >
            {allPlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-(--text-main) mb-1">
            {isAr ? 'الباقة التدريبية (اختياري)' : 'Training Plan (Optional)'}
          </label>
          <select
            value={selectedPlanId}
            onChange={(e) => {
              const planId = e.target.value;
              setSelectedPlanId(planId);
              const chosen = plans.find((p) => p.id === planId);
              if (chosen) setSubFeeAmount(chosen.feeAmount);
            }}
            className="w-full rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-3.5 py-2.5 text-xs font-semibold text-(--text-main) focus:border-(--accent-primary) focus:outline-none cursor-pointer"
          >
            <option value="">
              {isAr ? 'بدون باقة محددة (مبلغ مخصص)' : 'Custom Fee (No pre-set plan)'}
            </option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.feeAmount} {currencyLabel})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-(--text-main) mb-1">
              {isAr
                ? `قيمة الاشتراك (${currencyLabel}) *`
                : `Subscription Fee (${currencyLabel}) *`}
            </label>
            <input
              type="number"
              min="1"
              step="0.01"
              required
              value={subFeeAmount}
              onChange={(e) => setSubFeeAmount(parseFloat(e.target.value) || 0)}
              className="w-full rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-3.5 py-2 text-xs text-(--text-main) font-bold focus:border-(--accent-primary) focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-(--text-main) mb-1">
              {isAr ? `خصم ممنوح (${currencyLabel})` : `Discount (${currencyLabel})`}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={subDiscountAmount}
              onChange={(e) => setSubDiscountAmount(parseFloat(e.target.value) || 0)}
              className="w-full rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-3.5 py-2 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none"
            />
          </div>
        </div>

        {subDiscountAmount > 0 && (
          <div>
            <label className="block text-xs font-semibold text-(--text-main) mb-1">
              {isAr ? 'سبب الخصم الممنوح' : 'Discount Reason'}
            </label>
            <input
              type="text"
              placeholder={
                isAr
                  ? 'مثال: خصم إخوة، منحة تفوق رياضي...'
                  : 'e.g. Sibling discount, athletic scholarship...'
              }
              value={subDiscountReason}
              onChange={(e) => setSubDiscountReason(e.target.value)}
              className="w-full rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-3.5 py-2 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-(--text-main) mb-1">
            {isAr ? 'تاريخ استحقاق التجديد *' : 'Renewal Due Date *'}
          </label>
          <input
            type="date"
            required
            value={subDueDate}
            onChange={(e) => setSubDueDate(e.target.value)}
            className="w-full rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-3.5 py-2 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-(--text-main) mb-1">
            {isAr ? 'ملاحظات الاشتراك' : 'Subscription Notes'}
          </label>
          <textarea
            rows={2}
            value={subNotes}
            onChange={(e) => setSubNotes(e.target.value)}
            placeholder={isAr ? 'ملاحظات العضوية والاشتراك...' : 'Membership notes...'}
            className="w-full rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) p-3 text-xs text-(--text-main) placeholder-(--text-muted) focus:border-(--accent-primary) focus:outline-none resize-none"
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
            disabled={isSubmitting || !selectedPlayerId || subFeeAmount <= 0}
            startIcon={<PlusCircle className="h-3.5 w-3.5" />}
          >
            {isAr ? 'حفظ الاشتراك' : 'Save Subscription'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
