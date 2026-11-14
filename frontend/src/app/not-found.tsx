import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-base)] text-[var(--text-main)] px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] text-2xl font-black">
          404
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">الصفحة غير موجودة | Page Not Found</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            عذرًا، لم نتمكن من العثور على الصفحة المطلوبة.
            <br />
            Sorry, the page you are looking for does not exist.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent-primary)] to-emerald-500 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:brightness-110 transition-all"
          >
            العودة للوحة التحكم | Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
