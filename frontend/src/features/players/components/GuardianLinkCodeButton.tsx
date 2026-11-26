'use client';

import React, { useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';
import { portalApi } from '@/features/portal/api';
import { getErrorMessage } from '@/lib/http/api-error';

/**
 * Staff hand a one-time link code to a guardian they have met (valid 7 days). The guardian enters it in the guardian
 * portal to follow this player. Used for children without their own account, or when the e-mail approval is not
 * possible. Generating a new code replaces the previous one.
 */
export function GuardianLinkCodeButton({
  guardianId,
  locale,
}: {
  guardianId: string;
  locale: 'ar' | 'en';
}) {
  const ar = locale === 'ar';
  const [code, setCode] = useState<{ value: string; expiresAt: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await portalApi.generateClaimToken({
        targetType: 'GUARDIAN',
        targetId: guardianId,
      });
      setCode({ value: res.claimToken, expiresAt: res.expiresAt });
      setCopied(false);
    } catch (err: unknown) {
      setError(getErrorMessage(err, ar ? 'تعذر إنشاء الرمز' : 'Could not create the code'));
    } finally {
      setIsLoading(false);
    }
  };

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  if (code) {
    return (
      <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-2.5 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span dir="ltr" className="font-mono text-sm font-bold tracking-wider text-(--text-main)">
            {code.value}
          </span>
          <button
            type="button"
            onClick={copy}
            aria-label={ar ? 'نسخ الرمز' : 'Copy code'}
            className="h-7 w-7 rounded-md flex items-center justify-center text-purple-600 dark:text-purple-300 hover:bg-purple-500/15"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
        <p className="text-[11px] text-(--text-muted) leading-relaxed">
          {ar
            ? `أعطِ الرمز لولي الأمر ليدخله في بوابة ولي الأمر. صالح حتى ${new Date(code.expiresAt).toLocaleDateString('ar-EG')}، ويُستخدم مرة واحدة.`
            : `Give this code to the guardian to enter in the guardian portal. Valid until ${new Date(code.expiresAt).toLocaleDateString('en-US')}, single use.`}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={generate}
        disabled={isLoading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-(--border-subtle) px-2.5 py-1.5 text-[11px] font-semibold text-(--text-main) hover:bg-(--bg-surface) disabled:opacity-50"
      >
        <KeyRound aria-hidden="true" className="h-3.5 w-3.5 text-purple-500" />
        <span>
          {isLoading
            ? ar
              ? 'جارٍ الإنشاء...'
              : 'Creating...'
            : ar
              ? 'رمز ربط لولي الأمر'
              : 'Guardian link code'}
        </span>
      </button>
      {error && <p className="text-[11px] text-rose-500">{error}</p>}
    </div>
  );
}
