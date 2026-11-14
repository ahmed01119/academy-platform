/**
 * Class strings repeated verbatim across the public auth pages.
 * Kept as constants (not new components) so markup stays readable at the call site.
 */

/** Full-width gradient primary action (buttons and link-buttons). */
export const AUTH_PRIMARY_ACTION =
  'w-full flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-[#0A3BFF] via-[#0077FF] to-[#00D6FF] py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/30 hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all';

/** Field label. */
export const AUTH_LABEL = 'block text-xs font-semibold text-(--text-sub) mb-1.5';

/** Base text input (callers add padding/size). */
export const AUTH_INPUT_BASE =
  'w-full rounded-xl border border-(--border-app) bg-(--bg-surface-subtle) text-(--text-main) placeholder-(--text-muted) focus:border-(--accent-primary) focus:ring-1 focus:ring-(--accent-primary) outline-none transition-all';

/** Monospace token input (verification / invitation tokens). */
export const AUTH_TOKEN_INPUT = `${AUTH_INPUT_BASE} py-2.5 px-3 text-xs font-mono`;

/** Input with a leading icon. */
export const AUTH_ICON_INPUT = `${AUTH_INPUT_BASE} py-2.5 px-4 ps-10 text-sm`;

/** Large centred 6-digit code input. */
export const AUTH_OTP_INPUT = `${AUTH_INPUT_BASE} py-3 px-4 text-center text-xl font-mono font-bold tracking-[0.5em]`;
