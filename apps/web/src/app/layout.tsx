import type { Metadata } from 'next';
import { DEFAULT_LOCALE, LOCALE_DIRECTION } from '@academy/shared';
import { AuthProvider } from '../lib/auth-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'منصة إدارة الأكاديميات الرياضية | Academy Platform',
  description: 'نظام سحابي متكامل لإدارة الأكاديميات الرياضية، الفروع، الاشتراكات والحضور',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = DEFAULT_LOCALE;
  const dir = LOCALE_DIRECTION[locale];

  return (
    <html lang={locale} dir={dir}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
