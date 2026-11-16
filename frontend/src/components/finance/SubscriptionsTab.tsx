'use client';

import { useAcademyCurrency } from '@/hooks/useAcademyCurrency';
import React, { useMemo, useState } from 'react';
import { useLocale } from '@/contexts/locale-context';
import { translateDataString } from '@/utils/data-translator';
import type { PlayerSubscriptionItem } from '@academy/shared';
import { Search, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface SubscriptionsTabProps {
  subscriptions: PlayerSubscriptionItem[];
  onCollectPayment: (sub: PlayerSubscriptionItem) => void;
}

export function SubscriptionsTab({ subscriptions, onCollectPayment }: SubscriptionsTabProps) {
  const { locale } = useLocale();
  const { label: currencyLabel } = useAcademyCurrency();
  const isAr = locale === 'ar';

  const [subSearch, setSubSearch] = useState('');
  const [subStatusFilter, setSubStatusFilter] = useState<string>('ALL');

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((sub) => {
      const q = subSearch.trim().toLowerCase();
      const matchesSearch = !q || sub.playerName.toLowerCase().includes(q);
      const matchesStatus = subStatusFilter === 'ALL' || sub.status === subStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [subscriptions, subSearch, subStatusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-(--text-main)">
            {isAr ? 'اشتراكات وعضويات اللاعبين' : 'Athlete Subscriptions & Memberships'}
          </h3>
          <p className="text-xs text-(--text-muted)">
            {isAr
              ? 'إدارة خطط اشتراكات اللاعبين، متابعة الأرصدة المتبقية، وتحصيل الرسوم.'
              : 'Manage athlete membership plans, track receivables, and collect dues.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute right-3 rtl:right-3 ltr:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-(--text-muted)" />
            <input
              type="text"
              placeholder={isAr ? 'بحث باسم اللاعب...' : 'Search athlete name...'}
              value={subSearch}
              onChange={(e) => setSubSearch(e.target.value)}
              className="rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) rtl:pr-9 rtl:pl-3 ltr:pl-9 ltr:pr-3 py-1.5 text-xs text-(--text-main) placeholder-(--text-muted) focus:border-(--accent-primary) focus:outline-none"
            />
          </div>

          <select
            value={subStatusFilter}
            onChange={(e) => setSubStatusFilter(e.target.value)}
            className="rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-3 py-1.5 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none cursor-pointer"
          >
            <option value="ALL">{isAr ? 'جميع الحالات' : 'All Statuses'}</option>
            <option value="ACTIVE">{isAr ? 'نشط ومسدد' : 'Active & Paid'}</option>
            <option value="PARTIAL">{isAr ? 'مسدد جزئياً' : 'Partially Paid'}</option>
            <option value="OVERDUE">{isAr ? 'متأخر عن السداد' : 'Overdue'}</option>
            <option value="EXPIRED">{isAr ? 'منتهي الصلاحية' : 'Expired'}</option>
          </select>
        </div>
      </div>

      {filteredSubscriptions.length === 0 ? (
        <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface) p-12 text-center text-(--text-muted) text-xs">
          {isAr
            ? 'لا يوجد اشتراكات مطابقة للبحث أو الفلتر.'
            : 'No subscriptions match search or filter.'}
        </div>
      ) : (
        <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface) overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right rtl:text-right ltr:text-left text-xs">
              <thead>
                <tr className="border-b border-(--border-subtle) bg-(--bg-surface-subtle)/50 text-(--text-muted)">
                  <th className="py-3 px-4">{isAr ? 'اللاعب' : 'Athlete'}</th>
                  <th className="py-3 px-4">{isAr ? 'الباقة التدريبية' : 'Training Plan'}</th>
                  <th className="py-3 px-4">{isAr ? 'تاريخ البداية' : 'Start Date'}</th>
                  <th className="py-3 px-4">{isAr ? 'تاريخ الاستحقاق' : 'Due Date'}</th>
                  <th className="py-3 px-4">{isAr ? 'قيمة الاشتراك' : 'Fee Amount'}</th>
                  <th className="py-3 px-4">{isAr ? 'المسدد' : 'Paid'}</th>
                  <th className="py-3 px-4">{isAr ? 'المتبقي' : 'Outstanding'}</th>
                  <th className="py-3 px-4">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="py-3 px-4 text-left rtl:text-left ltr:text-right">
                    {isAr ? 'إجراء' : 'Action'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border-subtle)">
                {filteredSubscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-(--bg-surface-subtle)/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-(--text-main)">{sub.playerName}</td>
                    <td className="py-3 px-4 text-(--text-muted)">
                      {translateDataString(
                        sub.planName || (isAr ? 'باقة مخصصة' : 'Custom Plan'),
                        locale,
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-(--text-muted)">
                      {String(sub.startDate).slice(0, 10)}
                    </td>
                    <td className="py-3 px-4 font-mono text-(--text-muted)">
                      {String(sub.dueDate).slice(0, 10)}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-(--text-main)">
                      {sub.feeAmount.toLocaleString()} {currencyLabel}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {sub.paidAmount.toLocaleString()} {currencyLabel}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold">
                      <span
                        className={
                          sub.outstandingBalance > 0 ? 'text-amber-500' : 'text-(--text-muted)'
                        }
                      >
                        {sub.outstandingBalance.toLocaleString()} {currencyLabel}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          sub.status === 'ACTIVE'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : sub.status === 'PARTIAL'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {sub.status === 'ACTIVE'
                          ? isAr
                            ? 'نشط ومسدد'
                            : 'Active & Paid'
                          : sub.status === 'PARTIAL'
                            ? isAr
                              ? 'مسدد جزئياً'
                              : 'Partially Paid'
                            : sub.status === 'OVERDUE'
                              ? isAr
                                ? 'متأخر'
                                : 'Overdue'
                              : sub.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-left rtl:text-left ltr:text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        onClick={() => onCollectPayment(sub)}
                        startIcon={<CreditCard className="h-3.5 w-3.5" />}
                      >
                        {isAr ? 'تحصيل دفعة' : 'Collect Payment'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
