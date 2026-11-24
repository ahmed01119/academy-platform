'use client';

import React, { useEffect, useState } from 'react';
import { useAcademySports } from '@/hooks/useAcademySports';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useAccessGuard } from '@/hooks/useAccessGuard';
import { Permission } from '@academy/shared';
import type { AccessRule } from '@/lib/auth/access-rules';
import { useLocale } from '@/contexts/locale-context';
import { AppShell } from '../../../components/layout/AppShell';
import { PageHeader } from '../../../components/ui/PageHeader';
import { api, getErrorMessage } from '@/api/client';
import { PageSkeleton } from '@/components/ui/skeleton';
import {
  buildCreatePlayerPayload,
  validateNewPlayerForm,
  type NewPlayerFormValues,
} from '@/features/players/new-player-form';
import type { BranchSummary } from '@academy/shared';
import { UserPlus, AlertCircle, Save, GitBranch } from 'lucide-react';
import { PlayerProfileFields } from '@/features/players/components/PlayerProfileFields';
import {
  EMPTY_PLAYER_PROFILE,
  type PlayerProfileFieldValues,
} from '@/features/players/player-profile-fields';

const PAGE_ACCESS: AccessRule = { anyOf: [Permission.PLAYERS_CREATE] };

export default function NewPlayerPage() {
  const router = useRouter();
  const { user, activeTenant, isLoading } = useAuth();
  const { locale } = useLocale();
  const { mainSport } = useAcademySports();

  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State: the shared player fields, then the branch enrollment.
  const [profile, setProfile] = useState<PlayerProfileFieldValues>(EMPTY_PLAYER_PROFILE);

  // Branch
  const [branchId, setBranchId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  useAccessGuard(PAGE_ACCESS);

  useEffect(() => {
    if (user && activeTenant) {
      void api.branches
        .list({ status: 'ACTIVE' })
        .then((data) => {
          setBranches(data);
          if (data.length > 0 && data[0]?.id) {
            setBranchId((prev) => prev || data[0]?.id || '');
          }
        })
        .catch(() => []);
    }
  }, [user, activeTenant]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const values: NewPlayerFormValues = {
      ...profile,
      branchId,
      enrollmentStartDate: startDate,
    };
    const lang = locale === 'ar' ? 'ar' : 'en';
    const validationError = validateNewPlayerForm(values, lang);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = buildCreatePlayerPayload(values, lang, mainSport);
      const created = await api.players.create(payload);
      router.push(`/players/${created.id}`);
    } catch (err: unknown) {
      setErrorMessage(
        getErrorMessage(err, locale === 'ar' ? 'فشل في تسجيل اللاعب' : 'Failed to enroll player'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <PageSkeleton variant="detail" />
      </AppShell>
    );
  }

  return (
    <AppShell
      breadcrumbs={[
        { label: locale === 'ar' ? 'اللاعبين' : 'Athletes', href: '/players' },
        { label: locale === 'ar' ? 'تسجيل لاعب جديد' : 'Enroll New Player' },
      ]}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <PageHeader
          title={locale === 'ar' ? 'استمارة تسجيل لاعب جديد' : 'New Athlete Enrollment Form'}
          description={
            locale === 'ar'
              ? 'تسجيل بيانات اللاعب الرياضية وتعيين ولي الأمر وقيده بالفرع المستهدف فوراً.'
              : 'Register athlete athletic profile, assign primary guardian, and enroll in target branch.'
          }
          icon={UserPlus}
        />

        {errorMessage && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-500 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <PlayerProfileFields
            values={profile}
            onChange={(patch) => setProfile((current) => ({ ...current, ...patch }))}
            locale={locale === 'ar' ? 'ar' : 'en'}
            idPrefix="new-player"
            disabled={isSubmitting}
          />

          {/* Section 3: Initial Branch Enrollment */}
          <div className="rounded-2xl border border-(--border-subtle) bg-[var(--bg-surface)] p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-(--border-subtle) pb-3 text-sm font-bold text-(--text-main)">
              <GitBranch className="h-4 w-4 text-[var(--accent-primary)]" />
              <span>{locale === 'ar' ? '3. القيد بفرع الأكاديمية' : '3. Branch Enrollment'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="select-initial-branch"
                  className="block text-xs font-semibold text-(--text-muted) mb-1.5"
                >
                  {locale === 'ar' ? 'الفرع المخصص *' : 'Assigned Branch *'}
                </label>
                <select
                  required
                  id="select-initial-branch"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-3.5 py-2.5 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none transition-colors"
                >
                  <option value="">{locale === 'ar' ? 'اختر الفرع...' : 'Select branch...'}</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.city ? `(${b.city})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="input-enrollment-start"
                  className="block text-xs font-semibold text-(--text-muted) mb-1.5"
                >
                  {locale === 'ar' ? 'تاريخ بدء القيد' : 'Enrollment Start Date'}
                </label>
                <input
                  type="date"
                  id="input-enrollment-start"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-3.5 py-2.5 text-xs text-(--text-main) focus:border-(--accent-primary) focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Actions Bar */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-(--border-subtle)">
            <Link
              href="/players"
              className="rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-5 py-2.5 text-xs font-semibold text-(--text-muted) hover:text-(--text-main) transition-colors"
            >
              {locale === 'ar' ? 'إلغاء' : 'Cancel'}
            </Link>

            <button
              type="submit"
              id="btn-submit-player"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-(--accent-primary) text-white px-6 py-2.5 text-xs font-semibold shadow-sm hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>
                {isSubmitting
                  ? locale === 'ar'
                    ? 'جارٍ الحفظ...'
                    : 'Saving...'
                  : locale === 'ar'
                    ? 'تسجيل وقيد اللاعب'
                    : 'Enroll Athlete'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
