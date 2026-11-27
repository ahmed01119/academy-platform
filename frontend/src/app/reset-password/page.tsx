'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useLocale } from '@/contexts/locale-context';
import { PostLoginSkeleton } from '@/features/auth/components/PostLoginSkeleton';
import { getRoleHomeRoute } from '@/utils/role-routing';
import { api, getErrorMessage } from '@/api/client';
import { PasswordStrengthMeter } from '@/components/ui/PasswordStrengthMeter';
import { useDelayedRedirect } from '@/hooks/useDelayedRedirect';
import { AuthPageLayout, AuthPageSuspense } from '@/features/auth/components/AuthPageLayout';
import { AuthCard, BackToSignInLink } from '@/features/auth/components/AuthCard';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { OtpCodeField, PasswordField } from '@/features/auth/components/AuthFields';
import { AUTH_ICON_INPUT, AUTH_LABEL } from '@/features/auth/components/auth-styles';
import {
  buildResetPasswordPayload,
  hasResetSecret,
  readResetLinkParams,
} from '@/features/auth/reset-link';
import { AUTH_PRIMARY_ACTION } from '@/features/auth/components/auth-styles';
import { validateResetPasswordForm } from '@/features/auth/password-reset-validation';
import { KeyRound, ArrowRight, Loader2, Mail } from 'lucide-react';

function ResetPasswordForm() {
  const { locale, isRtl } = useLocale();
  const router = useRouter();
  const { user, activeTenant, refreshUser } = useAuth();

  const [token, setToken] = useState('');
  /** 64-hex token from the e-mailed link (or an activation link); never shown or editable. */
  const [linkToken, setLinkToken] = useState<string | undefined>(undefined);
  /** Invitation link: set the first password and go straight into the app (owner request 2026-11-27). */
  const [activate, setActivate] = useState(false);
  /** The server signed this device in with the new password; the app opens instead of the sign-in page. */
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useDelayedRedirect(success && !signedIn, '/login', 3000);

  useEffect(() => {
    if (!signedIn) return;
    router.replace(user ? getRoleHomeRoute(user, activeTenant) : '/login');
  }, [signedIn, user, activeTenant, router]);

  useEffect(() => {
    // K1: the link carries its token in the URL fragment (never sent to servers). Read it once, then remove it
    // from the address bar and the history entry so it cannot leak through copy/paste, screenshots or history.
    const params = readResetLinkParams(window.location.hash, window.location.search);
    if (params.linkToken) setLinkToken(params.linkToken);
    if (params.code) setToken(params.code);
    if (params.email) setEmail(params.email);
    if (params.activate) setActivate(true);
    if (hasResetSecret(params)) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validateResetPasswordForm(
      { token, password, confirmPassword, linkToken, email },
      locale,
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await api.auth.resetPassword(
        buildResetPasswordPayload({
          linkToken,
          code: token,
          email,
          newPassword: password,
          activate,
        }),
      );
      if (result.signedIn) {
        try {
          localStorage.setItem('sportexus_has_session', 'true');
        } catch {
          // Storage unavailable: the session cookies alone keep the user signed in.
        }
        // Load the new session; the effect above then opens the user's home. If it cannot be loaded the user stays
        // signed out and the page falls back to the usual "sign in" redirect (the password is set either way).
        await refreshUser();
        setSignedIn(true);
      }
      setSuccess(true);
    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          locale === 'ar'
            ? 'فشل إعادة ضبط كلمة المرور. قد يكون الرمز غير صحيح أو منتهي الصلاحية.'
            : 'Failed to reset password. The token may be invalid or expired.',
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (signedIn) {
    return (
      <PostLoginSkeleton destination={user ? getRoleHomeRoute(user, activeTenant) : '/dashboard'} />
    );
  }

  return (
    <AuthCard
      icon={KeyRound}
      stackHeader
      title={
        activate
          ? locale === 'ar'
            ? 'تفعيل حسابك'
            : 'Activate your account'
          : locale === 'ar'
            ? 'إعادة تعيين كلمة المرور'
            : 'Reset Password'
      }
      subtitle={
        activate
          ? locale === 'ar'
            ? 'اختر كلمة المرور الخاصة بك، وبعدها تفتح لوحة التحكم مباشرة'
            : 'Choose your password, then your dashboard opens right away'
          : locale === 'ar'
            ? 'أدخل رمز التحقق (OTP) المكوّن من 6 أرقام وكلمة المرور الجديدة'
            : 'Enter your 6-digit verification code (OTP) and new password'
      }
      headerExtra={
        email && (
          <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-(--bg-surface-subtle) border border-(--border-subtle) text-xs text-(--text-muted) font-mono">
            <Mail aria-hidden="true" className="h-3 w-3 text-(--accent-primary)" />
            <span>{email}</span>
          </div>
        )
      }
      footer={
        <BackToSignInLink label={locale === 'ar' ? 'العودة إلى تسجيل الدخول' : 'Back to sign in'} />
      }
    >
      {error && (
        <AuthAlert tone="error" className="mb-6">
          {error}
        </AuthAlert>
      )}

      {success && (
        <AuthAlert tone="success" className="mb-6">
          {locale === 'ar'
            ? 'تم تغيير كلمة المرور بنجاح! يتم تحويلك تلقائياً لصفحة تسجيل الدخول...'
            : 'Password changed successfully! Redirecting to sign in...'}
        </AuthAlert>
      )}

      {!success && (
        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          {linkToken ? (
            <AuthAlert tone="success" size="compact">
              {activate
                ? locale === 'ar'
                  ? 'تم التعرف على رابط الدعوة. اختر كلمة المرور الخاصة بك.'
                  : 'Invitation link recognised. Choose your password.'
                : locale === 'ar'
                  ? 'تم التعرف على رابط إعادة التعيين. اختر كلمة مرور جديدة.'
                  : 'Reset link recognised. Choose a new password.'}
            </AuthAlert>
          ) : (
            <>
              <div>
                <label htmlFor="email" className={AUTH_LABEL}>
                  {locale === 'ar' ? 'البريد الإلكتروني *' : 'Email Address *'}
                </label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    dir="ltr"
                    className={AUTH_ICON_INPUT}
                  />
                  <Mail
                    aria-hidden="true"
                    className="absolute inset-s-3 top-3 h-4 w-4 text-(--text-muted)"
                  />
                </div>
              </div>
              <OtpCodeField
                id="token"
                label={
                  locale === 'ar' ? 'رمز التحقق (6 أرقام) *' : 'Verification Code (6 digits) *'
                }
                value={token}
                onChange={setToken}
              />
            </>
          )}

          <PasswordField
            id="password"
            label={locale === 'ar' ? 'كلمة المرور الجديدة *' : 'New Password *'}
            value={password}
            onChange={setPassword}
            placeholder={
              locale === 'ar' ? 'كلمة مرور قوية (8+ أحرف)' : 'Strong password (8+ chars)'
            }
            minLength={8}
            visible={showPassword}
            onToggleVisible={() => setShowPassword(!showPassword)}
          >
            <PasswordStrengthMeter password={password} locale={locale} showChecklist={true} />
          </PasswordField>

          <PasswordField
            id="confirmPassword"
            label={locale === 'ar' ? 'تأكيد كلمة المرور الجديدة *' : 'Confirm New Password *'}
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder={locale === 'ar' ? 'أعد كتابة كلمة المرور' : 'Re-enter password'}
            visible={showConfirmPassword}
            onToggleVisible={() => setShowConfirmPassword(!showConfirmPassword)}
          />

          <button type="submit" disabled={isSubmitting} className={AUTH_PRIMARY_ACTION}>
            {isSubmitting ? (
              <>
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                <span>{locale === 'ar' ? 'جارٍ الحفظ...' : 'Saving...'}</span>
              </>
            ) : (
              <>
                <span>
                  {activate
                    ? locale === 'ar'
                      ? 'تم، افتح لوحة التحكم'
                      : 'Done, open my dashboard'
                    : locale === 'ar'
                      ? 'تأكيد كلمة المرور الجديدة'
                      : 'Confirm New Password'}
                </span>
                <ArrowRight aria-hidden="true" className={`h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
              </>
            )}
          </button>
        </form>
      )}
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthPageLayout>
      <AuthPageSuspense>
        <ResetPasswordForm />
      </AuthPageSuspense>
    </AuthPageLayout>
  );
}
