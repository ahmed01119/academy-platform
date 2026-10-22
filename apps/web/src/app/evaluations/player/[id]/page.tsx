'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '../../../../lib/api-client';
import {
  Award,
  ChevronRight,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Lock,
  HeartHandshake,
  Target,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import type { PlayerDevelopmentProfile } from '@academy/shared';

export default function PlayerDevelopmentProfilePage() {
  const params = useParams();
  const playerId = params.id as string;

  const [profile, setProfile] = useState<PlayerDevelopmentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playerId) return;

    const loadProfile = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiClient.evaluations.getPlayerDevelopmentProfile(playerId);
        setProfile(data);
      } catch (err: unknown) {
        setError((err as Error)?.message || 'فشل في تحميل الملف التنموي للاعب');
      } finally {
        setIsLoading(false);
      }
    };

    void loadProfile();
  }, [playerId]);

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-[#45c387]" />
          <p className="text-sm text-[#9bb5a8]">جارٍ تحميل الملف التنموي والذكاء الرياضي...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-xl py-20 px-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 mb-4">
          <Award className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">الملف التنموي غير متوفر</h1>
        <p className="text-sm text-[#9bb5a8] mb-6">{error || 'لم يتم العثور على اللاعب المطلوب'}</p>
        <Link
          href="/evaluations"
          className="inline-flex items-center gap-2 rounded-xl bg-[#2f9e6b] px-4 py-2 text-sm font-semibold text-[#062016]"
        >
          العودة لمركز التقييمات
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1410] text-[#e8f0ec] py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#9bb5a8]">
          <Link href="/evaluations" className="hover:text-white transition-colors">
            مركز التقييمات
          </Link>
          <ChevronRight className="h-3.5 w-3.5 rotate-180" />
          <span className="text-[#45c387]">{profile.playerName}</span>
        </div>

        {/* Hero Card */}
        <div className="rounded-2xl border border-[#2b4c3e] bg-gradient-to-r from-[#12231c] via-[#162821] to-[#12231c] p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-[#2f9e6b]/20 border border-[#2f9e6b]/40 flex items-center justify-center text-[#45c387] text-2xl font-black">
                {profile.playerName.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold text-white">{profile.playerName}</h1>
                  <span className="rounded-full bg-[#2f9e6b]/20 px-2.5 py-0.5 text-xs font-bold text-[#45c387] border border-[#2f9e6b]/40">
                    {profile.ageCategory}
                  </span>
                </div>
                <div className="text-xs text-[#9bb5a8] flex items-center gap-3">
                  <span>تاريخ الميلاد: {profile.dateOfBirth}</span>
                  <span>•</span>
                  <span>إجمالي التقييمات: {profile.totalEvaluations}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#2f9e6b]/40 bg-[#162821] p-4 text-center sm:text-right">
              <span className="text-xs text-[#9bb5a8]">المعدل العام التراكمي</span>
              <div className="text-3xl font-extrabold text-[#45c387] mt-0.5">
                {profile.averageScores.overall.toFixed(1)}
                <span className="text-sm font-normal text-[#9bb5a8]"> / 10</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Pillars Breakdown Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border border-[#234235] bg-[#12231c] p-4">
            <span className="text-xs text-[#9bb5a8]">المهارات الفنية</span>
            <div className="text-2xl font-extrabold text-white mt-1">
              {profile.averageScores.technical.toFixed(1)}
              <span className="text-xs font-normal text-[#9bb5a8]"> / 10</span>
            </div>
            <div className="w-full bg-[#162821] h-2 rounded-full overflow-hidden mt-3">
              <div
                className="bg-[#2f9e6b] h-full rounded-full transition-all duration-500"
                style={{ width: `${(profile.averageScores.technical / 10) * 100}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-[#234235] bg-[#12231c] p-4">
            <span className="text-xs text-[#9bb5a8]">الوعي التكتيكي</span>
            <div className="text-2xl font-extrabold text-white mt-1">
              {profile.averageScores.tactical.toFixed(1)}
              <span className="text-xs font-normal text-[#9bb5a8]"> / 10</span>
            </div>
            <div className="w-full bg-[#162821] h-2 rounded-full overflow-hidden mt-3">
              <div
                className="bg-[#38bdf8] h-full rounded-full transition-all duration-500"
                style={{ width: `${(profile.averageScores.tactical / 10) * 100}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-[#234235] bg-[#12231c] p-4">
            <span className="text-xs text-[#9bb5a8]">الجاهزية البدنية</span>
            <div className="text-2xl font-extrabold text-white mt-1">
              {profile.averageScores.physical.toFixed(1)}
              <span className="text-xs font-normal text-[#9bb5a8]"> / 10</span>
            </div>
            <div className="w-full bg-[#162821] h-2 rounded-full overflow-hidden mt-3">
              <div
                className="bg-[#f59e0b] h-full rounded-full transition-all duration-500"
                style={{ width: `${(profile.averageScores.physical / 10) * 100}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-[#234235] bg-[#12231c] p-4">
            <span className="text-xs text-[#9bb5a8]">الانضباط والسلوك</span>
            <div className="text-2xl font-extrabold text-white mt-1">
              {profile.averageScores.behavioral.toFixed(1)}
              <span className="text-xs font-normal text-[#9bb5a8]"> / 10</span>
            </div>
            <div className="w-full bg-[#162821] h-2 rounded-full overflow-hidden mt-3">
              <div
                className="bg-[#a855f7] h-full rounded-full transition-all duration-500"
                style={{ width: `${(profile.averageScores.behavioral / 10) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Strengths & Goals Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-xl border border-[#234235] bg-[#12231c] p-5">
            <h3 className="font-bold text-sm text-white flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-[#45c387]" />
              <span>أبرز نقاط القوة المكتسبة</span>
            </h3>
            {profile.strongestSkills.length === 0 ? (
              <p className="text-xs text-[#9bb5a8]">لا توجد نقاط مسجلة بعد</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {profile.strongestSkills.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 bg-[#162821] p-2.5 rounded-lg text-emerald-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-[#234235] bg-[#12231c] p-5">
            <h3 className="font-bold text-sm text-white flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-amber-400" />
              <span>مجالات التركيز والتطوير</span>
            </h3>
            {profile.areasNeedingImprovement.length === 0 ? (
              <p className="text-xs text-[#9bb5a8]">لا توجد مجالات مسجلة بعد</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {profile.areasNeedingImprovement.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 bg-[#162821] p-2.5 rounded-lg text-amber-200">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-[#234235] bg-[#12231c] p-5">
            <h3 className="font-bold text-sm text-white flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-[#38bdf8]" />
              <span>الأهداف التدريبية المقترحة</span>
            </h3>
            {profile.goals.length === 0 ? (
              <p className="text-xs text-[#9bb5a8]">لا توجد أهداف مسجلة بعد</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {profile.goals.map((g, i) => (
                  <li key={i} className="flex items-start gap-2 bg-[#162821] p-2.5 rounded-lg text-sky-200">
                    <span className="text-sky-400 font-bold">🎯</span>
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Detailed Evaluations Timeline */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#2f9e6b]" />
            <span>سجل التقييمات التاريخية ({profile.evaluations.length})</span>
          </h2>

          <div className="space-y-4">
            {profile.evaluations.map((e) => (
              <div
                key={e.id}
                className="rounded-xl border border-[#234235] bg-[#12231c] p-6 space-y-4 hover:border-[#2f9e6b]/40 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#234235] pb-3">
                  <div>
                    <span className="text-sm font-bold text-white">
                      تقييم بتاريخ: {e.evaluationDate}
                    </span>
                    <span className="text-xs text-[#9bb5a8] mr-3">
                      المدرب المقيّم: {e.evaluatorName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#9bb5a8]">المعدل المحسوب:</span>
                    <span className="text-base font-extrabold text-[#45c387]">
                      {e.overallScore.toFixed(2)} / 10
                    </span>
                  </div>
                </div>

                {/* 4 Scores Mini Grid */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-[#162821] p-2 rounded-lg">
                    <span className="text-[10px] text-[#9bb5a8] block">فني</span>
                    <span className="font-bold text-white">{e.technicalScore}</span>
                  </div>
                  <div className="bg-[#162821] p-2 rounded-lg">
                    <span className="text-[10px] text-[#9bb5a8] block">تكتيكي</span>
                    <span className="font-bold text-white">{e.tacticalScore}</span>
                  </div>
                  <div className="bg-[#162821] p-2 rounded-lg">
                    <span className="text-[10px] text-[#9bb5a8] block">بدني</span>
                    <span className="font-bold text-white">{e.physicalScore}</span>
                  </div>
                  <div className="bg-[#162821] p-2 rounded-lg">
                    <span className="text-[10px] text-[#9bb5a8] block">سلوكي</span>
                    <span className="font-bold text-white">{e.behavioralScore}</span>
                  </div>
                </div>

                {/* Feedback Blocks */}
                <div className="space-y-3 pt-2 text-xs">
                  {e.strengths && (
                    <div className="bg-[#162821] p-3 rounded-lg border-r-2 border-emerald-500">
                      <span className="font-bold text-emerald-400 block mb-0.5">نقاط القوة:</span>
                      <p className="text-white">{e.strengths}</p>
                    </div>
                  )}

                  {e.areasForImprovement && (
                    <div className="bg-[#162821] p-3 rounded-lg border-r-2 border-amber-500">
                      <span className="font-bold text-amber-400 block mb-0.5">مجالات التحسين:</span>
                      <p className="text-white">{e.areasForImprovement}</p>
                    </div>
                  )}

                  {e.guardianFeedback && (
                    <div className="bg-[#162821] p-3 rounded-lg border-r-2 border-sky-500 flex items-start gap-2">
                      <HeartHandshake className="h-4 w-4 text-sky-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-sky-400 block mb-0.5">توجيهات لولي الأمر:</span>
                        <p className="text-white">{e.guardianFeedback}</p>
                      </div>
                    </div>
                  )}

                  {e.privateCoachNotes && (
                    <div className="bg-amber-950/20 p-3 rounded-lg border border-amber-500/30 flex items-start gap-2">
                      <Lock className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-amber-300 block mb-0.5">
                          ملاحظات سرية للجهاز الفني (لا تظهر لولي الأمر):
                        </span>
                        <p className="text-amber-100">{e.privateCoachNotes}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
