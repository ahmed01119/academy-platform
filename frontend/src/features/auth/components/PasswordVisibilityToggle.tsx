'use client';

import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useLocale } from '@/contexts/locale-context';

export interface PasswordVisibilityToggleProps {
  visible: boolean;
  onToggle: () => void;
  /** Positioning/colour classes from the caller so each form keeps its layout. */
  className: string;
  /** id of the input this button controls. */
  controls?: string;
}

/** Icon button that shows/hides a password, with an accessible, localized name. */
export function PasswordVisibilityToggle({
  visible,
  onToggle,
  className,
  controls,
}: PasswordVisibilityToggleProps) {
  const { locale } = useLocale();
  const label = visible
    ? locale === 'ar'
      ? 'إخفاء كلمة المرور'
      : 'Hide password'
    : locale === 'ar'
      ? 'إظهار كلمة المرور'
      : 'Show password';

  return (
    <button
      type="button"
      onClick={onToggle}
      className={className}
      title={label}
      aria-label={label}
      aria-pressed={visible}
      aria-controls={controls}
    >
      {visible ? (
        <EyeOff aria-hidden="true" className="h-4 w-4" />
      ) : (
        <Eye aria-hidden="true" className="h-4 w-4" />
      )}
    </button>
  );
}
