'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { useLocale } from '../../lib/locale-context';
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
  Compass,
  Wallet,
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
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const SIDEBAR_COLLAPSED_KEY = 'academy_sidebar_collapsed';

export function Sidebar({ isMobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const { user, activeTenant, memberships, switchTenant, logout } = useAuth();
  const { t, locale, isRtl } = useLocale();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isTenantMenuOpen, setIsTenantMenuOpen] = useState(false);

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
  const isStaffOrOwner =
    activeTenant &&
    ['OWNER', 'MANAGER', 'BRANCH_MANAGER', 'RECEPTIONIST', 'ACCOUNTANT'].includes(
      activeTenant.role,
    );
  const hasPlayerProfile = Boolean(user?.hasPlayerProfile);
  const hasGuardianProfile = Boolean(user?.hasGuardianProfile);

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

  if (isSuperAdmin) {
    sections.push({
      title: locale === 'ar' ? 'منصة الإدارة' : 'Platform Operations',
      items: [
        {
          href: '/platform',
          label: t('nav.platformAdmin', 'إدارة المنصة'),
          icon: Compass,
          id: 'nav-platform-admin',
        },
      ],
    });
  }

  if (isStaffOrOwner) {
    sections.push({
      title: locale === 'ar' ? 'نظرة عامة' : 'Overview',
      items: [
        {
          href: '/dashboard',
          label: t('nav.dashboard', 'لوحة التحكم'),
          icon: LayoutDashboard,
          id: 'sidebar-nav-dashboard',
        },
      ],
    });

    sections.push({
      title: t('common.athletics', 'اللاعبين والفرق'),
      items: [
        {
          href: '/players',
          label: t('nav.players', 'اللاعبين والناشئين'),
          icon: Users,
          id: 'sidebar-nav-players',
        },
        {
          href: '/groups',
          label: t('nav.groups', 'المجموعات التدريبية'),
          icon: Layers,
          id: 'sidebar-nav-groups',
        },
        {
          href: '/evaluations',
          label: t('nav.evaluations', 'تقييمات الأداء'),
          icon: Award,
          id: 'sidebar-nav-evaluations',
        },
      ],
    });

    sections.push({
      title: t('common.operations', 'العمليات والتشغيل'),
      items: [
        {
          href: '/sessions',
          label: t('nav.sessions', 'الحصص التدريبية'),
          icon: CalendarCheck,
          id: 'sidebar-nav-sessions',
        },
        {
          href: '/attendance/scanner',
          label: t('nav.scanner', 'ماسح الحضور QR'),
          icon: QrCode,
          badge: locale === 'ar' ? 'مباشر' : 'Live',
          id: 'sidebar-nav-scanner',
        },
        {
          href: '/attendance/reports',
          label: t('nav.reports', 'تقارير الحضور'),
          icon: BarChart3,
          id: 'sidebar-nav-reports',
        },
        {
          href: '/branches',
          label: t('nav.branches', 'الفروع والملاعب'),
          icon: GitBranch,
          id: 'sidebar-nav-branches',
        },
        {
          href: '/finance',
          label: t('finance.title', 'العمليات المالية والاشتراكات'),
          icon: Wallet,
          id: 'sidebar-nav-finance',
        },
      ],
    });

    sections.push({
      title: t('common.administration', 'الإدارة والنظام'),
      items: [
        {
          href: '/settings',
          label: t('nav.settings', 'الإعدادات العامة'),
          icon: Settings,
          id: 'sidebar-nav-settings',
        },
      ],
    });
  } else if (isCoach) {
    sections.push({
      title: locale === 'ar' ? 'المساحة التدريبية' : 'Coach Operations',
      items: [
        {
          href: '/coach',
          label: t('nav.coachWorkspace', 'مساحة المدرب'),
          icon: LayoutDashboard,
          id: 'sidebar-nav-coach-workspace',
        },
        {
          href: '/sessions',
          label: t('nav.sessions', 'الحصص التدريبية'),
          icon: CalendarCheck,
          id: 'sidebar-nav-coach-sessions',
        },
        {
          href: '/attendance/scanner',
          label: t('nav.scanner', 'ماسح الحضور QR'),
          icon: QrCode,
          badge: locale === 'ar' ? 'مباشر' : 'Live',
          id: 'sidebar-nav-coach-scanner',
        },
        {
          href: '/evaluations',
          label: t('nav.evaluations', 'تقييمات الأداء'),
          icon: Award,
          id: 'sidebar-nav-coach-evaluations',
        },
      ],
    });
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
    <div className="flex h-full flex-col justify-between overflow-y-auto overflow-x-hidden bg-[var(--bg-surface)] border-e border-[var(--border-app)] transition-all duration-300">
      {/* Brand & Topbar */}
      <div>
        <div
          className={`flex h-16 items-center border-b border-[var(--border-app)] px-4 ${
            isCollapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          <div onClick={onCloseMobile} className="overflow-hidden">
            <SportexusLogo variant={isCollapsed ? 'symbol' : 'full'} href="/" size="sm" />
          </div>

          {/* Mobile close button */}
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="lg:hidden rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-main)] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Active Academy Switcher in Sidebar (When logged in with multiple memberships) */}
        {activeTenant && !isCollapsed && (
          <div className="px-3 py-3 border-b border-[var(--border-subtle)] relative">
            <button
              type="button"
              onClick={() => setIsTenantMenuOpen(!isTenantMenuOpen)}
              className="w-full flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-2.5 text-xs text-[var(--text-main)] hover:border-emerald-500/50 transition-all text-start"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--badge-bg)] text-[var(--accent-primary)] font-bold">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold truncate text-[11px] text-[var(--text-main)]">
                    {activeTenant.tenantName}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] truncate">
                    {activeTenant.role ? roleLabels[activeTenant.role] || activeTenant.role : ''}
                  </div>
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
            </button>

            {isTenantMenuOpen && memberships.length > 0 && (
              <div className="absolute start-3 end-3 top-full mt-1 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2 py-1 text-[10px] font-semibold text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
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
                          ? 'bg-emerald-500/15 text-[var(--accent-primary)] font-bold'
                          : 'text-[var(--text-main)] hover:bg-[var(--bg-surface-subtle)]'
                      }`}
                    >
                      <span className="truncate text-[11px]">{m.tenantName}</span>
                      <span className="text-[9px] text-[var(--text-muted)]">
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
                <div className="px-2.5 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] opacity-80">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' &&
                    item.href !== '/' &&
                    item.href !== '/platform' &&
                    pathname.startsWith(item.href));
                const IconComponent = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    id={item.id}
                    onClick={onCloseMobile}
                    title={isCollapsed ? item.label : undefined}
                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-[var(--accent-primary)] text-white shadow-md shadow-emerald-600/25'
                        : 'text-[var(--text-main)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--accent-primary)]'
                    } ${isCollapsed ? 'justify-center px-2' : ''}`}
                  >
                    <IconComponent
                      className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 ${
                        isActive
                          ? 'text-white'
                          : 'text-[var(--text-muted)] group-hover:text-[var(--accent-primary)]'
                      }`}
                    />
                    {!isCollapsed && (
                      <span className="truncate flex-1 text-[12px]">{item.label}</span>
                    )}
                    {!isCollapsed && item.badge && (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-extrabold text-emerald-300 border border-emerald-500/30">
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

      {/* Footer Controls: User Card & Collapse Toggle */}
      <div className="p-3 border-t border-[var(--border-app)] space-y-2">
        {user ? (
          <div
            className={`flex items-center gap-2.5 rounded-xl bg-[var(--bg-surface-subtle)] p-2 ${
              isCollapsed ? 'justify-center' : 'justify-between'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-600 to-teal-700 text-xs font-bold text-white shadow-inner">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-[var(--text-main)] truncate">
                    {user.name}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] truncate">{user.email}</div>
                </div>
              )}
            </div>

            {!isCollapsed && (
              <button
                type="button"
                onClick={() => void logout()}
                title={t('common.logout')}
                className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
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
              className="flex w-full items-center justify-center rounded-xl border border-[var(--border-app)] px-3 py-2 text-xs font-semibold text-[var(--text-main)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-all"
            >
              {t('common.login')}
            </Link>
          </div>
        )}

        {/* Desktop Collapse Toggle */}
        <div className="hidden lg:flex items-center justify-end pt-1">
          <button
            type="button"
            onClick={toggleCollapsed}
            title={isCollapsed ? t('common.expand') : t('common.collapse')}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-main)] transition-colors"
          >
            <CollapseIcon className="h-4 w-4" />
          </button>
        </div>
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
