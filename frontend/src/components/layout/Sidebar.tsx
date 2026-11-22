'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useLocale } from '@/contexts/locale-context';
import { Permission } from '@academy/shared';
import { canAll, canAny } from '@/lib/auth/permissions';
import { SportexusLogo } from '../brand/SportexusLogo';
import {
  LayoutDashboard,
  Users,
  Layers,
  Award,
  CalendarCheck,
  BarChart3,
  QrCode,
  GitBranch,
  Settings,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  HeartHandshake,
  LogOut,
  Building2,
  ChevronDown,
  X,
  Wallet,
  Inbox,
  Database,
  Crown,
  ShieldCheck,
  ShieldAlert,
  Activity,
} from 'lucide-react';

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  id: string;
  /** Shown only to users holding at least one of these permissions (lib/auth/permissions.ts). */
  anyOf?: readonly Permission[];
  /** Shown only to users holding all of these permissions (same rule as the page's PAGE_ACCESS). */
  allOf?: readonly Permission[];
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const SIDEBAR_COLLAPSED_KEY = 'academy_sidebar_collapsed';

export function Sidebar({ isMobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') || 'academies';
  const { user, activeTenant, memberships, switchTenant, logout } = useAuth();
  const { t, locale, isRtl } = useLocale();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isTenantMenuOpen, setIsTenantMenuOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname, searchParams]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (saved !== null) {
        setIsCollapsed(saved === 'true');
      }
    } catch {
      // Storage access ignored
    }
  }, []);

  const toggleCollapsed = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
    } catch {
      // Storage access ignored
    }
  };

  const isSuperAdmin = Boolean(user?.isPlatformSuperAdmin);
  const isCoach = activeTenant?.role === 'COACH';
  // Academy members of any role (incl. VIEWER) get the academy menu; what each item shows follows the permission
  // matrix, so nobody sees a page their role cannot use. The API enforces the same permissions.
  const isAcademyMember = Boolean(activeTenant && activeTenant.status === 'ACTIVE');
  const hasPlayerProfile = Boolean(user?.hasPlayerProfile);
  const hasGuardianProfile = Boolean(user?.hasGuardianProfile);
  const visible = (item: NavItem) =>
    (!item.anyOf || canAny(user, activeTenant, item.anyOf)) &&
    (!item.allOf || canAll(user, activeTenant, item.allOf));

  // Role labels
  const roleLabels: Record<string, string> = {
    OWNER: locale === 'ar' ? 'مالك الأكاديمية' : 'Academy Owner',
    MANAGER: locale === 'ar' ? 'مدير عام' : 'General Manager',
    BRANCH_MANAGER: locale === 'ar' ? 'مدير فرع' : 'Branch Manager',
    COACH: locale === 'ar' ? 'مدرب معتمد' : 'Coach',
    RECEPTIONIST: locale === 'ar' ? 'استقبال' : 'Receptionist',
    ACCOUNTANT: locale === 'ar' ? 'محاسب' : 'Accountant',
    VIEWER: locale === 'ar' ? 'مراقب' : 'Viewer',
  };

  // Build role-specific navigation sections
  const sections: NavSection[] = [];
  const pushSection = (title: string, items: NavItem[]) => {
    const shown = items.filter(visible);
    if (shown.length > 0) sections.push({ title, items: shown });
  };

  // Overview first: the coach workspace for coaches, the dashboard for everyone else in the academy.
  if (isSuperAdmin || (isAcademyMember && !isCoach)) {
    pushSection(locale === 'ar' ? 'نظرة عامة' : 'Overview', [
      {
        href: '/dashboard',
        label: t('nav.dashboard', 'لوحة التحكم'),
        icon: LayoutDashboard,
        id: 'sidebar-nav-dashboard',
      },
    ]);
  }
  if (isCoach) {
    pushSection(locale === 'ar' ? 'المساحة التدريبية' : 'Coach Operations', [
      {
        href: '/coach',
        label: t('nav.coachWorkspace', 'مساحة المدرب'),
        icon: LayoutDashboard,
        id: 'sidebar-nav-coach-workspace',
      },
    ]);
  }

  if (isSuperAdmin) {
    pushSection(locale === 'ar' ? 'إدارة المنصة المركزية' : 'Platform Operations', [
      {
        href: '/platform?tab=academies',
        label: locale === 'ar' ? 'سجل الأكاديميات' : 'Academies Registry',
        icon: Building2,
        id: 'sidebar-nav-platform-academies',
      },
      {
        href: '/platform?tab=applications',
        label: locale === 'ar' ? 'طلبات التأسيس' : 'Applications',
        icon: Inbox,
        id: 'sidebar-nav-platform-applications',
      },
      {
        href: '/platform?tab=users',
        label: locale === 'ar' ? 'المستخدمين والجلسات' : 'Users & Sessions',
        icon: Users,
        id: 'sidebar-nav-platform-users',
      },
      {
        href: '/platform?tab=plans',
        label: locale === 'ar' ? 'باقات الاشتراك (SaaS)' : 'SaaS Plans',
        icon: Layers,
        id: 'sidebar-nav-platform-plans',
      },
      {
        href: '/platform?tab=payouts',
        label: locale === 'ar' ? 'تحويلات الأكاديميات' : 'Academy Payouts',
        icon: Wallet,
        id: 'sidebar-nav-platform-payouts',
      },
      {
        href: '/platform?tab=storage',
        label: locale === 'ar' ? 'التخزين والبيانات' : 'Storage & Lifecycle',
        icon: Database,
        id: 'sidebar-nav-platform-storage',
      },
      {
        href: '/platform?tab=coowner',
        label: locale === 'ar' ? 'ملكية المنصة والشركاء' : 'Platform Ownership',
        icon: Crown,
        id: 'sidebar-nav-platform-coowner',
      },
      {
        href: '/platform?tab=governance',
        label: locale === 'ar' ? 'حوكمة النظام المركزي' : 'Governance',
        icon: ShieldCheck,
        id: 'sidebar-nav-platform-governance',
      },
      {
        href: '/platform?tab=security',
        label: locale === 'ar' ? 'الأمان والحماية' : 'Platform Security',
        icon: ShieldAlert,
        id: 'sidebar-nav-platform-security',
      },
      {
        href: '/platform?tab=audit',
        label: locale === 'ar' ? 'سجلات المراجعة' : 'Audit Logs',
        icon: Activity,
        id: 'sidebar-nav-platform-audit',
      },
    ]);
  }

  if (isAcademyMember) {
    pushSection(t('common.athletics', 'اللاعبين والفرق'), [
      {
        href: '/players',
        label: t('nav.players', 'اللاعبين والناشئين'),
        icon: Users,
        id: 'sidebar-nav-players',
        anyOf: [Permission.PLAYERS_READ],
      },
      {
        href: '/groups',
        label: t('nav.groups', 'المجموعات التدريبية'),
        icon: Layers,
        id: 'sidebar-nav-groups',
        anyOf: [Permission.GROUPS_READ],
      },
      {
        href: '/evaluations',
        label: t('nav.evaluations', 'تقييمات الأداء'),
        icon: Award,
        id: 'sidebar-nav-evaluations',
        anyOf: [Permission.EVALUATIONS_READ],
      },
    ]);

    pushSection(t('common.operations', 'العمليات والتشغيل'), [
      {
        href: '/sessions',
        label: t('nav.sessions', 'الحصص التدريبية'),
        icon: CalendarCheck,
        id: 'sidebar-nav-sessions',
        anyOf: [Permission.SESSIONS_READ],
      },
      {
        href: '/attendance/scanner',
        label: t('nav.scanner', 'ماسح الحضور QR'),
        icon: QrCode,
        badge: locale === 'ar' ? 'مباشر' : 'Live',
        id: 'sidebar-nav-scanner',
        anyOf: [Permission.ATTENDANCE_MARK],
      },
      {
        href: '/attendance/reports',
        label: t('nav.reports', 'تقارير الحضور'),
        icon: BarChart3,
        id: 'sidebar-nav-reports',
        // The report endpoint needs reports.read; the page itself is attendance data (and loads groups).
        allOf: [Permission.ATTENDANCE_READ, Permission.REPORTS_READ],
      },
      {
        href: '/branches',
        label: t('nav.branches', 'الفروع والملاعب'),
        icon: GitBranch,
        id: 'sidebar-nav-branches',
        anyOf: [Permission.BRANCHES_READ],
      },
      {
        href: '/finance',
        label: t('finance.title', 'العمليات المالية والاشتراكات'),
        icon: Wallet,
        id: 'sidebar-nav-finance',
        // Every panel on /finance is loaded from payments.read endpoints.
        anyOf: [Permission.PAYMENTS_READ],
      },
    ]);

    if (!isCoach) {
      pushSection(t('common.administration', 'الإدارة والنظام'), [
        {
          href: '/settings',
          label: t('nav.settings', 'الإعدادات العامة'),
          icon: Settings,
          id: 'sidebar-nav-settings',
        },
      ]);
    }
  }

  // Cross-role portals for players and guardians
  const portalItems: NavItem[] = [];
  if (hasPlayerProfile) {
    portalItems.push({
      href: '/player',
      label: t('nav.playerPortal', 'بوابة اللاعب'),
      icon: UserIcon,
      id: 'sidebar-nav-player-portal',
    });
  }
  if (hasGuardianProfile) {
    portalItems.push({
      href: '/guardian',
      label: t('nav.guardianPortal', 'بوابة ولي الأمر'),
      icon: HeartHandshake,
      id: 'sidebar-nav-guardian-portal',
    });
  }

  if (portalItems.length > 0) {
    sections.push({
      title: locale === 'ar' ? 'البوابات المخصصة' : 'Member Portals',
      items: portalItems,
    });
  }

  const CollapseIcon = isRtl
    ? isCollapsed
      ? ChevronLeft
      : ChevronRight
    : isCollapsed
      ? ChevronRight
      : ChevronLeft;

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between overflow-y-auto overflow-x-hidden bg-(--bg-surface) border-e border-(--border-app) transition-all duration-300">
      {/* Brand & Topbar */}
      <div>
        <div
          className={`flex h-16 items-center border-b border-(--border-app) px-4 ${
            isCollapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          <div onClick={onCloseMobile} className="overflow-hidden">
            <SportexusLogo variant={isCollapsed ? 'symbol' : 'full'} href="/dashboard" size="sm" />
          </div>

          {/* Mobile close button */}
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="lg:hidden rounded-lg p-1.5 text-(--text-muted) hover:bg-(--bg-surface-subtle) hover:text-(--text-main) transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Active Academy Switcher in Sidebar (When logged in with multiple memberships) */}
        {activeTenant && !isCollapsed && (
          <div className="px-3 py-3 border-b border-(--border-subtle) relative">
            <button
              type="button"
              onClick={() => setIsTenantMenuOpen(!isTenantMenuOpen)}
              className="w-full flex items-center justify-between rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) p-2.5 text-xs text-(--text-main) hover:border-emerald-500/50 transition-all text-start"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-(--badge-bg) text-(--accent-primary) font-bold">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold truncate text-[11px] text-(--text-main)">
                    {activeTenant.tenantName}
                  </div>
                  <div className="text-[10px] text-(--text-muted) truncate">
                    {activeTenant.role ? roleLabels[activeTenant.role] || activeTenant.role : ''}
                  </div>
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-(--text-muted) shrink-0" />
            </button>

            {isTenantMenuOpen && memberships.length > 0 && (
              <div className="absolute inset-s-3 inset-e-3 top-full mt-1 rounded-xl border border-(--border-app) bg-(--bg-surface) p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2 py-1 text-[10px] font-semibold text-(--text-muted) border-b border-(--border-subtle)">
                  {locale === 'ar' ? 'الأكاديميات المتاحة' : 'Available Academies'}
                </div>
                <div className="mt-1 space-y-0.5 max-h-48 overflow-y-auto">
                  {memberships.map((m) => (
                    <button
                      key={m.tenantId}
                      type="button"
                      onClick={async () => {
                        setIsTenantMenuOpen(false);
                        await switchTenant(m.tenantId);
                      }}
                      className={`w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-xs text-start transition-colors ${
                        m.tenantId === activeTenant.tenantId
                          ? 'bg-emerald-500/15 text-(--accent-primary) font-bold'
                          : 'text-(--text-main) hover:bg-(--bg-surface-subtle)'
                      }`}
                    >
                      <span className="truncate text-[11px]">{m.tenantName}</span>
                      <span className="text-[9px] text-(--text-muted)">
                        {roleLabels[m.role] || m.role}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation Groups */}
        <nav className="p-3 space-y-5">
          {sections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              {!isCollapsed && section.title && (
                <div className="px-2.5 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-(--text-muted) opacity-80">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => {
                const isNavActive =
                  pathname === '/platform' && item.href.startsWith('/platform')
                    ? item.href.includes(`tab=${currentTab}`) ||
                      (item.href === '/platform' && currentTab === 'academies')
                    : pathname === item.href ||
                      (!item.href.includes('?') &&
                        item.href !== '/dashboard' &&
                        item.href !== '/' &&
                        item.href !== '/platform' &&
                        pathname.startsWith(item.href));
                const isPending = pendingHref === item.href;
                const isActive = isPending || isNavActive;
                const IconComponent = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    id={item.id}
                    prefetch={true}
                    scroll={false}
                    onClick={() => {
                      if (!isNavActive) {
                        setPendingHref(item.href);
                      }
                      if (onCloseMobile) {
                        onCloseMobile();
                      }
                    }}
                    title={isCollapsed ? item.label : undefined}
                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-(--accent-primary) text-(--accent-primary-fg) font-bold shadow-sm'
                        : 'text-(--text-main) hover:bg-(--bg-surface-subtle) hover:text-(--accent-primary)'
                    } ${isCollapsed ? 'justify-center px-2' : ''} ${isPending ? 'opacity-90 ring-2 ring-(--accent-primary)/40 ring-offset-1' : ''}`}
                  >
                    <IconComponent
                      className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 ${
                        isActive
                          ? 'text-(--accent-primary-fg)'
                          : 'text-(--text-muted) group-hover:text-(--accent-primary)'
                      }`}
                    />
                    {!isCollapsed && (
                      <span className="truncate flex-1 text-[12px]">{item.label}</span>
                    )}
                    {!isCollapsed && item.badge && (
                      <span className="rounded-full bg-(--badge-bg) px-2 py-0.5 text-[9px] font-extrabold text-(--badge-fg) border border-(--badge-border)">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Footer Controls: Collapse Toggle Above, User Card & Logout At Very Bottom */}
      <div className="p-3 border-t border-(--border-app) space-y-2">
        {/* Desktop Collapse Toggle - Placed above the user/logout row */}
        <div
          className={`hidden lg:flex items-center ${isCollapsed ? 'justify-center' : 'justify-end'} pb-0.5`}
        >
          <button
            type="button"
            onClick={toggleCollapsed}
            title={isCollapsed ? t('common.expand') : t('common.collapse')}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-(--border-subtle) text-(--text-muted) hover:bg-(--bg-surface-subtle) hover:text-(--text-main) transition-colors cursor-pointer"
          >
            <CollapseIcon className="h-4 w-4" />
          </button>
        </div>

        {/* User Card with Logout Button at the bottom */}
        {user ? (
          <div
            className={`flex items-center gap-2.5 rounded-xl bg-(--bg-surface-subtle) p-2 ${
              isCollapsed ? 'justify-center' : 'justify-between'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-emerald-600 to-teal-700 text-xs font-bold text-white shadow-inner">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-(--text-main) truncate">{user.name}</div>
                  <div className="text-[10px] text-(--text-muted) truncate">{user.email}</div>
                </div>
              )}
            </div>

            {!isCollapsed && (
              <button
                type="button"
                onClick={() => void logout()}
                title={t('common.logout')}
                className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/10 hover:text-rose-500 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <Link
              href="/login"
              onClick={onCloseMobile}
              className="flex w-full items-center justify-center rounded-xl border border-(--border-app) px-3 py-2 text-xs font-semibold text-(--text-main) hover:border-(--accent-primary) hover:text-(--accent-primary) transition-all"
            >
              {t('common.login')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 h-screen sticky top-0 z-40 transition-all duration-300 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Backdrop & Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />

          {/* Drawer content */}
          <div
            className={`fixed inset-y-0 ${
              isRtl ? 'right-0' : 'left-0'
            } w-72 max-w-[85vw] shadow-2xl z-50 animate-in slide-in-from-${
              isRtl ? 'right' : 'left'
            } duration-200`}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

export default Sidebar;
