'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiClient } from '../../lib/api-client';
import {
  HeartHandshake,
  Award,
  CalendarCheck,
  CheckCircle2,
  RefreshCw,
  PlusCircle,
  ChevronLeft,
} from 'lucide-react';
import type { GuardianPortalData, PlayerEvaluation } from '@academy/shared';

export default function GuardianPortalPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [guardianData, setGuardianData] = useState<GuardianPortalData | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [childEvaluations, setChildEvaluations] = useState<PlayerEvaluation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Claim account state
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [claimTokenInput, setClaimTokenInput] = useState('');
  const [claimStatus, setClaimStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);

  const loadGuardianData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.portal.getGuardianProfile();
      setGuardianData(data);
      if (data.children.length > 0 && !selectedChildId) {
        setSelectedChildId(data.children[0]!.playerId);
      }
    } catch {
      setGuardianData(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedChildId]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user) {
      void loadGuardianData();
    }
  }, [user, authLoading, router, loadGuardianData]);

  // Load evaluations for currently selected child
  useEffect(() => {
    if (!selectedChildId) return;

    const loadEvals = async () => {
      try {
        const evals = await apiClient.evaluations.listPlayerEvaluations(selectedChildId);
        setChildEvaluations(evals || []);
      } catch {
        setChildEvaluations([]);
      }
    };

    void loadEvals();
  }, [selectedChildId]);

  const handleClaimChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimTokenInput.trim()) return;

    setIsClaiming(true);
    setClaimStatus(null);
    try {
      const res = await apiClient.portal.redeemClaimToken(claimTokenInput.trim());
      setClaimStatus({
        type: 'success',
        text: res.message || 'تم ربط حساب اللاعب بحساب ولي الأمر بنجاح!',
      });
      setClaimTokenInput('');
      await loadGuardianData();
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
          <p className="text-sm text-[#9bb5a8]">جارٍ تحميل بوابة ولي الأمر...</p>
        </div>
      </div>
    );
  }

  // If user does not have a linked guardian profile yet, prompt to claim child
  if (!guardianData || guardianData.children.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a1410] text-[#e8f0ec] py-12">
        <div className="mx-auto max-w-xl px-4 text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/20 border border-purple-500/40 text-purple-400">
            <HeartHandshake className="h-8 w-8" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-white">بوابة ولي الأمر</h1>
            <p className="text-sm text-[#9bb5a8] mt-2 leading-relaxed">
              لم يتم ربط أي أبناء مسجلين بحسابك حتى الآن. يرجى إدخال رمز المطالبة (Claim Code) الممنوح لك من قِبل الأكاديمية لربط ملف ابنك ومتابعة حضوره وأدائه.
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

          <form onSubmit={handleClaimChild} className="space-y-4 text-right">
            <div>
              <label className="block text-xs font-semibold text-[#9bb5a8] mb-1.5">
                رمز المطالبة (Claim Code):
              </label>
              <input
                type="text"
                required
                placeholder="مثال: ACAD-XXXX"
                value={claimTokenInput}
                onChange={(e) => setClaimTokenInput(e.target.value)}
                className="w-full font-mono text-center tracking-widest text-lg font-bold rounded-xl border border-[#2b4c3e] bg-[#162821] px-4 py-3 text-white placeholder-[#9bb5a8]/50 focus:border-[#2f9e6b] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isClaiming}
              className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 py-3 text-sm font-bold text-white hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              {isClaiming ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              <span>تأكيد وربط الابن بالحساب</span>
            </button>
          </form>

          <p className="text-xs text-[#9bb5a8]/80">
            رمز المطالبة يوفره المشرف أو المدرب لتأكيد صلة القرابة برقم الهوية أو الجوال.
          </p>
        </div>
      </div>
    );
  }

  const selectedChild = guardianData.children.find((c) => c.playerId === selectedChildId) || guardianData.children[0]!;

  return (
    <div className="min-h-screen bg-[#0a1410] text-[#e8f0ec] py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Guardian Welcome Header */}
        <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-r from-[#171223] via-[#1a1628] to-[#171223] p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-400 bg-purple-500/15 px-3 py-1 rounded-full border border-purple-500/30">
                  <HeartHandshake className="h-4 w-4" />
                  Guardian & Parent Portal
                </span>
                <span className="text-xs text-purple-200/80">
                  الأبناء المسجلين: {guardianData.children.length}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                أهلاً بك، {guardianData.name} 👨‍👩‍👧‍👦
              </h1>
              <p className="mt-1 text-sm text-[#9bb5a8]">
                متابعة حضور وتطور وملاحظات المدربين لأبنائك المسجلين في الأكاديميات الرياضية.
              </p>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setIsClaimModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-purple-600/30 border border-purple-500/40 px-4 py-2.5 text-xs font-bold text-purple-200 hover:bg-purple-600/40 transition-all"
              >
                <PlusCircle className="h-4 w-4" />
                <span>ربط ابن آخر برمز المطالبة</span>
              </button>
            </div>
          </div>
        </div>

        {/* Multi-Child Selector Tabs */}
        {guardianData.children.length > 1 && (
          <div className="flex items-center gap-3 overflow-x-auto pb-2">
            <span className="text-xs text-[#9bb5a8] font-medium flex-shrink-0">اختيار الابن:</span>
            {guardianData.children.map((child) => (
              <button
                key={child.playerId}
                type="button"
                onClick={() => setSelectedChildId(child.playerId)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all flex-shrink-0 ${
                  child.playerId === selectedChildId
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                    : 'bg-[#162821] text-[#9bb5a8] border border-[#2b4c3e] hover:text-white'
                }`}
              >
                <span>{child.firstName} {child.lastName}</span>
                <span className="text-[10px] opacity-80">({child.tenantName})</span>
              </button>
            ))}
          </div>
        )}

        {/* Selected Child Summary Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Child Identity Card */}
          <div className="rounded-xl border border-[#234235] bg-[#12231c] p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white text-xl font-black">
                {selectedChild.firstName.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">
                  {selectedChild.firstName} {selectedChild.lastName}
                </h3>
                <span className="text-xs text-[#9bb5a8] block">
                  {selectedChild.tenantName} • {selectedChild.branchName || 'الفرع الرئيسي'}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs border-t border-[#234235] pt-3 text-[#9bb5a8]">
              <div className="flex justify-between">
                <span>الفريق:</span>
                <span className="text-white font-semibold">{selectedChild.groupName || 'فريق البراعم'}</span>
              </div>
              <div className="flex justify-between">
                <span>صلة القرابة:</span>
                <span className="text-white font-semibold">{selectedChild.relationship === 'FATHER' ? 'الوالد' : 'ولي الأمر'}</span>
              </div>
              <div className="flex justify-between">
                <span>تاريخ الميلاد:</span>
                <span className="text-white font-semibold">{selectedChild.dateOfBirth}</span>
              </div>
            </div>
          </div>

          {/* Attendance Rate Card */}
          <div className="rounded-xl border border-[#234235] bg-[#12231c] p-5 flex flex-col justify-between">
            <div>
              <span className="text-xs text-[#9bb5a8] flex items-center gap-1.5 mb-1">
                <CalendarCheck className="h-4 w-4 text-[#2f9e6b]" />
                نسبة الالتزام بالحضور
              </span>
              <div className="text-3xl font-black text-[#45c387] mt-2">
                {selectedChild.attendanceRate}%
              </div>
            </div>
            <p className="text-xs text-[#9bb5a8] mt-4 leading-relaxed">
              المواظبة على التدريبات الأسبوعية تعزز من لياقة وانضباط اللاعب وتطوره الفني داخل الملعب.
            </p>
          </div>

          {/* Performance Score Card */}
          <div className="rounded-xl border border-[#234235] bg-[#12231c] p-5 flex flex-col justify-between">
            <div>
              <span className="text-xs text-[#9bb5a8] flex items-center gap-1.5 mb-1">
                <Award className="h-4 w-4 text-amber-400" />
                آخر تقييم أداء مسجل
              </span>
              <div className="text-3xl font-black text-amber-400 mt-2">
                {selectedChild.latestScore ? `${selectedChild.latestScore.toFixed(1)} / 10` : '—'}
              </div>
            </div>
            <div className="mt-4">
              <Link
                href={`/evaluations/player/${selectedChild.playerId}`}
                className="text-xs font-semibold text-[#45c387] hover:underline flex items-center gap-1"
              >
                <span>استعراض الرادار التنموي الكامل</span>
                <ChevronLeft className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Coach Feedback Specifically Directed to Guardian */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <HeartHandshake className="h-5 w-5 text-purple-400" />
            <span>توجيهات وملاحظات المدربين لولي الأمر</span>
          </h2>

          {childEvaluations.length === 0 ? (
            <div className="rounded-xl border border-[#234235] bg-[#12231c] p-8 text-center text-[#9bb5a8]">
              <Award className="h-10 w-10 text-purple-400 mx-auto mb-2 opacity-50" />
              <div className="font-semibold text-white">لا توجد ملاحظات منشورة حتى الآن</div>
              <p className="text-xs mt-1">
                ستظهر هنا رسائل المدرب الخاصة بولي الأمر فور اعتماد تقييم التدريب القادم.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {childEvaluations.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-[#234235] bg-[#12231c] p-5 space-y-4 hover:border-purple-500/30 transition-colors"
                >
                  <div className="flex items-center justify-between border-b border-[#234235] pb-3">
                    <div>
                      <span className="text-xs text-[#9bb5a8]">تاريخ الحصة: {item.evaluationDate}</span>
                      <div className="text-xs font-semibold text-white mt-0.5">
                        المدرب المقيّم: {item.evaluatorName}
                      </div>
                    </div>
                    <div className="text-left">
                      <span className="text-xs text-[#9bb5a8]">التقييم العام:</span>
                      <div className="text-lg font-black text-[#45c387]">
                        {item.overallScore.toFixed(1)} / 10
                      </div>
                    </div>
                  </div>

                  {/* Feedback Blocks */}
                  <div className="space-y-3 text-xs">
                    {item.guardianFeedback ? (
                      <div className="bg-purple-950/20 border border-purple-500/30 p-3.5 rounded-xl">
                        <span className="font-bold text-purple-300 block mb-1">
                          رسالة وتوجيهات الكابتن لولي الأمر:
                        </span>
                        <p className="text-purple-100 leading-relaxed">{item.guardianFeedback}</p>
                      </div>
                    ) : (
                      <div className="bg-[#162821] p-3 rounded-lg text-[#9bb5a8]">
                        تم اعتماد التقييم الرياضي بدون ملاحظات إضافية.
                      </div>
                    )}

                    {item.suggestedGoals && (
                      <div className="bg-[#162821] p-3 rounded-lg border-r-2 border-sky-500">
                        <span className="font-bold text-sky-400 block mb-0.5">
                          الأهداف التدريبية المقترحة للمنزل:
                        </span>
                        <p className="text-white">{item.suggestedGoals}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Claim Additional Child Modal */}
        {isClaimModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-purple-500/30 bg-[#12231c] p-6 shadow-2xl space-y-4 text-right">
              <div className="flex items-center justify-between border-b border-[#234235] pb-3">
                <h3 className="font-bold text-base text-white">ربط ابن جديد بحسابك</h3>
                <button
                  type="button"
                  onClick={() => setIsClaimModalOpen(false)}
                  className="text-xs text-[#9bb5a8] hover:text-white"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-[#9bb5a8] leading-relaxed">
                أدخل رمز المطالبة (Claim Code) الممنوح لك من إدارة الأكاديمية لربط ملف ابن آخر بحسابك.
              </p>

              {claimStatus && (
                <div
                  className={`p-3 rounded-xl border text-xs ${
                    claimStatus.type === 'success'
                      ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {claimStatus.text}
                </div>
              )}

              <form onSubmit={handleClaimChild} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#9bb5a8] mb-1">
                    رمز المطالبة:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: ACAD-XXXX"
                    value={claimTokenInput}
                    onChange={(e) => setClaimTokenInput(e.target.value)}
                    className="w-full font-mono text-center tracking-widest text-base font-bold rounded-xl border border-[#2b4c3e] bg-[#162821] px-4 py-2.5 text-white placeholder-[#9bb5a8]/50 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isClaiming}
                    className="flex-1 rounded-xl bg-purple-600 py-2.5 text-xs font-bold text-white hover:bg-purple-500 transition-all flex items-center justify-center gap-1.5"
                  >
                    {isClaiming ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    <span>تأكيد الربط</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsClaimModalOpen(false)}
                    className="rounded-xl border border-[#2b4c3e] bg-[#162821] px-4 py-2.5 text-xs font-semibold text-[#9bb5a8] hover:text-white"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
