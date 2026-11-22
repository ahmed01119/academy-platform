'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, MailCheck, RefreshCw } from 'lucide-react';
import { api } from '@/api/client';
import { useCooldown } from '@/hooks/useCooldown';
import {
  emailCodeErrorMessage,
  looksLikeEmail,
  retryAfterSeconds,
} from '@/features/auth/email-code';

const RESEND_SECONDS = 60;

interface EmailCodeVerificationProps {
  /** The address typed in the form's e-mail field. */
  email: string;
  locale: 'ar' | 'en';
  /** Called with the proof once the code is confirmed, and with null when the address changes afterwards. */
  onProofChange: (proof: string | null) => void;
  disabled?: boolean;
  /** Prefix for element ids (two forms may be on one page). */
  idPrefix: string;
}

/**
 * "Confirm your e-mail" step under an e-mail field: sends a 6-digit code, checks it, and hands the proof to the form.
 * Changing the address after confirming it clears the proof, so the form always submits a confirmed address.
 */
export function EmailCodeVerification({
  email,
  locale,
  onProofChange,
  disabled = false,
  idPrefix,
}: EmailCodeVerificationProps) {
  const isAr = locale === 'ar';
  const normalized = email.trim().toLowerCase();

  const [sentTo, setSentTo] = useState<string | null>(null);
  const [verifiedFor, setVerifiedFor] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'send' | 'verify' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { remaining: cooldown, start: startCooldown } = useCooldown();
  const codeInputRef = useRef<HTMLInputElement>(null);
  const onProofChangeRef = useRef(onProofChange);
  useEffect(() => {
    onProofChangeRef.current = onProofChange;
  }, [onProofChange]);

  const isVerified = verifiedFor !== null && verifiedFor === normalized;
  const codeSentForThisEmail = sentTo !== null && sentTo === normalized;

  // A different address than the confirmed / pending one starts over.
  useEffect(() => {
    if (verifiedFor !== null && verifiedFor !== normalized) {
      setVerifiedFor(null);
      onProofChangeRef.current(null);
    }
    if (sentTo !== null && sentTo !== normalized) {
      setSentTo(null);
      setCode('');
      setError(null);
      setNotice(null);
    }
  }, [normalized, verifiedFor, sentTo]);

  const sendCode = async () => {
    if (!looksLikeEmail(normalized) || busy) return;
    setBusy('send');
    setError(null);
    setNotice(null);
    try {
      await api.auth.sendEmailCode(normalized);
      setSentTo(normalized);
      setCode('');
      startCooldown(RESEND_SECONDS);
      setNotice(
        isAr
          ? `أرسلنا رمزاً من 6 أرقام إلى ${normalized}. افحص صندوق الوارد والرسائل غير المرغوب فيها.`
          : `We sent a 6-digit code to ${normalized}. Check your inbox and spam folder.`,
      );
      setTimeout(() => codeInputRef.current?.focus(), 0);
    } catch (err) {
      const wait = retryAfterSeconds(err);
      if (wait > 0) startCooldown(wait);
      setError(emailCodeErrorMessage(err, locale));
    } finally {
      setBusy(null);
    }
  };

  const verifyCode = async () => {
    if (code.length !== 6 || busy) return;
    setBusy('verify');
    setError(null);
    try {
      const { proof } = await api.auth.verifyEmailCode(normalized, code);
      setVerifiedFor(normalized);
      setNotice(null);
      onProofChangeRef.current(proof);
    } catch (err) {
      setError(emailCodeErrorMessage(err, locale));
    } finally {
      setBusy(null);
    }
  };

  if (isVerified) {
    return (
      <p
        className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-500"
        role="status"
        data-testid={`${idPrefix}-email-verified`}
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>{isAr ? 'تم تأكيد البريد الإلكتروني' : 'Email confirmed'}</span>
      </p>
    );
  }

  const canSend = looksLikeEmail(normalized) && !disabled && busy === null && cooldown === 0;

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-(--border-app) bg-(--bg-surface-subtle) p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-(--text-sub)">
          {codeSentForThisEmail
            ? isAr
              ? 'اكتب الرمز المرسل إلى بريدك.'
              : 'Enter the code sent to your email.'
            : isAr
              ? 'نحتاج إلى التأكد من أن هذا البريد يخصك قبل إرسال الطلب.'
              : 'We need to confirm this email is yours before sending the request.'}
        </p>
        <button
          type="button"
          onClick={sendCode}
          disabled={!canSend}
          id={`${idPrefix}-send-code`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-(--accent-primary)/40 bg-(--accent-primary)/10 px-3 py-1.5 text-xs font-bold text-(--accent-primary) transition-colors hover:bg-(--accent-primary)/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === 'send' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : codeSentForThisEmail ? (
            <RefreshCw className="h-3.5 w-3.5" />
          ) : (
            <MailCheck className="h-3.5 w-3.5" />
          )}
          <span>
            {cooldown > 0
              ? isAr
                ? `إعادة الإرسال بعد ${cooldown} ث`
                : `Resend in ${cooldown}s`
              : codeSentForThisEmail
                ? isAr
                  ? 'إرسال رمز جديد'
                  : 'Send a new code'
                : isAr
                  ? 'إرسال رمز التأكيد'
                  : 'Send verification code'}
          </span>
        </button>
      </div>

      {codeSentForThisEmail && (
        <div className="flex gap-2">
          <label htmlFor={`${idPrefix}-email-code`} className="sr-only">
            {isAr ? 'رمز التأكيد' : 'Verification code'}
          </label>
          <input
            id={`${idPrefix}-email-code`}
            ref={codeInputRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            dir="ltr"
            value={code}
            disabled={disabled}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void verifyCode();
              }
            }}
            placeholder="______"
            className="w-36 rounded-lg border border-(--border-app) bg-(--bg-surface) px-3 py-2 text-center font-mono text-base tracking-[0.4em] text-(--text-main) outline-none focus:border-(--accent-primary) focus:ring-1 focus:ring-(--accent-primary)"
          />
          <button
            type="button"
            onClick={verifyCode}
            disabled={code.length !== 6 || busy !== null || disabled}
            id={`${idPrefix}-verify-code`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-(--accent-primary) px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === 'verify' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{isAr ? 'تأكيد' : 'Confirm'}</span>
          </button>
        </div>
      )}

      {notice && !error && (
        <p className="text-xs text-(--text-muted)" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="text-xs text-rose-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
