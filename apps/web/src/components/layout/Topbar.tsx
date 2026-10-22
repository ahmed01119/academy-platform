'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { useLocale } from '../../lib/locale-context';
import { ThemeToggle } from '../ThemeToggle';
import { LocaleToggle } from '../LocaleToggle';
import {
  Menu,
  Bell,
  Search,
  ChevronDown,
  LogOut,
  Settings,
  Sparkles,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

import type { BreadcrumbItem } from './AppShell';

interface TopbarProps {
  onOpenMobile?: () => void;
  breadcrumbs?: BreadcrumbItem[];
}

export function Topbar({ onOpenMobile, breadcrumbs: customBreadcrumbs }: TopbarProps) {
  const pathname = usePathname();
  const { user, activeTenant, logout } = useAuth();
  const { t, locale, isRtl } = useLocale();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Generate breadcrumb items from pathname if no custom breadcrumbs provided
  const pathSegments = pathname.split('/').filter(Boolean);
  const autoBreadcrumbs = pathSegments.map((segment, index) => {
    const url = `/${pathSegments.slice(0, index + 1).join('/')}`;
    let label = segment;

    // Friendly labels
    const routeMap: Record<string, string> = {
      dashboard: t('nav.dashboard', 'لوحة التحكم'),
      players: t('nav.players', 'اللاعبين'),
      groups: t('nav.groups', 'المجموعات'),
      evaluations: t('nav.evaluations', 'التقييمات'),
      sessions: t('nav.sessions', 'الحصص'),
      attendance: locale === 'ar' ? 'الحضور' : 'Attendance',
      scanner: t('nav.scanner', 'ماسح QR'),
      reports: t('nav.reports', 'تقارير الحضور'),
      branches: t('nav.branches', 'الفروع'),
      settings: t('nav.settings', 'الإعدادات'),
      platform: t('nav.platformAdmin', 'إدارة المنصة'),
      player: t('nav.playerPortal', 'بوابة اللاعب'),
      guardian: t('nav.guardianPortal', 'بوابة ولي الأمر'),
      coach: t('nav.coachWorkspace', 'مساحة المدرب'),
      new: locale === 'ar' ? 'إضافة جديد' : 'New',
    };

    if (routeMap[segment]) {
      label = routeMap[segment];
    } else if (segment.length > 20) {
      label = locale === 'ar' ? 'تفاصيل السجل' : 'Details';
    }

    return { url, label };
  });

  const roleLabels: Record<string, string> = {
    OWNER: locale === 'ar' ? 'مالك الأكاديمية' : 'Owner',
    MANAGER: locale === 'ar' ? 'مدير عام' : 'Manager',
    BRANCH_MANAGER: locale === 'ar' ? 'مدير فرع' : 'Branch Manager',
    COACH: locale === 'ar' ? 'مدرب معتمد' : 'Coach',
    RECEPTIONIST: locale === 'ar' ? 'استقبال' : 'Receptionist',
    ACCOUNTANT: locale === 'ar' ? 'محاسب' : 'Accountant',
    VIEWER: locale === 'ar' ? 'مراقب' : 'Viewer',
  };

  const isSuperAdmin = Boolean(user?.isPlatformSuperAdmin);

  const effectiveBreadcrumbs =
    customBreadcrumbs && customBreadcrumbs.length > 0
      ? customBreadcrumbs.map((c) => ({
          label: c.label,
          url: c.href || '',
        }))
      : autoBreadcrumbs;

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[var(--border-app)] bg-[var(--bg-base)]/85 px-4 backdrop-blur-md sm:px-6 transition-colors">
      {/* Left / Start: Mobile Menu Toggle & Contextual Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobile}
          className="lg:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-app)] text-[var(--text-main)] hover:bg-[var(--bg-surface)] transition-colors"
          aria-label={t('common.menu', 'القائمة')}
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumb Path */}
        <nav
          aria-label="Breadcrumb"
          className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--text-muted)] truncate"
        >
          <Link
            href="/"
            className="hover:text-[var(--text-main)] transition-colors font-medium flex items-center gap-1"
          >
            {t('common.home', 'الرئيسية')}
          </Link>
          {effectiveBreadcrumbs.map((crumb, idx) => {
            const isLast = idx === effectiveBreadcrumbs.length - 1;
            return (
              <React.Fragment key={`${crumb.label}-${idx}`}>
                <ChevronRight
                  className={`h-3 w-3 text-[var(--text-muted)] shrink-0 ${
                    isRtl ? 'rotate-180' : ''
                  }`}
                />
                {isLast || !crumb.url ? (
                  <span className="font-semibold text-[var(--text-main)] truncate max-w-[150px]">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.url}
                    className="hover:text-[var(--text-main)] transition-colors truncate max-w-[120px]"
                  >
                    {crumb.label}
                  </Link>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Right / End: Global Controls (Search, Academy, Notifications, Locale, Theme, Profile) */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Search Trigger */}
        <button
          type="button"
          onClick={() => {
            const searchInput = document.getElementById('global-page-search');
            if (searchInput) {
              searchInput.focus();
            }
          }}
          className="hidden md:flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:border-emerald-500/50 hover:text-[var(--text-main)] transition-all shadow-sm"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="text-[11px]">{t('common.searchPlaceholder', 'بحث سريع...')}</span>
          <kbd className="hidden lg:inline-flex items-center rounded bg-[var(--bg-surface-subtle)] px-1.5 py-0.5 text-[9px] font-mono text-[var(--text-muted)] border border-[var(--border-subtle)]">
            Ctrl K
          </kbd>
        </button>

        {/* Notifications Icon with Mock Badge */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:border-emerald-500/50 hover:text-[var(--text-main)] transition-colors shadow-sm"
            aria-label={t('common.notifications', 'الإشعارات')}
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 end-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          </button>

          {isNotificationsOpen && (
            <div className="absolute end-0 mt-2 w-80 rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
                <span className="font-bold text-xs text-[var(--text-main)]">
                  {t('common.notifications', 'الإشعارات')}
                </span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  {locale === 'ar' ? '2 جديد' : '2 New'}
                </span>
              </div>
              <div className="mt-2 space-y-2">
                <div className="rounded-xl bg-[var(--bg-surface-subtle)] p-2.5 text-xs space-y-1">
                  <div className="font-bold text-[11px] text-[var(--text-main)]">
                    {locale === 'ar' ? 'اكتمال الحصة التدريبية' : 'Training Session Completed'}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">
                    {locale === 'ar'
                      ? 'تم تسجيل حضور 22 لاعب في مجموعة النمور U14 بنجاح.'
                      : 'Attendance recorded for 22 players in U14 Tigers.'}
                  </div>
                </div>
                <div className="rounded-xl bg-[var(--bg-surface-subtle)] p-2.5 text-xs space-y-1">
                  <div className="font-bold text-[11px] text-[var(--text-main)]">
                    {locale === 'ar' ? 'تحديث بطاقة لاعب' : 'Player Card Rotated'}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">
                    {locale === 'ar'
                      ? 'تم تدوير رمز QR للعضوية للاعب عمر شريف.'
                      : 'Membership QR card rotated for player Omar Sherif.'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Language & Theme Controls */}
        <div className="flex items-center gap-1 border-s border-e border-[var(--border-app)] px-2">
          <LocaleToggle />
          <ThemeToggle />
        </div>

        {/* User Profile Pill / Dropdown */}
        {user ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5 ps-2 text-xs text-[var(--text-main)] hover:border-emerald-500/50 transition-all shadow-sm"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-600 text-[11px] font-bold text-white shadow-inner">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden sm:flex flex-col text-start">
                <span className="font-bold text-[11px] text-[var(--text-main)] max-w-[90px] truncate leading-tight">
                  {user.name}
                </span>
                <span className="text-[9px] text-[var(--text-muted)]">
                  {isSuperAdmin
                    ? locale === 'ar'
                      ? 'أدمن المنصة'
                      : 'Super Admin'
                    : activeTenant?.role
                      ? roleLabels[activeTenant.role] || activeTenant.role
                      : ''}
                </span>
              </div>
              <ChevronDown className="h-3 w-3 text-[var(--text-muted)]" />
            </button>

            {isProfileOpen && (
              <div className="absolute end-0 mt-2 w-56 rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2.5 py-2 border-b border-[var(--border-subtle)]">
                  <div className="font-bold text-xs text-[var(--text-main)] truncate">
                    {user.name}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] truncate">{user.email}</div>
                  {isSuperAdmin && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-500 border border-amber-500/30">
                      <ShieldAlert className="h-2.5 w-2.5" />
                      {locale === 'ar' ? 'مشرف المنصة العام' : 'Super Admin'}
                    </span>
                  )}
                </div>

                <div className="mt-1 space-y-1">
                  <Link
                    href="/settings"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-[var(--text-main)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
                  >
                    <Settings className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    <span>{t('nav.settings', 'الإعدادات')}</span>
                  </Link>

                  <button
                    type="button"
                    onClick={async () => {
                      setIsProfileOpen(false);
                      await logout();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>{t('common.logout', 'تسجيل الخروج')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-xl border border-[var(--border-app)] px-3 py-1.5 text-xs font-semibold text-[var(--text-main)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-all"
            >
              {t('common.login', 'تسجيل الدخول')}
            </Link>
            <Link
              href="/register"
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--accent-primary)] to-emerald-500 px-3 py-1.5 text-xs font-bold text-emerald-950 shadow-md shadow-emerald-500/20 hover:brightness-110 transition-all"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{t('common.register', 'تسجيل جديد')}</span>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

export default Topbar;
