/**
 * Display preferences shared by the server (root layout) and the client providers.
 *
 * This module must stay free of 'use client': the root layout is a server component, and values exported from a
 * client module reach it as client references, not as their values. That is why the two inline scripts below used to
 * render empty, and the page showed Arabic / the light theme for a moment before React applied the saved choice.
 */

export const THEME_STORAGE_KEY = 'academy_theme';
export const LOCALE_STORAGE_KEY = 'academy_locale';
/** Cookie the root layout reads so the server renders the chosen language (correct html lang, no Arabic flash). */
export const LOCALE_COOKIE = 'NEXT_LOCALE';

/** Applies the saved theme before the first paint. */
export const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}') || 'system';
    var isDark = stored === 'dark' || (stored === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
})();
`;

/** Attribute on <html> while this browser holds a session hint; the landing page stays hidden until the app decides. */
export const SIGNED_IN_HINT_ATTR = 'data-signed-in';

/**
 * Marks <html> before the first paint when this browser was signed in, so a signed-in visitor opening the site in a
 * new tab never sees the landing page flash before being sent to their home (globals.css hides .landing-page).
 */
export const signedInHintScript = `
(function() {
  try {
    if (localStorage.getItem('sportexus_has_session') === 'true') {
      document.documentElement.setAttribute('${SIGNED_IN_HINT_ATTR}', '');
    }
  } catch (e) {}
})();
`;

/**
 * Applies the saved language before the first paint and keeps the cookie in step with it, so the next server render
 * already uses it. Without a saved choice it keeps what the server rendered.
 */
export const localeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('${LOCALE_STORAGE_KEY}') || document.documentElement.lang || 'ar';
    var dir = stored === 'en' ? 'ltr' : 'rtl';
    document.documentElement.lang = stored;
    document.documentElement.dir = dir;
    document.documentElement.setAttribute('data-locale', stored);
    document.cookie = '${LOCALE_COOKIE}=' + stored + '; path=/; max-age=31536000; SameSite=Lax';
  } catch (e) {}
})();
`;
