'use client';

import { useAcademyCurrency } from '@/hooks/useAcademyCurrency';
import React from 'react';
import { useLocale } from '@/contexts/locale-context';
import type { PlayerSubscriptionPlanItem, TenantSubscriptionItem } from '@academy/shared';
import { ShieldCheck, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface PlansTabProps {
  tenantSub: TenantSubscriptionItem | null;
  plans: PlayerSubscriptionPlanItem[];
  onOpenCreatePlan: () => void;
}

export function PlansTab({ tenantSub, plans, onOpenCreatePlan }: PlansTabProps) {
  const { locale } = useLocale();
  const { label: currencyLabel } = useAcademyCurrency();
  const isAr = locale === 'ar';

  return (
    <div className="space-y-6">
      {/* SaaS Contract Card */}
      {tenantSub && (
        <div className="rounded-2xl border border-[var(--accent-primary)]/40 bg-[var(--bg-surface)] p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--brand-surface)] text-[var(--accent-primary)] font-bold">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-(--text-main)">
                    {isAr
                      ? `عقد اشتراك الأكاديمية بالمنصة (${tenantSub.planName})`
                      : `Academy Platform Subscription (${tenantSub.planName})`}
                  </h3>
                  <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 text-xs font-bold border border-emerald-500/30">
                    {tenantSub.status}
                  </span>
                </div>
                <p className="text-xs text-(--text-muted) mt-0.5">
                  {isAr
                    ? `الباقة المفعلة تشمل حتى ${tenantSub.maxBranches} فروع و ${tenantSub.maxPlayers} لاعب نشط.`
                    : `Active plan covers up to ${tenantSub.maxBranches} branches and ${tenantSub.maxPlayers} active athletes.`}
                </p>
              </div>
            </div>

            <div className="text-left rtl:text-left ltr:text-right font-mono">
              <span className="text-xs text-(--text-muted) block">
                {isAr ? 'قيمة الاشتراك الشهري (MRR)' : 'Monthly SaaS Tier (MRR)'}
              </span>
              <span className="text-xl font-black text-[var(--accent-primary)]">
                {tenantSub.currentPrice.toLocaleString()} {tenantSub.currency || `${currencyLabel}`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-(--border-subtle) text-xs">
            <div>
              <span className="text-(--text-muted) block mb-0.5">
                {isAr ? 'تاريخ بدء العقد:' : 'Contract Start Date:'}
              </span>
              <span className="font-mono font-bold text-(--text-main)">
                {String(tenantSub.startDate).slice(0, 10)}
              </span>
            </div>
            <div>
              <span className="text-(--text-muted) block mb-0.5">
                {isAr ? 'تاريخ التجديد القادم:' : 'Next Renewal Date:'}
              </span>
              <span className="font-mono font-bold text-(--text-main)">
                {String(tenantSub.renewalDate).slice(0, 10)}
              </span>
            </div>
            <div>
              <span className="text-(--text-muted) block mb-0.5">
                {isAr ? 'الحد الأقصى للفروع:' : 'Max Branches:'}
              </span>
              <span className="font-bold text-(--text-main)">
                {tenantSub.maxBranches} {isAr ? 'فروع' : 'branches'}
              </span>
            </div>
            <div>
              <span className="text-(--text-muted) block mb-0.5">
                {isAr ? 'الحد الأقصى للاعبين:' : 'Max Athletes:'}
              </span>
              <span className="font-bold text-(--text-main)">
                {tenantSub.maxPlayers} {isAr ? 'لاعب' : 'athletes'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Player Plans Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-(--text-main)">
              {isAr ? 'باقات العضويات والتدريب للأكاديمية' : 'Academy Membership & Training Plans'}
            </h3>
            <p className="text-xs text-(--text-muted)">
              {isAr
                ? 'الباقات المتاحة لتسجيل اللاعبين والاشتراكات الدورية.'
                : 'Available recurring membership plans for enrolling athletes.'}
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={onOpenCreatePlan}
            startIcon={<PlusCircle className="h-4 w-4" />}
          >
            {isAr ? 'إنشاء باقة جديدة' : 'New Training Plan'}
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-(--border-subtle) bg-[var(--bg-surface)] p-5 shadow-xs space-y-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start">
                  <h4 className="text-base font-bold text-(--text-main)">{p.name}</h4>
                  <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold">
                    {p.billingPeriod === 'MONTHLY' ? (isAr ? 'شهري' : 'Monthly') : p.billingPeriod}
                  </span>
                </div>
                <p className="text-xs text-(--text-muted) mt-1">
                  {p.description || (isAr ? 'باقة تدريب رسمية' : 'Official training package')}
                </p>
              </div>

              <div className="pt-4 border-t border-(--border-subtle) flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-black text-(--text-main)">
                    {p.feeAmount.toLocaleString()}
                  </span>
                  <span className="text-xs text-(--text-muted) font-semibold mx-1">
                    {isAr ? `${currencyLabel} / دورة` : `${currencyLabel} / cycle`}
                  </span>
                </div>
                <span className="text-xs text-[var(--accent-primary)] font-bold">
                  {p.billingPeriod === 'MONTHLY'
                    ? isAr
                      ? 'شهري'
                      : 'Monthly'
                    : p.billingPeriod === 'PER_SESSION'
                      ? isAr
                        ? 'حسب الحصة'
                        : 'Per Session'
                      : p.billingPeriod}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
