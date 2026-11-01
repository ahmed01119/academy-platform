'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiClient } from '../../lib/api-client';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/ui/PageHeader';
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
  const [claimStatus, setClaimStatus] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
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
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-[var(--accent-primary)]" />
            <p className="text-sm font-medium text-[var(--text-muted)]">
              جارٍ تحميل بوابة ولي الأمر...
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  // If user does not have a linked guardian profile yet, prompt to claim child
  if (!guardianData || guardianData.children.length === 0) {
    return (
      <AppShell>
        <div className="py-8">
          <div className="mx-auto max-w-xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 text-center space-y-6 shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-400">
              <HeartHandshake className="h-8 w-8" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-[var(--text-main)]">بوابة ولي الأمر</h1>
              <p className="text-sm text-[var(--text-muted)] mt-2 leading-relaxed">
                لم يتم ربط أي أبناء مسجلين بحسابك حتى الآن. يرجى إدخال رمز المطالبة (Claim Code)
                الممنوح لك من قِبل الأكاديمية لربط ملف ابنك ومتابعة حضوره وأدائه.
              </p>
            </div>

            {claimStatus && (
              <div
                className={`p-4 rounded-xl border text-xs text-right ${
                  claimStatus.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                }`}
              >
                {claimStatus.text}
              </div>
            )}

            <form onSubmit={handleClaimChild} className="space-y-4 text-right">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                  رمز المطالبة (Claim Code):
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: ACAD-XXXX"
                  value={claimTokenInput}
                  onChange={(e) => setClaimTokenInput(e.target.value)}
                  className="w-full font-mono text-center tracking-widest text-lg font-bold rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-4 py-3 text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-purple-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isClaiming}
                className="w-full rounded-xl bg-purple-600 py-3 text-sm font-bold text-white hover:bg-purple-700 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {isClaiming ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                <span>تأكيد وربط الابن بالحساب</span>
              </button>
            </form>

            <p className="text-xs text-[var(--text-muted)]">
              رمز المطالبة يوفره المشرف أو المدرب لتأكيد صلة القرابة برقم الهوية أو الجوال.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  const selectedChild =
    guardianData.children.find((c) => c.playerId === selectedChildId) || guardianData.children[0]!;

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          breadcrumbs={[{ label: 'الرئيسية', href: '/dashboard' }, { label: 'بوابة ولي الأمر' }]}
          title={`أهلاً بك، ${guardianData.name} 👨‍👩‍👧‍👦`}
          description="متابعة حضور وتطور وملاحظات المدربين لأبنائك المسجلين في الأكاديميات الرياضية."
          actions={
            <button
              type="button"
              onClick={() => setIsClaimModalOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-xs font-bold text-purple-600 dark:text-purple-300 hover:bg-purple-500/20 transition-all cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              <span>ربط ابن آخر برمز المطالبة</span>
            </button>
          }
        />

        {/* Multi-Child Selector Tabs */}
        {guardianData.children.length > 1 && (
          <div className="flex items-center gap-3 overflow-x-auto pb-2">
            <span className="text-xs text-[var(--text-muted)] font-medium flex-shrink-0">
              اختيار الابن:
            </span>
            {guardianData.children.map((child) => (
              <button
                key={child.playerId}
                type="button"
                onClick={() => setSelectedChildId(child.playerId)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all flex-shrink-0 cursor-pointer ${
                  child.playerId === selectedChildId
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-subtle)] hover:text-[var(--text-main)]'
                }`}
              >
                <span>
                  {child.firstName} {child.lastName}
                </span>
                <span className="text-[10px] opacity-80">({child.tenantName})</span>
              </button>
            ))}
          </div>
        )}

        {/* Selected Child Summary Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Child Identity Card */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-xl bg-purple-600 text-white flex items-center justify-center text-xl font-black shadow-md">
                {selectedChild.firstName.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-lg text-[var(--text-main)]">
                  {selectedChild.firstName} {selectedChild.lastName}
                </h3>
                <span className="text-xs text-[var(--text-muted)] block">
                  {selectedChild.tenantName} • {selectedChild.branchName || 'الفرع الرئيسي'}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs border-t border-[var(--border-subtle)] pt-3 text-[var(--text-muted)]">
              <div className="flex justify-between">
                <span>الفريق:</span>
                <span className="text-[var(--text-main)] font-semibold">
                  {selectedChild.groupName || 'فريق البراعم'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>صلة القرابة:</span>
                <span className="text-[var(--text-main)] font-semibold">
                  {selectedChild.relationship === 'FATHER' ? 'الوالد' : 'ولي الأمر'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>تاريخ الميلاد:</span>
                <span className="text-[var(--text-main)] font-semibold">
                  {selectedChild.dateOfBirth}
                </span>
              </div>
            </div>
          </div>

          {/* Attendance Rate Card */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 flex flex-col justify-between shadow-sm">
            <div>
              <span className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mb-1">
                <CalendarCheck className="h-4 w-4 text-[var(--accent-primary)]" />
                نسبة الالتزام بالحضور
              </span>
              <div className="text-3xl font-black text-[var(--accent-primary)] mt-2">
                {selectedChild.attendanceRate}%
              </div>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-4 leading-relaxed">
              المواظبة على التدريبات الأسبوعية تعزز من لياقة وانضباط اللاعب وتطوره الفني داخل
              الملعب.
            </p>
          </div>

          {/* Performance Score Card */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 flex flex-col justify-between shadow-sm">
            <div>
              <span className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mb-1">
                <Award className="h-4 w-4 text-amber-500" />
                آخر تقييم أداء مسجل
              </span>
              <div className="text-3xl font-black text-amber-500 mt-2">
                {selectedChild.latestScore ? `${selectedChild.latestScore.toFixed(1)} / 10` : '—'}
              </div>
            </div>
            <div className="mt-4">
              <Link
                href={`/evaluations/player/${selectedChild.playerId}`}
                className="text-xs font-semibold text-[var(--accent-primary)] hover:underline flex items-center gap-1"
              >
                <span>استعراض الرادار التنموي الكامل</span>
                <ChevronLeft className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Coach Feedback Specifically Directed to Guardian */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
            <HeartHandshake className="h-5 w-5 text-purple-500" />
            <span>توجيهات وملاحظات المدربين لولي الأمر</span>
          </h2>

          {childEvaluations.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 text-center text-[var(--text-muted)] shadow-sm">
              <Award className="h-10 w-10 text-purple-400 mx-auto mb-2 opacity-50" />
              <div className="font-semibold text-[var(--text-main)]">
                لا توجد ملاحظات منشورة حتى الآن
              </div>
              <p className="text-xs mt-1">
                ستظهر هنا رسائل المدرب الخاصة بولي الأمر فور اعتماد تقييم التدريب القادم.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {childEvaluations.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-4 hover:border-purple-500/30 transition-colors shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                    <div>
                      <span className="text-xs text-[var(--text-muted)]">
                        تاريخ الحصة: {item.evaluationDate}
                      </span>
                      <div className="text-xs font-semibold text-[var(--text-main)] mt-0.5">
                        المدرب المقيّم: {item.evaluatorName}
                      </div>
                    </div>
                    <div className="text-left">
                      <span className="text-xs text-[var(--text-muted)]">التقييم العام:</span>
                      <div className="text-lg font-black text-[var(--accent-primary)]">
                        {item.overallScore.toFixed(1)} / 10
                      </div>
                    </div>
                  </div>

                  {/* Feedback Blocks */}
                  <div className="space-y-3 text-xs">
                    {item.guardianFeedback ? (
                      <div className="bg-purple-500/10 border border-purple-500/30 p-3.5 rounded-xl">
                        <span className="font-bold text-purple-600 dark:text-purple-300 block mb-1">
                          رسالة وتوجيهات الكابتن لولي الأمر:
                        </span>
                        <p className="text-[var(--text-main)] leading-relaxed">
                          {item.guardianFeedback}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-[var(--bg-surface-subtle)] p-3 rounded-lg text-[var(--text-muted)]">
                        تم اعتماد التقييم الرياضي بدون ملاحظات إضافية.
                      </div>
                    )}

                    {item.suggestedGoals && (
                      <div className="bg-[var(--bg-surface-subtle)] p-3 rounded-lg border-r-2 border-sky-500">
                        <span className="font-bold text-sky-600 dark:text-sky-400 block mb-0.5">
                          الأهداف التدريبية المقترحة للمنزل:
                        </span>
                        <p className="text-[var(--text-main)]">{item.suggestedGoals}</p>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl space-y-4 text-right">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                <h3 className="font-bold text-base text-[var(--text-main)]">ربط ابن جديد بحسابك</h3>
                <button
                  type="button"
                  onClick={() => setIsClaimModalOpen(false)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                أدخل رمز المطالبة (Claim Code) الممنوح لك من إدارة الأكاديمية لربط ملف ابن آخر
                بحسابك.
              </p>

              {claimStatus && (
                <div
                  className={`p-3 rounded-xl border text-xs ${
                    claimStatus.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {claimStatus.text}
                </div>
              )}

              <form onSubmit={handleClaimChild} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                    رمز المطالبة:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: ACAD-XXXX"
                    value={claimTokenInput}
                    onChange={(e) => setClaimTokenInput(e.target.value)}
                    className="w-full font-mono text-center tracking-widest text-base font-bold rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-4 py-2.5 text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isClaiming}
                    className="flex-1 rounded-xl bg-purple-600 py-2.5 text-xs font-bold text-white hover:bg-purple-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isClaiming ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    <span>تأكيد الربط</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsClaimModalOpen(false)}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-4 py-2.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
