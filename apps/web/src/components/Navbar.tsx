'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../lib/auth-context';
import { useLocale } from '../lib/locale-context';
import { ThemeToggle } from './ThemeToggle';
import { LocaleToggle } from './LocaleToggle';
import {
  ShieldCheck,
  Building2,
  LogOut,
  ChevronDown,
  User as UserIcon,
  Sparkles,
  LayoutDashboard,
  Users,
  GitBranch,
  Settings,
  Layers,
  CalendarCheck,
  BarChart3,
  Award,
  Globe2,
  HeartHandshake,
  UserCheck,
  QrCode,
} from 'lucide-react';

export function Navbar() {
  const { user, activeTenant, memberships, logout, switchTenant } = useAuth();
  const { t, locale } = useLocale();
  const [isTenantMenuOpen, setIsTenantMenuOpen] = useState(false);

  const roleLabels: Record<string, string> = {
    OWNER: locale === 'ar' ? 'مالك الأكاديمية' : 'Academy Owner',
    MANAGER: locale === 'ar' ? 'مدير عام' : 'General Manager',
    BRANCH_MANAGER: locale === 'ar' ? 'مدير فرع' : 'Branch Manager',
    COACH: locale === 'ar' ? 'مدرب معتمد' : 'Coach',
    RECEPTIONIST: locale === 'ar' ? 'استقبال' : 'Receptionist',
    ACCOUNTANT: locale === 'ar' ? 'محاسب' : 'Accountant',
    VIEWER: locale === 'ar' ? 'مراقب' : 'Viewer',
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

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--border-app)] bg-[var(--bg-base)]/90 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand & Nav */}
        <div className="flex items-center gap-6 lg:gap-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-[var(--accent-primary)] to-[var(--accent-hover)] shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-200">
              <ShieldCheck className="h-6 w-6 text-emerald-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-lg text-[var(--text-main)]">
                  {t('common.academyPlatform')}
                </span>
                <span className="rounded-full bg-[var(--badge-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--badge-text)] border border-[var(--badge-border)]">
                  {locale === 'ar' ? 'سحابي متكامل' : 'Cloud SaaS'}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">Academy Management Cloud</p>
            </div>
          </Link>

          {user && (
            <nav className="hidden lg:flex items-center gap-1">
              {/* Super Admin Nav */}
              {isSuperAdmin && (
                <Link
                  href="/platform"
                  id="nav-link-platform"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-all"
                >
                  <Globe2 className="h-4 w-4" />
                  <span>{t('nav.platform')}</span>
                </Link>
              )}

              {/* Coach Nav */}
              {isCoach && (
                <>
                  <Link
                    href="/coach"
                    id="nav-link-coach"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--accent-primary)] bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all"
                  >
                    <UserCheck className="h-4 w-4" />
                    <span>{t('nav.coachWorkspace')}</span>
                  </Link>
                  <Link
                    href="/evaluations"
                    id="nav-link-coach-evaluations"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-main)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-surface)] transition-all"
                  >
                    <Award className="h-4 w-4 text-[var(--accent-primary)]" />
                    <span>{t('nav.evaluations')}</span>
                  </Link>
                  <Link
                    href="/sessions"
                    id="nav-link-coach-sessions"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-main)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-surface)] transition-all"
                  >
                    <CalendarCheck className="h-4 w-4 text-[var(--accent-primary)]" />
                    <span>{t('nav.sessions')}</span>
                  </Link>
                  <Link
                    href="/attendance/scanner"
                    id="nav-link-coach-scanner"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all"
                  >
                    <QrCode className="h-4 w-4 text-emerald-400" />
                    <span>{t('nav.scanner')}</span>
                  </Link>
                </>
              )}

              {/* Academy Owner / Staff Nav */}
              {isStaffOrOwner && (
                <>
                  <Link
                    href="/dashboard"
                    id="nav-link-dashboard"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-main)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-surface)] transition-all"
                  >
                    <LayoutDashboard className="h-4 w-4 text-[var(--accent-primary)]" />
                    <span>{t('nav.home')}</span>
                  </Link>
                  <Link
                    href="/players"
                    id="nav-link-players"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-main)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-surface)] transition-all"
                  >
                    <Users className="h-4 w-4 text-[var(--accent-primary)]" />
                    <span>{t('nav.players')}</span>
                  </Link>
                  <Link
                    href="/groups"
                    id="nav-link-groups"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-main)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-surface)] transition-all"
                  >
                    <Layers className="h-4 w-4 text-[var(--accent-primary)]" />
                    <span>{t('nav.groups')}</span>
                  </Link>
                  <Link
                    href="/evaluations"
                    id="nav-link-evaluations"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-main)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-surface)] transition-all"
                  >
                    <Award className="h-4 w-4 text-[var(--accent-primary)]" />
                    <span>{t('nav.evaluations')}</span>
                  </Link>
                  <Link
                    href="/sessions"
                    id="nav-link-sessions"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-main)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-surface)] transition-all"
                  >
                    <CalendarCheck className="h-4 w-4 text-[var(--accent-primary)]" />
                    <span>{t('nav.sessions')}</span>
                  </Link>
                  <Link
                    href="/attendance/scanner"
                    id="nav-link-scanner"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all"
                  >
                    <QrCode className="h-4 w-4 text-emerald-400" />
                    <span>{t('nav.scanner')}</span>
                  </Link>
                  <Link
                    href="/attendance/reports"
                    id="nav-link-reports"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-main)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-surface)] transition-all"
                  >
                    <BarChart3 className="h-4 w-4 text-[var(--accent-primary)]" />
                    <span>{t('nav.reports')}</span>
                  </Link>
                  <Link
                    href="/branches"
                    id="nav-link-branches"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-main)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-surface)] transition-all"
                  >
                    <GitBranch className="h-4 w-4 text-[var(--accent-primary)]" />
                    <span>{t('nav.branches')}</span>
                  </Link>
                  <Link
                    href="/settings"
                    id="nav-link-settings"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-main)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-surface)] transition-all"
                  >
                    <Settings className="h-4 w-4 text-[var(--accent-primary)]" />
                    <span>{t('nav.settings')}</span>
                  </Link>
                </>
              )}

              {/* Player Portal Link */}
              {hasPlayerProfile && (
                <Link
                  href="/player"
                  id="nav-link-player-portal"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-sky-400 bg-sky-500/10 border border-sky-500/30 hover:bg-sky-500/20 transition-all"
                >
                  <UserIcon className="h-4 w-4" />
                  <span>{t('nav.playerPortal')}</span>
                </Link>
              )}

              {/* Guardian Portal Link */}
              {hasGuardianProfile && (
                <Link
                  href="/guardian"
                  id="nav-link-guardian-portal"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-purple-400 bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 transition-all"
                >
                  <HeartHandshake className="h-4 w-4" />
                  <span>{t('nav.guardianPortal')}</span>
                </Link>
              )}
            </nav>
          )}
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Controls: Locale & Theme */}
          <div className="flex items-center gap-1.5 border-e border-[var(--border-app)] pe-2 sm:pe-3">
            <LocaleToggle />
            <ThemeToggle />
          </div>

          {user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Active Academy Dropdown / Switcher */}
              {memberships.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsTenantMenuOpen(!isTenantMenuOpen)}
                    className="flex items-center gap-2 rounded-lg border border-[var(--border-app)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-main)] hover:border-emerald-500/60 transition-colors"
                  >
                    <Building2 className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                    <span className="font-medium max-w-[120px] truncate">
                      {activeTenant?.tenantName || (locale === 'ar' ? 'الأكاديمية' : 'Academy')}
                    </span>
                    <span className="rounded bg-[var(--bg-surface-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] hidden sm:inline">
                      {activeTenant?.role ? roleLabels[activeTenant.role] || activeTenant.role : ''}
                    </span>
                    <ChevronDown className="h-3 w-3 text-[var(--text-muted)]" />
                  </button>

                  {isTenantMenuOpen && (
                    <div className="absolute end-0 mt-2 w-64 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-2 py-1.5 text-xs font-medium text-[var(--text-muted)] border-b border-[var(--border-app)]">
                        {locale === 'ar' ? 'الأكاديميات المتاحة' : 'Available Academies'} ({memberships.length})
                      </div>
                      <div className="mt-1 space-y-1">
                        {memberships.map((m) => (
                          <button
                            key={m.tenantId}
                            type="button"
                            onClick={async () => {
                              setIsTenantMenuOpen(false);
                              await switchTenant(m.tenantId);
                            }}
                            className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-start text-xs transition-colors ${
                              m.tenantId === activeTenant?.tenantId
                                ? 'bg-emerald-500/20 text-[var(--accent-primary)] font-semibold'
                                : 'text-[var(--text-main)] hover:bg-[var(--bg-surface-subtle)]'
                            }`}
                          >
                            <span className="truncate">{m.tenantName}</span>
                            <span className="text-[10px] text-[var(--text-muted)]">
                              {roleLabels[m.role] || m.role}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* User badge */}
              <div className="hidden sm:flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface-subtle)] px-2.5 py-1.5 text-xs text-[var(--text-main)]">
                <UserIcon className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                <span className="font-medium truncate max-w-[100px]">{user.name}</span>
                {isSuperAdmin && (
                  <span className="rounded bg-amber-500/20 px-1 py-0.2 text-[9px] font-semibold text-amber-500 border border-amber-500/30">
                    {locale === 'ar' ? 'أدمن المنصة' : 'Super Admin'}
                  </span>
                )}
              </div>

              {/* Logout Button */}
              <button
                type="button"
                onClick={() => void logout()}
                title={t('common.logout')}
                className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-500/20 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('common.logout')}</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-lg border border-[var(--border-app)] px-3.5 py-1.5 text-xs font-medium text-[var(--text-main)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-all"
              >
                {t('common.login')}
              </Link>
              <Link
                href="/register"
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-hover)] px-3.5 py-1.5 text-xs font-semibold text-emerald-950 shadow-md shadow-emerald-500/20 hover:brightness-110 transition-all"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{t('common.register')}</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
