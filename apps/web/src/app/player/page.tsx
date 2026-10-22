'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiClient } from '../../lib/api-client';
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
  const router = useRouter();

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
  const [claimStatus, setClaimStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
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
        text: res.message || 'تم ربط ملف اللاعب بحسابك بنجاح!',
      });
      setClaimTokenInput('');
      await loadPlayerData();
    } catch (err: unknown) {
      setClaimStatus({
        type: 'error',
        text: (err as Error)?.message || 'رمز المطالبة غير صالح أو منتهي الصلاحية',
      });
    } finally {
      setIsClaiming(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-[#45c387]" />
          <p className="text-sm text-[#9bb5a8]">جارٍ تحميل بوابة اللاعب الرياضي...</p>
        </div>
      </div>
    );
  }

  // If user is not yet linked to a player profile, show claim screen
  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a1410] text-[#e8f0ec] py-12">
        <div className="mx-auto max-w-xl px-4 text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#2f9e6b]/20 border border-[#2f9e6b]/40 text-[#45c387]">
            <KeyRound className="h-8 w-8" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-white">ربط ملف اللاعب بحسابك</h1>
            <p className="text-sm text-[#9bb5a8] mt-2 leading-relaxed">
              لم يتم ربط حسابك بملف لاعب حتى الآن. يرجى إدخال رمز المطالبة (Claim Code) الممنوح لك من قِبل إدارة الأكاديمية.
            </p>
          </div>

          {claimStatus && (
            <div
              className={`p-4 rounded-xl border text-xs text-right ${
                claimStatus.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
              }`}
            >
              {claimStatus.text}
            </div>
          )}

          <form onSubmit={handleClaimAccount} className="space-y-4 text-right">
            <div>
              <label className="block text-xs font-semibold text-[#9bb5a8] mb-1.5">
                رمز المطالبة (Claim Code):
              </label>
              <input
                type="text"
                required
                placeholder="مثال: ACAD-A7F2"
                value={claimTokenInput}
                onChange={(e) => setClaimTokenInput(e.target.value)}
                className="w-full font-mono text-center tracking-widest text-lg font-bold rounded-xl border border-[#2b4c3e] bg-[#162821] px-4 py-3 text-white placeholder-[#9bb5a8]/50 focus:border-[#2f9e6b] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isClaiming}
              className="w-full rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] py-3 text-sm font-bold text-[#062016] hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              {isClaiming ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              <span>تأكيد وربط ملف اللاعب</span>
            </button>
          </form>

          <p className="text-xs text-[#9bb5a8]/80">
            للحصول على رمز المطالبة، يرجى التواصل مع إدارة فرع الأكاديمية أو المدرب المسؤول.
          </p>
        </div>
      </div>
    );
  }

  const { profile, upcomingSessions, attendanceSummary, recentEvaluations } = data;

  return (
    <div className="min-h-screen bg-[#0a1410] text-[#e8f0ec] py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Welcome Player Hero Card */}
        <div className="rounded-2xl border border-[#2b4c3e] bg-gradient-to-r from-[#12231c] via-[#162821] to-[#12231c] p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-[#2f9e6b] to-[#45c387] flex items-center justify-center text-[#062016] text-2xl font-black shadow-lg shadow-[#2f9e6b]/20">
                {profile.firstName.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold text-white">
                    أهلاً بك، {profile.firstName} {profile.lastName} ⚽
                  </h1>
                  <span className="rounded-full bg-[#2f9e6b]/20 px-2.5 py-0.5 text-xs font-bold text-[#45c387] border border-[#2f9e6b]/40">
                    لاعب نشط
                  </span>
                </div>
                <div className="text-xs text-[#9bb5a8] flex flex-wrap items-center gap-3">
                  <span>الأكاديمية: {profile.tenantName}</span>
                  <span>•</span>
                  <span>الفرع: {profile.branchName || 'الفرع الرئيسي'}</span>
                  <span>•</span>
                  <span>الفريق: {profile.groupName || 'فريق البراعم'}</span>
                  {profile.headCoachName && (
                    <>
                      <span>•</span>
                      <span>المدرب: {profile.headCoachName}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              {qrCard && (
                <button
                  type="button"
                  id="btn-open-player-card"
                  onClick={() => setShowQrCardModal(true)}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#45c387] px-4 py-3 text-xs font-bold text-[#062016] shadow-lg shadow-[#2f9e6b]/20 hover:brightness-110 transition-all w-full sm:w-auto justify-center cursor-pointer"
                >
                  <QrCode className="h-4 w-4" />
                  <span>بطاقة العضوية الذكية (QR Card)</span>
                </button>
              )}

              <div className="rounded-xl border border-[#2f9e6b]/40 bg-[#162821] p-4 text-center sm:text-right w-full sm:w-auto">
                <span className="text-xs text-[#9bb5a8]">نسبة الالتزام والحضور</span>
                <div className="text-3xl font-extrabold text-[#45c387] mt-0.5">
                  {attendanceSummary.attendanceRate}%
                </div>
                <span className="text-[10px] text-[#9bb5a8] mt-1 block">
                  {profile.totalSessionsAttended} حصة حضور مثبتة
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Attendance Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border border-[#234235] bg-[#12231c] p-4">
            <span className="text-xs text-[#9bb5a8]">إجمالي الحصص المقررة</span>
            <div className="text-2xl font-bold text-white mt-1">{attendanceSummary.totalEligible}</div>
            <span className="text-[11px] text-[#9bb5a8] mt-1 block">حصة تدريبية</span>
          </div>

          <div className="rounded-xl border border-[#234235] bg-[#12231c] p-4">
            <span className="text-xs text-[#9bb5a8]">حضور مبكر ومنضبط</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{attendanceSummary.present}</div>
            <span className="text-[11px] text-emerald-300/80 mt-1 block">في الوقت المحدد</span>
          </div>

          <div className="rounded-xl border border-[#234235] bg-[#12231c] p-4">
            <span className="text-xs text-[#9bb5a8]">حضور متأخر</span>
            <div className="text-2xl font-bold text-amber-400 mt-1">{attendanceSummary.late}</div>
            <span className="text-[11px] text-amber-300/80 mt-1 block">تأخر بعذر / مقبول</span>
          </div>

          <div className="rounded-xl border border-[#234235] bg-[#12231c] p-4">
            <span className="text-xs text-[#9bb5a8]">الغياب</span>
            <div className="text-2xl font-bold text-rose-400 mt-1">{attendanceSummary.absent}</div>
            <span className="text-[11px] text-rose-300/80 mt-1 block">غياب غير محتسب</span>
          </div>
        </div>

        {/* Two Column Layout: Upcoming Schedule & Performance Evaluations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upcoming Training Sessions */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-[#2f9e6b]" />
              <span>جدول الحصص التدريبية القادمة</span>
            </h2>

            {upcomingSessions.length === 0 ? (
              <div className="rounded-xl border border-[#234235] bg-[#12231c] p-8 text-center text-[#9bb5a8]">
                <Clock className="h-10 w-10 text-[#2f9e6b] mx-auto mb-2 opacity-50" />
                <div className="font-semibold text-white">لا توجد حصص قادمة مجدولة حالياً</div>
                <p className="text-xs mt-1">سيتم إشعارك فور قيام المدرب بجدولة التدريبات القادمة.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingSessions.map((session) => (
                  <div
                    key={session.id}
                    className="rounded-xl border border-[#234235] bg-[#12231c] p-4 hover:border-[#2f9e6b]/40 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-bold text-sm text-white">{session.groupName}</h4>
                      <div className="text-xs text-[#9bb5a8] flex items-center gap-3 mt-1">
                        <span>📅 {session.sessionDate}</span>
                        <span>⏰ {session.startTime} - {session.endTime}</span>
                      </div>
                    </div>

                    <div className="text-left text-xs text-[#45c387] font-semibold bg-[#2f9e6b]/10 px-3 py-1.5 rounded-lg border border-[#2f9e6b]/20">
                      {session.branchName || 'الفرع الرئيسي'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Development Evaluations & Coach Feedback */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Award className="h-5 w-5 text-[#2f9e6b]" />
              <span>تقييمات وتوجيهات المدربين المعتمدة</span>
            </h2>

            {recentEvaluations.length === 0 ? (
              <div className="rounded-xl border border-[#234235] bg-[#12231c] p-8 text-center text-[#9bb5a8]">
                <Award className="h-10 w-10 text-amber-400 mx-auto mb-2 opacity-50" />
                <div className="font-semibold text-white">لا توجد تقييمات منشورة حتى الآن</div>
                <p className="text-xs mt-1">
                  يقوم الجهاز التدريبي بتقييم أداء اللاعب بانتظام وستظهر النتائج هنا فور اعتمادها.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentEvaluations.map((evalItem) => (
                  <div
                    key={evalItem.id}
                    className="rounded-xl border border-[#234235] bg-[#12231c] p-5 space-y-4 hover:border-[#2f9e6b]/40 transition-colors"
                  >
                    <div className="flex items-center justify-between border-b border-[#234235] pb-3">
                      <div>
                        <span className="text-xs text-[#9bb5a8]">تاريخ التقييم: {evalItem.evaluationDate}</span>
                        <div className="text-xs font-semibold text-white mt-0.5">
                          المدرب: {evalItem.evaluatorName}
                        </div>
                      </div>
                      <div className="text-left">
                        <span className="text-xs text-[#9bb5a8]">الدرجة العامة:</span>
                        <div className="text-xl font-black text-[#45c387]">
                          {evalItem.overallScore.toFixed(1)} / 10
                        </div>
                      </div>
                    </div>

                    {/* 4 Pillars Badges */}
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div className="bg-[#162821] p-2 rounded-lg">
                        <span className="text-[10px] text-[#9bb5a8] block">فني</span>
                        <span className="font-bold text-white">{evalItem.technicalScore}</span>
                      </div>
                      <div className="bg-[#162821] p-2 rounded-lg">
                        <span className="text-[10px] text-[#9bb5a8] block">تكتيكي</span>
                        <span className="font-bold text-white">{evalItem.tacticalScore}</span>
                      </div>
                      <div className="bg-[#162821] p-2 rounded-lg">
                        <span className="text-[10px] text-[#9bb5a8] block">بدني</span>
                        <span className="font-bold text-white">{evalItem.physicalScore}</span>
                      </div>
                      <div className="bg-[#162821] p-2 rounded-lg">
                        <span className="text-[10px] text-[#9bb5a8] block">سلوكي</span>
                        <span className="font-bold text-white">{evalItem.behavioralScore}</span>
                      </div>
                    </div>

                    {/* Strengths & Improvements */}
                    <div className="space-y-2 text-xs">
                      {evalItem.strengths && (
                        <div className="bg-[#162821] p-3 rounded-lg border-r-2 border-emerald-500">
                          <span className="font-bold text-emerald-400 block mb-0.5">نقاط قوتك:</span>
                          <p className="text-white">{evalItem.strengths}</p>
                        </div>
                      )}

                      {evalItem.areasForImprovement && (
                        <div className="bg-[#162821] p-3 rounded-lg border-r-2 border-amber-500">
                          <span className="font-bold text-amber-400 block mb-0.5">ركز على تطوير:</span>
                          <p className="text-white">{evalItem.areasForImprovement}</p>
                        </div>
                      )}

                      {evalItem.suggestedGoals && (
                        <div className="bg-[#162821] p-3 rounded-lg border-r-2 border-sky-500 flex items-start gap-2">
                          <Target className="h-4 w-4 text-sky-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-sky-400 block mb-0.5">أهدافك القادمة:</span>
                            <p className="text-white">{evalItem.suggestedGoals}</p>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
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
    </div>
  );
}
