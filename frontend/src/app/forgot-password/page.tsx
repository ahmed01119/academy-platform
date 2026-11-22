'use client';

import React, { useState } from 'react';
import { useLocale } from '@/contexts/locale-context';
import { api, getErrorMessage } from '@/api/client';
import { useCooldown } from '@/hooks/useCooldown';
import { useDelayedRedirect } from '@/hooks/useDelayedRedirect';
import { AuthPageLayout } from '@/features/auth/components/AuthPageLayout';
import { AuthCard, BackToSignInLink } from '@/features/auth/components/AuthCard';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { OtpCodeField, PasswordField } from '@/features/auth/components/AuthFields';
import {
  AUTH_ICON_INPUT,
  AUTH_INPUT_BASE,
  AUTH_LABEL,
  AUTH_PRIMARY_ACTION,
} from '@/features/auth/components/auth-styles';
import { validateForgotPasswordReset } from '@/features/auth/password-reset-validation';
import { KeyRound, Mail, Loader2, ArrowRight, Copy } from 'lucide-react';

const RESEND_COOLDOWN_SECONDS = 60;

// Security guard: debug OTP is ONLY shown when accessed via localhost/127.0.0.1.
// (The API only returns `debugOtp` in development with AUTH_EXPOSE_DEBUG_OTP=true.)
const isLocalDevAccess =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

function readDebugOtp(res: unknown): string | null {
  const otpCode = (res as { debugOtp?: string }).debugOtp;
  return otpCode && isLocalDevAccess ? otpCode : null;
}

export default function ForgotPasswordPage() {
  const { locale } = useLocale();

  // Step 1: email entry. Step 2: OTP + new password.
  const [step, setStep] = useState<'email' | 'otp'>('email');

  // Step 1 state
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { remaining: cooldown, start: startCooldown } = useCooldown();

  // Step 2 state
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useDelayedRedirect(resetSuccess, '/login', 3000);

  const requestCode = async () => {
    const res = await api.auth.forgotPassword({ email: email.trim().toLowerCase() });
    const code = readDebugOtp(res);
    if (code) setDebugOtp(code);
    startCooldown(RESEND_COOLDOWN_SECONDS);
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await requestCode();
      setStep('otp');
    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          locale === 'ar'
            ? 'حدث خطأ أثناء معالجة الطلب. يرجى المحاولة لاحقاً.'
            : 'An error occurred. Please try again later.',
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validateForgotPasswordReset(
      { otp, newPassword, confirmPassword },
      locale,
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsResetting(true);
    try {
      await api.auth.resetPassword({
        token: otp.trim(),
        email: email.trim().toLowerCase(),
        newPassword,
      });
      setResetSuccess(true);
    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          locale === 'ar'
            ? 'فشل إعادة تعيين كلمة المرور. قد يكون الرمز غير صحيح أو منتهي الصلاحية.'
            : 'Failed to reset password. The code may be incorrect or expired.',
        ),
      );
    } finally {
      setIsResetting(false);
    }
  };

  const handleCopy = () => {
    if (debugOtp) {
      void navigator.clipboard.writeText(debugOtp);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleResendCode = async () => {
    if (cooldown > 0) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await requestCode();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to resend code.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageLayout>
      <AuthCard
        icon={KeyRound}
        stackHeader
        title={locale === 'ar' ? 'استعادة كلمة المرور' : 'Reset Password'}
        subtitle={
          step === 'email'
            ? locale === 'ar'
              ? 'أدخل بريدك الإلكتروني وسنرسل لك رمز تحقق مكوّن من 6 أرقام'
              : 'Enter your email and we will send you a 6-digit verification code'
            : locale === 'ar'
              ? 'أدخل الرمز المرسل إلى بريدك الإلكتروني وكلمة المرور الجديدة'
              : 'Enter the code sent to your email and your new password'
        }
        footer={
          <BackToSignInLink
            label={locale === 'ar' ? 'العودة إلى صفحة تسجيل الدخول' : 'Back to sign in'}
          />
        }
      >
        {/* Progress indicator */}
        <div className="flex gap-2 mb-6 relative z-10" aria-hidden="true">
          <div className="h-1 flex-1 rounded-full transition-colors bg-(--accent-primary)" />
          <div
            className={`h-1 flex-1 rounded-full transition-colors ${step === 'otp' ? 'bg-(--accent-primary)' : 'bg-(--border-app)'}`}
          />
        </div>

        {error && (
          <AuthAlert tone="error" className="mb-6">
            {error}
          </AuthAlert>
        )}

        {resetSuccess && (
          <AuthAlert tone="success" className="mb-6">
            {locale === 'ar'
              ? 'تم إعادة تعيين كلمة المرور بنجاح! جارٍ التوجيه إلى صفحة تسجيل الدخول...'
              : 'Password reset successfully! Redirecting to login...'}
          </AuthAlert>
        )}

        {/* STEP 1: Email entry */}
        {step === 'email' && (
          <form onSubmit={handleSendCode} className="space-y-5 relative z-10">
            <div>
              <label className={AUTH_LABEL} htmlFor="email">
                {locale === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
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

            <button
              type="submit"
              disabled={isSubmitting || cooldown > 0}
              className={AUTH_PRIMARY_ACTION}
            >
              {isSubmitting ? (
                <>
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  <span>{locale === 'ar' ? 'جارٍ الإرسال...' : 'Sending...'}</span>
                </>
              ) : cooldown > 0 ? (
                <span>
                  {locale === 'ar'
                    ? `إعادة الإرسال بعد ${cooldown} ثانية`
                    : `Resend available in ${cooldown}s`}
                </span>
              ) : (
                <>
                  <span>{locale === 'ar' ? 'إرسال رمز التحقق' : 'Send Verification Code'}</span>
                  <ArrowRight
                    aria-hidden="true"
                    className={`h-4 w-4 ${locale === 'ar' ? 'rotate-180' : ''}`}
                  />
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: OTP + new password */}
        {step === 'otp' && !resetSuccess && (
          <form onSubmit={handleResetPassword} className="space-y-5 relative z-10">
            {/* Debug OTP: localhost only */}
            {debugOtp && isLocalDevAccess && (
              <div className="rounded-xl border border-amber-600/30 bg-amber-500/10 p-4 text-xs space-y-2">
                <div className="flex items-center justify-between text-amber-400">
                  <span className="font-semibold">
                    🔒 {locale === 'ar' ? 'للتطوير المحلي فقط' : 'Local Dev Only'}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-(--accent-primary) hover:underline"
                  >
                    <Copy aria-hidden="true" className="h-3 w-3" />
                    <span>
                      {copied
                        ? locale === 'ar'
                          ? 'تم!'
                          : 'Copied!'
                        : locale === 'ar'
                          ? 'نسخ'
                          : 'Copy'}
                    </span>
                  </button>
                </div>
                <div className="text-center py-2">
                  <span className="font-mono text-2xl font-bold tracking-[0.5em] text-amber-300">
                    {debugOtp}
                  </span>
                </div>
                <p className="text-amber-300/70 text-[10px]">
                  {locale === 'ar'
                    ? 'هذا الرمز لا يظهر في بيئة الإنتاج، يُرسَل عبر البريد الإلكتروني فقط.'
                    : 'This code is never shown in production. Delivered via email only.'}
                </p>
              </div>
            )}

            <OtpCodeField
              id="otp"
              label={locale === 'ar' ? 'رمز التحقق (6 أرقام)' : 'Verification Code (6 digits)'}
              value={otp}
              onChange={setOtp}
              hint={
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-xs text-(--text-muted)">
                    {locale === 'ar' ? `أُرسل إلى ${email}` : `Sent to ${email}`}
                  </p>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={cooldown > 0 || isSubmitting}
                    className="text-xs text-(--accent-primary) hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cooldown > 0
                      ? locale === 'ar'
                        ? `إعادة الإرسال بعد ${cooldown}s`
                        : `Resend in ${cooldown}s`
                      : locale === 'ar'
                        ? 'إعادة إرسال الرمز'
                        : 'Resend code'}
                  </button>
                </div>
              }
            />

            <PasswordField
              id="newPassword"
              label={locale === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}
              value={newPassword}
              onChange={setNewPassword}
              placeholder={
                locale === 'ar' ? 'كلمة مرور قوية (8+ أحرف)' : 'Strong password (8+ chars)'
              }
              minLength={8}
              visible={showPassword}
              onToggleVisible={() => setShowPassword(!showPassword)}
            />

            <div>
              <label className={AUTH_LABEL} htmlFor="confirmPassword">
                {locale === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm Password'}
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={locale === 'ar' ? 'أعد كتابة كلمة المرور' : 'Re-enter password'}
                dir="ltr"
                className={`${AUTH_INPUT_BASE} py-2.5 px-4 text-sm`}
              />
            </div>

            <button type="submit" disabled={isResetting} className={AUTH_PRIMARY_ACTION}>
              {isResetting ? (
                <>
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  <span>{locale === 'ar' ? 'جارٍ إعادة التعيين...' : 'Resetting...'}</span>
                </>
              ) : (
                <>
                  <span>
                    {locale === 'ar' ? 'تأكيد وإعادة التعيين' : 'Confirm & Reset Password'}
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className={`h-4 w-4 ${locale === 'ar' ? 'rotate-180' : ''}`}
                  />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('email');
                setError(null);
                setOtp('');
              }}
              className="w-full text-xs text-(--text-muted) hover:text-(--text-main) transition-colors"
            >
              {locale === 'ar' ? '← تغيير البريد الإلكتروني' : '← Change email address'}
            </button>
          </form>
        )}
      </AuthCard>
    </AuthPageLayout>
  );
}
