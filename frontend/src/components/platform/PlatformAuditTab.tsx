'use client';

import React from 'react';
import { useLocale } from '@/contexts/locale-context';
import type { PlatformAuditLogItem } from '@academy/shared';

export interface PlatformAuditTabProps {
  auditLogs: PlatformAuditLogItem[];
}

export function PlatformAuditTab({ auditLogs }: PlatformAuditTabProps) {
  const { t, locale } = useLocale();
  const isAr = locale === 'ar';

  return (
    <div className="rounded-2xl border border-(--border-subtle) bg-[var(--bg-surface)] overflow-x-auto shadow-xs">
      <table className="w-full text-sm text-start rtl:text-right ltr:text-left">
        <thead className="bg-(--bg-surface-subtle) border-b border-(--border-subtle) text-xs text-(--text-muted)">
          <tr>
            <th className="px-4 py-3">{t('common.date', isAr ? 'التاريخ' : 'Date')}</th>
            <th className="px-4 py-3">{isAr ? 'الإجراء' : 'Action'}</th>
            <th className="px-4 py-3">{isAr ? 'المستخدم المنفذ' : 'Actor'}</th>
            <th className="px-4 py-3">{isAr ? 'الأكاديمية' : 'Academy'}</th>
            <th className="px-4 py-3">{isAr ? 'الكيان المتأثر' : 'Target Entity'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {auditLogs.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-8 text-center text-(--text-muted) text-xs">
                {isAr ? 'لا توجد سجلات تدقيق' : 'No audit records'}
              </td>
            </tr>
          ) : (
            auditLogs.map((log) => (
              <tr key={log.id} className="hover:bg-(--bg-surface-subtle)/50 transition-colors">
                <td className="px-4 py-3 text-xs text-(--text-muted) font-mono whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-US')}
                </td>
                <td className="px-4 py-3 font-semibold text-xs text-(--text-main) font-mono">
                  {log.action}
                </td>
                <td className="px-4 py-3 text-xs text-(--text-main) font-mono">
                  {log.actorEmail || 'System / Anonymous'}
                </td>
                <td className="px-4 py-3 text-xs text-(--text-main)">
                  {log.tenantName || 'Platform Core'}
                </td>
                <td className="px-4 py-3 text-xs text-(--text-muted) font-mono">
                  {log.resourceType} {log.resourceId ? `(${log.resourceId.slice(0, 8)}...)` : ''}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
