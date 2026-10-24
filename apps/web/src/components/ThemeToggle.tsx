'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTheme, type ThemeMode } from '../lib/theme-context';
import { Sun, Moon, Monitor, ChevronDown } from 'lucide-react';

interface ThemeToggleProps {
  compact?: boolean;
}

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
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
    labelAr: string;
    labelEn: string;
    icon: React.ReactNode;
  }> = [
    {
      mode: 'light',
      labelAr: 'نهاري',
      labelEn: 'Light',
      icon: <Sun className="h-4 w-4 text-amber-500" />,
    },
    {
      mode: 'dark',
      labelAr: 'ليلي',
      labelEn: 'Dark',
      icon: <Moon className="h-4 w-4 text-emerald-400" />,
    },
    {
      mode: 'system',
      labelAr: 'تلقائي (النظام)',
      labelEn: 'System',
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

  const getLabel = (opt: (typeof options)[0]) => {
    return opt.labelAr; // or opt.labelEn based on locale
  };

  return (
    <div className="relative inline-block text-right" ref={menuRef}>
      <button
        type="button"
        id="theme-toggle-button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 rounded-xl border border-border-app bg-bg-surface px-2.5 py-1.5 text-xs font-medium text-text-main hover:bg-bg-surface-subtle transition-colors shadow-sm"
        aria-label="تبديل مظهر العرض (Theme)"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {currentIcon}
        {!compact && (
          <span className="hidden sm:inline-block">
            {theme === 'system' ? 'النظام' : theme === 'dark' ? 'ليلي' : 'نهاري'}
          </span>
        )}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute left-0 mt-1.5 w-36 origin-top-left rounded-xl border border-border-app bg-bg-surface p-1 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100"
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
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                theme === opt.mode
                  ? 'bg-accent-primary/15 text-accent-primary font-bold'
                  : 'text-text-main hover:bg-bg-surface-subtle'
              }`}
            >
              <div className="flex items-center gap-2">
                {opt.icon}
                <span>{getLabel(opt)}</span>
              </div>
              {theme === opt.mode && (
                <span className="h-1.5 w-1.5 rounded-full bg-accent-primary" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
