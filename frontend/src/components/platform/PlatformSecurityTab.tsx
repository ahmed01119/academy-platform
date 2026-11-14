'use client';

import React from 'react';
import { useLocale } from '@/contexts/locale-context';
import type { PlatformSecurityEvent } from '@academy/shared';
import { XCircle, ShieldAlert, AlertTriangle, ShieldCheck } from 'lucide-react';

export interface PlatformSecurityTabProps {
  securityEvents: PlatformSecurityEvent[];
}

export function PlatformSecurityTab({ securityEvents }: PlatformSecurityTabProps) {
  const { locale } = useLocale();
  const isAr = locale === 'ar';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-rose-500/20 bg-rose-500/10">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-sm font-semibold mb-1">
            <XCircle className="w-4 h-4" />
            {isAr ? 'محاولات دخول فاشلة' : 'Failed Login Attempts'}
          </div>
          <div className="text-2xl font-bold text-rose-700 dark:text-rose-300">
            {securityEvents.filter((e) => e.type === 'FAILED_LOGIN').length}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-purple-500/20 bg-purple-500/10">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 text-sm font-semibold mb-1">
            <ShieldAlert className="w-4 h-4" />
            {isAr ? 'إعادة استخدام توكن مشبوهة' : 'Suspicious Token Reuses'}
          </div>
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
            {securityEvents.filter((e) => e.type === 'SUSPICIOUS_TOKEN_REUSE').length}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm font-semibold mb-1">
            <AlertTriangle className="w-4 h-4" />
            {isAr ? 'تجاوز حدود الطلبات (Rate Limit)' : 'Rate Limit Triggers'}
          </div>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
            {securityEvents.filter((e) => e.type === 'RATE_LIMIT_TRIGGERED').length}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-blue-500/20 bg-blue-500/10">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm font-semibold mb-1">
            <ShieldCheck className="w-4 h-4" />
            {isAr ? 'جلسات أمان مسجلة' : 'Logged Security Signals'}
          </div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            {securityEvents.length}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-(--border-subtle) bg-[var(--bg-surface)] p-5 shadow-xs">
        <h3 className="font-bold text-(--text-main) mb-3 flex items-center gap-2 text-sm">
          <ShieldAlert className="w-5 h-5 text-amber-500" />
          {isAr ? 'سجل الأحداث الأمنية المباشر' : 'Live Security Operations Stream'}
        </h3>
        <div className="divide-y divide-[var(--border-subtle)]">
          {securityEvents.length === 0 ? (
            <p className="py-6 text-center text-sm text-(--text-muted)">
              {isAr
                ? 'لا توجد أحداث أمنية مشبوهة مسجلة حديثاً.'
                : 'No suspicious security signals logged.'}
            </p>
          ) : (
            securityEvents.map((evt) => (
              <div key={evt.id} className="py-3 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                        evt.severity === 'CRITICAL'
                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                          : evt.severity === 'HIGH'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                            : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                      }`}
                    >
                      {evt.severity}
                    </span>
                    <span className="font-semibold text-xs text-(--text-main) font-mono">
                      {evt.type}
                    </span>
                  </div>
                  <p className="text-sm text-(--text-main)">{evt.description}</p>
                  {evt.actorEmail && (
                    <div className="text-xs text-(--text-muted) mt-0.5 font-mono">
                      User: {evt.actorEmail} {evt.ipAddress && `| IP: ${evt.ipAddress}`}
                    </div>
                  )}
                </div>
                <div className="text-xs text-(--text-muted) whitespace-nowrap font-mono">
                  {new Date(evt.timestamp).toLocaleString(isAr ? 'ar-EG' : 'en-US')}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
