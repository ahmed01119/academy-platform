import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { KeyRound } from 'lucide-react';
import { LocaleProvider } from '@/contexts/locale-context';
import { AuthAlert } from './AuthAlert';
import { AuthCard, BackToSignInLink } from './AuthCard';
import { OtpCodeField, normalizeOtpInput, PasswordField } from './AuthFields';
import { PasswordVisibilityToggle } from './PasswordVisibilityToggle';

const withLocale = (node: React.ReactNode) =>
  renderToStaticMarkup(<LocaleProvider>{node}</LocaleProvider>);

describe('AuthAlert', () => {
  it('announces errors assertively and success politely', () => {
    expect(renderToStaticMarkup(<AuthAlert tone="error">Bad</AuthAlert>)).toContain('role="alert"');
    expect(renderToStaticMarkup(<AuthAlert tone="success">Ok</AuthAlert>)).toContain(
      'role="status"',
    );
  });

  it('keeps the existing design-system colours', () => {
    const error = renderToStaticMarkup(<AuthAlert tone="error">x</AuthAlert>);
    expect(error).toContain('border-rose-500/30');
    expect(error).toContain('text-rose-300');
    const panel = renderToStaticMarkup(
      <AuthAlert tone="success" size="panel" title="Done">
        body
      </AuthAlert>,
    );
    expect(panel).toContain('text-[#4ADE80]');
    expect(panel).toContain('text-[#86EFAC]');
    expect(panel).toContain('<h3');
  });
});

describe('PasswordVisibilityToggle', () => {
  it('has a localized accessible name and pressed state', () => {
    const hidden = withLocale(
      <PasswordVisibilityToggle
        visible={false}
        onToggle={() => undefined}
        className="x"
        controls="pw"
      />,
    );
    expect(hidden).toContain('aria-label="إظهار كلمة المرور"'); // Arabic is the default locale
    expect(hidden).toContain('aria-pressed="false"');
    expect(hidden).toContain('aria-controls="pw"');
    expect(hidden).toContain('type="button"'); // never submits the form

    const shown = withLocale(
      <PasswordVisibilityToggle visible onToggle={() => undefined} className="x" />,
    );
    expect(shown).toContain('aria-label="إخفاء كلمة المرور"');
    expect(shown).toContain('aria-pressed="true"');
  });
});

describe('AuthFields', () => {
  it('normalizes OTP input to at most 6 digits', () => {
    expect(normalizeOtpInput('12a3-45 678')).toBe('123456');
  });

  it('OTP field is a labelled numeric one-time-code input', () => {
    const html = renderToStaticMarkup(
      <OtpCodeField id="otp" label="Code" value="" onChange={() => undefined} />,
    );
    expect(html).toContain('for="otp"');
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('autoComplete="one-time-code"');
    expect(html).toContain('maxLength="6"');
  });

  it('password field masks by default and is labelled', () => {
    const html = withLocale(
      <PasswordField
        id="pw"
        label="New password"
        value=""
        onChange={() => undefined}
        placeholder="p"
        visible={false}
        onToggleVisible={() => undefined}
      />,
    );
    expect(html).toContain('for="pw"');
    expect(html).toContain('type="password"');
    expect(html).toContain('autoComplete="new-password"');
  });
});

describe('AuthCard', () => {
  it('renders the heading, content and footer link', () => {
    const html = renderToStaticMarkup(
      <AuthCard
        icon={KeyRound}
        title="Reset Password"
        subtitle="sub"
        footer={<BackToSignInLink label="Back" />}
      >
        <p>content</p>
      </AuthCard>,
    );
    expect(html).toContain('<h1');
    expect(html).toContain('Reset Password');
    expect(html).toContain('content');
    expect(html).toContain('href="/login"');
  });
});
