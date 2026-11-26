'use client';

import React, { useState } from 'react';
import { CheckCircle2, UserCheck } from 'lucide-react';
import type { AttendanceRosterItem } from '@academy/shared';
import { useLocale } from '@/contexts/locale-context';
import { useToast } from '@/components/ui/Toast';
import { translateDataString, translateStatus } from '@/utils/data-translator';
import { attendanceApi } from '@/features/attendance/api';

export interface QrCheckInSimulatorProps {
  sessionId: string;
  /** Current session QR token; `null` until a code has been generated. */
  token: string | null;
  /** False once the QR code has expired. */
  isTokenValid: boolean;
  roster: AttendanceRosterItem[];
  /** Called after a successful simulated check-in so the page can reload the roster. */
  onCheckedIn: () => Promise<void> | void;
}

/**
 * DEVELOPMENT-ONLY tool: records a QR check-in for a chosen player using the live
 * session token, for testing without a camera. Callers must render it behind
 * `IS_DEVELOPMENT` so the component is compiled out of production builds.
 */
export function QrCheckInSimulator({
  sessionId,
  token,
  isTokenValid,
  roster,
  onCheckedIn,
}: QrCheckInSimulatorProps) {
  const { locale } = useLocale();
  const { toast } = useToast();
  const [playerId, setPlayerId] = useState(roster[0]?.playerId ?? '');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSimulate = async () => {
    if (!token || !playerId) return;
    try {
      await attendanceApi.checkInViaQr(sessionId, { token, playerId });
      toast.success(
        locale === 'en'
          ? 'Attendance recorded via QR code successfully!'
          : 'تم تسجيل الحضور عبر رمز QR بنجاح!',
      );
      setSuccessMessage(
        locale === 'en'
          ? 'Attendance recorded via QR successfully!'
          : 'تم تسجيل الحضور عبر QR بنجاح!',
      );
      await onCheckedIn();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : locale === 'en'
            ? 'Failed to check in via QR'
            : 'فشل التحضير بالرمز',
      );
    }
  };

  return (
    <div className="rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) p-4 space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-bold text-(--text-main)">
        <UserCheck className="h-4 w-4 text-(--accent-primary)" />
        <span>
          {locale === 'en'
            ? 'Player Check-in Simulator (Quick QR)'
            : 'محاكي المسح للاعب (Quick QR Scanner)'}
        </span>
      </div>
      <p className="text-[11px] text-(--text-muted)">
        {locale === 'en'
          ? 'For testing without a camera, select a player and simulate scan with current token:'
          : 'للاختبار دون ماسح ضوئي كاميرا، اختر لاعباً وانقر لتسجيل حضوره بالرمز الحالي:'}
      </p>

      {successMessage && (
        <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 p-2 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <select
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
          aria-label={locale === 'en' ? 'Player to check in' : 'اللاعب المراد تحضيره'}
          className="flex-1 rounded-xl border border-(--border-subtle) bg-(--bg-surface) px-3 py-2 text-xs text-(--text-main) focus:outline-none"
        >
          {roster.map((r) => (
            <option key={r.playerId} value={r.playerId}>
              {translateDataString(r.playerName, locale)} ({translateStatus(r.status, locale)})
            </option>
          ))}
        </select>

        <button
          type="button"
          id="btn-simulate-qr-checkin"
          disabled={!token || !isTokenValid}
          onClick={handleSimulate}
          className="rounded-xl bg-(--accent-primary) px-3.5 py-2 text-xs font-bold text-white hover:brightness-110 disabled:opacity-50"
        >
          {locale === 'en' ? 'Check In' : 'تسجيل بالرمز'}
        </button>
      </div>
    </div>
  );
}
