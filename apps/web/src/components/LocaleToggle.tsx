'use client';

import React from 'react';
import { useLocale } from '../lib/locale-context';
import { Languages } from 'lucide-react';

interface LocaleToggleProps {
  compact?: boolean;
}

export function LocaleToggle({ compact = false }: LocaleToggleProps) {
  const { locale, setLocale } = useLocale();

  const toggleLocale = () => {
    const nextLocale = locale === 'ar' ? 'en' : 'ar';
    setLocale(nextLocale);
  };

  return (
    <button
      type="button"
      id="locale-toggle-button"
      onClick={toggleLocale}
      className="flex items-center gap-1.5 rounded-xl border border-border-app bg-bg-surface px-2.5 py-1.5 text-xs font-medium text-text-main hover:bg-bg-surface-subtle transition-colors shadow-sm"
      aria-label="تبديل اللغة (Toggle Language)"
      title={locale === 'ar' ? 'Switch to English' : 'التحويل إلى العربية'}
    >
      <Languages className="h-4 w-4 text-accent-primary" />
      {!compact && (
        <span className="font-semibold">{locale === 'ar' ? 'English' : 'عربي'}</span>
      )}
    </button>
  );
}
