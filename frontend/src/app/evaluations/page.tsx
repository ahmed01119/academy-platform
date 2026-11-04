'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/api/client';
import { useAuth } from '@/contexts/auth-context';
import { useLocale } from '@/contexts/locale-context';
import { translateDataString } from '@/utils/data-translator';
import { offlineEngine } from '@/utils/offline-engine';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/ui/PageHeader';
import {
  Award,
  TrendingUp,
  TrendingDown,
  Minus,
  Filter,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Lock,
  HeartHandshake,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import type {
  EvaluationTemplate,
  PerformanceRankingsResponse,
  PlayerSummary,
  TrainingGroupSummary,
} from '@academy/shared';

function EvaluationsCenterContent() {
  const searchParams = useSearchParams();
  const preselectedSessionId = searchParams.get('sessionId');
  const { user, activeTenant } = useAuth();
  const { locale, isRtl, t } = useLocale();
  const ar = locale === 'ar';

  const [activeTab, setActiveTab] = useState<'rankings' | 'new-eval' | 'templates'>('rankings');
  const [rankings, setRankings] = useState<PerformanceRankingsResponse | null>(null);
  const [templates, setTemplates] = useState<EvaluationTemplate[]>([]);
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [groups, setGroups] = useState<TrainingGroupSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter states
  const [selectedAgeCategory, setSelectedAgeCategory] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  // Form states for new evaluation
  const [formPlayerId, setFormPlayerId] = useState<string>('');
  const [formTemplateId, setFormTemplateId] = useState<string>('');
  const [formTechnical, setFormTechnical] = useState<number>(8.0);
  const [formTactical, setFormTactical] = useState<number>(8.0);
  const [formPhysical, setFormPhysical] = useState<number>(8.0);
  const [formBehavioral, setFormBehavioral] = useState<number>(9.0);
  const [formStrengths, setFormStrengths] = useState<string>('');
  const [formImprovements, setFormImprovements] = useState<string>('');
  const [formPrivateNotes, setFormPrivateNotes] = useState<string>('');
  const [formGuardianFeedback, setFormGuardianFeedback] = useState<string>('');
  const [formGoals, setFormGoals] = useState<string>('');
  const [formIsPublished, setFormIsPublished] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formStatus, setFormStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const calculatedOverall = Number(
    ((formTechnical + formTactical + formPhysical + formBehavioral) / 4).toFixed(2),
  );

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [rankingsRes, templatesRes, playersRes, groupsRes] = await Promise.all([
        apiClient.evaluations
          .getRankings({
            ageCategory: selectedAgeCategory || undefined,
            groupId: selectedGroupId || undefined,
          })
          .catch(() => null),
        apiClient.evaluations.listTemplates().catch(() => []),
        apiClient.players.list({ status: 'ACTIVE' }).catch(() => ({ items: [] })),
        apiClient.groups.list().catch(() => ({ items: [] })),
      ]);

      setRankings(rankingsRes);
      setTemplates(templatesRes);
      setPlayers(playersRes.items || []);
      setGroups(groupsRes.items || []);

      if (templatesRes.length > 0 && !formTemplateId) {
        setFormTemplateId(templatesRes[0]!.id);
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedAgeCategory, selectedGroupId, formTemplateId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSaveDraft = async () => {
    if (!formPlayerId) {
      setFormStatus({
        type: 'error',
        text: ar ? 'يرجى اختيار اللاعب أولاً لحفظ المسودة' : 'Please select a player to save draft',
      });
      return;
    }

    try {
      await offlineEngine.saveEvaluationDraft({
        id: `draft-${Date.now()}`,
        tenantId: activeTenant?.tenantId || '',
        actorUserId: user?.id || '',
        playerId: formPlayerId,
        templateId: formTemplateId || undefined,
        sessionId: preselectedSessionId || undefined,
        technicalScore: formTechnical,
        tacticalScore: formTactical,
        physicalScore: formPhysical,
        behavioralScore: formBehavioral,
        strengths: formStrengths || undefined,
        areasForImprovement: formImprovements || undefined,
        privateCoachNotes: formPrivateNotes || undefined,
        guardianFeedback: formGuardianFeedback || undefined,
        suggestedGoals: formGoals || undefined,
        isPublished: formIsPublished,
        updatedAt: new Date().toISOString(),
      });

      setFormStatus({
        type: 'success',
        text: ar ? 'تم حفظ المسودة بنجاح محلياً' : 'Local draft saved successfully',
      });
    } catch {
      setFormStatus({
        type: 'error',
        text: ar ? 'فشل حفظ المسودة محلياً' : 'Failed to save local draft',
      });
    }
  };

  const handleSubmitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPlayerId || !formTemplateId) {
      setFormStatus({
        type: 'error',
        text: ar ? 'يرجى اختيار اللاعب ونموذج التقييم' : 'Please select both player and criteria template',
      });
      return;
    }

    setIsSubmitting(true);
    setFormStatus(null);
    try {
      await apiClient.evaluations.createEvaluation({
        playerId: formPlayerId,
        templateId: formTemplateId,
        sessionId: preselectedSessionId || undefined,
        technicalScore: formTechnical,
        tacticalScore: formTactical,
        physicalScore: formPhysical,
        behavioralScore: formBehavioral,
        strengths: formStrengths.trim() || undefined,
        areasForImprovement: formImprovements.trim() || undefined,
        privateCoachNotes: formPrivateNotes.trim() || undefined,
        guardianFeedback: formGuardianFeedback.trim() || undefined,
        suggestedGoals: formGoals.trim() || undefined,
        isPublished: formIsPublished,
      });

      setFormStatus({
        type: 'success',
        text: ar ? 'تم اعتماد ونشر التقييم بنجاح!' : 'Evaluation submitted and published successfully!',
      });

      setFormStrengths('');
      setFormImprovements('');
      setFormPrivateNotes('');
      setFormGuardianFeedback('');
      setFormGoals('');

      await loadData();
    } catch (err: unknown) {
      setFormStatus({
        type: 'error',
        text: (err as Error)?.message || (ar ? 'فشل إرسال التقييم' : 'Failed to submit evaluation'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={[
            { label: ar ? 'الرئيسية' : 'Home', href: '/dashboard' },
            { label: ar ? 'مركز التقييم والذكاء الرياضي' : 'Evaluation Center' },
          ]}
          title={ar ? 'مركز تقييم الأداء والذكاء الرياضي' : 'Performance Evaluation & Athletic Intelligence'}
          description={
            ar
              ? 'متابعة تطور اللاعبين الرباعي (فني، تكتيكي، بدني، سلوكي)، وتصنيف الفئات العمرية بشفافية وعدالة.'
              : 'Track player performance across technical, tactical, physical, and behavioral pillars with fair age-group grading.'
          }
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void loadData();
                }}
                disabled={isLoading}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--accent-primary)] transition-all cursor-pointer"
                title={ar ? 'تحديث البيانات' : 'Refresh data'}
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoading ? 'animate-spin text-[var(--accent-primary)]' : ''}`}
                />
                <span className="hidden sm:inline">{ar ? 'تحديث' : 'Refresh'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('new-eval')}
                className="flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:brightness-110 transition-all cursor-pointer"
              >
                <PlusCircle className="h-4 w-4" />
                <span>{ar ? 'تقييم لاعب جديد' : 'New Evaluation'}</span>
              </button>
            </div>
          }
        />

        {/* Tab Navigation */}
        <div className="border-b border-[var(--border-subtle)] flex items-center gap-6 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('rankings')}
            className={`pb-3 text-sm font-semibold transition-all relative cursor-pointer whitespace-nowrap ${
              activeTab === 'rankings'
                ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            {ar ? 'لوحة الترتيب والتصنيف العادل' : 'Fair Leaderboard & Rankings'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('new-eval')}
            className={`pb-3 text-sm font-semibold transition-all relative cursor-pointer whitespace-nowrap ${
              activeTab === 'new-eval'
                ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            {ar ? 'إضافة تقييم أداء للاعب' : 'New Player Evaluation'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`pb-3 text-sm font-semibold transition-all relative cursor-pointer whitespace-nowrap ${
              activeTab === 'templates'
                ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            {ar ? 'نماذج ومعايير التقييم' : 'Evaluation Templates'} ({templates.length})
          </button>
        </div>

        {/* TAB 1: RANKINGS */}
        {activeTab === 'rankings' && (
          <div className="space-y-6">
            {/* Criteria Formula Banner */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 flex items-start gap-3">
              <HelpCircle className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-emerald-300">
                  {ar ? 'معيار ومعادلة التصنيف العادل للاعبين' : 'Fair Evaluation Matrix & Formula'}
                </h4>
                <p className="text-xs text-emerald-200 mt-1 leading-relaxed">
                  {ar
                    ? 'يتم الترتيب بناءً على: المعدل التراكمي = (المهارات الفنية + الوعي التكتيكي + الجاهزية البدنية + الانضباط والسلوك) / 4 بناءً على تقييمات المدربين الرسمية لكل فئة عمرية أو مجموعة تدريبية، لمنع مقارنة الفئات العمرية غير المتكافئة.'
                    : 'Rankings are computed as: Cumulative GPA = (Technical + Tactical + Physical + Behavioral) / 4 across age groups to prevent unbalanced comparisons.'}
                </p>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-subtle)]">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-xs text-[var(--text-muted)] font-medium flex items-center gap-1">
                  <Filter className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                  {ar ? 'الفئة العمرية:' : 'Age Category:'}
                </span>
                <select
                  value={selectedAgeCategory}
                  onChange={(e) => setSelectedAgeCategory(e.target.value)}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none cursor-pointer"
                >
                  <option value="">{ar ? 'جميع الفئات العمرية' : 'All Age Groups'}</option>
                  <option value="U-11">{ar ? 'فئة البراعم (U-11)' : 'Juniors (U-11)'}</option>
                  <option value="U-14">{ar ? 'فئة الناشئين (U-14)' : 'Cadets (U-14)'}</option>
                  <option value="U-17">{ar ? 'فئة الشباب (U-17)' : 'Youth (U-17)'}</option>
                </select>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-xs text-[var(--text-muted)] font-medium">
                  {ar ? 'المجموعة التدريبية:' : 'Training Squad:'}
                </span>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none cursor-pointer"
                >
                  <option value="">{ar ? 'جميع المجموعات' : 'All Training Squads'}</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {locale === 'en' ? translateDataString(g.name, 'en') : g.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Rankings Table */}
            <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              <table className="w-full text-start text-xs">
                <thead className="bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                  <tr>
                    <th className="p-3.5 text-center w-16">{t('evaluations.rankCol', 'الترتيب')}</th>
                    <th className="p-3.5 text-start">{t('evaluations.playerCol', 'اللاعب')}</th>
                    <th className="p-3.5 text-start">{ar ? 'الفئة / المجموعة' : 'Squad / Category'}</th>
                    <th className="p-3.5 text-center">
                      {t('evaluations.evaluationsCountCol', 'عدد التقييمات')}
                    </th>
                    <th className="p-3.5 text-center">
                      {t('evaluations.overallScoreCol', 'المعدل العام (10)')}
                    </th>
                    <th className="p-3.5 text-center">{t('evaluations.trendCol', 'الاتجاه (Trend)')}</th>
                    <th className="p-3.5 text-center">
                      {t('evaluations.viewProfileLink', 'الملف التنموي')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {!rankings || rankings.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[var(--text-muted)]">
                        {ar
                          ? 'لا توجد بيانات تقييم للاعبين ضمن الفئة المحددة حالياً. ابدأ بإضافة تقييم من تبويب "إضافة تقييم جديد".'
                          : 'No player evaluations found in this category. Start adding ratings via the "New Evaluation" tab.'}
                      </td>
                    </tr>
                  ) : (
                    rankings.items.map((item) => {
                      const isTop1 = item.rank === 1;
                      const isTop2 = item.rank === 2;
                      const isTop3 = item.rank === 3;

                      return (
                        <tr
                          key={item.playerId}
                          className="hover:bg-[var(--bg-surface-subtle)]/50 transition-colors"
                        >
                          <td className="p-3.5 text-center">
                            {isTop1 ? (
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/20 text-amber-500 font-extrabold text-xs border border-amber-500/40 shadow-sm shadow-amber-500/20">
                                🥇
                              </span>
                            ) : isTop2 ? (
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-300/20 text-slate-400 font-extrabold text-xs border border-slate-300/40">
                                🥈
                              </span>
                            ) : isTop3 ? (
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-700/20 text-amber-600 font-extrabold text-xs border border-amber-700/40">
                                🥉
                              </span>
                            ) : (
                              <span className="font-bold text-[var(--text-muted)]">
                                #{item.rank}
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 font-bold text-[var(--text-main)] text-sm">
                            {item.playerName}
                          </td>
                          <td className="p-3.5 text-[var(--text-muted)]">
                            <span className="rounded bg-[var(--bg-surface-subtle)] px-2 py-0.5 text-[11px] text-[var(--accent-primary)] me-2 border border-[var(--border-subtle)]">
                              {item.ageCategory}
                            </span>
                            <span>{locale === 'en' ? translateDataString(item.groupName, 'en') : item.groupName || '—'}</span>
                          </td>
                          <td className="p-3.5 text-center text-[var(--text-main)] font-medium">
                            {item.evaluationsCount} {ar ? 'تقييم' : 'evals'}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="text-base font-extrabold text-[var(--accent-primary)]">
                              {item.averageScore.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)]"> / 10</span>
                          </td>
                          <td className="p-3.5 text-center">
                            {item.trend === 'UP' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-500 text-xs font-semibold">
                                <TrendingUp className="h-3.5 w-3.5" />+{item.trendDelta}
                              </span>
                            ) : item.trend === 'DOWN' ? (
                              <span className="inline-flex items-center gap-1 text-rose-500 text-xs font-semibold">
                                <TrendingDown className="h-3.5 w-3.5" />
                                {item.trendDelta}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[var(--text-muted)] text-xs">
                                <Minus className="h-3.5 w-3.5" />
                                {ar ? 'مستقر' : 'Stable'}
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-center">
                            <Link
                              href={`/evaluations/player/${item.playerId}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-primary)] hover:border-[var(--accent-primary)] transition-all"
                            >
                              <span>{ar ? 'استعراض الرادار' : 'View Profile'}</span>
                              {isRtl ? (
                                <ChevronLeft className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: NEW EVALUATION */}
        {activeTab === 'new-eval' && (
          <div className="max-w-3xl mx-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
                <Award className="h-5 w-5 text-[var(--accent-primary)]" />
                <span>{ar ? 'نموذج تقييم أداء اللاعب الرباعي' : '4-Pillar Player Evaluation Form'}</span>
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {ar
                  ? 'سجل درجات المهارات الرياضية، الملاحظات الخاصة بالمدرب، والتوجيهات الموجهة لولي الأمر واللاعب.'
                  : 'Score athletic competencies, record confidential coach remarks, and draft guardian guidance.'}
              </p>
            </div>

            {formStatus && (
              <div
                className={`p-4 rounded-xl border text-xs flex items-center gap-2 ${
                  formStatus.type === 'success'
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                }`}
              >
                {formStatus.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                )}
                <span>{formStatus.text}</span>
              </div>
            )}

            <form onSubmit={handleSubmitEvaluation} className="space-y-6 text-start">
              {/* Player Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                    {ar ? 'اللاعب المراد تقييمه *' : 'Selected Player *'}
                  </label>
                  <select
                    required
                    value={formPlayerId}
                    onChange={(e) => setFormPlayerId(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none cursor-pointer"
                  >
                    <option value="">{ar ? 'اختر لاعباً من الأكاديمية...' : 'Select academy player...'}</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.firstName} {p.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                    {ar ? 'نموذج المعايير المعتمد' : 'Criteria Template'}
                  </label>
                  <select
                    value={formTemplateId}
                    onChange={(e) => setFormTemplateId(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none cursor-pointer"
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.ageCategory ? `(${t.ageCategory})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Real-time Overall Score Display Card */}
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-[var(--text-muted)]">
                    {ar ? 'المعدل العام التراكمي المحسوب تلقائياً' : 'Calculated Cumulative Average'}
                  </span>
                  <div className="text-2xl font-extrabold text-[var(--accent-primary)] mt-0.5">
                    {calculatedOverall.toFixed(2)} / 10
                  </div>
                </div>
                <div className="text-end text-xs text-[var(--text-muted)]">
                  {ar ? 'متوسط (فني + تكتيكي + بدني + سلوكي) / 4' : '(Technical + Tactical + Physical + Behavioral) / 4'}
                </div>
              </div>

              {/* 4 Pillars Sliders */}
              <div className="space-y-4 pt-2">
                <h3 className="text-sm font-bold text-[var(--text-main)]">
                  {ar ? 'الدرجات الأساسية (من 1 إلى 10)' : 'Core Pillar Scores (Scale 1 - 10)'}
                </h3>

                {/* Technical Score */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-[var(--text-main)]">
                      1. {ar ? 'المهارات الفنية' : 'Technical Skills'} (Technical)
                    </span>
                    <span className="font-bold text-[var(--accent-primary)]">
                      {formTechnical.toFixed(1)} / 10
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.1"
                    value={formTechnical}
                    onChange={(e) => setFormTechnical(parseFloat(e.target.value))}
                    className="w-full accent-[var(--accent-primary)] cursor-pointer"
                  />
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {ar
                      ? 'التحكم بالكرة، دقة التمرير، المراوغة، التسديد واستقبال الكرات.'
                      : 'Ball control, passing accuracy, dribbling, shooting, and first touch.'}
                  </span>
                </div>

                {/* Tactical Score */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-[var(--text-main)]">
                      2. {ar ? 'الوعي التكتيكي' : 'Tactical Awareness'} (Tactical)
                    </span>
                    <span className="font-bold text-[var(--accent-primary)]">
                      {formTactical.toFixed(1)} / 10
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.1"
                    value={formTactical}
                    onChange={(e) => setFormTactical(parseFloat(e.target.value))}
                    className="w-full accent-[var(--accent-primary)] cursor-pointer"
                  />
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {ar
                      ? 'التمركز الصحيح، اتخاذ القرار، رؤية الملعب، والتحرك بدون كرة.'
                      : 'Positioning, pitch vision, decision speed, and off-the-ball movement.'}
                  </span>
                </div>

                {/* Physical Score */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-[var(--text-main)]">
                      3. {ar ? 'الجاهزية البدنية' : 'Physical Fitness'} (Physical)
                    </span>
                    <span className="font-bold text-[var(--accent-primary)]">
                      {formPhysical.toFixed(1)} / 10
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.1"
                    value={formPhysical}
                    onChange={(e) => setFormPhysical(parseFloat(e.target.value))}
                    className="w-full accent-[var(--accent-primary)] cursor-pointer"
                  />
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {ar
                      ? 'السرعة بالكرة، الرشاقة، التوازن، القوة البدنية، والتحمل الهوائي.'
                      : 'Speed, agility, balance, core strength, and aerobic stamina.'}
                  </span>
                </div>

                {/* Behavioral Score */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-[var(--text-main)]">
                      4. {ar ? 'الانضباط والسلوك' : 'Discipline & Behavior'} (Behavioral)
                    </span>
                    <span className="font-bold text-[var(--accent-primary)]">
                      {formBehavioral.toFixed(1)} / 10
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.1"
                    value={formBehavioral}
                    onChange={(e) => setFormBehavioral(parseFloat(e.target.value))}
                    className="w-full accent-[var(--accent-primary)] cursor-pointer"
                  />
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {ar
                      ? 'الالتزام بتوجيهات المدرب، الروح الرياضية، والتعاون الإيجابي مع الزملاء.'
                      : 'Coachability, sportsmanship, discipline, and team camaraderie.'}
                  </span>
                </div>
              </div>

              {/* Strengths & Improvements */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                    {ar ? 'أبرز نقاط القوة' : 'Key Strengths'}
                  </label>
                  <textarea
                    rows={2}
                    placeholder={ar ? 'مثال: دقة متناهية في التمرير القصير وهدوء تحت الضغط...' : 'e.g. Exceptional precision in short passes, composure under press...'}
                    value={formStrengths}
                    onChange={(e) => setFormStrengths(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-2.5 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                    {ar ? 'مجالات بحاجة إلى تطوير' : 'Areas for Improvement'}
                  </label>
                  <textarea
                    rows={2}
                    placeholder={ar ? 'مثال: التغطية العكسية عند فقدان الكرة، التسديد بالقدم اليسرى...' : 'e.g. Defensive recovery on turnovers, weaker-foot shooting...'}
                    value={formImprovements}
                    onChange={(e) => setFormImprovements(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-2.5 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
                  />
                </div>
              </div>

              {/* Privacy-Tiers: Private Coach Notes vs. Guardian Feedback */}
              <div className="space-y-4 pt-2 border-t border-[var(--border-subtle)]">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Lock className="h-3.5 w-3.5 text-amber-500" />
                    <label className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      {ar
                        ? 'ملاحظات المدرب الداخلية الخاصة (سرية تماماً — لا تظهر لولي الأمر أو اللاعب)'
                        : 'Confidential Internal Staff Notes (Hidden from player and guardian)'}
                    </label>
                  </div>
                  <textarea
                    rows={2}
                    placeholder={ar ? 'ملاحظات فنية خاصة بالجهاز التدريبي، خطط تصعيد اللاعب...' : 'Private observations, promotion plans, physical health flags...'}
                    value={formPrivateNotes}
                    onChange={(e) => setFormPrivateNotes(e.target.value)}
                    className="w-full rounded-lg border border-amber-500/30 bg-[var(--bg-base)] p-2.5 text-xs text-[var(--text-main)] placeholder-amber-500/50 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <HeartHandshake className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                    <label className="text-xs font-bold text-[var(--accent-primary)]">
                      {ar
                        ? 'رسالة وتوجيهات لولي الأمر (تظهر في بوابة ولي الأمر)'
                        : 'Guidance Note for Guardian (Visible on Guardian Portal)'}
                    </label>
                  </div>
                  <textarea
                    rows={2}
                    placeholder={ar ? 'كلمة تشجيعية لولي الأمر، توجيهات غذائية ونوم، وتوصيات للتدريب المنزلي...' : 'Encouraging message, nutrition recommendations, home drills...'}
                    value={formGuardianFeedback}
                    onChange={(e) => setFormGuardianFeedback(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-2.5 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                    {ar ? 'الأهداف المقترحة للمرحلة القادمة' : 'Next Milestone Goals'}
                  </label>
                  <input
                    type="text"
                    placeholder={ar ? 'مثال: إتقان الكرات الثابتة، رفع معدل التحمل إلى 90 دقيقة...' : 'e.g. Master set-piece delivery, build 90-minute stamina...'}
                    value={formGoals}
                    onChange={(e) => setFormGoals(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-2.5 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
                  />
                </div>
              </div>

              {/* Publish Toggle & Submit Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-[var(--border-subtle)]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsPublished}
                    onChange={(e) => setFormIsPublished(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--border-subtle)] bg-[var(--bg-base)] text-[var(--accent-primary)] focus:ring-0"
                  />
                  <span className="text-xs text-[var(--text-main)] font-medium">
                    {ar
                      ? 'نشر التقييم فوراً ليظهر في بوابة اللاعب وبوابة ولي الأمر'
                      : 'Publish evaluation immediately to Player & Guardian portals'}
                  </span>
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveDraft()}
                    className="rounded-xl border border-[var(--border-subtle)] px-4 py-2.5 text-sm font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                  >
                    {ar ? 'حفظ مسودة محلية' : 'Save Local Draft'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl bg-[var(--accent-primary)] px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>{ar ? 'جارٍ الحفظ...' : 'Submitting...'}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{ar ? 'اعتماد وحفظ التقييم' : 'Submit & Publish Evaluation'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: TEMPLATES */}
        {activeTab === 'templates' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-[var(--text-main)]">{template.name}</h3>
                  {template.isDefault && (
                    <span className="rounded-full bg-[var(--accent-primary)]/15 px-2 py-0.5 text-xs font-semibold text-[var(--accent-primary)] border border-[var(--accent-primary)]/30">
                      {ar ? 'النموذج الافتراضي' : 'Default Template'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  {template.description || (ar ? 'معايير تقييم متقدمة' : 'Advanced Evaluation Criteria')}
                </p>

                <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
                  <h4 className="text-xs font-semibold text-[var(--text-main)]">
                    {ar ? 'المعايير المحددة:' : 'Configured Criteria:'}
                  </h4>
                  <div className="space-y-1.5">
                    {template.criteria.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between text-xs bg-[var(--bg-surface-subtle)] p-2 rounded-lg"
                      >
                        <span className="text-[var(--text-main)]">{c.name}</span>
                        <span className="text-[10px] text-[var(--accent-primary)] font-semibold bg-[var(--accent-primary)]/10 px-2 py-0.5 rounded">
                          {c.category}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function EvaluationsCenterPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="flex h-64 items-center justify-center">
            <RefreshCw className="h-8 w-8 animate-spin text-[var(--accent-primary)]" />
          </div>
        </AppShell>
      }
    >
      <EvaluationsCenterContent />
    </Suspense>
  );
}
