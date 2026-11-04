'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTheme, type ThemeMode } from '@/contexts/theme-context';
import { useLocale } from '@/contexts/locale-context';
import { Sun, Moon, Monitor, ChevronDown } from 'lucide-react';

interface ThemeToggleProps {
  compact?: boolean;
}

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { locale } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const options: Array<{
    mode: ThemeMode;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      mode: 'light',
      label: locale === 'ar' ? 'نهاري' : 'Light Mode',
      icon: <Sun className="h-4 w-4 text-amber-500" />,
    },
    {
      mode: 'dark',
      label: locale === 'ar' ? 'ليلي' : 'Dark Mode',
      icon: <Moon className="h-4 w-4 text-emerald-400" />,
    },
    {
      mode: 'system',
      label: locale === 'ar' ? 'تلقائي (النظام)' : 'System Mode',
      icon: <Monitor className="h-4 w-4 text-sky-400" />,
    },
  ];

  const currentIcon =
    theme === 'system' ? (
      <Monitor className="h-4 w-4 text-sky-400" />
    ) : resolvedTheme === 'dark' ? (
      <Moon className="h-4 w-4 text-emerald-400" />
    ) : (
      <Sun className="h-4 w-4 text-amber-500" />
    );

  const currentLabel =
    theme === 'system'
      ? locale === 'ar'
        ? 'النظام'
        : 'System'
      : theme === 'dark'
        ? locale === 'ar'
          ? 'ليلي'
          : 'Dark'
        : locale === 'ar'
          ? 'نهاري'
          : 'Light';

  return (
    <div className="relative inline-block text-start" ref={menuRef}>
      <button
        type="button"
        id="theme-toggle-button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 rounded-xl border border-border-app bg-bg-surface px-2.5 py-1.5 text-xs font-medium text-text-main hover:bg-bg-surface-subtle transition-colors shadow-sm cursor-pointer"
        aria-label={locale === 'ar' ? 'تبديل مظهر العرض (المود)' : 'Toggle Theme Mode'}
        title={locale === 'ar' ? 'مظهر العرض (المود)' : 'Theme Mode'}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {currentIcon}
        {!compact && (
          <span className="hidden sm:inline-block font-medium">
            {currentLabel}
          </span>
        )}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute end-0 mt-1.5 w-40 origin-top-right rounded-xl border border-border-app bg-bg-surface p-1 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100"
        >
          {options.map((opt) => (
            <button
              key={opt.mode}
              type="button"
              role="menuitem"
              onClick={() => {
                setTheme(opt.mode);
                setIsOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                theme === opt.mode
                  ? 'bg-accent-primary/10 text-accent-primary font-bold'
                  : 'text-text-main hover:bg-bg-surface-subtle'
              }`}
            >
              <div className="flex items-center gap-2">
                {opt.icon}
                <span>{opt.label}</span>
              </div>
              {theme === opt.mode && (
                <span className="h-1.5 w-1.5 rounded-full bg-accent-primary shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
export default ThemeToggle;
