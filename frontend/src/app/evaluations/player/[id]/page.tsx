'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/api/client';
import { useLocale } from '@/contexts/locale-context';
import { translateDataString } from '@/utils/data-translator';
import { AppShell } from '../../../../components/layout/AppShell';
import { PageHeader } from '../../../../components/ui/PageHeader';
import {
  Award,
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
  const { locale } = useLocale();

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
        setError(
          (err as Error)?.message ||
            (locale === 'en'
              ? 'Failed to load player development profile'
              : 'فشل في تحميل الملف التنموي للاعب'),
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadProfile();
  }, [playerId, locale]);

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-[var(--accent-primary)]" />
            <p className="text-sm text-[var(--text-muted)]">
              {locale === 'en'
                ? 'Loading development profile and athletic intelligence...'
                : 'جارٍ تحميل الملف التنموي والذكاء الرياضي...'}
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !profile) {
    return (
      <AppShell>
        <div className="mx-auto max-w-xl py-20 px-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 mb-4">
            <Award className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-[var(--text-main)] mb-2">
            {locale === 'en' ? 'Development Profile Unavailable' : 'الملف التنموي غير متوفر'}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            {error ||
              (locale === 'en'
                ? 'Requested player was not found'
                : 'لم يتم العثور على اللاعب المطلوب')}
          </p>
          <Link
            href="/evaluations"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            {locale === 'en' ? 'Back to Evaluations' : 'العودة لمركز التقييمات'}
          </Link>
        </div>
      </AppShell>
    );
  }

  const translatedPlayerName = translateDataString(profile.playerName, locale);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={[
            { label: locale === 'ar' ? 'الرئيسية' : 'Home', href: '/dashboard' },
            { label: locale === 'ar' ? 'مركز التقييمات' : 'Evaluations Center', href: '/evaluations' },
            { label: translatedPlayerName },
          ]}
          title={translatedPlayerName}
          description={
            locale === 'en'
              ? `Comprehensive Athletic Profile — Category ${profile.ageCategory}`
              : `الملف التنموي الرياضي الشامل — فئة ${profile.ageCategory}`
          }
          badge={
            <span className="rounded-full bg-[var(--accent-primary)]/15 px-2.5 py-0.5 text-xs font-bold text-[var(--accent-primary)] border border-[var(--accent-primary)]/30">
              {profile.ageCategory}
            </span>
          }
          actions={
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-center sm:text-right">
                <span className="text-[11px] text-[var(--text-muted)]">
                  {locale === 'en' ? 'Cumulative GPA' : 'المعدل العام التراكمي'}
                </span>
                <div className="text-xl font-extrabold text-[var(--accent-primary)]">
                  {profile.averageScores.overall.toFixed(1)}
                  <span className="text-xs font-normal text-[var(--text-muted)]"> / 10</span>
                </div>
              </div>
            </div>
          }
        />

        {/* 4 Pillars Breakdown Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <span className="text-xs text-[var(--text-muted)]">
              {locale === 'en' ? 'Technical Skills' : 'المهارات الفنية'}
            </span>
            <div className="text-2xl font-extrabold text-[var(--text-main)] mt-1">
              {profile.averageScores.technical.toFixed(1)}
              <span className="text-xs font-normal text-[var(--text-muted)]"> / 10</span>
            </div>
            <div className="w-full bg-[var(--bg-surface-subtle)] h-2 rounded-full overflow-hidden mt-3">
              <div
                className="bg-[var(--accent-primary)] h-full rounded-full transition-all duration-500"
                style={{ width: `${(profile.averageScores.technical / 10) * 100}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <span className="text-xs text-[var(--text-muted)]">
              {locale === 'en' ? 'Tactical Awareness' : 'الوعي التكتيكي'}
            </span>
            <div className="text-2xl font-extrabold text-[var(--text-main)] mt-1">
              {profile.averageScores.tactical.toFixed(1)}
              <span className="text-xs font-normal text-[var(--text-muted)]"> / 10</span>
            </div>
            <div className="w-full bg-[var(--bg-surface-subtle)] h-2 rounded-full overflow-hidden mt-3">
              <div
                className="bg-sky-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${(profile.averageScores.tactical / 10) * 100}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <span className="text-xs text-[var(--text-muted)]">
              {locale === 'en' ? 'Physical Readiness' : 'الجاهزية البدنية'}
            </span>
            <div className="text-2xl font-extrabold text-[var(--text-main)] mt-1">
              {profile.averageScores.physical.toFixed(1)}
              <span className="text-xs font-normal text-[var(--text-muted)]"> / 10</span>
            </div>
            <div className="w-full bg-[var(--bg-surface-subtle)] h-2 rounded-full overflow-hidden mt-3">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${(profile.averageScores.physical / 10) * 100}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <span className="text-xs text-[var(--text-muted)]">
              {locale === 'en' ? 'Discipline & Behavior' : 'الانضباط والسلوك'}
            </span>
            <div className="text-2xl font-extrabold text-[var(--text-main)] mt-1">
              {profile.averageScores.behavioral.toFixed(1)}
              <span className="text-xs font-normal text-[var(--text-muted)]"> / 10</span>
            </div>
            <div className="w-full bg-[var(--bg-surface-subtle)] h-2 rounded-full overflow-hidden mt-3">
              <div
                className="bg-purple-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${(profile.averageScores.behavioral / 10) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Strengths & Goals Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            <h3 className="font-bold text-sm text-[var(--text-main)] flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-[var(--accent-primary)]" />
              <span>{locale === 'en' ? 'Key Acquired Strengths' : 'أبرز نقاط القوة المكتسبة'}</span>
            </h3>
            {profile.strongestSkills.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                {locale === 'en' ? 'No strengths recorded yet' : 'لا توجد نقاط مسجلة بعد'}
              </p>
            ) : (
              <ul className="space-y-2 text-xs">
                {profile.strongestSkills.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 bg-[var(--bg-surface-subtle)] p-2.5 rounded-lg text-emerald-600 dark:text-emerald-300"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span>{translateDataString(s, locale)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            <h3 className="font-bold text-sm text-[var(--text-main)] flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-amber-500" />
              <span>{locale === 'en' ? 'Focus & Improvement Areas' : 'مجالات التركيز والتطوير'}</span>
            </h3>
            {profile.areasNeedingImprovement.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                {locale === 'en' ? 'No areas recorded yet' : 'لا توجد مجالات مسجلة بعد'}
              </p>
            ) : (
              <ul className="space-y-2 text-xs">
                {profile.areasNeedingImprovement.map((a, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 bg-[var(--bg-surface-subtle)] p-2.5 rounded-lg text-amber-600 dark:text-amber-300"
                  >
                    <span className="text-amber-500 font-bold">•</span>
                    <span>{translateDataString(a, locale)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            <h3 className="font-bold text-sm text-[var(--text-main)] flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-sky-500" />
              <span>{locale === 'en' ? 'Target Training Goals' : 'الأهداف التدريبية المقترحة'}</span>
            </h3>
            {profile.goals.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                {locale === 'en' ? 'No goals recorded yet' : 'لا توجد أهداف مسجلة بعد'}
              </p>
            ) : (
              <ul className="space-y-2 text-xs">
                {profile.goals.map((g, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 bg-[var(--bg-surface-subtle)] p-2.5 rounded-lg text-sky-600 dark:text-sky-300"
                  >
                    <span className="text-sky-500 font-bold">🎯</span>
                    <span>{translateDataString(g, locale)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Detailed Evaluations Timeline */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[var(--accent-primary)]" />
            <span>
              {locale === 'en'
                ? `Evaluation History (${profile.evaluations.length})`
                : `سجل التقييمات التاريخية (${profile.evaluations.length})`}
            </span>
          </h2>

          <div className="space-y-4">
            {profile.evaluations.map((e) => (
              <div
                key={e.id}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-4 hover:border-[var(--accent-primary)]/40 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
                  <div>
                    <span className="text-sm font-bold text-[var(--text-main)]">
                      {locale === 'en' ? 'Evaluation Date: ' : 'تقييم بتاريخ: '}
                      {e.evaluationDate}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] mx-3">
                      {locale === 'en' ? 'Evaluator: ' : 'المدرب المقيّم: '}
                      {translateDataString(e.evaluatorName, locale)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--text-muted)]">
                      {locale === 'en' ? 'Calculated Score:' : 'المعدل المحسوب:'}
                    </span>
                    <span className="text-base font-extrabold text-[var(--accent-primary)]">
                      {e.overallScore.toFixed(2)} / 10
                    </span>
                  </div>
                </div>

                {/* 4 Scores Mini Grid */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-[var(--bg-surface-subtle)] p-2 rounded-lg">
                    <span className="text-[10px] text-[var(--text-muted)] block">
                      {locale === 'en' ? 'Technical' : 'فني'}
                    </span>
                    <span className="font-bold text-[var(--text-main)]">{e.technicalScore}</span>
                  </div>
                  <div className="bg-[var(--bg-surface-subtle)] p-2 rounded-lg">
                    <span className="text-[10px] text-[var(--text-muted)] block">
                      {locale === 'en' ? 'Tactical' : 'تكتيكي'}
                    </span>
                    <span className="font-bold text-[var(--text-main)]">{e.tacticalScore}</span>
                  </div>
                  <div className="bg-[var(--bg-surface-subtle)] p-2 rounded-lg">
                    <span className="text-[10px] text-[var(--text-muted)] block">
                      {locale === 'en' ? 'Physical' : 'بدني'}
                    </span>
                    <span className="font-bold text-[var(--text-main)]">{e.physicalScore}</span>
                  </div>
                  <div className="bg-[var(--bg-surface-subtle)] p-2 rounded-lg">
                    <span className="text-[10px] text-[var(--text-muted)] block">
                      {locale === 'en' ? 'Behavioral' : 'سلوكي'}
                    </span>
                    <span className="font-bold text-[var(--text-main)]">{e.behavioralScore}</span>
                  </div>
                </div>

                {/* Feedback Blocks */}
                <div className="space-y-3 pt-2 text-xs">
                  {e.strengths && (
                    <div className="bg-[var(--bg-surface-subtle)] p-3 rounded-lg border-s-2 border-emerald-500">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 block mb-0.5">
                        {locale === 'en' ? 'Strengths:' : 'نقاط القوة:'}
                      </span>
                      <p className="text-[var(--text-main)]">
                        {translateDataString(e.strengths, locale)}
                      </p>
                    </div>
                  )}

                  {e.areasForImprovement && (
                    <div className="bg-[var(--bg-surface-subtle)] p-3 rounded-lg border-s-2 border-amber-500">
                      <span className="font-bold text-amber-600 dark:text-amber-400 block mb-0.5">
                        {locale === 'en' ? 'Areas for Improvement:' : 'مجالات التحسين:'}
                      </span>
                      <p className="text-[var(--text-main)]">
                        {translateDataString(e.areasForImprovement, locale)}
                      </p>
                    </div>
                  )}

                  {e.guardianFeedback && (
                    <div className="bg-[var(--bg-surface-subtle)] p-3 rounded-lg border-s-2 border-sky-500 flex items-start gap-2">
                      <HeartHandshake className="h-4 w-4 text-sky-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-sky-600 dark:text-sky-400 block mb-0.5">
                          {locale === 'en' ? 'Guardian Guidance:' : 'توجيهات لولي الأمر:'}
                        </span>
                        <p className="text-[var(--text-main)]">
                          {translateDataString(e.guardianFeedback, locale)}
                        </p>
                      </div>
                    </div>
                  )}

                  {e.privateCoachNotes && (
                    <div className="bg-amber-500/10 p-3 rounded-lg border border-amber-500/30 flex items-start gap-2">
                      <Lock className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-amber-600 dark:text-amber-400 block mb-0.5">
                          {locale === 'en'
                            ? 'Staff Confidential Notes (Hidden from Guardian):'
                            : 'ملاحظات سرية للجهاز الفني (لا تظهر لولي الأمر):'}
                        </span>
                        <p className="text-amber-800 dark:text-amber-200">
                          {translateDataString(e.privateCoachNotes, locale)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
