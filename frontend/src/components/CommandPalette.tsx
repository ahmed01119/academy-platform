'use client';

import React, { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { useLocale } from '../lib/locale-context';
import api from '../lib/api-client';
import {
  Search,
  Users,
  Calendar,
  QrCode,
  DollarSign,
  Award,
  Settings,
  Building,
  Shield,
  Layers,
  ArrowRight,
  Sparkles,
  X,
} from 'lucide-react';

interface CommandItem {
  id: string;
  category: 'navigation' | 'actions' | 'players' | 'recent';
  title: string;
  subtitle?: string;
  href?: string;
  icon: React.ReactNode;
  onSelect?: () => void;
  requiredRole?: string[];
  superAdminOnly?: boolean;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { user, activeTenant } = useAuth();
  const { locale, isRtl } = useLocale();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [, startTransition] = useTransition();
  const [playerResults, setPlayerResults] = useState<
    Array<{ id: string; name: string; branchName?: string }>
  >([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent searches on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('academy_recent_searches');
        if (stored) {
          setRecentSearches(JSON.parse(stored).slice(0, 5));
        }
      } catch {
        // ignore storage error
      }
    }
  }, []);

  const saveRecentSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    try {
      const updated = [trimmed, ...recentSearches.filter((s) => s !== trimmed)].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem('academy_recent_searches', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Trigger open via custom event if closed
          window.dispatchEvent(new CustomEvent('open-command-palette'));
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery('');
      setPlayerResults([]);
    }
  }, [isOpen]);

  // Debounced search for players if tenant active and has permissions
  useEffect(() => {
    if (!query.trim() || !activeTenant || query.length < 2) {
      setPlayerResults([]);
      return;
    }

    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          const res = await api.players.list({ search: query.trim(), limit: 5 });
          setPlayerResults(
            res.items.map((p) => ({
              id: p.id,
              name: `${p.firstName} ${p.lastName}`.trim(),
              branchName: p.currentBranch?.name,
            })),
          );
        } catch {
          // silently handle search error
          setPlayerResults([]);
        }
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [query, activeTenant]);

  const isSuperAdmin = Boolean(user?.isPlatformSuperAdmin || user?.isPlatformOwner);

  // Base navigation items
  const baseNavigation: CommandItem[] = [
    {
      id: 'nav-dashboard',
      category: 'navigation',
      title: locale === 'ar' ? 'لوحة التحكم الرئيسية' : 'Dashboard Overview',
      subtitle: locale === 'ar' ? 'مؤشرات الأداء والملخص اليومي' : 'Key metrics and daily overview',
      href: '/dashboard',
      icon: <Layers className="w-4 h-4 text-emerald-400" />,
    },
    {
      id: 'nav-players',
      category: 'navigation',
      title: locale === 'ar' ? 'سجل اللاعبين' : 'Players Directory',
      subtitle:
        locale === 'ar'
          ? 'إدارة اللاعبين والعضويات وبطاقات QR'
          : 'Manage players, memberships & QR',
      href: '/players',
      icon: <Users className="w-4 h-4 text-blue-400" />,
    },
    {
      id: 'nav-sessions',
      category: 'navigation',
      title: locale === 'ar' ? 'حصص التدريب والحضور' : 'Training Sessions & Attendance',
      subtitle:
        locale === 'ar' ? 'الجداول والتحضير الفوري' : 'Schedules and live attendance check-in',
      href: '/sessions',
      icon: <Calendar className="w-4 h-4 text-amber-400" />,
    },
    {
      id: 'nav-scanner',
      category: 'navigation',
      title: locale === 'ar' ? 'ماسح الحضور السريع QR' : 'QR Attendance Scanner',
      subtitle:
        locale === 'ar'
          ? 'مسح فوري بالكاميرا حتى دون اتصال'
          : 'Instant camera check-in, works offline',
      href: '/attendance/scanner',
      icon: <QrCode className="w-4 h-4 text-teal-400" />,
    },
    {
      id: 'nav-groups',
      category: 'navigation',
      title: locale === 'ar' ? 'المجموعات والفرق' : 'Training Groups & Squads',
      subtitle:
        locale === 'ar' ? 'توزيع الفئات السنية والمدربين' : 'Age categories and coaching staff',
      href: '/groups',
      icon: <Building className="w-4 h-4 text-purple-400" />,
    },
    {
      id: 'nav-evaluations',
      category: 'navigation',
      title: locale === 'ar' ? 'تقييمات الأداء الفني' : 'Player Evaluations',
      subtitle:
        locale === 'ar'
          ? 'التقييمات الفنية والبدنية والتطوير'
          : 'Technical & physical progress metrics',
      href: '/evaluations',
      icon: <Award className="w-4 h-4 text-rose-400" />,
    },
    {
      id: 'nav-finance',
      category: 'navigation',
      title: locale === 'ar' ? 'الإدارة المالية والمصروفات' : 'Finance & Subscriptions',
      subtitle:
        locale === 'ar'
          ? 'الاشتراكات والمدفوعات وإغلاق الخزينة'
          : 'Player billing, expenses & cashier closing',
      href: '/finance',
      icon: <DollarSign className="w-4 h-4 text-emerald-400" />,
    },
    {
      id: 'nav-branches',
      category: 'navigation',
      title: locale === 'ar' ? 'الفروع والملاعب' : 'Branches & Locations',
      subtitle:
        locale === 'ar' ? 'إدارة فروع ومقرات الأكاديمية' : 'Manage academy branches & facilities',
      href: '/branches',
      icon: <Building className="w-4 h-4 text-indigo-400" />,
    },
    {
      id: 'nav-settings',
      category: 'navigation',
      title: locale === 'ar' ? 'إعدادات الأكاديمية' : 'Academy Settings',
      subtitle:
        locale === 'ar' ? 'الهوية وسياسات الحضور والاشتراك' : 'Identity, grace period & policies',
      href: '/settings',
      icon: <Settings className="w-4 h-4 text-slate-400" />,
    },
  ];

  // Super admin items
  if (isSuperAdmin) {
    baseNavigation.unshift({
      id: 'nav-platform',
      category: 'navigation',
      title: locale === 'ar' ? 'مركز إدارة المنصة (Super Admin)' : 'Platform Control Center',
      subtitle:
        locale === 'ar'
          ? 'الأكاديميات، الطلبات، التخزين، والحوكمة'
          : 'Academies, requests, storage & governance',
      href: '/platform',
      icon: <Shield className="w-4 h-4 text-amber-400" />,
      superAdminOnly: true,
    });
  }

  // Quick actions
  const quickActions: CommandItem[] = [
    {
      id: 'action-new-player',
      category: 'actions',
      title: locale === 'ar' ? 'تسجيل لاعب جديد' : 'Register New Player',
      subtitle:
        locale === 'ar'
          ? 'إضافة لاعب مع إصدار بطاقة QR فورية'
          : 'Enroll player with instant QR code',
      href: '/players/new',
      icon: <Users className="w-4 h-4 text-emerald-400" />,
    },
    {
      id: 'action-open-scanner',
      category: 'actions',
      title: locale === 'ar' ? 'فتح ماسح الحضور' : 'Open Attendance Scanner',
      subtitle:
        locale === 'ar' ? 'بدء تسجيل حضور الحصة التدريبية' : 'Start scanning session attendance',
      href: '/attendance/scanner',
      icon: <QrCode className="w-4 h-4 text-teal-400" />,
    },
  ];

  // Filter items based on query
  const q = query.toLowerCase().trim();
  const filteredNav = baseNavigation.filter(
    (item) =>
      !q ||
      item.title.toLowerCase().includes(q) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(q)),
  );

  const filteredActions = quickActions.filter(
    (item) =>
      !q ||
      item.title.toLowerCase().includes(q) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(q)),
  );

  const playerItems: CommandItem[] = playerResults.map((p) => ({
    id: `player-${p.id}`,
    category: 'players',
    title: p.name,
    subtitle: p.branchName || '',
    href: `/players/${p.id}`,
    icon: <Users className="w-4 h-4 text-blue-400" />,
  }));

  const allItems = [...filteredNav, ...filteredActions, ...playerItems];

  const handleSelect = (item: CommandItem) => {
    if (query.trim()) {
      saveRecentSearch(query.trim());
    }
    onClose();
    if (item.onSelect) {
      item.onSelect();
    } else if (item.href) {
      router.push(item.href);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (allItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % allItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allItems.length) % allItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = allItems[selectedIndex];
      if (selected) {
        handleSelect(selected);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-3 bg-[var(--bg-base)]/50">
          <Search className="h-5 w-5 text-emerald-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={
              locale === 'ar'
                ? 'ابحث عن صفحة، إجراء، أو لاعب... (Ctrl+K)'
                : 'Search page, action, or player... (Ctrl+K)'
            }
            className="flex-1 bg-transparent text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="hidden sm:inline-flex rounded-md bg-[var(--bg-surface-subtle)] px-2 py-0.5 text-[10px] font-mono text-[var(--text-muted)] border border-[var(--border-subtle)]">
            ESC
          </span>
        </div>

        {/* Results Body */}
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-4">
          {/* Player Results Section */}
          {playerItems.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3 h-3" />
                {locale === 'ar' ? 'اللاعبين المطابقين' : 'Matching Players'}
              </div>
              <div className="space-y-1">
                {playerItems.map((item) => {
                  const globalIdx = allItems.findIndex((x) => x.id === item.id);
                  const isSelected = globalIdx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-start transition-colors ${
                        isSelected
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'text-[var(--text-main)] hover:bg-[var(--bg-surface-subtle)]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg bg-[var(--bg-surface-subtle)]">
                          {item.icon}
                        </div>
                        <div>
                          <div className="text-xs font-semibold">{item.title}</div>
                          {item.subtitle && (
                            <div className="text-[11px] text-[var(--text-muted)]">
                              {item.subtitle}
                            </div>
                          )}
                        </div>
                      </div>
                      <ArrowRight
                        className={`w-3.5 h-3.5 opacity-60 ${isRtl ? 'rotate-180' : ''}`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          {filteredActions.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-amber-400" />
                {locale === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}
              </div>
              <div className="space-y-1">
                {filteredActions.map((item) => {
                  const globalIdx = allItems.findIndex((x) => x.id === item.id);
                  const isSelected = globalIdx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-start transition-colors ${
                        isSelected
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'text-[var(--text-main)] hover:bg-[var(--bg-surface-subtle)]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg bg-[var(--bg-surface-subtle)]">
                          {item.icon}
                        </div>
                        <div>
                          <div className="text-xs font-semibold">{item.title}</div>
                          {item.subtitle && (
                            <div className="text-[11px] text-[var(--text-muted)]">
                              {item.subtitle}
                            </div>
                          )}
                        </div>
                      </div>
                      <ArrowRight
                        className={`w-3.5 h-3.5 opacity-60 ${isRtl ? 'rotate-180' : ''}`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Navigation Items */}
          {filteredNav.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-emerald-400" />
                {locale === 'ar' ? 'صفحات التطبيق' : 'Navigation'}
              </div>
              <div className="space-y-1">
                {filteredNav.map((item) => {
                  const globalIdx = allItems.findIndex((x) => x.id === item.id);
                  const isSelected = globalIdx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-start transition-colors ${
                        isSelected
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'text-[var(--text-main)] hover:bg-[var(--bg-surface-subtle)]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg bg-[var(--bg-surface-subtle)]">
                          {item.icon}
                        </div>
                        <div>
                          <div className="text-xs font-semibold">{item.title}</div>
                          {item.subtitle && (
                            <div className="text-[11px] text-[var(--text-muted)]">
                              {item.subtitle}
                            </div>
                          )}
                        </div>
                      </div>
                      <ArrowRight
                        className={`w-3.5 h-3.5 opacity-60 ${isRtl ? 'rotate-180' : ''}`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state when no matches */}
          {allItems.length === 0 && (
            <div className="py-12 text-center text-xs text-[var(--text-muted)]">
              {locale === 'ar' ? 'لا توجد نتائج مطابقة لبحثك' : 'No matching results found'}
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-4 py-2 text-[10px] text-[var(--text-muted)] bg-[var(--bg-base)]/50">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono bg-[var(--bg-surface-subtle)] px-1 py-0.5 rounded border border-[var(--border-subtle)]">
                ↑↓
              </kbd>{' '}
              {locale === 'ar' ? 'للتنقل' : 'to navigate'}
            </span>
            <span>
              <kbd className="font-mono bg-[var(--bg-surface-subtle)] px-1 py-0.5 rounded border border-[var(--border-subtle)]">
                ↵
              </kbd>{' '}
              {locale === 'ar' ? 'للاختيار' : 'to select'}
            </span>
          </div>
          <span>{locale === 'ar' ? 'البحث السريع الموحد' : 'Unified Quick Search'}</span>
        </div>
      </div>
    </div>
  );
}
