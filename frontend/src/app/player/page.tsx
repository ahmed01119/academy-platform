'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { useLocale } from '../../lib/locale-context';
import { translateDataString } from '../../lib/data-translator';
import { apiClient } from '../../lib/api-client';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/ui/PageHeader';
import {
  CalendarCheck,
  Award,
  Clock,
  CheckCircle2,
  RefreshCw,
  KeyRound,
  Target,
  QrCode,
} from 'lucide-react';
import { PlayerQrCard } from '../../components/player-qr-card';
import type {
  PlayerPortalProfile,
  PlayerPortalEvaluation,
  PlayerQrCardResponse,
} from '@academy/shared';

export default function PlayerPortalPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { locale, t } = useLocale();
  const router = useRouter();
  const ar = locale === 'ar';

  const [data, setData] = useState<{
    profile: PlayerPortalProfile;
    upcomingSessions: Array<{
      id: string;
      sessionDate: string;
      startTime: string;
      endTime: string;
      groupName: string;
      branchName?: string;
    }>;
    attendanceSummary: {
      totalEligible: number;
      present: number;
      late: number;
      absent: number;
      attendanceRate: number;
    };
    recentEvaluations: PlayerPortalEvaluation[];
  } | null>(null);

  const [claimTokenInput, setClaimTokenInput] = useState('');
  const [claimStatus, setClaimStatus] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [qrCard, setQrCard] = useState<PlayerQrCardResponse | null>(null);
  const [showQrCardModal, setShowQrCardModal] = useState(false);

  const loadPlayerData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [res, cardRes] = await Promise.all([
        apiClient.portal.getPlayerProfile(),
        apiClient.portal.getMyPlayerQrCard().catch(() => null),
      ]);
      setData(res);
      setQrCard(cardRes);
    } catch {
      setData(null);
      setQrCard(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user) {
      void loadPlayerData();
    }
  }, [user, authLoading, router, loadPlayerData]);

  const handleClaimAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimTokenInput.trim()) return;

    setIsClaiming(true);
    setClaimStatus(null);
    try {
      const res = await apiClient.portal.redeemClaimToken(claimTokenInput.trim());
      setClaimStatus({
        type: 'success',
        text: res.message || (ar ? 'تم ربط ملف اللاعب بحسابك بنجاح!' : 'Player profile successfully linked!'),
      });
      setClaimTokenInput('');
      await loadPlayerData();
    } catch (err: unknown) {
      setClaimStatus({
        type: 'error',
        text: (err as Error)?.message || (ar ? 'رمز المطالبة غير صالح أو منتهي الصلاحية' : 'Invalid or expired claim code'),
      });
    } finally {
      setIsClaiming(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-[var(--accent-primary)]" />
            <p className="text-sm font-medium text-[var(--text-muted)]">
              {ar ? 'جارٍ تحميل بوابة اللاعب الرياضي...' : 'Loading Player Portal...'}
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  // If user is not yet linked to a player profile, show claim screen
  if (!data) {
    return (
      <AppShell>
        <div className="py-8">
          <div className="mx-auto max-w-xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 text-center space-y-6 shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--badge-bg)] text-[var(--accent-primary)]">
              <KeyRound className="h-8 w-8" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-[var(--text-main)]">
                {ar ? 'ربط ملف اللاعب بحسابك' : 'Claim Your Player Profile'}
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-2 leading-relaxed">
                {ar
                  ? 'لم يتم ربط حسابك بملف لاعب حتى الآن. يرجى إدخال رمز المطالبة (Claim Code) الممنوح لك من قِبل إدارة الأكاديمية.'
                  : 'Your account is not linked to an athlete record yet. Enter the activation token provided by the coaching staff.'}
              </p>
            </div>

            {claimStatus && (
              <div
                className={`p-4 rounded-xl border text-xs text-start ${
                  claimStatus.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                }`}
              >
                {claimStatus.text}
              </div>
            )}

            <form onSubmit={handleClaimAccount} className="space-y-4 text-start">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                  {ar ? 'رمز المطالبة (Claim Code):' : 'Claim Token / Code:'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="ACAD-A7F2"
                  value={claimTokenInput}
                  onChange={(e) => setClaimTokenInput(e.target.value)}
                  className="w-full font-mono text-center tracking-widest text-lg font-bold rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-4 py-3 text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isClaiming}
                className="w-full rounded-xl bg-[var(--accent-primary)] py-3 text-sm font-bold text-white hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {isClaiming ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                <span>{ar ? 'تأكيد وربط ملف اللاعب' : 'Claim & Activate Profile'}</span>
              </button>
            </form>

            <p className="text-xs text-[var(--text-muted)]">
              {ar
                ? 'للحصول على رمز المطالبة، يرجى التواصل مع إدارة فرع الأكاديمية أو المدرب المسؤول.'
                : 'Contact your academy desk or coach to receive your secure claim code.'}
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  const { profile, upcomingSessions, attendanceSummary, recentEvaluations } = data;

  const branchDisplay =
    locale === 'en'
      ? translateDataString(profile.branchName, 'en') || 'Main Branch'
      : profile.branchName || 'الفرع الرئيسي';
  const groupDisplay =
    locale === 'en'
      ? translateDataString(profile.groupName, 'en') || 'Junior Squad'
      : profile.groupName || 'فريق البراعم';

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          breadcrumbs={[
            { label: ar ? 'الرئيسية' : 'Home', href: '/dashboard' },
            { label: ar ? 'بوابة اللاعب' : 'Player Portal' },
          ]}
          title={
            ar
              ? `أهلاً بك، ${profile.firstName} ${profile.lastName} ⚽`
              : `Welcome, ${profile.firstName} ${profile.lastName} ⚽`
          }
          description={`${profile.tenantName} • ${branchDisplay} • ${groupDisplay}${profile.headCoachName ? ` • ${ar ? 'المدرب:' : 'Coach:'} ${profile.headCoachName}` : ''}`}
          actions={
            qrCard ? (
              <button
                type="button"
                id="btn-open-player-card"
                onClick={() => setShowQrCardModal(true)}
                className="flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-bold text-white shadow-sm hover:brightness-110 transition-all cursor-pointer"
              >
                <QrCode className="h-4 w-4" />
                <span>{ar ? 'بطاقة العضوية الذكية (QR Card)' : 'Digital QR Pass'}</span>
              </button>
            ) : undefined
          }
        />

        {/* Hero Quick KPI Card */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-[var(--accent-primary)] text-white text-xl font-black flex items-center justify-center shadow-md">
              {profile.firstName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base font-bold text-[var(--text-main)]">
                  {profile.firstName} {profile.lastName}
                </span>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {ar ? 'لاعب نشط' : 'Active Player'}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                {groupDisplay} • {ar ? 'تاريخ الميلاد: ' : 'Date of Birth: '}
                {profile.dateOfBirth
                  ? new Date(profile.dateOfBirth).toLocaleDateString(ar ? 'ar-EG' : 'en-US')
                  : ar ? 'غير محدد' : 'N/A'}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4 text-center sm:text-end w-full sm:w-auto">
            <span className="text-xs text-[var(--text-muted)]">
              {ar ? 'نسبة الالتزام والحضور' : 'Attendance Compliance Rate'}
            </span>
            <div className="text-3xl font-extrabold text-[var(--accent-primary)] mt-0.5">
              {attendanceSummary.attendanceRate}%
            </div>
            <span className="text-[10px] text-[var(--text-muted)] mt-1 block">
              {profile.totalSessionsAttended} {ar ? 'حصة حضور مثبتة' : 'confirmed check-ins'}
            </span>
          </div>
        </div>

        {/* Attendance Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm">
            <span className="text-xs text-[var(--text-muted)]">
              {ar ? 'إجمالي الحصص المقررة' : 'Eligible Sessions'}
            </span>
            <div className="text-2xl font-bold text-[var(--text-main)] mt-1">
              {attendanceSummary.totalEligible}
            </div>
            <span className="text-[11px] text-[var(--text-muted)] mt-1 block">
              {ar ? 'حصة تدريبية' : 'sessions'}
            </span>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm">
            <span className="text-xs text-[var(--text-muted)]">
              {ar ? 'حضور مبكر ومنضبط' : 'On-Time Attendance'}
            </span>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {attendanceSummary.present}
            </div>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400/80 mt-1 block">
              {ar ? 'في الوقت المحدد' : 'checked-in on time'}
            </span>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm">
            <span className="text-xs text-[var(--text-muted)]">
              {ar ? 'حضور متأخر' : 'Late Check-ins'}
            </span>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {attendanceSummary.late}
            </div>
            <span className="text-[11px] text-amber-600 dark:text-amber-400/80 mt-1 block">
              {ar ? 'تأخر مقبول' : 'grace period'}
            </span>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm">
            <span className="text-xs text-[var(--text-muted)]">
              {ar ? 'الغياب' : 'Absences'}
            </span>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
              {attendanceSummary.absent}
            </div>
            <span className="text-[11px] text-rose-600 dark:text-rose-400/80 mt-1 block">
              {ar ? 'غياب غير محتسب' : 'unexcused missed'}
            </span>
          </div>
        </div>

        {/* Two Column Layout: Upcoming Schedule & Performance Evaluations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upcoming Training Sessions */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-[var(--accent-primary)]" />
              <span>{ar ? 'جدول الحصص التدريبية القادمة' : 'Upcoming Training Schedule'}</span>
            </h2>

            {upcomingSessions.length === 0 ? (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 text-center text-[var(--text-muted)] shadow-sm">
                <Clock className="h-10 w-10 text-[var(--accent-primary)] mx-auto mb-2 opacity-50" />
                <div className="font-semibold text-[var(--text-main)]">
                  {ar ? 'لا توجد حصص قادمة مجدولة حالياً' : 'No upcoming sessions scheduled'}
                </div>
                <p className="text-xs mt-1">
                  {ar
                    ? 'سيتم إشعارك فور قيام المدرب بجدولة التدريبات القادمة.'
                    : 'You will receive notifications once new sessions are scheduled.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingSessions.map((session) => (
                  <div
                    key={session.id}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 hover:border-[var(--accent-primary)]/40 transition-colors flex items-center justify-between shadow-sm"
                  >
                    <div>
                      <h4 className="font-bold text-sm text-[var(--text-main)]">
                        {locale === 'en' ? translateDataString(session.groupName, 'en') : session.groupName}
                      </h4>
                      <div className="text-xs text-[var(--text-muted)] flex items-center gap-3 mt-1">
                        <span>📅 {session.sessionDate}</span>
                        <span>
                          ⏰ {session.startTime} - {session.endTime}
                        </span>
                      </div>
                    </div>

                    <div className="text-end text-xs text-[var(--accent-primary)] font-semibold bg-[var(--badge-bg)] px-3 py-1.5 rounded-lg border border-[var(--border-subtle)]">
                      {session.branchName
                        ? locale === 'en'
                          ? translateDataString(session.branchName, 'en')
                          : session.branchName
                        : branchDisplay}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Development Evaluations & Coach Feedback */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
              <Award className="h-5 w-5 text-[var(--accent-primary)]" />
              <span>{ar ? 'تقييمات وتوجيهات المدربين المعتمدة' : 'Official Performance Evaluations'}</span>
            </h2>

            {recentEvaluations.length === 0 ? (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 text-center text-[var(--text-muted)] shadow-sm">
                <Award className="h-10 w-10 text-amber-500 mx-auto mb-2 opacity-50" />
                <div className="font-semibold text-[var(--text-main)]">
                  {ar ? 'لا توجد تقييمات منشورة حتى الآن' : 'No evaluations recorded yet'}
                </div>
                <p className="text-xs mt-1">
                  {ar
                    ? 'يقوم الجهاز التدريبي بتقييم أداء اللاعب بانتظام وستظهر النتائج هنا فور اعتمادها.'
                    : 'The coaching staff evaluates player progress regularly and results appear here.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentEvaluations.map((evalItem) => (
                  <div
                    key={evalItem.id}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-4 hover:border-[var(--accent-primary)]/40 transition-colors shadow-sm"
                  >
                    <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                      <div>
                        <span className="text-xs text-[var(--text-muted)]">
                          {ar ? 'تاريخ التقييم: ' : 'Date: '}{evalItem.evaluationDate}
                        </span>
                        <div className="text-xs font-semibold text-[var(--text-main)] mt-0.5">
                          {ar ? 'المدرب: ' : 'Coach: '}{evalItem.evaluatorName}
                        </div>
                      </div>
                      <div className="text-end">
                        <span className="text-xs text-[var(--text-muted)]">
                          {ar ? 'الدرجة العامة:' : 'Overall Rating:'}
                        </span>
                        <div className="text-xl font-black text-[var(--accent-primary)]">
                          {evalItem.overallScore.toFixed(1)} / 10
                        </div>
                      </div>
                    </div>

                    {/* 4 Pillars Badges */}
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div className="bg-[var(--bg-surface-subtle)] p-2 rounded-lg">
                        <span className="text-[10px] text-[var(--text-muted)] block">
                          {ar ? 'فني' : 'Technical'}
                        </span>
                        <span className="font-bold text-[var(--text-main)]">
                          {evalItem.technicalScore}
                        </span>
                      </div>
                      <div className="bg-[var(--bg-surface-subtle)] p-2 rounded-lg">
                        <span className="text-[10px] text-[var(--text-muted)] block">
                          {ar ? 'تكتيكي' : 'Tactical'}
                        </span>
                        <span className="font-bold text-[var(--text-main)]">
                          {evalItem.tacticalScore}
                        </span>
                      </div>
                      <div className="bg-[var(--bg-surface-subtle)] p-2 rounded-lg">
                        <span className="text-[10px] text-[var(--text-muted)] block">
                          {ar ? 'بدني' : 'Physical'}
                        </span>
                        <span className="font-bold text-[var(--text-main)]">
                          {evalItem.physicalScore}
                        </span>
                      </div>
                      <div className="bg-[var(--bg-surface-subtle)] p-2 rounded-lg">
                        <span className="text-[10px] text-[var(--text-muted)] block">
                          {ar ? 'سلوكي' : 'Discipline'}
                        </span>
                        <span className="font-bold text-[var(--text-main)]">
                          {evalItem.behavioralScore}
                        </span>
                      </div>
                    </div>

                    {/* Strengths & Improvements */}
                    <div className="space-y-2 text-xs">
                      {evalItem.strengths && (
                        <div className="bg-[var(--bg-surface-subtle)] p-3 rounded-lg border-s-2 border-emerald-500">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 block mb-0.5">
                            {ar ? 'نقاط قوتك:' : 'Key Strengths:'}
                          </span>
                          <p className="text-[var(--text-main)]">{evalItem.strengths}</p>
                        </div>
                      )}

                      {evalItem.areasForImprovement && (
                        <div className="bg-[var(--bg-surface-subtle)] p-3 rounded-lg border-s-2 border-amber-500">
                          <span className="font-bold text-amber-600 dark:text-amber-400 block mb-0.5">
                            {ar ? 'ركز على تطوير:' : 'Areas to Improve:'}
                          </span>
                          <p className="text-[var(--text-main)]">{evalItem.areasForImprovement}</p>
                        </div>
                      )}

                      {evalItem.suggestedGoals && (
                        <div className="bg-[var(--bg-surface-subtle)] p-3 rounded-lg border-s-2 border-sky-500 flex items-start gap-2">
                          <Target className="h-4 w-4 text-sky-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-sky-600 dark:text-sky-400 block mb-0.5">
                              {ar ? 'أهدافك القادمة:' : 'Target Milestones:'}
                            </span>
                            <p className="text-[var(--text-main)]">{evalItem.suggestedGoals}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* QR Membership Card Modal */}
        {showQrCardModal && qrCard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-md my-8">
              <PlayerQrCard
                card={qrCard}
                isAdmin={false}
                onClose={() => setShowQrCardModal(false)}
              />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
