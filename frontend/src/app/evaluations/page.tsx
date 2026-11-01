'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';
import { offlineEngine } from '../../lib/offline-engine';
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
    if (!activeTenant?.tenantId || !user?.id || !formPlayerId) {
      setFormStatus({
        type: 'error',
        text: 'يلزم اختيار لاعب وتسجيل الدخول لحفظ مسودة محلية',
      });
      return;
    }
    const draftId = `${activeTenant.tenantId}:${formPlayerId}:${preselectedSessionId ?? 'none'}`;
    await offlineEngine.saveEvaluationDraft({
      id: draftId,
      tenantId: activeTenant.tenantId,
      actorUserId: user.id,
      playerId: formPlayerId,
      sessionId: preselectedSessionId || undefined,
      templateId: formTemplateId || undefined,
      technicalScore: formTechnical,
      tacticalScore: formTactical,
      physicalScore: formPhysical,
      behavioralScore: formBehavioral,
      strengths: formStrengths.trim() || undefined,
      areasForImprovement: formImprovements.trim() || undefined,
      privateCoachNotes: formPrivateNotes.trim() || undefined,
      guardianFeedback: formGuardianFeedback.trim() || undefined,
      suggestedGoals: formGoals.trim() || undefined,
      isPublished: false,
      updatedAt: new Date().toISOString(),
    });
    setFormStatus({
      type: 'success',
      text: 'تم حفظ المسودة على هذا الجهاز. النشر يتطلب اتصالاً بالخادم.',
    });
  };

  useEffect(() => {
    if (!activeTenant?.tenantId || !formPlayerId) return;
    const draftId = `${activeTenant.tenantId}:${formPlayerId}:${preselectedSessionId ?? 'none'}`;
    void offlineEngine.getEvaluationDraft(activeTenant.tenantId, draftId).then((draft) => {
      if (!draft) return;
      setFormTechnical(draft.technicalScore);
      setFormTactical(draft.tacticalScore);
      setFormPhysical(draft.physicalScore);
      setFormBehavioral(draft.behavioralScore);
      setFormStrengths(draft.strengths ?? '');
      setFormImprovements(draft.areasForImprovement ?? '');
      setFormPrivateNotes(draft.privateCoachNotes ?? '');
      setFormGuardianFeedback(draft.guardianFeedback ?? '');
      setFormGoals(draft.suggestedGoals ?? '');
      if (draft.templateId) setFormTemplateId(draft.templateId);
    });
  }, [activeTenant?.tenantId, formPlayerId, preselectedSessionId]);

  const handleSubmitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPlayerId) {
      setFormStatus({ type: 'error', text: 'يرجى اختيار اللاعب المراد تقييمه' });
      return;
    }

    setIsSubmitting(true);
    setFormStatus(null);
    try {
      await apiClient.evaluations.createEvaluation({
        playerId: formPlayerId,
        sessionId: preselectedSessionId || undefined,
        templateId: formTemplateId || undefined,
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
        text: 'تم حفظ واعتماد تقييم أداء اللاعب بنجاح! تم تحديث لوحة الترتيب وملف اللاعب.',
      });

      // Reset form
      setFormStrengths('');
      setFormImprovements('');
      setFormPrivateNotes('');
      setFormGuardianFeedback('');
      setFormGoals('');

      // Reload rankings
      await loadData();
    } catch (err: unknown) {
      setFormStatus({
        type: 'error',
        text: (err as Error)?.message || 'حدث خطأ أثناء حفظ التقييم',
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
            { label: 'الرئيسية', href: '/dashboard' },
            { label: 'مركز التقييم والذكاء الرياضي' },
          ]}
          title="مركز تقييم الأداء والذكاء الرياضي"
          description="متابعة تطور اللاعبين الرباعي (فني، تكتيكي، بدني، سلوكي)، وتصنيف الفئات العمرية بشفافية وعدالة."
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void loadData();
                }}
                disabled={isLoading}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--accent-primary)] transition-all"
                title="تحديث البيانات"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoading ? 'animate-spin text-[var(--accent-primary)]' : ''}`}
                />
                <span className="hidden sm:inline">تحديث</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('new-eval')}
                className="flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:brightness-110 transition-all"
              >
                <PlusCircle className="h-4 w-4" />
                <span>تقييم لاعب جديد</span>
              </button>
            </div>
          }
        />

        {/* Tab Navigation */}
        <div className="border-b border-[var(--border-subtle)] flex items-center gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('rankings')}
            className={`pb-3 text-sm font-semibold transition-all relative ${
              activeTab === 'rankings'
                ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            لوحة الترتيب والتصنيف العادل
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('new-eval')}
            className={`pb-3 text-sm font-semibold transition-all relative ${
              activeTab === 'new-eval'
                ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            إضافة تقييم أداء للاعب
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`pb-3 text-sm font-semibold transition-all relative ${
              activeTab === 'templates'
                ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            نماذج ومعايير التقييم ({templates.length})
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
                  معيار ومعادلة التصنيف العادل للاعبين
                </h4>
                <p className="text-xs text-emerald-200 mt-1 leading-relaxed">
                  يتم الترتيب بناءً على:{' '}
                  <span className="font-mono font-bold text-white">
                    المعدل التراكمي = (المهارات الفنية + الوعي التكتيكي + الجاهزية البدنية +
                    الانضباط والسلوك) / 4
                  </span>{' '}
                  بناءً على تقييمات المدربين الرسمية لكل فئة عمرية أو مجموعة تدريبية، لمنع مقارنة
                  الفئات العمرية غير المتكافئة.
                </p>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-[#12231c] p-4 rounded-xl border border-[#234235]">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-xs text-[#9bb5a8] font-medium flex items-center gap-1">
                  <Filter className="h-3.5 w-3.5 text-[#2f9e6b]" />
                  الفئة العمرية:
                </span>
                <select
                  value={selectedAgeCategory}
                  onChange={(e) => setSelectedAgeCategory(e.target.value)}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
                >
                  <option value="">جميع الفئات العمرية</option>
                  <option value="U-11">فئة البراعم (U-11)</option>
                  <option value="U-14">فئة الناشئين (U-14)</option>
                  <option value="U-17">فئة الشباب (U-17)</option>
                </select>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-xs text-[var(--text-muted)] font-medium">
                  المجموعة التدريبية:
                </span>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
                >
                  <option value="">جميع المجموعات</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Rankings Table */}
            <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              <table className="w-full text-right text-xs">
                <thead className="bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                  <tr>
                    <th className="p-3.5 text-center w-16">الترتيب</th>
                    <th className="p-3.5">اللاعب</th>
                    <th className="p-3.5">الفئة / المجموعة</th>
                    <th className="p-3.5 text-center">عدد التقييمات</th>
                    <th className="p-3.5 text-center">المعدل العام (10)</th>
                    <th className="p-3.5 text-center">الاتجاه (Trend)</th>
                    <th className="p-3.5 text-center">الملف التنموي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {!rankings || rankings.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[var(--text-muted)]">
                        لا توجد بيانات تقييم للاعبين ضمن الفئة المحددة حالياً. ابدأ بإضافة تقييم من
                        تبويب "إضافة تقييم جديد".
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
                            <span className="rounded bg-[var(--bg-surface-subtle)] px-2 py-0.5 text-[11px] text-[var(--accent-primary)] ml-2 border border-[var(--border-subtle)]">
                              {item.ageCategory}
                            </span>
                            <span>{item.groupName || '—'}</span>
                          </td>
                          <td className="p-3.5 text-center text-[var(--text-main)] font-medium">
                            {item.evaluationsCount} تقييم
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
                                مستقر
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-center">
                            <Link
                              href={`/evaluations/player/${item.playerId}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-primary)] hover:border-[var(--accent-primary)] transition-all"
                            >
                              <span>استعراض الرادار</span>
                              <ChevronLeft className="h-3.5 w-3.5" />
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
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Award className="h-5 w-5 text-[#2f9e6b]" />
                <span>نموذج تقييم أداء اللاعب الرباعي</span>
              </h2>
              <p className="text-xs text-[#9bb5a8] mt-1">
                سجل درجات المهارات الرياضية، الملاحظات الخاصة بالمدرب، والتوجيهات الموجهة لولي الأمر
                واللاعب.
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

            <form onSubmit={handleSubmitEvaluation} className="space-y-6">
              {/* Player Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                    اللاعب المراد تقييمه *
                  </label>
                  <select
                    required
                    value={formPlayerId}
                    onChange={(e) => setFormPlayerId(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
                  >
                    <option value="">اختر لاعباً من الأكاديمية...</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.firstName} {p.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                    نموذج المعايير المعتمد
                  </label>
                  <select
                    value={formTemplateId}
                    onChange={(e) => setFormTemplateId(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
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
                    المعدل العام التراكمي المحسوب تلقائياً
                  </span>
                  <div className="text-2xl font-extrabold text-[var(--accent-primary)] mt-0.5">
                    {calculatedOverall.toFixed(2)} / 10
                  </div>
                </div>
                <div className="text-left text-xs text-[var(--text-muted)]">
                  متوسط (فني + تكتيكي + بدني + سلوكي) / 4
                </div>
              </div>

              {/* 4 Pillars Sliders */}
              <div className="space-y-4 pt-2">
                <h3 className="text-sm font-bold text-[var(--text-main)]">
                  الدرجات الأساسية (من 1 إلى 10)
                </h3>

                {/* Technical Score */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-[var(--text-main)]">
                      1. المهارات الفنية (Technical)
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
                    التحكم بالكرة، دقة التمرير، المراوغة، التسديد واستقبال الكرات.
                  </span>
                </div>

                {/* Tactical Score */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-[var(--text-main)]">
                      2. الوعي التكتيكي (Tactical)
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
                    التمركز الصحيح، اتخاذ القرار، رؤية الملعب، والتحرك بدون كرة.
                  </span>
                </div>

                {/* Physical Score */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-[var(--text-main)]">
                      3. الجاهزية البدنية (Physical)
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
                    السرعة بالكرة، الرشاقة، التوازن، القوة البدنية، والتحمل الهوائي.
                  </span>
                </div>

                {/* Behavioral Score */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-[var(--text-main)]">
                      4. الانضباط والسلوك (Behavioral)
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
                    الالتزام بتوجيهات المدرب، الروح الرياضية، والتعاون الإيجابي مع الزملاء.
                  </span>
                </div>
              </div>

              {/* Strengths & Improvements */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                    أبرز نقاط القوة
                  </label>
                  <textarea
                    rows={2}
                    placeholder="مثال: دقة متناهية في التمرير القصير وهدوء تحت الضغط..."
                    value={formStrengths}
                    onChange={(e) => setFormStrengths(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-2.5 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                    مجالات بحاجة إلى تطوير
                  </label>
                  <textarea
                    rows={2}
                    placeholder="مثال: التغطية العكسية عند فقدان الكرة، التسديد بالقدم اليسرى..."
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
                      ملاحظات المدرب الداخلية الخاصة (سرية تماماً — لا تظهر لولي الأمر أو اللاعب)
                    </label>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="ملاحظات فنية خاصة بالجهاز التدريبي، خطط تصعيد اللاعب، مؤشرات بدنية داخلية..."
                    value={formPrivateNotes}
                    onChange={(e) => setFormPrivateNotes(e.target.value)}
                    className="w-full rounded-lg border border-amber-500/30 bg-[var(--bg-base)] p-2.5 text-xs text-[var(--text-main)] placeholder-amber-500/50 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <HeartHandshake className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                    <label className="text-xs font-bold text-[var(--accent-primary)]">
                      رسالة وتوجيهات لولي الأمر (تظهر في بوابة ولي الأمر)
                    </label>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="كلمة تشجيعية لولي الأمر، توجيهات غذائية ونوم، وتوصيات للتدريب المنزلي..."
                    value={formGuardianFeedback}
                    onChange={(e) => setFormGuardianFeedback(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-2.5 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                    الأهداف المقترحة للمرحلة القادمة
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: إتقان الكرات الثابتة، رفع معدل التحمل إلى 90 دقيقة..."
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
                    نشر التقييم فوراً ليظهر في بوابة اللاعب وبوابة ولي الأمر
                  </span>
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveDraft()}
                    className="rounded-xl border border-[var(--border-subtle)] px-4 py-2.5 text-sm font-semibold text-[var(--text-main)]"
                  >
                    حفظ مسودة محلية
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl bg-[var(--accent-primary)] px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:brightness-110 transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>جارٍ الحفظ...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>اعتماد وحفظ التقييم</span>
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
                      النموذج الافتراضي
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  {template.description || 'معايير تقييم متقدمة'}
                </p>

                <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
                  <h4 className="text-xs font-semibold text-[var(--text-main)]">
                    المعايير المحددة:
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
