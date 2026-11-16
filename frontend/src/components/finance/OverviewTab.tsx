'use client';

import { useAcademyCurrency } from '@/hooks/useAcademyCurrency';
import React, { useMemo, useState } from 'react';
import { useLocale } from '@/contexts/locale-context';
import type { AcademyFinancialDashboardMetrics, FinancialTransactionItem } from '@academy/shared';
import { CreditCard, Building2, Search, RotateCcw } from 'lucide-react';

export interface OverviewTabProps {
  metrics: AcademyFinancialDashboardMetrics | null;
  onReverseTransaction: (tx: FinancialTransactionItem) => void;
}

export function OverviewTab({ metrics, onReverseTransaction }: OverviewTabProps) {
  const { locale } = useLocale();
  const { label: currencyLabel } = useAcademyCurrency();
  const isAr = locale === 'ar';

  const [txSearch, setTxSearch] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<string>('ALL');

  const filteredTransactions = useMemo(() => {
    if (!metrics?.recentTransactions) return [];
    return metrics.recentTransactions.filter((tx) => {
      const q = txSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (tx.receiptNumber && tx.receiptNumber.toLowerCase().includes(q)) ||
        (tx.playerName && tx.playerName.toLowerCase().includes(q)) ||
        (tx.notes && tx.notes.toLowerCase().includes(q));

      const matchesType = txTypeFilter === 'ALL' || tx.type === txTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [metrics?.recentTransactions, txSearch, txTypeFilter]);

  return (
    <div className="space-y-6">
      {/* Visual Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Payment Methods Breakdown */}
        <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface) p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-(--accent-primary)" />
            <h3 className="text-sm font-bold text-(--text-main)">
              {isAr ? 'طرق الدفع المعتمدة' : 'Payment Methods Breakdown'}
            </h3>
          </div>

          <div className="space-y-3">
            {metrics &&
              Object.entries(metrics.paymentMethodBreakdown).map(([method, amount]) => {
                const total =
                  Object.values(metrics.paymentMethodBreakdown).reduce((a, b) => a + b, 0) || 1;
                const percentage = Math.round((amount / total) * 100);

                return (
                  <div key={method} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-(--text-main)">
                        {method === 'CASH'
                          ? isAr
                            ? 'نقدي (كاش)'
                            : 'Cash'
                          : method === 'POS'
                            ? isAr
                              ? 'نقاط البيع (شبكة / مدى)'
                              : 'POS / Mada'
                            : method === 'CARD'
                              ? isAr
                                ? 'بطاقة بنكية / فيزا'
                                : 'Card / Visa'
                              : method === 'BANK_TRANSFER'
                                ? isAr
                                  ? 'تحويل بنكي'
                                  : 'Bank Transfer'
                                : method}
                      </span>
                      <span className="font-mono text-(--text-muted)">
                        {amount.toLocaleString()} {currencyLabel} ({percentage}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-(--bg-surface-subtle) overflow-hidden">
                      <div
                        className="h-full rounded-full bg-(--accent-primary) transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Branch Revenue Breakdown */}
        <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface) p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-(--accent-primary)" />
            <h3 className="text-sm font-bold text-(--text-main)">
              {isAr ? 'إيرادات الفروع والملاعب' : 'Revenue by Branch & Ground'}
            </h3>
          </div>

          <div className="space-y-3">
            {metrics && Object.keys(metrics.branchRevenue).length === 0 ? (
              <p className="text-xs text-(--text-muted) py-4 text-center">
                {isAr
                  ? 'لا توجد إيرادات مسجلة بالفروع حتى الآن.'
                  : 'No revenue recorded by branches yet.'}
              </p>
            ) : (
              metrics &&
              Object.entries(metrics.branchRevenue).map(([branchName, amount]) => (
                <div
                  key={branchName}
                  className="rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) p-3 text-xs flex justify-between items-center"
                >
                  <span className="font-semibold text-(--text-main)">{branchName}</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                    {amount.toLocaleString()} {currencyLabel}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Transactions Ledger Table */}
      <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface) p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-(--text-main)">
              {isAr ? 'سجل القيود والمعاملات المالية' : 'Transactions & Ledger'}
            </h3>
            <p className="text-xs text-(--text-muted)">
              {isAr
                ? 'سجل شامل لجميع المقبوضات ومصروفات الحصص مع إمكانية عكس القيود المحاسبية.'
                : 'Comprehensive audit ledger for collections and expenses with reversal capability.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute right-3 rtl:right-3 ltr:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-(--text-muted)" />
              <input
                type="text"
                placeholder={
                  isAr ? 'بحث برقم الإيصال أو اللاعب...' : 'Search receipt or athlete...'
                }
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                className="rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) rtl:pr-9 rtl:pl-3 ltr:pl-9 ltr:pr-3 py-1.5 text-xs text-(--text-main) placeholder-(--text-muted) focus:border-(--accent-primary) focus:outline-none"
              />
            </div>

            <select
              value={txTypeFilter}
              onChange={(e) => setTxTypeFilter(e.target.value)}
              className="rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-3 py-1.5 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none cursor-pointer"
            >
              <option value="ALL">{isAr ? 'جميع الحركات' : 'All Types'}</option>
              <option value="MEMBERSHIP_FEE">{isAr ? 'رسوم اشتراك لاعب' : 'Membership Fee'}</option>
              <option value="SESSION_EXPENSE">
                {isAr ? 'مصروف حصة تشغيلي' : 'Session Expense'}
              </option>
              <option value="REGISTRATION_FEE">{isAr ? 'رسوم تسجيل' : 'Registration Fee'}</option>
            </select>
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="py-12 text-center text-(--text-muted) text-xs">
            {isAr
              ? 'لا توجد حركات مالية مطابقة للبحث أو الفلتر.'
              : 'No financial transactions match search or filter.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right rtl:text-right ltr:text-left text-xs">
              <thead>
                <tr className="border-b border-(--border-subtle) text-(--text-muted)">
                  <th className="py-2.5 px-3">{isAr ? 'رقم الإيصال' : 'Receipt No.'}</th>
                  <th className="py-2.5 px-3">{isAr ? 'التاريخ والوقت' : 'Date & Time'}</th>
                  <th className="py-2.5 px-3">
                    {isAr ? 'المستفيد / اللاعب' : 'Beneficiary / Athlete'}
                  </th>
                  <th className="py-2.5 px-3">{isAr ? 'النوع' : 'Type'}</th>
                  <th className="py-2.5 px-3">{isAr ? 'المبلغ' : 'Amount'}</th>
                  <th className="py-2.5 px-3">{isAr ? 'طريقة الدفع' : 'Payment Method'}</th>
                  <th className="py-2.5 px-3">{isAr ? 'سجل بواسطة' : 'Recorded By'}</th>
                  <th className="py-2.5 px-3">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="py-2.5 px-3 text-left rtl:text-left ltr:text-right">
                    {isAr ? 'إجراء' : 'Action'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border-subtle)">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-(--bg-surface-subtle)/50 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-(--accent-primary)">
                      {tx.receiptNumber || tx.id.slice(0, 8)}
                    </td>
                    <td className="py-3 px-3 text-(--text-muted) font-mono">
                      {new Date(tx.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-3 font-bold text-(--text-main)">
                      {tx.playerName || (isAr ? 'مصروف تشغيلي للحصة' : 'Session Expense')}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tx.type === 'MEMBERSHIP_FEE'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : tx.type === 'SESSION_EXPENSE'
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                              : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {isAr
                          ? tx.type === 'MEMBERSHIP_FEE'
                            ? 'سداد اشتراك'
                            : tx.type === 'SESSION_EXPENSE'
                              ? 'مصروف حصة'
                              : tx.type
                          : tx.type === 'MEMBERSHIP_FEE'
                            ? 'Subscription'
                            : tx.type === 'SESSION_EXPENSE'
                              ? 'Expense'
                              : tx.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-extrabold">
                      <span
                        className={
                          tx.type === 'SESSION_EXPENSE'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }
                      >
                        {tx.type === 'SESSION_EXPENSE' ? '-' : '+'}
                        {tx.amount.toLocaleString()} {currencyLabel}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-(--text-muted)">{tx.paymentMethod}</td>
                    <td className="py-3 px-3 text-(--text-muted)">
                      {tx.recordedByName || (isAr ? 'النظام' : 'System')}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tx.status === 'COMPLETED'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {tx.status === 'COMPLETED'
                          ? isAr
                            ? 'مكتمل'
                            : 'Completed'
                          : isAr
                            ? 'معكوس / ملغي'
                            : 'Reversed'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-left rtl:text-left ltr:text-right">
                      {tx.status === 'COMPLETED' && (
                        <button
                          type="button"
                          onClick={() => onReverseTransaction(tx)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer"
                          title={
                            isAr
                              ? 'إلغاء المعاملة وعكس القيد المحاسبي'
                              : 'Reverse transaction and cancel ledger'
                          }
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>{isAr ? 'عكس القيد' : 'Reverse'}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
