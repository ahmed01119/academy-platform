'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiClient } from '../../lib/api-client';
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

export default function EvaluationsCenterPage() {
  const searchParams = useSearchParams();
  const preselectedSessionId = searchParams.get('sessionId');
  const { activeTenant } = useAuth();

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
  const [formStatus, setFormStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const calculatedOverall = Number(
    ((formTechnical + formTactical + formPhysical + formBehavioral) / 4).toFixed(2),
  );

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [rankingsRes, templatesRes, playersRes, groupsRes] = await Promise.all([
        apiClient.evaluations.getRankings({
          ageCategory: selectedAgeCategory || undefined,
          groupId: selectedGroupId || undefined,
        }).catch(() => null),
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
    <div className="min-h-screen bg-[#0a1410] text-[#e8f0ec] py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header Hero */}
        <div className="rounded-2xl border border-[#2b4c3e] bg-gradient-to-r from-[#12231c] via-[#162821] to-[#12231c] p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#45c387] bg-[#2f9e6b]/15 px-3 py-1 rounded-full border border-[#2f9e6b]/30">
                  <Award className="h-4 w-4" />
                  Player Performance Intelligence
                </span>
                <span className="text-xs text-[#9bb5a8]">
                  {activeTenant?.tenantName || 'الأكاديمية الرياضية'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                مركز تقييم الأداء والذكاء الرياضي
              </h1>
              <p className="mt-1 text-sm text-[#9bb5a8]">
                متابعة تطور اللاعبين الرباعي (فني، تكتيكي، بدني، سلوكي)، وتصنيف الفئات العمرية بشفافية وعدالة.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => { void loadData(); }}
                disabled={isLoading}
                className="flex items-center gap-1.5 rounded-xl border border-[#2b4c3e] bg-[#162821] px-3.5 py-2.5 text-sm font-semibold text-[#9bb5a8] hover:text-white hover:border-[#2f9e6b] transition-all"
                title="تحديث البيانات"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-[#45c387]' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('new-eval')}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] px-4 py-2.5 text-sm font-semibold text-[#062016] shadow-md shadow-[#2f9e6b]/20 hover:brightness-110 transition-all"
              >
                <PlusCircle className="h-4 w-4" />
                <span>تقييم لاعب جديد</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-[#234235] flex items-center gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('rankings')}
            className={`pb-3 text-sm font-semibold transition-all relative ${
              activeTab === 'rankings'
                ? 'text-[#45c387] border-b-2 border-[#45c387]'
                : 'text-[#9bb5a8] hover:text-white'
            }`}
          >
            لوحة الترتيب والتصنيف العادل
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('new-eval')}
            className={`pb-3 text-sm font-semibold transition-all relative ${
              activeTab === 'new-eval'
                ? 'text-[#45c387] border-b-2 border-[#45c387]'
                : 'text-[#9bb5a8] hover:text-white'
            }`}
          >
            إضافة تقييم أداء للاعب
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`pb-3 text-sm font-semibold transition-all relative ${
              activeTab === 'templates'
                ? 'text-[#45c387] border-b-2 border-[#45c387]'
                : 'text-[#9bb5a8] hover:text-white'
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
                <h4 className="font-bold text-sm text-emerald-300">معيار ومعادلة التصنيف العادل للاعبين</h4>
                <p className="text-xs text-emerald-200 mt-1 leading-relaxed">
                  يتم الترتيب بناءً على: <span className="font-mono font-bold text-white">المعدل التراكمي = (المهارات الفنية + الوعي التكتيكي + الجاهزية البدنية + الانضباط والسلوك) / 4</span> بناءً على تقييمات المدربين الرسمية لكل فئة عمرية أو مجموعة تدريبية، لمنع مقارنة الفئات العمرية غير المتكافئة.
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
                  className="rounded-lg border border-[#2b4c3e] bg-[#162821] px-3 py-2 text-xs text-white focus:border-[#2f9e6b] focus:outline-none"
                >
                  <option value="">جميع الفئات العمرية</option>
                  <option value="U-11">فئة البراعم (U-11)</option>
                  <option value="U-14">فئة الناشئين (U-14)</option>
                  <option value="U-17">فئة الشباب (U-17)</option>
                </select>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-xs text-[#9bb5a8] font-medium">المجموعة التدريبية:</span>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="rounded-lg border border-[#2b4c3e] bg-[#162821] px-3 py-2 text-xs text-white focus:border-[#2f9e6b] focus:outline-none"
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
            <div className="overflow-x-auto rounded-xl border border-[#234235] bg-[#12231c]">
              <table className="w-full text-right text-xs">
                <thead className="bg-[#162821] text-[#9bb5a8] border-b border-[#234235]">
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
                <tbody className="divide-y divide-[#234235]/60">
                  {!rankings || rankings.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[#9bb5a8]">
                        لا توجد بيانات تقييم للاعبين ضمن الفئة المحددة حالياً. ابدأ بإضافة تقييم من تبويب "إضافة تقييم جديد".
                      </td>
                    </tr>
                  ) : (
                    rankings.items.map((item) => {
                      const isTop1 = item.rank === 1;
                      const isTop2 = item.rank === 2;
                      const isTop3 = item.rank === 3;

                      return (
                        <tr key={item.playerId} className="hover:bg-[#162821]/50 transition-colors">
                          <td className="p-3.5 text-center">
                            {isTop1 ? (
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/20 text-amber-300 font-extrabold text-xs border border-amber-500/40 shadow-sm shadow-amber-500/20">
                                🥇
                              </span>
                            ) : isTop2 ? (
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-300/20 text-slate-200 font-extrabold text-xs border border-slate-300/40">
                                🥈
                              </span>
                            ) : isTop3 ? (
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-700/20 text-amber-500 font-extrabold text-xs border border-amber-700/40">
                                🥉
                              </span>
                            ) : (
                              <span className="font-bold text-[#9bb5a8]">#{item.rank}</span>
                            )}
                          </td>
                          <td className="p-3.5 font-bold text-white text-sm">
                            {item.playerName}
                          </td>
                          <td className="p-3.5 text-[#9bb5a8]">
                            <span className="rounded bg-[#234235] px-2 py-0.5 text-[11px] text-[#45c387] ml-2">
                              {item.ageCategory}
                            </span>
                            <span>{item.groupName || '—'}</span>
                          </td>
                          <td className="p-3.5 text-center text-white font-medium">
                            {item.evaluationsCount} تقييم
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="text-base font-extrabold text-[#45c387]">
                              {item.averageScore.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-[#9bb5a8]"> / 10</span>
                          </td>
                          <td className="p-3.5 text-center">
                            {item.trend === 'UP' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                                <TrendingUp className="h-3.5 w-3.5" />
                                +{item.trendDelta}
                              </span>
                            ) : item.trend === 'DOWN' ? (
                              <span className="inline-flex items-center gap-1 text-rose-400 text-xs font-semibold">
                                <TrendingDown className="h-3.5 w-3.5" />
                                {item.trendDelta}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[#9bb5a8] text-xs">
                                <Minus className="h-3.5 w-3.5" />
                                مستقر
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-center">
                            <Link
                              href={`/evaluations/player/${item.playerId}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#2b4c3e] bg-[#162821] px-3 py-1.5 text-xs font-semibold text-[#45c387] hover:border-[#2f9e6b] hover:bg-[#2f9e6b]/10 transition-all"
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
          <div className="max-w-3xl mx-auto rounded-2xl border border-[#234235] bg-[#12231c] p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Award className="h-5 w-5 text-[#2f9e6b]" />
                <span>نموذج تقييم أداء اللاعب الرباعي</span>
              </h2>
              <p className="text-xs text-[#9bb5a8] mt-1">
                سجل درجات المهارات الرياضية، الملاحظات الخاصة بالمدرب، والتوجيهات الموجهة لولي الأمر واللاعب.
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
                  <label className="block text-xs font-medium text-[#9bb5a8] mb-1.5">
                    اللاعب المراد تقييمه *
                  </label>
                  <select
                    required
                    value={formPlayerId}
                    onChange={(e) => setFormPlayerId(e.target.value)}
                    className="w-full rounded-lg border border-[#2b4c3e] bg-[#162821] px-3 py-2 text-xs text-white focus:border-[#2f9e6b] focus:outline-none"
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
                  <label className="block text-xs font-medium text-[#9bb5a8] mb-1.5">
                    نموذج المعايير المعتمد
                  </label>
                  <select
                    value={formTemplateId}
                    onChange={(e) => setFormTemplateId(e.target.value)}
                    className="w-full rounded-lg border border-[#2b4c3e] bg-[#162821] px-3 py-2 text-xs text-white focus:border-[#2f9e6b] focus:outline-none"
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
              <div className="rounded-xl border border-[#2f9e6b]/40 bg-[#162821] p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#9bb5a8]">المعدل العام التراكمي المحسوب تلقائياً</span>
                  <div className="text-2xl font-extrabold text-[#45c387] mt-0.5">
                    {calculatedOverall.toFixed(2)} / 10
                  </div>
                </div>
                <div className="text-left text-xs text-[#9bb5a8]">
                  متوسط (فني + تكتيكي + بدني + سلوكي) / 4
                </div>
              </div>

              {/* 4 Pillars Sliders */}
              <div className="space-y-4 pt-2">
                <h3 className="text-sm font-bold text-white">الدرجات الأساسية (من 1 إلى 10)</h3>

                {/* Technical Score */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-white">1. المهارات الفنية (Technical)</span>
                    <span className="font-bold text-[#45c387]">{formTechnical.toFixed(1)} / 10</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.1"
                    value={formTechnical}
                    onChange={(e) => setFormTechnical(parseFloat(e.target.value))}
                    className="w-full accent-[#2f9e6b] cursor-pointer"
                  />
                  <span className="text-[10px] text-[#9bb5a8]">
                    التحكم بالكرة، دقة التمرير، المراوغة، التسديد واستقبال الكرات.
                  </span>
                </div>

                {/* Tactical Score */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-white">2. الوعي التكتيكي (Tactical)</span>
                    <span className="font-bold text-[#45c387]">{formTactical.toFixed(1)} / 10</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.1"
                    value={formTactical}
                    onChange={(e) => setFormTactical(parseFloat(e.target.value))}
                    className="w-full accent-[#2f9e6b] cursor-pointer"
                  />
                  <span className="text-[10px] text-[#9bb5a8]">
                    التمركز الصحيح، اتخاذ القرار، رؤية الملعب، والتحرك بدون كرة.
                  </span>
                </div>

                {/* Physical Score */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-white">3. الجاهزية البدنية (Physical)</span>
                    <span className="font-bold text-[#45c387]">{formPhysical.toFixed(1)} / 10</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.1"
                    value={formPhysical}
                    onChange={(e) => setFormPhysical(parseFloat(e.target.value))}
                    className="w-full accent-[#2f9e6b] cursor-pointer"
                  />
                  <span className="text-[10px] text-[#9bb5a8]">
                    السرعة بالكرة، الرشاقة، التوازن، القوة البدنية، والتحمل الهوائي.
                  </span>
                </div>

                {/* Behavioral Score */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-white">4. الانضباط والسلوك (Behavioral)</span>
                    <span className="font-bold text-[#45c387]">{formBehavioral.toFixed(1)} / 10</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.1"
                    value={formBehavioral}
                    onChange={(e) => setFormBehavioral(parseFloat(e.target.value))}
                    className="w-full accent-[#2f9e6b] cursor-pointer"
                  />
                  <span className="text-[10px] text-[#9bb5a8]">
                    الالتزام بتوجيهات المدرب، الروح الرياضية، والتعاون الإيجابي مع الزملاء.
                  </span>
                </div>
              </div>

              {/* Strengths & Improvements */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-[#9bb5a8] mb-1">
                    أبرز نقاط القوة
                  </label>
                  <textarea
                    rows={2}
                    placeholder="مثال: دقة متناهية في التمرير القصير وهدوء تحت الضغط..."
                    value={formStrengths}
                    onChange={(e) => setFormStrengths(e.target.value)}
                    className="w-full rounded-lg border border-[#2b4c3e] bg-[#162821] p-2.5 text-xs text-white placeholder-[#9bb5a8] focus:border-[#2f9e6b] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#9bb5a8] mb-1">
                    مجالات بحاجة إلى تطوير
                  </label>
                  <textarea
                    rows={2}
                    placeholder="مثال: التغطية العكسية عند فقدان الكرة، التسديد بالقدم اليسرى..."
                    value={formImprovements}
                    onChange={(e) => setFormImprovements(e.target.value)}
                    className="w-full rounded-lg border border-[#2b4c3e] bg-[#162821] p-2.5 text-xs text-white placeholder-[#9bb5a8] focus:border-[#2f9e6b] focus:outline-none"
                  />
                </div>
              </div>

              {/* Privacy-Tiers: Private Coach Notes vs. Guardian Feedback */}
              <div className="space-y-4 pt-2 border-t border-[#234235]">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Lock className="h-3.5 w-3.5 text-amber-400" />
                    <label className="text-xs font-bold text-amber-300">
                      ملاحظات المدرب الداخلية الخاصة (سرية تماماً — لا تظهر لولي الأمر أو اللاعب)
                    </label>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="ملاحظات فنية خاصة بالجهاز التدريبي، خطط تصعيد اللاعب، مؤشرات بدنية داخلية..."
                    value={formPrivateNotes}
                    onChange={(e) => setFormPrivateNotes(e.target.value)}
                    className="w-full rounded-lg border border-amber-500/30 bg-[#162821] p-2.5 text-xs text-amber-100 placeholder-amber-400/40 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <HeartHandshake className="h-3.5 w-3.5 text-[#45c387]" />
                    <label className="text-xs font-bold text-[#45c387]">
                      رسالة وتوجيهات لولي الأمر (تظهر في بوابة ولي الأمر)
                    </label>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="كلمة تشجيعية لولي الأمر، توجيهات غذائية ونوم، وتوصيات للتدريب المنزلي..."
                    value={formGuardianFeedback}
                    onChange={(e) => setFormGuardianFeedback(e.target.value)}
                    className="w-full rounded-lg border border-[#2b4c3e] bg-[#162821] p-2.5 text-xs text-white placeholder-[#9bb5a8] focus:border-[#2f9e6b] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#9bb5a8] mb-1">
                    الأهداف المقترحة للمرحلة القادمة
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: إتقان الكرات الثابتة، رفع معدل التحمل إلى 90 دقيقة..."
                    value={formGoals}
                    onChange={(e) => setFormGoals(e.target.value)}
                    className="w-full rounded-lg border border-[#2b4c3e] bg-[#162821] p-2.5 text-xs text-white placeholder-[#9bb5a8] focus:border-[#2f9e6b] focus:outline-none"
                  />
                </div>
              </div>

              {/* Publish Toggle & Submit Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-[#234235]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsPublished}
                    onChange={(e) => setFormIsPublished(e.target.checked)}
                    className="h-4 w-4 rounded border-[#2b4c3e] bg-[#162821] text-[#2f9e6b] focus:ring-0"
                  />
                  <span className="text-xs text-white font-medium">
                    نشر التقييم فوراً ليظهر في بوابة اللاعب وبوابة ولي الأمر
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] px-6 py-2.5 text-sm font-bold text-[#062016] shadow-md shadow-[#2f9e6b]/20 hover:brightness-110 transition-all flex items-center justify-center gap-2"
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
            </form>
          </div>
        )}

        {/* TAB 3: TEMPLATES */}
        {activeTab === 'templates' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className="rounded-xl border border-[#234235] bg-[#12231c] p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-white">{template.name}</h3>
                  {template.isDefault && (
                    <span className="rounded-full bg-[#2f9e6b]/20 px-2 py-0.5 text-xs font-semibold text-[#45c387] border border-[#2f9e6b]/30">
                      النموذج الافتراضي
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#9bb5a8] leading-relaxed">
                  {template.description || 'معايير تقييم متقدمة'}
                </p>

                <div className="space-y-2 pt-2 border-t border-[#234235]">
                  <h4 className="text-xs font-semibold text-white">المعايير المحددة:</h4>
                  <div className="space-y-1.5">
                    {template.criteria.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between text-xs bg-[#162821] p-2 rounded-lg"
                      >
                        <span className="text-white">{c.name}</span>
                        <span className="text-[10px] text-[#45c387] font-semibold bg-[#2f9e6b]/10 px-2 py-0.5 rounded">
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
    </div>
  );
}
