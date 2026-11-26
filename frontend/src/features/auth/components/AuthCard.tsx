import React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

export interface AuthCardProps {
  icon: LucideIcon;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Optional content under the subtitle (e.g. the target email chip). */
  headerExtra?: React.ReactNode;
  /** Stack header items as a centred column (used when `headerExtra` is an inline chip). */
  stackHeader?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Glass card with ambient glows and the gradient icon header used by the public auth pages. */
export function AuthCard({
  icon: Icon,
  title,
  subtitle,
  headerExtra,
  stackHeader = false,
  children,
  footer,
}: AuthCardProps) {
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-3xl border border-(--border-app) bg-(--bg-surface)/95 p-5 sm:p-8 shadow-float backdrop-blur-xl relative overflow-hidden animate-scale-up">
        {/* Sportexus ambient glows */}
        <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-(--accent-blue)/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-(--accent-primary)/10 blur-3xl pointer-events-none" />

        <div
          className={`text-center mb-8 relative z-10${stackHeader ? ' flex flex-col items-center' : ''}`}
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-tr from-[#0A3BFF] to-[#00D6FF] shadow-lg shadow-blue-600/25">
            <Icon aria-hidden="true" className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-(--text-main)">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-(--text-muted)">{subtitle}</p>}
          {headerExtra}
        </div>

        {children}

        {footer && (
          <div className="mt-8 border-t border-(--border-subtle) pt-6 text-center text-xs text-(--text-muted) relative z-10">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** "Back to sign in" footer link used across the auth pages. */
export function BackToSignInLink({ label }: { label: string }) {
  return (
    <Link
      href="/login"
      className="font-semibold text-(--accent-primary) hover:underline transition-colors"
    >
      {label}
    </Link>
  );
}
