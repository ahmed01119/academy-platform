'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useLocale } from '@/contexts/locale-context';
import { translateDataString } from '@/utils/data-translator';
import { apiClient } from '@/api/client';
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
  ChevronRight,
  X,
} from 'lucide-react';
import type { GuardianPortalData, PlayerEvaluation } from '@academy/shared';

export default function GuardianPortalPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { locale, isRtl } = useLocale();
  const router = useRouter();
  const ar = locale === 'ar';

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
        text: res.message || (ar ? 'تم ربط حساب اللاعب بحساب ولي الأمر بنجاح!' : 'Child profile linked to guardian account!'),
      });
      setClaimTokenInput('');
      await loadGuardianData();
    } catch (err: unknown) {
      setClaimStatus({
        type: 'error',
        text: (err as Error)?.message || (ar ? 'رمز المطالبة غير صالح أو منتهي الصلاحية' : 'Invalid or expired claim token'),
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
              {ar ? 'جارٍ تحميل بوابة ولي الأمر...' : 'Loading Guardian Portal...'}
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
              <h1 className="text-2xl font-bold text-[var(--text-main)]">
                {ar ? 'بوابة ولي الأمر' : 'Guardian Portal'}
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-2 leading-relaxed">
                {ar
                  ? 'لم يتم ربط أي أبناء مسجلين بحسابك حتى الآن. يرجى إدخال رمز المطالبة (Claim Code) الممنوح لك من قِبل الأكاديمية لربط ملف ابنك ومتابعة حضوره وأدائه.'
                  : 'No players are currently linked to your guardian account. Please enter the claim code provided by the academy administration to track attendance and evaluations.'}
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

            <form onSubmit={handleClaimChild} className="space-y-4 text-start">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                  {ar ? 'رمز المطالبة (Claim Code):' : 'Claim Token / Code:'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="ACAD-XXXX"
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
                <span>{ar ? 'تأكيد وربط الابن بالحساب' : 'Claim & Link Child Profile'}</span>
              </button>
            </form>

            <p className="text-xs text-[var(--text-muted)]">
              {ar
                ? 'رمز المطالبة يوفره المشرف أو المدرب لتأكيد صلة القرابة برقم الهوية أو الجوال.'
                : 'The token is supplied by the coaching staff or admin desk to verify guardianship.'}
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
          breadcrumbs={[
            { label: ar ? 'الرئيسية' : 'Home', href: '/dashboard' },
            { label: ar ? 'بوابة ولي الأمر' : 'Guardian Portal' },
          ]}
          title={ar ? `أهلاً بك، ${guardianData.name} 👨‍👩‍👧‍👦` : `Welcome, ${guardianData.name} 👨‍👩‍👧‍👦`}
          description={
            ar
              ? 'متابعة حضور وتطور وملاحظات المدربين لأبنائك المسجلين في الأكاديميات الرياضية.'
              : 'Track attendance, skill evaluations, and personalized coach feedback for your children.'
          }
          actions={
            <button
              type="button"
              onClick={() => setIsClaimModalOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-xs font-bold text-purple-600 dark:text-purple-300 hover:bg-purple-500/20 transition-all cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              <span>{ar ? 'ربط ابن آخر برمز المطالبة' : 'Link Another Child'}</span>
            </button>
          }
        />

        {/* Multi-Child Selector Tabs */}
        {guardianData.children.length > 1 && (
          <div className="flex items-center gap-3 overflow-x-auto pb-2">
            <span className="text-xs text-[var(--text-muted)] font-medium flex-shrink-0">
              {ar ? 'اختيار الابن:' : 'Select Child:'}
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
                  {selectedChild.tenantName} •{' '}
                  {locale === 'en'
                    ? translateDataString(selectedChild.branchName, 'en') || 'Main Branch'
                    : selectedChild.branchName || 'الفرع الرئيسي'}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs border-t border-[var(--border-subtle)] pt-3 text-[var(--text-muted)]">
              <div className="flex justify-between">
                <span>{ar ? 'الفريق:' : 'Group / Squad:'}</span>
                <span className="text-[var(--text-main)] font-semibold">
                  {locale === 'en'
                    ? translateDataString(selectedChild.groupName, 'en') || 'Junior Squad'
                    : selectedChild.groupName || 'فريق البراعم'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{ar ? 'صلة القرابة:' : 'Relationship:'}</span>
                <span className="text-[var(--text-main)] font-semibold">
                  {selectedChild.relationship === 'FATHER'
                    ? ar
                      ? 'الوالد'
                      : 'Father'
                    : ar
                      ? 'ولي الأمر'
                      : 'Guardian'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{ar ? 'تاريخ الميلاد:' : 'Date of Birth:'}</span>
                <span className="text-[var(--text-main)] font-semibold">
                  {selectedChild.dateOfBirth
                    ? new Date(selectedChild.dateOfBirth).toLocaleDateString(ar ? 'ar-EG' : 'en-US')
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Attendance Rate Card */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 flex flex-col justify-between shadow-sm">
            <div>
              <span className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mb-1">
                <CalendarCheck className="h-4 w-4 text-[var(--accent-primary)]" />
                {ar ? 'نسبة الالتزام بالحضور' : 'Attendance Compliance Rate'}
              </span>
              <div className="text-3xl font-black text-[var(--accent-primary)] mt-2">
                {selectedChild.attendanceRate}%
              </div>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-4 leading-relaxed">
              {ar
                ? 'المواظبة على التدريبات الأسبوعية تعزز من لياقة وانضباط اللاعب وتطوره الفني داخل الملعب.'
                : 'Consistent weekly training check-ins reinforce player stamina, discipline, and tactical growth.'}
            </p>
          </div>

          {/* Performance Score Card */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 flex flex-col justify-between shadow-sm">
            <div>
              <span className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mb-1">
                <Award className="h-4 w-4 text-amber-500" />
                {ar ? 'آخر تقييم أداء مسجل' : 'Latest Overall Rating'}
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
                <span>{ar ? 'استعراض الرادار التنموي الكامل' : 'View Full Development Radar'}</span>
                {isRtl ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </Link>
            </div>
          </div>
        </div>

        {/* Coach Feedback Specifically Directed to Guardian */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
            <HeartHandshake className="h-5 w-5 text-purple-500" />
            <span>{ar ? 'توجيهات وملاحظات المدربين لولي الأمر' : 'Coach Guidance & Feedback'}</span>
          </h2>

          {childEvaluations.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 text-center text-[var(--text-muted)] shadow-sm">
              <Award className="h-10 w-10 text-purple-400 mx-auto mb-2 opacity-50" />
              <div className="font-semibold text-[var(--text-main)]">
                {ar ? 'لا توجد ملاحظات منشورة حتى الآن' : 'No Feedback Published Yet'}
              </div>
              <p className="text-xs mt-1">
                {ar
                  ? 'ستظهر هنا رسائل المدرب الخاصة بولي الأمر فور اعتماد تقييم التدريب القادم.'
                  : 'Coach evaluation notes will be shown here upon review completion.'}
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
                        {ar ? 'تاريخ الحصة: ' : 'Session Date: '}{item.evaluationDate}
                      </span>
                      <div className="text-xs font-semibold text-[var(--text-main)] mt-0.5">
                        {ar ? 'المدرب المقيّم: ' : 'Evaluator: '}{item.evaluatorName}
                      </div>
                    </div>
                    <div className="text-end">
                      <span className="text-xs text-[var(--text-muted)]">
                        {ar ? 'التقييم العام:' : 'Overall Score:'}
                      </span>
                      <div className="text-lg font-black text-[var(--accent-primary)]">
                        {item.overallScore.toFixed(1)} / 10
                      </div>
                    </div>
                  </div>

                  {item.guardianFeedback && (
                    <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-3.5 text-xs text-purple-900 dark:text-purple-200">
                      <span className="font-bold block mb-1">
                        {ar ? 'رسالة المدرب لولي الأمر:' : 'Note for Parent:'}
                      </span>
                      <p className="leading-relaxed">{item.guardianFeedback}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="rounded-lg bg-[var(--bg-surface-subtle)] p-2.5 text-center">
                      <span className="text-[10px] text-[var(--text-muted)] block">
                        {ar ? 'المهارات الفنية' : 'Technical'}
                      </span>
                      <span className="font-bold text-[var(--text-main)]">
                        {item.technicalScore.toFixed(1)} / 10
                      </span>
                    </div>
                    <div className="rounded-lg bg-[var(--bg-surface-subtle)] p-2.5 text-center">
                      <span className="text-[10px] text-[var(--text-muted)] block">
                        {ar ? 'الوعي التكتيكي' : 'Tactical'}
                      </span>
                      <span className="font-bold text-[var(--text-main)]">
                        {item.tacticalScore.toFixed(1)} / 10
                      </span>
                    </div>
                    <div className="rounded-lg bg-[var(--bg-surface-subtle)] p-2.5 text-center">
                      <span className="text-[10px] text-[var(--text-muted)] block">
                        {ar ? 'الجاهزية البدنية' : 'Physical'}
                      </span>
                      <span className="font-bold text-[var(--text-main)]">
                        {item.physicalScore.toFixed(1)} / 10
                      </span>
                    </div>
                    <div className="rounded-lg bg-[var(--bg-surface-subtle)] p-2.5 text-center">
                      <span className="text-[10px] text-[var(--text-muted)] block">
                        {ar ? 'السلوك والانضباط' : 'Behavior'}
                      </span>
                      <span className="font-bold text-[var(--text-main)]">
                        {item.behavioralScore.toFixed(1)} / 10
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Claim Child Modal */}
      {isClaimModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <h3 className="font-bold text-sm text-[var(--text-main)] flex items-center gap-2">
                <PlusCircle className="h-4 w-4 text-purple-500" />
                <span>{ar ? 'ربط ابن إضافي بالحساب' : 'Link Additional Child Profile'}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsClaimModalOpen(false);
                  setClaimStatus(null);
                }}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {claimStatus && (
              <div
                className={`p-3 rounded-xl border text-xs text-start ${
                  claimStatus.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                }`}
              >
                {claimStatus.text}
              </div>
            )}

            <form onSubmit={handleClaimChild} className="space-y-4 text-start">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                  {ar ? 'رمز المطالبة (Claim Code):' : 'Claim Token / Code:'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="ACAD-XXXX"
                  value={claimTokenInput}
                  onChange={(e) => setClaimTokenInput(e.target.value)}
                  className="w-full font-mono text-center tracking-widest text-base font-bold rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-2.5 text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsClaimModalOpen(false);
                    setClaimStatus(null);
                  }}
                  className="rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] cursor-pointer"
                >
                  {ar ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isClaiming || !claimTokenInput.trim()}
                  className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white hover:bg-purple-700 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isClaiming ? (ar ? 'جارٍ التحقق...' : 'Claiming...') : ar ? 'تأكيد الربط' : 'Confirm Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
