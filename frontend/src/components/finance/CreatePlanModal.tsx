'use client';

import { useAcademyCurrency } from '@/hooks/useAcademyCurrency';
import { useAcademySports } from '@/hooks/useAcademySports';
import React, { useState } from 'react';
import { useLocale } from '@/contexts/locale-context';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/api/client';
import { Layers } from 'lucide-react';

export interface CreatePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

export function CreatePlanModal({ isOpen, onClose, onSuccess }: CreatePlanModalProps) {
  const { locale } = useLocale();
  const { label: currencyLabel, code: currencyCode } = useAcademyCurrency();
  const { mainSport } = useAcademySports();
  const isAr = locale === 'ar';
  const { toast } = useToast();

  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState<number>(650);
  const [planPeriod, setPlanPeriod] = useState<'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'PER_SESSION'>(
    'MONTHLY',
  );
  const [planDescription, setPlanDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName.trim() || planPrice <= 0) return;
    setIsSubmitting(true);
    try {
      await apiClient.finance.createPlayerPlan({
        name: planName.trim(),
        feeAmount: Number(planPrice),
        currency: currencyCode,
        billingPeriod: planPeriod,
        sport: mainSport,
        description: planDescription.trim() || undefined,
      });
      toast.success(
        isAr ? 'تم إنشاء الباقة التدريبية بنجاح' : 'Training plan created successfully',
      );
      setPlanName('');
      setPlanPrice(650);
      setPlanDescription('');
      onClose();
      await onSuccess();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : isAr
            ? 'فشل إنشاء الباقة التدريبية'
            : 'Failed to create training plan',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isAr ? 'إنشاء باقة تدريبية جديدة' : 'New Training Plan'}
      description={
        isAr
          ? 'إضافة خطة اشتراك للناشئين واللاعبين'
          : 'Define a recurring or per-session training subscription tier'
      }
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-(--text-main) mb-1">
            {isAr ? 'اسم الباقة التدريبية *' : 'Plan Name *'}
          </label>
          <input
            type="text"
            required
            placeholder={
              isAr
                ? 'مثال: باقة النخبة الشهرية (3 حصص أسبوعياً)'
                : 'e.g. Monthly Elite Plan (3 sessions/week)'
            }
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            className="w-full rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-3.5 py-2 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-(--text-main) mb-1">
              {isAr ? `السعر (${currencyLabel}) *` : `Price (${currencyLabel}) *`}
            </label>
            <input
              type="number"
              min="1"
              step="0.01"
              required
              value={planPrice}
              onChange={(e) => setPlanPrice(parseFloat(e.target.value) || 0)}
              className="w-full rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-3.5 py-2 text-xs text-(--text-main) font-bold focus:border-(--accent-primary) focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-(--text-main) mb-1">
              {isAr ? 'دورة الفوترة *' : 'Billing Cycle *'}
            </label>
            <select
              value={planPeriod}
              onChange={(e) =>
                setPlanPeriod(e.target.value as 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'PER_SESSION')
              }
              className="w-full rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-3.5 py-2 text-xs font-semibold text-(--text-main) focus:border-(--accent-primary) focus:outline-none cursor-pointer"
            >
              <option value="MONTHLY">{isAr ? 'شهري (Monthly)' : 'Monthly'}</option>
              <option value="QUARTERLY">
                {isAr ? 'ربع سنوي (3 أشهر)' : 'Quarterly (3 months)'}
              </option>
              <option value="ANNUAL">{isAr ? 'سنوي (12 شهر)' : 'Annual (12 months)'}</option>
              <option value="PER_SESSION">
                {isAr ? 'حسب الحصة (Per Session)' : 'Per Session'}
              </option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-(--text-main) mb-1">
            {isAr ? 'وصف ومميزات الباقة' : 'Plan Description & Perks'}
          </label>
          <textarea
            rows={2}
            value={planDescription}
            onChange={(e) => setPlanDescription(e.target.value)}
            placeholder={
              isAr ? 'تفاصيل التمارين والمميزات المرفقة...' : 'Included perks, drills, and hours...'
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
            variant="primary"
            isLoading={isSubmitting}
            disabled={isSubmitting || !planName.trim() || planPrice <= 0}
            startIcon={<Layers className="h-3.5 w-3.5" />}
          >
            {isAr ? 'إنشاء الباقة' : 'Create Plan'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
