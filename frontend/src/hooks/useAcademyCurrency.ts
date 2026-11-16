'use client';

import { useAuth } from '@/contexts/auth-context';
import { CURRENCY_ARABIC_SYMBOLS, useLocale } from '@/contexts/locale-context';

/** Used when the active academy does not report a currency (same default as the database). */
export const DEFAULT_ACADEMY_CURRENCY = 'EGP';

/**
 * The active academy's currency (K4, owner decision 2026-11-16). Every amount in an academy is recorded by the API in
 * the academy's own currency (`tenants.currency`, set in academy settings), so the UI must show that currency too,
 * never a fixed one.
 *
 * `code` is the ISO 4217 code; `label` is what to print next to an amount: the Arabic symbol in Arabic (e.g. "ج.م"),
 * the code in English (e.g. "EGP").
 */
export function useAcademyCurrency(): { code: string; label: string } {
  const { activeTenant } = useAuth();
  const { locale } = useLocale();
  const code = (activeTenant?.tenantCurrency || DEFAULT_ACADEMY_CURRENCY).toUpperCase();
  const label = locale === 'ar' ? (CURRENCY_ARABIC_SYMBOLS[code] ?? code) : code;
  return { code, label };
}
