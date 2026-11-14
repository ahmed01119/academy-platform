'use client';

import React from 'react';
import { Lock } from 'lucide-react';
import { PasswordVisibilityToggle } from './PasswordVisibilityToggle';
import { AUTH_ICON_INPUT, AUTH_LABEL, AUTH_OTP_INPUT } from './auth-styles';

/** Keeps only digits, max 6 — the existing OTP input normalisation. */
export function normalizeOtpInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

export interface OtpCodeFieldProps {
  id: string;
  label: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  /** Rendered under the input (e.g. "Sent to …" + resend action). */
  hint?: React.ReactNode;
}

/** 6-digit verification code input. */
export function OtpCodeField({ id, label, value, onChange, hint }: OtpCodeFieldProps) {
  return (
    <div>
      <label className={AUTH_LABEL} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        value={value}
        onChange={(e) => onChange(normalizeOtpInput(e.target.value))}
        placeholder="000000"
        dir="ltr"
        className={AUTH_OTP_INPUT}
      />
      {hint}
    </div>
  );
}

export interface PasswordFieldProps {
  id: string;
  label: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  visible: boolean;
  onToggleVisible: () => void;
  minLength?: number;
  autoComplete?: 'new-password' | 'current-password';
  /** Rendered under the input (e.g. the strength meter). */
  children?: React.ReactNode;
}

/** Password input with leading lock icon and show/hide toggle (reset-password flows). */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  visible,
  onToggleVisible,
  minLength,
  autoComplete = 'new-password',
  children,
}: PasswordFieldProps) {
  return (
    <div>
      <label className={AUTH_LABEL} htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          dir="ltr"
          className={AUTH_ICON_INPUT}
        />
        <Lock aria-hidden="true" className="absolute inset-s-3 top-3 h-4 w-4 text-(--text-muted)" />
        <PasswordVisibilityToggle
          visible={visible}
          onToggle={onToggleVisible}
          controls={id}
          className="absolute end-3 top-3 text-(--text-muted) hover:text-(--text-main)"
        />
      </div>
      {children}
    </div>
  );
}
