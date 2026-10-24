'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { useLocale } from '../../lib/locale-context';
import { ThemeToggle } from '../ThemeToggle';
import { LocaleToggle } from '../LocaleToggle';
import { CommandPalette } from '../CommandPalette';
import api from '../../lib/api-client';
import type { AppNotificationItem } from '@academy/shared';
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
  CheckCheck,
} from 'lucide-react';

import type { BreadcrumbItem } from './AppShell';

interface TopbarProps {
  onOpenMobile?: () => void;
  breadcrumbs?: BreadcrumbItem[];
}

export function Topbar({ onOpenMobile, breadcrumbs: customBreadcrumbs }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, activeTenant, logout } = useAuth();
  const { t, locale, isRtl } = useLocale();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  // Listen for open-command-palette event from global shortcut
  useEffect(() => {
    const handleOpen = () => setIsCommandPaletteOpen(true);
    window.addEventListener('open-command-palette', handleOpen);
    return () => window.removeEventListener('open-command-palette', handleOpen);
  }, []);

  // Poll for unread count
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    const fetchCount = async () => {
      try {
        const res = await api.notifications.getUnreadCount();
        if (mounted) setUnreadCount(res.unreadCount);
      } catch {
        // ignore
      }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [user]);

  // Fetch full notifications list when opened
  useEffect(() => {
    if (!isNotificationsOpen || !user) return;
    setIsLoadingNotifications(true);
    api.notifications
      .list({ limit: 8 })
      .then((res) => {
        setNotifications(res.items);
        setUnreadCount(res.unreadCount);
      })
      .catch(() => {})
      .finally(() => setIsLoadingNotifications(false));
  }, [isNotificationsOpen, user]);

  const handleMarkAllRead = async () => {
    try {
      await api.notifications.markAllRead();
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date().toISOString() })),
      );
    } catch {
      // ignore
    }
  };

  const handleNotificationClick = async (item: AppNotificationItem) => {
    const isRead = Boolean(item.readAt);
    if (!isRead) {
      try {
        await api.notifications.markRead(item.id);
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n,
          ),
        );
      } catch {
        // ignore
      }
    }
    setIsNotificationsOpen(false);
    if (item.href) {
      router.push(item.href);
    }
  };

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

  const isSuperAdmin = Boolean(user?.isPlatformSuperAdmin || user?.isPlatformOwner);

  const effectiveBreadcrumbs =
    customBreadcrumbs && customBreadcrumbs.length > 0
      ? customBreadcrumbs.map((c) => ({
          label: c.label,
          url: c.href || '',
        }))
      : autoBreadcrumbs;

  return (
    <>
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />

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
            onClick={() => setIsCommandPaletteOpen(true)}
            className="hidden md:flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:border-emerald-500/50 hover:text-[var(--text-main)] transition-all shadow-sm"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="text-[11px]">{t('common.searchPlaceholder', 'بحث سريع...')}</span>
            <kbd className="hidden lg:inline-flex items-center rounded bg-[var(--bg-surface-subtle)] px-1.5 py-0.5 text-[9px] font-mono text-[var(--text-muted)] border border-[var(--border-subtle)]">
              Ctrl K
            </kbd>
          </button>

          {/* Notifications Icon with Real Badge */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:border-emerald-500/50 hover:text-[var(--text-main)] transition-colors shadow-sm"
              aria-label={t('common.notifications', 'الإشعارات')}
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -end-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white shadow-sm">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {isNotificationsOpen && (
              <div className="absolute end-0 mt-2 w-80 sm:w-96 rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[var(--text-main)]">
                      {t('common.notifications', 'الإشعارات')}
                    </span>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                        {unreadCount} {locale === 'ar' ? 'جديد' : 'New'}
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
                    >
                      <CheckCheck className="w-3 h-3" />
                      {locale === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all read'}
                    </button>
                  )}
                </div>

                <div className="mt-2 space-y-1.5 max-h-[350px] overflow-y-auto">
                  {isLoadingNotifications ? (
                    <div className="py-6 text-center text-xs text-[var(--text-muted)]">
                      {locale === 'ar' ? 'جاري تحميل الإشعارات...' : 'Loading notifications...'}
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                      {locale === 'ar' ? 'لا توجد إشعارات حالياً' : 'No notifications yet'}
                    </div>
                  ) : (
                    notifications.map((item) => {
                      const isRead = Boolean(item.readAt);
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleNotificationClick(item)}
                          className={`rounded-xl p-2.5 text-xs space-y-1 cursor-pointer transition-colors ${
                            !isRead
                              ? 'bg-emerald-500/10 border border-emerald-500/20'
                              : 'bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-surface-subtle)]/80'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-bold text-[11px] text-[var(--text-main)] leading-tight">
                              {item.title}
                            </div>
                            {!isRead && (
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0 mt-1" />
                            )}
                          </div>
                        <div className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                          {item.body}
                        </div>
                        <div className="text-[9px] text-[var(--text-muted)]/70 pt-0.5">
                          {new Date(item.createdAt).toLocaleDateString(
                            locale === 'ar' ? 'ar-EG' : 'en-US',
                            {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            },
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
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
    </>
  );
}

export default Topbar;
