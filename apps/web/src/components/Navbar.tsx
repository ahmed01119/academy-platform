'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../lib/auth-context';
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
} from 'lucide-react';

const ROLE_LABELS_AR: Record<string, string> = {
  OWNER: 'مالك الأكاديمية',
  MANAGER: 'مدير عام',
  BRANCH_MANAGER: 'مدير فرع',
  COACH: 'مدرب معتمد',
  RECEPTIONIST: 'استقبال',
  ACCOUNTANT: 'محاسب',
  VIEWER: 'مراقب',
};

export function Navbar() {
  const { user, activeTenant, memberships, logout, switchTenant } = useAuth();
  const [isTenantMenuOpen, setIsTenantMenuOpen] = useState(false);

  const isSuperAdmin = Boolean(user?.isPlatformSuperAdmin);
  const isCoach = activeTenant?.role === 'COACH';
  const isStaffOrOwner = activeTenant && ['OWNER', 'MANAGER', 'BRANCH_MANAGER', 'RECEPTIONIST'].includes(activeTenant.role);
  const hasPlayerProfile = Boolean(user?.hasPlayerProfile);
  const hasGuardianProfile = Boolean(user?.hasGuardianProfile);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#234235] bg-[#0f1c18]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand & Nav */}
        <div className="flex items-center gap-6 lg:gap-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-[#2f9e6b] to-[#45c387] shadow-lg shadow-[#2f9e6b]/20 group-hover:scale-105 transition-transform duration-200">
              <ShieldCheck className="h-6 w-6 text-[#062016]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-lg text-white">منصة الأكاديمية</span>
                <span className="rounded-full bg-[#2f9e6b]/20 px-2 py-0.5 text-xs font-semibold text-[#45c387] border border-[#2f9e6b]/40">
                  سحابي متكامل
                </span>
              </div>
              <p className="text-xs text-[#9bb5a8]">Academy Management Cloud</p>
            </div>
          </Link>

          {user && (
            <nav className="hidden lg:flex items-center gap-1">
              {/* Super Admin Nav */}
              {isSuperAdmin && (
                <Link
                  href="/platform"
                  id="nav-link-platform"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#f59e0b] bg-[#f59e0b]/10 border border-[#f59e0b]/30 hover:bg-[#f59e0b]/20 transition-all"
                >
                  <Globe2 className="h-4 w-4" />
                  <span>إدارة المنصة</span>
                </Link>
              )}

              {/* Coach Nav */}
              {isCoach && (
                <>
                  <Link
                    href="/coach"
                    id="nav-link-coach"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#45c387] bg-[#2f9e6b]/15 border border-[#2f9e6b]/30 hover:bg-[#2f9e6b]/25 transition-all"
                  >
                    <UserCheck className="h-4 w-4" />
                    <span>مساحة المدرب</span>
                  </Link>
                  <Link
                    href="/evaluations"
                    id="nav-link-coach-evaluations"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#e8f0ec] hover:text-[#45c387] hover:bg-[#162821] transition-all"
                  >
                    <Award className="h-4 w-4 text-[#2f9e6b]" />
                    <span>التقييمات والأداء</span>
                  </Link>
                  <Link
                    href="/sessions"
                    id="nav-link-coach-sessions"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#e8f0ec] hover:text-[#45c387] hover:bg-[#162821] transition-all"
                  >
                    <CalendarCheck className="h-4 w-4 text-[#2f9e6b]" />
                    <span>الحصص والتحضير</span>
                  </Link>
                </>
              )}

              {/* Academy Owner / Staff Nav */}
              {isStaffOrOwner && (
                <>
                  <Link
                    href="/dashboard"
                    id="nav-link-dashboard"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#e8f0ec] hover:text-[#45c387] hover:bg-[#162821] transition-all"
                  >
                    <LayoutDashboard className="h-4 w-4 text-[#2f9e6b]" />
                    <span>الرئيسية</span>
                  </Link>
                  <Link
                    href="/players"
                    id="nav-link-players"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#e8f0ec] hover:text-[#45c387] hover:bg-[#162821] transition-all"
                  >
                    <Users className="h-4 w-4 text-[#2f9e6b]" />
                    <span>اللاعبين</span>
                  </Link>
                  <Link
                    href="/groups"
                    id="nav-link-groups"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#e8f0ec] hover:text-[#45c387] hover:bg-[#162821] transition-all"
                  >
                    <Layers className="h-4 w-4 text-[#2f9e6b]" />
                    <span>المجموعات</span>
                  </Link>
                  <Link
                    href="/evaluations"
                    id="nav-link-evaluations"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#e8f0ec] hover:text-[#45c387] hover:bg-[#162821] transition-all"
                  >
                    <Award className="h-4 w-4 text-[#2f9e6b]" />
                    <span>تقييمات الأداء</span>
                  </Link>
                  <Link
                    href="/sessions"
                    id="nav-link-sessions"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#e8f0ec] hover:text-[#45c387] hover:bg-[#162821] transition-all"
                  >
                    <CalendarCheck className="h-4 w-4 text-[#2f9e6b]" />
                    <span>الحصص</span>
                  </Link>
                  <Link
                    href="/attendance/reports"
                    id="nav-link-reports"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#e8f0ec] hover:text-[#45c387] hover:bg-[#162821] transition-all"
                  >
                    <BarChart3 className="h-4 w-4 text-[#2f9e6b]" />
                    <span>التقارير</span>
                  </Link>
                  <Link
                    href="/branches"
                    id="nav-link-branches"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#e8f0ec] hover:text-[#45c387] hover:bg-[#162821] transition-all"
                  >
                    <GitBranch className="h-4 w-4 text-[#2f9e6b]" />
                    <span>الفروع</span>
                  </Link>
                  <Link
                    href="/settings"
                    id="nav-link-settings"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#e8f0ec] hover:text-[#45c387] hover:bg-[#162821] transition-all"
                  >
                    <Settings className="h-4 w-4 text-[#2f9e6b]" />
                    <span>الإعدادات</span>
                  </Link>
                </>
              )}

              {/* Player Portal Link */}
              {hasPlayerProfile && (
                <Link
                  href="/player"
                  id="nav-link-player-portal"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#38bdf8] bg-[#38bdf8]/10 border border-[#38bdf8]/30 hover:bg-[#38bdf8]/20 transition-all"
                >
                  <UserIcon className="h-4 w-4" />
                  <span>بوابة اللاعب</span>
                </Link>
              )}

              {/* Guardian Portal Link */}
              {hasGuardianProfile && (
                <Link
                  href="/guardian"
                  id="nav-link-guardian-portal"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#a855f7] bg-[#a855f7]/10 border border-[#a855f7]/30 hover:bg-[#a855f7]/20 transition-all"
                >
                  <HeartHandshake className="h-4 w-4" />
                  <span>بوابة ولي الأمر</span>
                </Link>
              )}
            </nav>
          )}
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              {/* Active Academy Dropdown / Switcher (only for users with tenant memberships) */}
              {memberships.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsTenantMenuOpen(!isTenantMenuOpen)}
                    className="flex items-center gap-2 rounded-lg border border-[#2b4c3e] bg-[#162821] px-3 py-1.5 text-sm text-[#e8f0ec] hover:border-[#2f9e6b]/60 transition-colors"
                  >
                    <Building2 className="h-4 w-4 text-[#2f9e6b]" />
                    <span className="font-medium max-w-[140px] truncate">
                      {activeTenant?.tenantName || 'الأكاديمية'}
                    </span>
                    <span className="rounded bg-[#234235] px-1.5 py-0.5 text-[11px] text-[#9bb5a8]">
                      {activeTenant?.role
                        ? ROLE_LABELS_AR[activeTenant.role] || activeTenant.role
                        : ''}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-[#9bb5a8]" />
                  </button>

                  {isTenantMenuOpen && (
                    <div className="absolute left-0 mt-2 w-64 rounded-xl border border-[#2b4c3e] bg-[#162821] p-2 shadow-2xl shadow-black/60 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-2 py-1.5 text-xs font-medium text-[#9bb5a8] border-b border-[#234235]">
                        الأكاديميات المتاحة ({memberships.length})
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
                            className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-right text-xs transition-colors ${
                              m.tenantId === activeTenant?.tenantId
                                ? 'bg-[#2f9e6b]/20 text-[#45c387] font-semibold'
                                : 'text-[#e8f0ec] hover:bg-[#234235]'
                            }`}
                          >
                            <span className="truncate">{m.tenantName}</span>
                            <span className="text-[10px] text-[#9bb5a8]">
                              {ROLE_LABELS_AR[m.role] || m.role}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* User badge */}
              <div
                className="flex items-center gap-2 rounded-lg bg-[#234235]/60 px-3 py-1.5 text-sm text-[#e8f0ec]"
              >
                <UserIcon className="h-4 w-4 text-[#45c387]" />
                <span className="font-medium text-xs truncate max-w-[120px]">{user.name}</span>
                {isSuperAdmin && (
                  <span className="rounded bg-[#f59e0b]/20 px-1 py-0.5 text-[10px] font-semibold text-[#f59e0b] border border-[#f59e0b]/30">
                    أدمن المنصة
                  </span>
                )}
              </div>

              {/* Logout Button */}
              <button
                type="button"
                onClick={() => void logout()}
                title="تسجيل الخروج"
                className="flex items-center gap-1.5 rounded-lg border border-[#3d2525] bg-[#2d1818]/50 px-3 py-1.5 text-xs font-medium text-[#fca5a5] hover:bg-[#3d2525] transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">خروج</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-lg border border-[#2b4c3e] px-4 py-1.5 text-sm font-medium text-[#e8f0ec] hover:border-[#2f9e6b] hover:text-[#45c387] transition-all"
              >
                دخول
              </Link>
              <Link
                href="/register"
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#2f9e6b] to-[#36b379] px-4 py-1.5 text-sm font-semibold text-[#062016] shadow-md shadow-[#2f9e6b]/20 hover:brightness-110 transition-all"
              >
                <Sparkles className="h-4 w-4" />
                <span>تسجيل أكاديمية</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
