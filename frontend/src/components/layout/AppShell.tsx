'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AppShellProps {
  children: React.ReactNode;
  hideSidebar?: boolean;
  breadcrumbs?: BreadcrumbItem[];
}

export function AppShell({ children, hideSidebar = false, breadcrumbs }: AppShellProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    // Print: only the page content, on as many sheets as it needs (no menus, no inner scroll box cutting it off).
    <div className="h-screen flex w-full bg-(--bg-base) text-(--text-main) overflow-hidden transition-colors print:block print:h-auto print:overflow-visible print:bg-white">
      {/* Persistent Sidebar */}
      {!hideSidebar && (
        <div className="contents print:hidden">
          <React.Suspense
            fallback={<div className="w-16 shrink-0 h-full bg-[var(--bg-surface)]" />}
          >
            <Sidebar
              isMobileOpen={isMobileSidebarOpen}
              onCloseMobile={() => setIsMobileSidebarOpen(false)}
            />
          </React.Suspense>
        </div>
      )}

      {/* Main View Area with Pinned Topbar and Independent Content Scroll */}
      <div className="flex flex-1 flex-col min-w-0 h-screen overflow-hidden print:block print:h-auto print:overflow-visible">
        <div className="shrink-0 z-30 print:hidden">
          <Topbar onOpenMobile={() => setIsMobileSidebarOpen(true)} breadcrumbs={breadcrumbs} />
        </div>

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 overflow-y-auto overflow-x-hidden overscroll-y-contain focus:outline-none animate-fade-in print:max-w-none print:overflow-visible print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppShell;
