import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_DIRECTION, type SupportedLocale } from '@academy/shared';
import { AuthProvider } from '@/contexts/auth-context';
import { ThemeProvider } from '@/contexts/theme-context';
import { LocaleProvider } from '@/contexts/locale-context';
import {
  LOCALE_COOKIE,
  localeInitScript,
  signedInHintScript,
  themeInitScript,
} from '@/lib/preferences/init-scripts';
import { ToastProvider } from '../components/ui/Toast';
import { ConfirmProvider } from '../components/ui/ConfirmDialog';
import { ServiceWorkerRegistrar } from '../components/pwa/ServiceWorkerRegistrar';
import { SyncStatus } from '../components/pwa/SyncStatus';
// Fonts ship with the app (@fontsource): the build never downloads from Google, whose font requests intermittently
// failed on the deployment builders ("Cannot read properties of null" in next/font/google) and broke the build.
// Same families, weights and subsets as before; globals.css points --font-plex-sans / --font-plex-arabic at them.
import '@fontsource/ibm-plex-sans/latin-300.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans/latin-700.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-300.css';
import '@fontsource/ibm-plex-sans-arabic/latin-300.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/latin-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/latin-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';
import '@fontsource/ibm-plex-sans-arabic/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-700.css';
import '@fontsource/ibm-plex-sans-arabic/latin-700.css';
import './globals.css';

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
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: localeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: signedInHintScript }} />
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
