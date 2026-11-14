'use client';

import React from 'react';
import { useLocale } from '@/contexts/locale-context';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/api/client';
import type { SaaSPlanItem } from '@academy/shared';

export interface PlatformPlansTabProps {
  plans: SaaSPlanItem[];
  onReload: () => Promise<void> | void;
}

export function PlatformPlansTab({ plans, onReload }: PlatformPlansTabProps) {
  const { locale } = useLocale();
  const isAr = locale === 'ar';
  const { toast } = useToast();

  const handleEditPrice = (p: SaaSPlanItem) => {
    const newPrice = prompt(
      isAr ? `تعديل السعر الشهري لخطة ${p.name}:` : `Edit monthly price for ${p.name}:`,
      String(p.priceMonthly),
    );
    if (newPrice !== null && !isNaN(Number(newPrice))) {
      void apiClient.platform
        .updateSaaSPlan(p.code, { priceMonthly: Number(newPrice) })
        .then(() => {
          toast.success(isAr ? 'تم تحديث السعر بنجاح' : 'Price updated successfully');
          void onReload();
        })
        .catch((err) => {
          toast.error(
            err instanceof Error
              ? err.message
              : isAr
                ? 'فشل تحديث السعر'
                : 'Failed to update price',
          );
        });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((p) => (
          <div
            key={p.id}
            className="p-5 rounded-2xl border border-(--border-subtle) bg-[var(--bg-surface)] flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-1 rounded-full text-xs font-extrabold tracking-wide uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  {p.code}
                </span>
                <span className="text-xs font-medium text-(--text-muted)">
                  {p.isActive ? (isAr ? 'مفعلة' : 'Active') : isAr ? 'معطلة' : 'Disabled'}
                </span>
              </div>

              <h3 className="text-lg font-bold text-(--text-main) mb-1">{p.name}</h3>
              <p className="text-xs text-(--text-muted) mb-4">{p.description}</p>

              <div className="mb-4">
                <div className="text-2xl font-black text-[var(--accent-primary)]">
                  {p.priceMonthly.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-(--text-muted)">
                    {p.currency} / {isAr ? 'شهرياً' : 'month'}
                  </span>
                </div>
                <div className="text-xs text-(--text-muted) mt-0.5">
                  {p.priceYearly.toLocaleString()} {p.currency} / {isAr ? 'سنوياً' : 'year'}
                </div>
              </div>

              <div className="space-y-2 py-3 border-t border-(--border-subtle) text-xs text-(--text-main)">
                <div className="flex justify-between">
                  <span className="text-(--text-muted)">
                    {isAr ? 'الحد الأقصى للفروع:' : 'Max Branches:'}
                  </span>
                  <span className="font-bold">{p.maxBranches}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-(--text-muted)">
                    {isAr ? 'الحد الأقصى للاعبين:' : 'Max Players:'}
                  </span>
                  <span className="font-bold">{p.maxPlayers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-(--text-muted)">
                    {isAr ? 'المدربين المسموح بهم:' : 'Max Coaches:'}
                  </span>
                  <span className="font-bold">{p.maxCoaches}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-(--border-subtle) mt-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleEditPrice(p)}
              >
                {isAr ? 'تعديل السعر والشروط' : 'Edit Plan Details'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
