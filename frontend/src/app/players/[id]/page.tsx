'use client';

import React, { use } from 'react';
import Link from 'next/link';
import { useAccessGuard } from '@/hooks/useAccessGuard';
import { useLocale } from '@/contexts/locale-context';
import { AppShell } from '../../../components/layout/AppShell';
import { PageSkeleton } from '@/components/ui/skeleton';
import {
  GitBranch,
  Phone,
  Heart,
  RefreshCw,
  ArrowRightLeft,
  Edit3,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Users,
  QrCode,
  Archive,
} from 'lucide-react';
import { PlayerQrCard } from '../../../components/player-qr-card';
import { usePlayerProfile } from '@/features/players/hooks/usePlayerProfile';
import {
  pastEnrollmentStatusLabel,
  playerGenderLabel,
  playerStatusLabel,
  playerStatusTone,
} from '@/features/players/player-profile';
import { TransferBranchModal } from '@/features/players/components/TransferBranchModal';
import { EditPlayerModal } from '@/features/players/components/EditPlayerModal';
import { GuardianLinkCodeButton } from '@/features/players/components/GuardianLinkCodeButton';
import { ArchivePlayerModal } from '@/features/players/components/ArchivePlayerModal';

const CARD = 'rounded-2xl border border-(--border-subtle) bg-(--bg-surface) p-6 shadow-sm';

export default function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: playerId } = use(params);
  const { t, locale } = useLocale();
  const isAr = locale === 'ar';
  const lang = isAr ? 'ar' : 'en';

  useAccessGuard('authenticated');
  const profile = usePlayerProfile(playerId, lang);
  const { player, permissions, transfer, edit, qr, archive } = profile;

  if (profile.isLoading) {
    return (
      <AppShell>
        <PageSkeleton variant="detail" />
      </AppShell>
    );
  }

  if (!player) {
    return (
      <AppShell>
        <div className="py-20 text-center">
          <AlertCircle aria-hidden="true" className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <p className="text-(--text-main) font-bold">
            {isAr ? 'اللاعب غير موجود أو تم حذفه' : 'Athlete does not exist or has been removed'}
          </p>
          {profile.errorMessage && (
            <p role="alert" className="mt-2 text-xs text-red-500">
              {profile.errorMessage}
            </p>
          )}
          <Link
            href="/players"
            className="mt-4 inline-block text-xs text-(--accent-primary) hover:underline"
          >
            {isAr ? 'العودة لقائمة اللاعبين' : 'Back to athletes list'}
          </Link>
        </div>
      </AppShell>
    );
  }

  const activeEnrollment = player.enrollments.find((en) => en.status === 'ACTIVE');
  const pastEnrollments = player.enrollments.filter((en) => en.status !== 'ACTIVE');
  const sep = ' • ';

  return (
    <AppShell
      breadcrumbs={[
        { label: t('nav.players'), href: '/players' },
        { label: `${player.firstName} ${player.lastName}` },
      ]}
    >
      <div className="space-y-6">
        {/* Alerts */}
        {profile.errorMessage && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-500 flex items-start gap-3"
          >
            <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0 text-red-500" />
            <div className="flex-1 font-medium">{profile.errorMessage}</div>
          </div>
        )}

        {profile.successMessage && (
          <div
            role="status"
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs text-emerald-600 dark:text-emerald-400 flex items-start gap-3"
          >
            <CheckCircle2
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
            />
            <div className="flex-1 font-medium">{profile.successMessage}</div>
          </div>
        )}

        {/* Player Profile Header Card */}
        <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface) p-6 sm:p-8 shadow-sm relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div
                aria-hidden="true"
                className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-(--accent-primary) text-white text-2xl sm:text-3xl font-extrabold shadow-sm"
              >
                {player.firstName.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl sm:text-3xl font-bold text-(--text-main)">
                    {player.firstName} {player.lastName}
                  </h1>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-bold ${playerStatusTone(player.status)}`}
                  >
                    {playerStatusLabel(player.status, lang)}
                  </span>
                </div>
                <p className="text-xs text-(--text-muted)">
                  {isAr ? 'تاريخ الميلاد:' : 'Date of birth:'}{' '}
                  <span className="text-(--text-main) font-mono">
                    {player.dateOfBirth.slice(0, 10)}
                  </span>
                  {sep}
                  {isAr ? 'الجنس:' : 'Gender:'}{' '}
                  <span className="text-(--text-main)">
                    {playerGenderLabel(player.gender, lang)}
                  </span>
                  {player.nationalId ? (
                    <>
                      {sep}
                      {isAr ? 'الرقم القومي:' : 'National ID:'}{' '}
                      <span className="text-(--text-main) font-mono">{player.nationalId}</span>
                    </>
                  ) : !permissions.canViewSensitive ? (
                    <>
                      {sep}
                      {isAr ? 'الرقم القومي:' : 'National ID:'}{' '}
                      <span className="text-(--text-muted) italic text-[11px]">
                        {isAr ? 'محجوب للخصوصية' : 'Hidden for privacy'}
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                id="btn-player-qr-card"
                onClick={qr.open}
                disabled={qr.isLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-4 py-2.5 text-xs font-semibold text-(--text-main) hover:border-(--accent-primary) transition-colors cursor-pointer disabled:opacity-50"
              >
                {qr.isLoading ? (
                  <RefreshCw
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin text-(--accent-primary)"
                  />
                ) : (
                  <QrCode aria-hidden="true" className="h-4 w-4 text-(--accent-primary)" />
                )}
                <span>{isAr ? 'بطاقة العضوية (QR Card)' : 'Membership QR Card'}</span>
              </button>

              <button
                type="button"
                id="btn-edit-player"
                onClick={edit.open}
                className="inline-flex items-center gap-2 rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-4 py-2.5 text-xs font-medium text-(--text-main) hover:border-(--accent-primary) transition-colors cursor-pointer"
              >
                <Edit3 aria-hidden="true" className="h-4 w-4 text-(--accent-primary)" />
                <span>{isAr ? 'تعديل البيانات' : 'Edit Profile'}</span>
              </button>

              <button
                type="button"
                id="btn-transfer-branch"
                onClick={transfer.open}
                className="inline-flex items-center gap-2 rounded-xl bg-(--accent-primary) text-white px-4 py-2.5 text-xs font-semibold shadow-sm hover:brightness-110 transition-all cursor-pointer"
              >
                <ArrowRightLeft aria-hidden="true" className="h-4 w-4" />
                <span>{isAr ? 'نقل لفرع آخر' : 'Transfer Branch'}</span>
              </button>

              {permissions.canDelete && player.status !== 'INACTIVE' && (
                <button
                  type="button"
                  id="btn-archive-player"
                  onClick={archive.open}
                  disabled={archive.isLoadingImpact}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/20 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {archive.isLoadingImpact ? (
                    <RefreshCw aria-hidden="true" className="h-4 w-4 animate-spin text-rose-500" />
                  ) : (
                    <Archive aria-hidden="true" className="h-4 w-4 text-rose-500" />
                  )}
                  <span>{isAr ? 'أرشفة اللاعب' : 'Archive Athlete'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Col 1 & 2: Branch Enrollments & History */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Branch Enrollment */}
            <section className={`${CARD} space-y-4`}>
              <div className="flex items-center justify-between border-b border-(--border-subtle) pb-3">
                <div className="flex items-center gap-2">
                  <GitBranch aria-hidden="true" className="h-5 w-5 text-blue-500" />
                  <h2 className="text-base font-bold text-(--text-main)">
                    {isAr ? 'الفرع الحالي المقيد به' : 'Current Enrolled Branch'}
                  </h2>
                </div>
                {activeEnrollment && (
                  <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-500 border border-blue-500/30">
                    {isAr ? 'قيد فعّال' : 'Active Enrollment'}
                  </span>
                )}
              </div>

              {activeEnrollment ? (
                <div className="rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-(--text-main)">
                        {activeEnrollment.branch.name}
                      </h3>
                      {activeEnrollment.branch.code && (
                        <span className="text-[10px] font-mono text-(--text-muted)">
                          {isAr ? 'كود الفرع: ' : 'Branch Code: '}
                          {activeEnrollment.branch.code}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={transfer.open}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-(--accent-primary) hover:underline cursor-pointer"
                    >
                      <ArrowRightLeft aria-hidden="true" className="h-3.5 w-3.5" />
                      <span>{isAr ? 'نقل إلى فرع آخر' : 'Transfer to Another Branch'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs pt-2 border-t border-(--border-subtle) text-(--text-muted)">
                    <div>
                      <span className="block text-[11px]">
                        {isAr ? 'تاريخ بدء القيد:' : 'Enrollment Start Date:'}
                      </span>
                      <span className="font-mono text-(--text-main) font-medium">
                        {activeEnrollment.startDate.slice(0, 10)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[11px]">
                        {isAr ? 'ملاحظات القيد:' : 'Enrollment Notes:'}
                      </span>
                      <span className="text-(--text-main)">
                        {activeEnrollment.notes || (isAr ? 'لا توجد' : 'None')}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-(--text-muted)">
                  {isAr
                    ? 'اللاعب ليس لديه أي اشتراك نشط حالياً بأي فرع.'
                    : 'Athlete does not have an active enrollment in any branch.'}
                </div>
              )}
            </section>

            {/* Branch Enrollment History */}
            <section className={`${CARD} space-y-4`}>
              <div className="flex items-center gap-2 border-b border-(--border-subtle) pb-3">
                <Calendar aria-hidden="true" className="h-5 w-5 text-(--accent-primary)" />
                <h2 className="text-base font-bold text-(--text-main)">
                  {isAr
                    ? `سجل التنقلات والاشتراكات السابقة (${pastEnrollments.length})`
                    : `Transfer & Enrollment History (${pastEnrollments.length})`}
                </h2>
              </div>

              {pastEnrollments.length === 0 ? (
                <p className="text-xs text-(--text-muted) py-4 text-center">
                  {isAr
                    ? 'لا توجد تنقلات سابقة مسجلة للاعب.'
                    : 'No previous branch transfers recorded for this athlete.'}
                </p>
              ) : (
                <ul className="space-y-3">
                  {pastEnrollments.map((en) => (
                    <li
                      key={en.id}
                      className="rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) p-3.5 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-(--text-main)">{en.branch.name}</div>
                        <div className="text-[11px] text-(--text-muted) mt-0.5">
                          {isAr ? 'من: ' : 'From: '}
                          {en.startDate.slice(0, 10)}{' '}
                          {en.endDate ? `${isAr ? 'إلى: ' : 'To: '}${en.endDate.slice(0, 10)}` : ''}
                        </div>
                        {en.notes && (
                          <div className="text-[11px] text-(--text-muted) mt-1">{en.notes}</div>
                        )}
                      </div>
                      <span className="rounded bg-(--bg-surface) px-2 py-0.5 text-[10px] text-(--text-muted) border border-(--border-subtle)">
                        {pastEnrollmentStatusLabel(en.status, lang)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Col 3: Guardians & Emergency Contacts */}
          <div className="space-y-6">
            {/* Guardians Card */}
            <section className={`${CARD} space-y-4`}>
              <div className="flex items-center gap-2 border-b border-(--border-subtle) pb-3">
                <Users aria-hidden="true" className="h-5 w-5 text-(--accent-primary)" />
                <h2 className="text-base font-bold text-(--text-main)">
                  {isAr ? 'أولياء الأمور' : 'Guardians & Family'}
                </h2>
              </div>

              <ul className="space-y-3">
                {player.guardians.map((g) => (
                  <li
                    key={g.id}
                    className="rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-(--text-main) text-xs">
                        {g.firstName} {g.lastName}
                      </span>
                      {g.isPrimary && (
                        <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          {isAr ? 'ولي أمر رئيسي' : 'Primary Guardian'}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-(--text-muted) space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Phone aria-hidden="true" className="h-3.5 w-3.5 text-(--accent-primary)" />
                        <span className="font-mono text-(--text-main)">{g.phone}</span>
                      </div>
                      {g.email && <div className="text-[11px] truncate">{g.email}</div>}
                    </div>
                    {g.hasAccount ? (
                      <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        {isAr ? 'مرتبط بحساب ولي أمر على المنصة' : 'Linked to a guardian account'}
                      </div>
                    ) : (
                      permissions.canIssueLinkCode && (
                        <GuardianLinkCodeButton guardianId={g.id} locale={isAr ? 'ar' : 'en'} />
                      )
                    )}
                  </li>
                ))}
              </ul>
            </section>

            {/* Health Card (the guardian above is also the emergency contact) */}
            <section className={`${CARD} space-y-4`}>
              <div className="flex items-center gap-2 border-b border-(--border-subtle) pb-3">
                <Heart aria-hidden="true" className="h-5 w-5 text-red-500" />
                <h2 className="text-base font-bold text-(--text-main)">
                  {isAr ? 'الصحة' : 'Health'}
                </h2>
              </div>

              <div className="space-y-3 text-xs">
                <div className="rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) p-3.5">
                  <span className="text-[11px] text-(--text-muted) block mb-1">
                    {isAr ? 'الملاحظات الطبية:' : 'Medical Notes:'}
                  </span>
                  <div className="text-(--text-main)">
                    {permissions.canViewSensitive
                      ? player.medicalNotes ||
                        (isAr
                          ? 'لا توجد ملاحظات طبية أو حساسية مسجلة'
                          : 'No medical notes or allergies recorded')
                      : isAr
                        ? 'محجوبة (لا تملك صلاحية الاطلاع على البيانات الحساسة)'
                        : 'Hidden (you do not have permission to view sensitive data)'}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <TransferBranchModal
          transfer={transfer}
          branches={profile.branches}
          currentBranchId={activeEnrollment?.branchId}
          isAr={isAr}
        />

        <EditPlayerModal edit={edit} canViewSensitive={permissions.canViewSensitive} isAr={isAr} />

        {/* QR Membership Card Modal */}
        {qr.isOpen && qr.card && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-label={isAr ? 'بطاقة العضوية' : 'Membership card'}
          >
            <div className="relative w-full max-w-md my-8">
              <PlayerQrCard
                card={qr.card}
                isAdmin={permissions.canViewSensitive}
                onCardUpdated={qr.setCard}
                onClose={qr.close}
              />
            </div>
          </div>
        )}

        <ArchivePlayerModal archive={archive} isAr={isAr} />
      </div>
    </AppShell>
  );
}
