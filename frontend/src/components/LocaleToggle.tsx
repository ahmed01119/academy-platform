'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useLocale } from '../lib/locale-context';
import { Languages, ChevronDown } from 'lucide-react';

interface LocaleToggleProps {
  compact?: boolean;
}

export function LocaleToggle({ compact = false }: LocaleToggleProps) {
  const { locale, setLocale } = useLocale();
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

  const languages = [
    {
      code: 'ar' as const,
      label: locale === 'ar' ? 'العربية' : 'Arabic (العربية)',
      short: 'AR',
    },
    {
      code: 'en' as const,
      label: locale === 'ar' ? 'الإنجليزية (English)' : 'English',
      short: 'EN',
    },
  ];

  return (
    <div className="relative inline-block text-start" ref={menuRef}>
      <button
        type="button"
        id="locale-toggle-button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 rounded-xl border border-border-app bg-bg-surface px-2.5 py-1.5 text-xs font-medium text-text-main hover:bg-bg-surface-subtle transition-colors shadow-sm cursor-pointer"
        aria-label={locale === 'ar' ? 'تغيير لغة الموقع' : 'Change Language'}
        title={locale === 'ar' ? 'اللغة الحالية: العربية' : 'Current Language: English'}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Languages className="h-4 w-4 text-accent-primary" />
        {!compact && (
          <span className="hidden sm:inline-block font-semibold">
            {locale === 'ar' ? 'العربية' : 'English'}
          </span>
        )}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute end-0 mt-1.5 w-44 origin-top-right rounded-xl border border-border-app bg-bg-surface p-1 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100"
        >
          {languages.map((lang) => (
            <button
              key={lang.code}
              type="button"
              role="menuitem"
              onClick={() => {
                setLocale(lang.code);
                setIsOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                locale === lang.code
                  ? 'bg-accent-primary/10 text-accent-primary font-bold'
                  : 'text-text-main hover:bg-bg-surface-subtle'
              }`}
            >
              <span>{lang.label}</span>
              {locale === lang.code && (
                <span className="h-1.5 w-1.5 rounded-full bg-accent-primary shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default LocaleToggle;
