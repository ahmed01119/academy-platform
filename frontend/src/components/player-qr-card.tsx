'use client';

import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Printer,
  Download,
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  X,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import type { PlayerQrCardResponse } from '@academy/shared';
import { apiClient } from '@/api/client';
import { useLocale } from '@/contexts/locale-context';

interface PlayerQrCardProps {
  card: PlayerQrCardResponse;
  isAdmin?: boolean;
  onCardUpdated?: (newCard: PlayerQrCardResponse) => void;
  onClose?: () => void;
}

export function PlayerQrCard({ card, isAdmin = false, onCardUpdated, onClose }: PlayerQrCardProps) {
  const { locale } = useLocale();
  const ar = locale === 'ar';

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isRotating, setIsRotating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (card?.qrCardCode) {
      QRCode.toDataURL(card.qrCardCode, {
        width: 256,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate QR code data URL:', err));
    }
  }, [card?.qrCardCode]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR-${card.membershipNumber || card.playerId}.png`;
    link.click();
  };

  const handleRotate = async () => {
    setIsRotating(true);
    setStatusMessage(null);
    try {
      const updated = await apiClient.players.rotateQrCard(card.playerId, {
        reason: 'Rotated from portal/admin card viewer',
      });
      setShowRotateConfirm(false);
      setStatusMessage({
        type: 'success',
        text: ar ? 'تم استبدال وتدوير رمز البطاقة بنجاح' : 'Card QR rotated and renewed successfully',
      });
      onCardUpdated?.(updated);
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: (err as Error)?.message || (ar ? 'فشل تدوير رمز البطاقة' : 'Failed to rotate QR card'),
      });
    } finally {
      setIsRotating(false);
    }
  };

  const handleRevoke = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokeReason.trim() || revokeReason.trim().length < 3) return;

    setIsRevoking(true);
    setStatusMessage(null);
    try {
      const updated = await apiClient.players.revokeQrCard(card.playerId, {
        reason: revokeReason.trim(),
      });
      setShowRevokeModal(false);
      setRevokeReason('');
      setStatusMessage({
        type: 'success',
        text: ar ? 'تم إلغاء صلاحية البطاقة بنجاح' : 'Card access revoked successfully',
      });
      onCardUpdated?.(updated);
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: (err as Error)?.message || (ar ? 'فشل إلغاء البطاقة' : 'Failed to revoke card'),
      });
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Printable Physical Card Layout */}
      <div
        ref={cardRef}
        id="printable-player-card"
        className="relative mx-auto w-full max-w-sm overflow-hidden rounded-3xl border-2 border-[#0A3BFF]/40 bg-gradient-to-b from-[#0d1f3c] via-[#0a1628] to-[#060d1a] p-6 shadow-2xl text-white print:border-black print:bg-white print:text-black print:shadow-none"
      >
        {/* Decorative Top Accent Glow */}
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-[#0A3BFF] via-[#0077FF] to-[#00D6FF] print:hidden" />

        {/* Card Header: Academy Branding */}
        <div className="flex items-center justify-between border-b border-[#1e3a5f] pb-4 print:border-gray-300">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-[#0a3bff] to-[#00d6ff] text-white font-black text-lg shadow-md print:bg-gray-200">
              ⚽
            </div>
            <div>
              <h3 className="text-sm font-extrabold tracking-tight text-white print:text-black">
                {card.academyName}
              </h3>
              <p className="text-[10px] font-semibold text-[#8ca89a] print:text-gray-600">
                {ar ? 'بطاقة عضوية رياضية معتمدة' : 'Official Athletic Member Pass'}
              </p>
            </div>
          </div>

          <div>
            {card.isRevoked ? (
              <span className="flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-500/40">
                <ShieldAlert className="h-3 w-3" />
                {ar ? 'ملغاة' : 'Revoked'}
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-[#22C55E]/20 px-2 py-0.5 text-[10px] font-bold text-[#4ADE80] border border-[#22C55E]/40 print:text-black">
                <ShieldCheck className="h-3 w-3 text-[#22C55E]" />
                {ar ? 'عضوية نشطة' : 'Active Member'}
              </span>
            )}
          </div>
        </div>

        {/* Player Profile & Details */}
        <div className="mt-5 flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0d1f3c] to-[#0a1628] border border-[#0A3BFF]/40 text-xl font-bold text-[#00D6FF] shadow-inner print:border-gray-400 print:text-black">
            {card.photoUrl ? (
              <img
                src={card.photoUrl}
                alt={card.playerName}
                className="h-full w-full rounded-2xl object-cover"
              />
            ) : (
              card.playerName.slice(0, 2).toUpperCase()
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold text-white print:text-black">
              {card.playerName}
            </h2>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-[10px] text-[#8ca89a] print:text-gray-600">
                {ar ? 'رقم العضوية:' : 'Member ID:'}
              </span>
              <span className="font-mono text-xs font-bold tracking-wider text-[#00D6FF] bg-[#0d1f3c] px-2 py-0.5 rounded border border-[#1e3a5f] print:border-gray-400 print:text-black">
                {card.membershipNumber}
              </span>
            </div>
            <div className="mt-1 text-[10px] text-[#8ca89a] print:text-gray-600">
              {ar ? 'تاريخ الإصدار: ' : 'Issued: '}
              {new Date(card.issuedAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}
            </div>
          </div>
        </div>

        {/* Center QR Code Container */}
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-[#1e3a5f] bg-[#060d1a] p-4 shadow-inner print:bg-white print:border-gray-300">
          {qrDataUrl ? (
            <div className="rounded-xl bg-white p-2.5 shadow-md">
              <img
                src={qrDataUrl}
                alt={`QR ${card.membershipNumber}`}
                className="h-44 w-44 object-contain"
              />
            </div>
          ) : (
            <div className="flex h-44 w-44 items-center justify-center text-slate-400">
              <QrCode className="h-10 w-10 animate-pulse text-[#00D6FF]" />
            </div>
          )}

          <p className="mt-3 text-center text-[10px] font-medium text-[#8ca89a] print:text-gray-600">
            {ar
              ? 'امسح الرمز عند بوابة الملعب لتسجيل الحضور الفوري'
              : 'Scan at the gate for instant contactless check-in'}
          </p>
          <div className="mt-1 text-center font-mono text-[9px] text-[#6b8577] print:text-gray-500 break-all select-all">
            {card.qrCardCode.slice(0, 8)}••••••••{card.qrCardCode.slice(-4)}
          </div>
        </div>

        {/* Card Footer */}
        <div className="mt-5 pt-3 border-t border-[#1e3a5f] text-center text-[9px] text-[#6b8577] print:text-gray-500 print:border-gray-300">
          {ar
            ? 'سبورتكسس — منصة واحدة. لكل أكاديمية. • SPORTEXUS'
            : 'SPORTEXUS — One Platform. Every Academy.'}
        </div>
      </div>

      {/* Action Buttons Toolbar */}
      <div className="flex flex-wrap items-center justify-center gap-3 print:hidden">
        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-2 rounded-xl bg-[#0d1f3c] border border-[#1e3a5f] px-4 py-2.5 text-xs font-bold text-white hover:border-[#00D6FF] hover:bg-[#142040] transition-colors cursor-pointer"
        >
          <Printer className="h-4 w-4 text-[#00D6FF]" />
          <span>{ar ? 'طباعة البطاقة / حفظ كـ PDF' : 'Print Pass / Save as PDF'}</span>
        </button>

        <button
          type="button"
          onClick={handleDownloadQr}
          disabled={!qrDataUrl}
          className="flex items-center gap-2 rounded-xl bg-[#0d1f3c] border border-[#1e3a5f] px-4 py-2.5 text-xs font-bold text-white hover:border-[#00D6FF] hover:bg-[#142040] transition-colors disabled:opacity-50 cursor-pointer"
        >
          <Download className="h-4 w-4 text-[#00D6FF]" />
          <span>{ar ? 'تحميل صورة الرمز' : 'Download QR Image'}</span>
        </button>

        {isAdmin && !card.isRevoked && (
          <button
            type="button"
            onClick={() => setShowRotateConfirm(true)}
            className="flex items-center gap-2 rounded-xl bg-[#2a2416] border border-[#59492b] px-4 py-2.5 text-xs font-bold text-amber-200 hover:border-amber-400 hover:bg-[#382f1b] transition-colors cursor-pointer"
          >
            <RotateCw className="h-4 w-4 text-amber-400" />
            <span>{ar ? 'استبدال / تدوير الرمز (Lost Card)' : 'Rotate / Renew QR Code'}</span>
          </button>
        )}

        {isAdmin && !card.isRevoked && (
          <button
            type="button"
            onClick={() => setShowRevokeModal(true)}
            className="flex items-center gap-2 rounded-xl bg-[#2a1616] border border-[#592b2b] px-4 py-2.5 text-xs font-bold text-rose-200 hover:border-rose-400 hover:bg-[#381b1b] transition-colors cursor-pointer"
          >
            <ShieldAlert className="h-4 w-4 text-rose-400" />
            <span>{ar ? 'إلغاء البطاقة' : 'Revoke Card Pass'}</span>
          </button>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-transparent px-4 py-2.5 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
            <span>{ar ? 'إغلاق' : 'Close'}</span>
          </button>
        )}
      </div>

      {/* Rotate Confirmation Modal */}
      {showRotateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-[#0d1f3c] p-6 shadow-2xl space-y-4 text-start">
            <div className="flex items-center gap-3 text-amber-400">
              <RotateCw className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-bold text-white">
                {ar ? 'تأكيد استبدال وتدوير رمز البطاقة' : 'Confirm QR Pass Rotation'}
              </h3>
            </div>
            <p className="text-xs text-[#8ca89a] leading-relaxed">
              {ar
                ? 'سيؤدي تدوير الرمز إلى إبطال البطاقة الحالية فوراً وتوليد رمز QR مشفر جديد تماماً. استخدم هذا الخيار إذا فقد اللاعب بطاقته المطبوعة.'
                : 'Rotating this card will immediately invalidate the existing QR code and generate a fresh cryptographic token. Use this if the player lost their physical card.'}
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isRotating}
                onClick={() => setShowRotateConfirm(false)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:text-white cursor-pointer"
              >
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isRotating}
                onClick={handleRotate}
                className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-black hover:bg-amber-400 transition-colors cursor-pointer"
              >
                {isRotating && <RotateCw className="h-3.5 w-3.5 animate-spin" />}
                <span>{ar ? 'نعم، استبدل الرمز فوراً' : 'Yes, Rotate Token Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Card Modal */}
      {showRevokeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleRevoke}
            className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-[#0d1f3c] p-6 shadow-2xl space-y-4 text-start"
          >
            <div className="flex items-center gap-3 text-rose-400">
              <ShieldAlert className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-bold text-white">
                {ar ? 'إلغاء صلاحية بطاقة العضوية' : 'Revoke Member Pass Access'}
              </h3>
            </div>
            <p className="text-xs text-[#8ca89a] leading-relaxed">
              {ar
                ? 'يرجى ذكر سبب إلغاء البطاقة (مطلوب لأغراض التدقيق وسجل التغييرات):'
                : 'Please state the reason for revocation (required for audit logging):'}
            </p>
            <div>
              <input
                type="text"
                required
                placeholder={
                  ar
                    ? 'مثال: إيقاف مؤقت للاعب أو تأخر سداد الاشتراك'
                    : 'e.g. Temporary suspension or subscription lapse'
                }
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-[#060d1a] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isRevoking}
                onClick={() => setShowRevokeModal(false)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:text-white cursor-pointer"
              >
                {ar ? 'تراجع' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isRevoking || !revokeReason.trim()}
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isRevoking && <RotateCw className="h-3.5 w-3.5 animate-spin" />}
                <span>{ar ? 'تأكيد الإلغاء' : 'Confirm Revocation'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default PlayerQrCard;
