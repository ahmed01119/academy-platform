import type { Metadata, Viewport } from 'next';
import { DEFAULT_LOCALE, LOCALE_DIRECTION } from '@academy/shared';
import { AuthProvider } from '../lib/auth-context';
import { ThemeProvider, themeInitScript } from '../lib/theme-context';
import { LocaleProvider } from '../lib/locale-context';
import { ToastProvider } from '../components/ui/Toast';
import { ServiceWorkerRegistrar } from '../components/pwa/ServiceWorkerRegistrar';
import { SyncStatus } from '../components/pwa/SyncStatus';
import './globals.css';

export const metadata: Metadata = {
  title: 'SPORTEXUS | سبورتكسس — One Platform. Every Academy.',
  description:
    'Sportexus: One Platform. Every Academy. منصة سحابية متكاملة لإدارة الأكاديميات الرياضية، الفروع، الاشتراكات، الحضور الذكي وتقييمات الأداء.',
  applicationName: 'SPORTEXUS',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/brand/sportexus-app-icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/icon' },
    ],
    apple: [
      { url: '/brand/sportexus-app-icon.svg', type: 'image/svg+xml' },
      { url: '/apple-touch-icon.png', sizes: '192x192', type: 'image/png' },
      { url: '/apple-icon' },
    ],
  },
  appleWebApp: {
    capable: true,
    title: 'SPORTEXUS',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#0A3BFF',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = DEFAULT_LOCALE;
  const dir = LOCALE_DIRECTION[locale];

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          <LocaleProvider>
            <AuthProvider>
              <ToastProvider>
                {children}
                <ServiceWorkerRegistrar />
                <SyncStatus />
              </ToastProvider>
            </AuthProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
