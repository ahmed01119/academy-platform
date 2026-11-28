import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PrivacyPage from './page';

const locale = vi.hoisted(() => ({ value: 'ar' as 'ar' | 'en' }));
vi.mock('@/contexts/locale-context', () => ({
  useLocale: () => ({ t: (k: string) => k, locale: locale.value, isRtl: locale.value === 'ar' }),
}));

describe('privacy page', () => {
  it('shows the Arabic policy right to left, with the contact address', () => {
    locale.value = 'ar';
    const html = renderToStaticMarkup(<PrivacyPage />);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('سياسة الخصوصية</h1>');
    expect(html).toContain('href="mailto:sportexus.academy@gmail.com"');
  });

  it('states that the Gmail permission only sends mail', () => {
    locale.value = 'en';
    const html = renderToStaticMarkup(<PrivacyPage />);
    expect(html).toContain('dir="ltr"');
    expect(html).toContain('Privacy Policy</h1>');
    expect(html).toContain('limited to sending messages');
  });
});
