'use client';

import React, { useState } from 'react';
import { Mail, Send } from 'lucide-react';
import { ApiError } from '@/lib/http/api-error';
import { portalApi } from '@/features/portal/api';

/**
 * "Link my child by e-mail" (owner decision 2026-11-24): for a child who already has a player account. The guardian
 * types the child's sign-in e-mail and their own phone as the academy registered it; the child gets an e-mail to
 * approve. The answer never says whether anything matched, so the message is the same in every case.
 */
export function GuardianLinkByEmail({ locale }: { locale: 'ar' | 'en' }) {
  const ar = locale === 'ar';
  const [childEmail, setChildEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setResult(null);
    try {
      await portalApi.requestGuardianLink({ childEmail: childEmail.trim(), phone: phone.trim() });
      setResult({
        ok: true,
        text: ar
          ? 'إذا كان البريد لحساب لاعب ورقمك مسجّلاً عند الأكاديمية كولي أمره، فسيصله بريد ليوافق. بعد موافقته يظهر ابنك هنا ويصلك إشعار.'
          : 'If the e-mail belongs to a player and the academy has your phone as their guardian, they will get an e-mail to approve. Once they approve, your child appears here and you get a notification.',
      });
      setChildEmail('');
    } catch (err: unknown) {
      const limited = err instanceof ApiError && err.statusCode === 429;
      setResult({
        ok: false,
        text: limited
          ? ar
            ? 'محاولات كثيرة. حاول مرة أخرى بعد ساعة.'
            : 'Too many requests. Please try again in an hour.'
          : ar
            ? 'تعذر إرسال الطلب. تأكد من البريد والرقم وحاول مرة أخرى.'
            : 'Could not send the request. Check the e-mail and phone and try again.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-3.5 py-2.5 text-sm text-(--text-main) placeholder:text-(--text-muted) focus:border-purple-500 focus:outline-none';

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-start">
      <p className="text-xs text-(--text-muted) leading-relaxed">
        {ar
          ? 'لابنك حساب لاعب؟ اكتب بريده الذي يدخل به، ورقم هاتفك كما سجّلته الأكاديمية. سيصله بريد ليوافق على الربط.'
          : 'Does your child have a player account? Enter the e-mail they sign in with, and your phone as the academy registered it. They will get an e-mail to approve the link.'}
      </p>

      {result && (
        <div
          role="status"
          className={`p-3 rounded-xl border text-xs ${
            result.ok
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
          }`}
        >
          {result.text}
        </div>
      )}

      <div>
        <label
          htmlFor="guardian-link-child-email"
          className="block text-xs font-semibold text-(--text-muted) mb-1"
        >
          {ar ? 'بريد ابنك الإلكتروني' : "Your child's e-mail"}
        </label>
        <input
          id="guardian-link-child-email"
          type="email"
          required
          dir="ltr"
          autoComplete="off"
          value={childEmail}
          onChange={(e) => setChildEmail(e.target.value)}
          placeholder="name@example.com"
          className={inputClass}
        />
      </div>
      <div>
        <label
          htmlFor="guardian-link-phone"
          className="block text-xs font-semibold text-(--text-muted) mb-1"
        >
          {ar ? 'رقم هاتفك (المسجّل عند الأكاديمية)' : 'Your phone (as the academy registered it)'}
        </label>
        <input
          id="guardian-link-phone"
          type="tel"
          required
          dir="ltr"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="01XXXXXXXXX"
          className={`${inputClass} font-mono`}
        />
      </div>
      <button
        type="submit"
        disabled={isSending || !childEmail.trim() || !phone.trim()}
        className="w-full rounded-xl bg-purple-600 py-2.5 text-sm font-bold text-white hover:bg-purple-700 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
      >
        {isSending ? <Mail className="h-4 w-4 animate-pulse" /> : <Send className="h-4 w-4" />}
        <span>{ar ? 'إرسال طلب الربط' : 'Send link request'}</span>
      </button>
    </form>
  );
}
