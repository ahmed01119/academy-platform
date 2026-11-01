'use client';

import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { SportexusLogo } from '../../components/brand/SportexusLogo';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-main)] flex flex-col items-center justify-center p-4 relative overflow-hidden animate-fade-in">
      {/* Background ambient decorative glow */}
      <div className="absolute top-1/4 start-1/2 -translate-x-1/2 w-96 h-96 bg-[var(--accent-primary)]/5 rounded-full blur-3xl pointer-events-none" />

      <main className="w-full max-w-md mx-auto text-center relative z-10">
        <div className="rounded-3xl border border-[var(--border-app)] bg-[var(--bg-surface)]/95 p-8 sm:p-10 shadow-float backdrop-blur-xl relative overflow-hidden animate-scale-up flex flex-col items-center">
          <SportexusLogo size="lg" className="mb-6" />

          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] shadow-inner">
            <WifiOff className="h-7 w-7 text-[var(--accent-primary)] animate-pulse-live" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)] mb-3">
            أنت غير متصل بالإنترنت
          </h1>
          <p className="text-sm font-semibold text-[var(--accent-primary)] mb-4">
            You are currently offline
          </p>

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4 text-xs text-[var(--text-muted)] space-y-2 mb-6 text-start">
            <p className="leading-relaxed">
              ⚡ <strong className="text-[var(--text-main)]">العمليات دون اتصال:</strong> يمكنك
              تسجيل الحضور ومسودات التقييم محلياً وسيتم المزامنة تلقائياً عند عودة الاتصال.
            </p>
            <p className="leading-relaxed text-[11px] opacity-80">
              Offline Mode: Quick attendance & evaluation drafts remain cached locally and sync when
              reconnected.
            </p>
          </div>

          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-5 py-3 text-sm font-bold text-[var(--accent-primary-fg)] shadow-sm hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-4 w-4" />
            <span>إعادة المحاولة / Retry</span>
          </button>
        </div>
      </main>
    </div>
  );
}
