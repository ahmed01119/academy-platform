import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, isSupportedLocale, LOCALE_DIRECTION } from './locales';

describe('locales', () => {
  it('defaults to Arabic for Egypt-first launch', () => {
    expect(DEFAULT_LOCALE).toBe('ar');
    expect(LOCALE_DIRECTION.ar).toBe('rtl');
    expect(LOCALE_DIRECTION.en).toBe('ltr');
  });

  it('validates supported locales', () => {
    expect(isSupportedLocale('ar')).toBe(true);
    expect(isSupportedLocale('en')).toBe(true);
    expect(isSupportedLocale('fr')).toBe(false);
  });
});
