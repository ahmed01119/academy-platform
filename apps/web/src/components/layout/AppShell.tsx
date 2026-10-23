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

export function AppShell({
  children,
  hideSidebar = false,
  breadcrumbs,
}: AppShellProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="h-screen flex w-full bg-[var(--bg-base)] text-[var(--text-main)] overflow-hidden transition-colors">
      {/* Persistent Sidebar */}
      {!hideSidebar && (
        <Sidebar
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Main View Area with Pinned Topbar and Independent Content Scroll */}
      <div className="flex flex-1 flex-col min-w-0 h-screen overflow-hidden">
        <div className="shrink-0 z-30">
          <Topbar
            onOpenMobile={() => setIsMobileSidebarOpen(true)}
            breadcrumbs={breadcrumbs}
          />
        </div>

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 overflow-y-auto overscroll-y-contain focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppShell;
