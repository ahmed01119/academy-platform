'use client';

import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { useLocale } from '@/contexts/locale-context';

/**
 * Full-page frame shared by the public auth pages (forgot/reset password, verify email,
 * accept invite): public navbar + vertically centred content.
 */
export function AuthPageLayout({ children }: { children: React.ReactNode }) {
  const { locale } = useLocale();
  return (
    <div
      className="min-h-screen bg-(--bg-base) text-(--text-main) flex flex-col transition-colors overflow-x-hidden animate-fade-in"
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
    >
      <Navbar />
      <main className="flex-1 flex items-center justify-center p-3 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}

function PageLoadingLabel() {
  const { locale } = useLocale();
  return <span>{locale === 'ar' ? 'جارٍ تحميل الصفحة...' : 'Loading page...'}</span>;
}

/**
 * Suspense boundary required by Next.js for pages that read `useSearchParams()`,
 * with the shared "Loading page..." fallback.
 */
export function AuthPageSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div role="status" className="flex items-center gap-2 text-sm text-(--text-muted)">
          <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-(--accent-primary)" />
          <PageLoadingLabel />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
