import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export type AuthAlertTone = 'error' | 'success';
/** `banner`: standard form feedback. `compact`: inline under a sub-form. `panel`: success with heading. */
export type AuthAlertSize = 'banner' | 'compact' | 'panel';

export interface AuthAlertProps {
  tone: AuthAlertTone;
  size?: AuthAlertSize;
  /** Heading shown in `panel` size. */
  title?: React.ReactNode;
  children: React.ReactNode;
  /** Spacing utilities from the caller (e.g. `mb-6`). */
  className?: string;
}

const TONE = {
  error: {
    box: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    icon: 'text-rose-400',
    title: 'text-rose-300',
    body: 'text-rose-300',
    Icon: AlertCircle,
  },
  success: {
    box: 'border-[#22C55E]/30 bg-[#22C55E]/10 text-[#4ADE80]',
    icon: 'text-[#22C55E]',
    title: 'text-[#4ADE80]',
    body: 'text-[#86EFAC]',
    Icon: CheckCircle2,
  },
} as const;

const SIZE = {
  banner: { box: 'gap-3 rounded-xl p-4 text-xs', icon: 'h-5 w-5' },
  compact: { box: 'gap-2 rounded-lg p-3 text-xs', icon: 'h-4 w-4' },
  panel: { box: 'gap-3 rounded-xl p-5 text-sm', icon: 'h-6 w-6' },
} as const;

/**
 * Error/success feedback for auth forms. Errors are announced immediately (`role="alert"`),
 * success politely (`role="status"`).
 */
export function AuthAlert({
  tone,
  size = 'banner',
  title,
  children,
  className = '',
}: AuthAlertProps) {
  const t = TONE[tone];
  const s = SIZE[size];
  const Icon = t.Icon;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start border ${s.box} ${t.box} relative z-10 ${className}`.trim()}
    >
      <Icon aria-hidden="true" className={`${s.icon} shrink-0 ${t.icon} mt-0.5`} />
      {size === 'panel' ? (
        <div>
          {title && <h3 className={`font-bold ${t.title}`}>{title}</h3>}
          <div className={`mt-1 text-xs ${t.body} leading-relaxed`}>{children}</div>
        </div>
      ) : (
        <div>{children}</div>
      )}
    </div>
  );
}
