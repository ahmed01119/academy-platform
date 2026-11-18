import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_DIRECTION, type SupportedLocale } from '@academy/shared';
import { AuthProvider } from '@/contexts/auth-context';
import { ThemeProvider } from '@/contexts/theme-context';
import { LocaleProvider } from '@/contexts/locale-context';
import { LOCALE_COOKIE, localeInitScript, themeInitScript } from '@/lib/preferences/init-scripts';
import { ToastProvider } from '../components/ui/Toast';
import { ConfirmProvider } from '../components/ui/ConfirmDialog';
import { ServiceWorkerRegistrar } from '../components/pwa/ServiceWorkerRegistrar';
import { SyncStatus } from '../components/pwa/SyncStatus';
import './globals.css';

// Fonts are downloaded at build time and served by this app (next/font): no request to Google from the browser and
// no layout shift. globals.css uses the two CSS variables.
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-plex-sans',
});
const plexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-plex-arabic',
});

export const metadata: Metadata = {
  title: 'SPORTEXUS | سبورتكسس — One Platform. Every Academy.',
  description:
    'Sportexus: One Platform. Every Academy. A cloud-based sports academy management platform for branches, subscriptions, smart attendance, and performance evaluations.',
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

/** The language the user chose (cookie written by LocaleProvider), so the server renders it from the first paint. */
async function readRequestLocale(): Promise<SupportedLocale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return value === 'en' || value === 'ar' ? value : DEFAULT_LOCALE;
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await readRequestLocale();
  const dir = LOCALE_DIRECTION[locale];

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${plexSans.variable} ${plexSansArabic.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: localeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <LocaleProvider initialLocale={locale}>
            <AuthProvider>
              <ToastProvider>
                <ConfirmProvider>{children}</ConfirmProvider>
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
