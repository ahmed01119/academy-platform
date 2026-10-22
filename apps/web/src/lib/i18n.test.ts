import { describe, expect, it } from 'vitest';
import { translations } from './i18n/translations';

describe('Localization Completeness & Translation Parity', () => {
  it('has identical top-level sections in both Arabic and English', () => {
    const arKeys = Object.keys(translations.ar).sort();
    const enKeys = Object.keys(translations.en).sort();
    expect(arKeys).toEqual(enKeys);
  });

  it('guarantees key parity for all nested translation objects', () => {
    for (const section of Object.keys(translations.ar) as Array<keyof typeof translations.ar>) {
      const arSubKeys = Object.keys(translations.ar[section]).sort();
      const enSubKeys = Object.keys(translations.en[section]).sort();
      expect(
        arSubKeys,
        `Mismatch in translation keys for section: ${section}`,
      ).toEqual(enSubKeys);
    }
  });

  it('formats currency in EGP correctly for Arabic and English', () => {
    const amount = 3500;
    const arFormatted = new Intl.NumberFormat('ar-EG').format(amount);
    expect(arFormatted).toBeDefined();

    const enFormatted = new Intl.NumberFormat('en-EG', {
      style: 'currency',
      currency: 'EGP',
      maximumFractionDigits: 0,
    }).format(amount);
    expect(enFormatted).toContain('3,500');
  });

  it('formats dates using Cairo default timezone (Africa/Cairo)', () => {
    const date = new Date('2026-10-22T08:00:00Z');
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);

    expect(formatted).toBeDefined();
    expect(formatted).toContain('2026');
  });

  it('contains all critical common and navigation keys without missing entries', () => {
    const requiredCommonKeys = [
      'appName',
      'academyPlatform',
      'login',
      'logout',
      'register',
      'home',
      'currency',
      'notifications',
      'profile',
      'collapse',
      'expand',
      'searchPlaceholder',
      'quickActions',
      'operations',
      'analytics',
      'athletics',
      'administration',
    ];

    const requiredNavKeys = [
      'home',
      'dashboard',
      'players',
      'groups',
      'evaluations',
      'sessions',
      'reports',
      'scanner',
      'branches',
      'settings',
      'coachWorkspace',
      'playerPortal',
      'guardianPortal',
    ];

    for (const key of requiredCommonKeys) {
      expect(translations.ar.common).toHaveProperty(key);
      expect(translations.en.common).toHaveProperty(key);
    }

    for (const key of requiredNavKeys) {
      expect(translations.ar.nav).toHaveProperty(key);
      expect(translations.en.nav).toHaveProperty(key);
    }
  });
});
