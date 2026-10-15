export const SUPPORTED_LOCALES = ['ar', 'en'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'ar';

export const LOCALE_DIRECTION: Record<SupportedLocale, 'rtl' | 'ltr'> = {
  ar: 'rtl',
  en: 'ltr',
};

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
