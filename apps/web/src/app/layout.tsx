import type { Metadata } from 'next';
import { DEFAULT_LOCALE, LOCALE_DIRECTION } from '@academy/shared';
import './globals.css';

export const metadata: Metadata = {
  title: 'Academy Platform',
  description: 'Sports Academy Management SaaS',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = DEFAULT_LOCALE;
  const dir = LOCALE_DIRECTION[locale];

  return (
    <html lang={locale} dir={dir}>
      <body>{children}</body>
    </html>
  );
}
