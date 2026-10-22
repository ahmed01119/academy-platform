'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { DEFAULT_LOCALE, LOCALE_DIRECTION, type SupportedLocale } from '@academy/shared';
import { translations } from './i18n/translations';

interface LocaleContextValue {
  locale: SupportedLocale;
  dir: 'rtl' | 'ltr';
  isRtl: boolean;
  setLocale: (locale: SupportedLocale) => void;
  t: (path: string, fallback?: string) => string;
  formatDate: (date: string | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (date: string | Date) => string;
  formatCurrency: (amount: number, currencyCode?: string) => string;
  formatNumber: (num: number) => string;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

const LOCALE_STORAGE_KEY = 'academy_locale';
const DEFAULT_TIMEZONE = 'Africa/Cairo';

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(DEFAULT_LOCALE);

  const applyLocale = useCallback((newLocale: SupportedLocale) => {
    const dir = LOCALE_DIRECTION[newLocale];
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLocale;
      document.documentElement.dir = dir;
      // Also update cookies for SSR compatibility
      document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, []);

  useEffect(() => {
    let saved: SupportedLocale = DEFAULT_LOCALE;
    try {
      const item = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (item === 'ar' || item === 'en') {
        saved = item;
      }
    } catch {
      // Fallback to default
    }

    setLocaleState(saved);
    applyLocale(saved);
  }, [applyLocale]);

  const setLocale = useCallback(
    (newLocale: SupportedLocale) => {
      setLocaleState(newLocale);
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
      } catch {
        // Storage write ignored
      }
      applyLocale(newLocale);
    },
    [applyLocale],
  );

  const resolveKey = useCallback(
    (loc: SupportedLocale, keyPath: string): string | null => {
      const parts = keyPath.split('.');
      let current: unknown = translations[loc];
      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = (current as Record<string, unknown>)[part];
        } else {
          return null;
        }
      }
      return typeof current === 'string' ? current : null;
    },
    [],
  );

  const t = useCallback(
    (path: string, fallback?: string): string => {
      // 1. Direct match in active locale
      const direct = resolveKey(locale, path);
      if (direct) return direct;

      // 2. Cross-domain alias resolution (common <-> nav)
      if (path.startsWith('common.')) {
        const navCandidate = path.replace(/^common\./, 'nav.');
        const navMatch = resolveKey(locale, navCandidate);
        if (navMatch) return navMatch;
      } else if (path.startsWith('nav.')) {
        const commonCandidate = path.replace(/^nav\./, 'common.');
        const commonMatch = resolveKey(locale, commonCandidate);
        if (commonMatch) return commonMatch;
      }

      // 3. Fallback to alternative locale (ar <-> en)
      const altLocale: SupportedLocale = locale === 'ar' ? 'en' : 'ar';
      const altMatch = resolveKey(altLocale, path);
      if (altMatch) return altMatch;

      // 4. Provided explicit fallback
      if (fallback) return fallback;

      // 5. Safe humanized string (never display raw internal key identifiers)
      const lastSegment = path.split('.').pop() || path;
      return lastSegment
        .replace(/([A-Z])/g, ' $1')
        .replace(/[-_]/g, ' ')
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
    },
    [locale, resolveKey],
  );

  const formatDate = useCallback(
    (dateInput: string | Date, options?: Intl.DateTimeFormatOptions): string => {
      try {
        const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
        if (isNaN(d.getTime())) return String(dateInput);

        const defaultOpts: Intl.DateTimeFormatOptions = {
          timeZone: DEFAULT_TIMEZONE,
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          ...options,
        };

        return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', defaultOpts).format(d);
      } catch {
        return String(dateInput);
      }
    },
    [locale],
  );

  const formatTime = useCallback(
    (dateInput: string | Date): string => {
      try {
        const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
        if (isNaN(d.getTime())) return String(dateInput);

        return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
          timeZone: DEFAULT_TIMEZONE,
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }).format(d);
      } catch {
        return String(dateInput);
      }
    },
    [locale],
  );

  const formatCurrency = useCallback(
    (amount: number, currencyCode = 'EGP'): string => {
      try {
        if (locale === 'ar') {
          return `${new Intl.NumberFormat('ar-EG').format(amount)} ج.م`;
        }
        return new Intl.NumberFormat('en-EG', {
          style: 'currency',
          currency: currencyCode,
          maximumFractionDigits: 0,
        }).format(amount);
      } catch {
        return `${amount} EGP`;
      }
    },
    [locale],
  );

  const formatNumber = useCallback(
    (num: number): string => {
      try {
        return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US').format(num);
      } catch {
        return String(num);
      }
    },
    [locale],
  );

  const dir = LOCALE_DIRECTION[locale];
  const isRtl = dir === 'rtl';

  return (
    <LocaleContext.Provider
      value={{
        locale,
        dir,
        isRtl,
        setLocale,
        t,
        formatDate,
        formatTime,
        formatCurrency,
        formatNumber,
      }}
    >
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}
