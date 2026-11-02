'use client';

import React, { useCallback, useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { useLocale } from '../../../lib/locale-context';
import { AppShell } from '../../../components/layout/AppShell';
import { api } from '../../../lib/api-client';
import type {
  BranchSummary,
  PlayerDetails,
  PlayerStatus,
  UpdatePlayerRequest,
  PlayerQrCardResponse,
  PlayerDeletionImpact,
} from '@academy/shared';
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
  X,
  Save,
  QrCode,
  Trash2,
  Archive,
  ShieldAlert,
} from 'lucide-react';
import { PlayerQrCard } from '../../../components/player-qr-card';
import { translateDataString } from '../../../lib/data-translator';

export default function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const playerId = resolvedParams.id;

  const router = useRouter();
  const { user, activeTenant, isLoading } = useAuth();
  const { t, locale, isRtl } = useLocale();
  const isAr = locale === 'ar';

  const canViewSensitive =
    activeTenant?.role === 'OWNER' ||
    activeTenant?.role === 'MANAGER' ||
    activeTenant?.role === 'BRANCH_MANAGER';

  const [player, setPlayer] = useState<PlayerDetails | null>(null);
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [targetBranchId, setTargetBranchId] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [transferNotes, setTransferNotes] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  // Edit Player Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmergencyName, setEditEmergencyName] = useState('');
  const [editEmergencyPhone, setEditEmergencyPhone] = useState('');
  const [editMedicalNotes, setEditMedicalNotes] = useState('');
  const [editStatus, setEditStatus] = useState<PlayerStatus>('ACTIVE');
  const [isUpdating, setIsUpdating] = useState(false);

  // QR Membership Card State
  const [qrCard, setQrCard] = useState<PlayerQrCardResponse | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isLoadingQrCard, setIsLoadingQrCard] = useState(false);

  const handleOpenQrCardModal = async () => {
    setIsLoadingQrCard(true);
    setErrorMessage(null);
    try {
      const cardData = await api.players.getQrCard(playerId);
      setQrCard(cardData);
      setIsQrModalOpen(true);
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || (isAr ? 'فشل تحميل بطاقة العضوية' : 'Failed to load membership QR card'));
    } finally {
      setIsLoadingQrCard(false);
    }
  };

  // Safe Deletion / Archive Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isFetchingImpact, setIsFetchingImpact] = useState(false);
  const [deletionImpact, setDeletionImpact] = useState<PlayerDeletionImpact | null>(null);
  const [isDeletingPlayer, setIsDeletingPlayer] = useState(false);

  const canDeletePlayer = activeTenant?.role === 'OWNER';

  const handleOpenDeleteModal = async () => {
    setIsFetchingImpact(true);
    setErrorMessage(null);
    try {
      const impact = await api.players.getDeletionImpact(playerId);
      setDeletionImpact(impact);
      setIsDeleteModalOpen(true);
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || (isAr ? 'فشل في احتساب تقرير أرشفة اللاعب' : 'Failed to compute archive impact report'));
    } finally {
      setIsFetchingImpact(false);
    }
  };

  const handleConfirmDelete = async () => {
    setIsDeletingPlayer(true);
    setErrorMessage(null);
    try {
      const res = await api.players.safeDelete(playerId);
      setSuccessMessage(res.message);
      setIsDeleteModalOpen(false);
      await loadPlayerData();
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || (isAr ? 'فشل في أرشفة اللاعب' : 'Failed to archive athlete'));
    } finally {
      setIsDeletingPlayer(false);
    }
  };

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  const loadPlayerData = useCallback(async () => {
    if (!user || !activeTenant || !playerId) return;
    setIsFetching(true);
    try {
      const [playerData, branchList] = await Promise.all([
        api.players.get(playerId),
        api.branches.list().catch(() => []),
      ]);
      setPlayer(playerData);
      setBranches(branchList);

      // Pre-fill edit form
      setEditFirstName(playerData.firstName);
      setEditLastName(playerData.lastName);
      setEditEmergencyName(playerData.emergencyContactName);
      setEditEmergencyPhone(playerData.emergencyContactPhone);
      setEditMedicalNotes(playerData.medicalNotes || '');
      setEditStatus(playerData.status);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (isAr ? 'فشل تحميل بيانات اللاعب' : 'Failed to load athlete profile');
      setErrorMessage(msg);
    } finally {
      setIsFetching(false);
    }
  }, [user, activeTenant, playerId]);

  useEffect(() => {
    void loadPlayerData();
  }, [loadPlayerData]);

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const activeEnrollment = player?.enrollments.find((en) => en.status === 'ACTIVE');
    if (!activeEnrollment) {
      setErrorMessage(isAr ? 'لا يوجد اشتراك نشط حالياً لنقله' : 'No active branch enrollment to transfer');
      return;
    }

    if (!targetBranchId) {
      setErrorMessage(isAr ? 'يرجى اختيار الفرع المستهدف' : 'Please select target branch');
      return;
    }

    if (targetBranchId === activeEnrollment.branchId) {
      setErrorMessage(isAr ? 'اللاعب مسجل بالفعل في هذا الفرع' : 'Athlete is already enrolled in this branch');
      return;
    }

    setIsTransferring(true);
    try {
      await api.enrollments.transfer(activeEnrollment.id, {
        targetBranchId,
        effectiveDate: transferDate || undefined,
        notes: transferNotes.trim() || undefined,
      });

      setSuccessMessage(isAr ? 'تم نقل اللاعب إلى الفرع الجديد بنجاح' : 'Athlete transferred to new branch successfully');
      setIsTransferModalOpen(false);
      setTransferNotes('');
      await loadPlayerData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (isAr ? 'فشل في نقل اللاعب' : 'Failed to transfer athlete');
      setErrorMessage(msg);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleUpdatePlayerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    setIsUpdating(true);
    try {
      const updatePayload: UpdatePlayerRequest = {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        emergencyContactName: editEmergencyName.trim(),
        emergencyContactPhone: editEmergencyPhone.trim(),
        status: editStatus,
        ...(canViewSensitive ? { medicalNotes: editMedicalNotes.trim() || null } : {}),
      };

      await api.players.update(playerId, updatePayload);
      setSuccessMessage(isAr ? 'تم تحديث بيانات اللاعب بنجاح' : 'Athlete profile updated successfully');
      setIsEditModalOpen(false);
      await loadPlayerData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (isAr ? 'فشل في تحديث بيانات اللاعب' : 'Failed to update athlete profile');
      setErrorMessage(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading || isFetching) {
    return (
      <AppShell>
        <div className="flex h-96 items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-[var(--accent-primary)]" />
        </div>
      </AppShell>
    );
  }

  if (!player) {
    return (
      <AppShell>
        <div className="py-20 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <p className="text-[var(--text-main)] font-bold">{isAr ? 'اللاعب غير موجود أو تم حذفه' : 'Athlete does not exist or has been removed'}</p>
          <Link
            href="/players"
            className="mt-4 inline-block text-xs text-[var(--accent-primary)] hover:underline"
          >
            العودة لقائمة اللاعبين
          </Link>
        </div>
      </AppShell>
    );
  }

  const activeEnrollment = player.enrollments.find((en) => en.status === 'ACTIVE');
  const pastEnrollments = player.enrollments.filter((en) => en.status !== 'ACTIVE');

  return (
    <AppShell
      breadcrumbs={[
        { label: t('nav.players'), href: '/players' },
        { label: `${player.firstName} ${player.lastName}` },
      ]}
    >
      <div className="space-y-6">
        {/* Alerts */}
        {errorMessage && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-500 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs text-emerald-600 dark:text-emerald-400 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="flex-1 font-medium">{successMessage}</div>
          </div>
        )}

        {/* Player Profile Header Card */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8 shadow-sm relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-[var(--accent-primary)] text-white text-2xl sm:text-3xl font-extrabold shadow-sm">
                {player.firstName.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-main)]">
                    {player.firstName} {player.lastName}
                  </h1>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-bold ${
                      player.status === 'ACTIVE'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : player.status === 'SUSPENDED'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                          : 'bg-red-500/10 text-red-500 border border-red-500/30'
                    }`}
                  >
                    {player.status === 'ACTIVE'
                      ? 'نشط'
                      : player.status === 'SUSPENDED'
                        ? 'موقوف'
                        : 'غير نشط'}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  تاريخ الميلاد:{' '}
                  <span className="text-[var(--text-main)] font-mono">
                    {player.dateOfBirth.slice(0, 10)}
                  </span>{' '}
                  • الجنس:{' '}
                  <span className="text-[var(--text-main)]">
                    {player.gender === 'MALE' ? 'ذكر' : 'أنثى'}
                  </span>
                  {player.nationalId ? (
                    <>
                      {' '}
                      • الرقم القومي:{' '}
                      <span className="text-[var(--text-main)] font-mono">{player.nationalId}</span>
                    </>
                  ) : !canViewSensitive ? (
                    <>
                      {' '}
                      • الرقم القومي:{' '}
                      <span className="text-[var(--text-muted)] italic text-[11px]">
                        محجوب للخصوصية
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
                onClick={handleOpenQrCardModal}
                disabled={isLoadingQrCard}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-4 py-2.5 text-xs font-semibold text-[var(--text-main)] hover:border-[var(--accent-primary)] transition-colors cursor-pointer disabled:opacity-50"
              >
                {isLoadingQrCard ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-[var(--accent-primary)]" />
                ) : (
                  <QrCode className="h-4 w-4 text-[var(--accent-primary)]" />
                )}
                <span>{isAr ? 'بطاقة العضوية (QR Card)' : 'Membership QR Card'}</span>
              </button>

              <button
                type="button"
                id="btn-edit-player"
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-4 py-2.5 text-xs font-medium text-[var(--text-main)] hover:border-[var(--accent-primary)] transition-colors cursor-pointer"
              >
                <Edit3 className="h-4 w-4 text-[var(--accent-primary)]" />
                <span>{isAr ? 'تعديل البيانات' : 'Edit Profile'}</span>
              </button>

              <button
                type="button"
                id="btn-transfer-branch"
                onClick={() => setIsTransferModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] text-white px-4 py-2.5 text-xs font-semibold shadow-sm hover:brightness-110 transition-all cursor-pointer"
              >
                <ArrowRightLeft className="h-4 w-4" />
                <span>{isAr ? 'نقل لفرع آخر' : 'Transfer Branch'}</span>
              </button>

              {canDeletePlayer && player.status !== 'INACTIVE' && (
                <button
                  type="button"
                  id="btn-archive-player"
                  onClick={handleOpenDeleteModal}
                  disabled={isFetchingImpact}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/20 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isFetchingImpact ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-rose-500" />
                  ) : (
                    <Archive className="h-4 w-4 text-rose-500" />
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
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-blue-500" />
                  <h2 className="text-base font-bold text-[var(--text-main)]">
                    الفرع الحالي المقيد به
                  </h2>
                </div>
                {activeEnrollment && (
                  <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-500 border border-blue-500/30">
                    قيد فعّال
                  </span>
                )}
              </div>

              {activeEnrollment ? (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-[var(--text-main)]">
                        {activeEnrollment.branch.name}
                      </h3>
                      {activeEnrollment.branch.code && (
                        <span className="text-[10px] font-mono text-[var(--text-muted)]">
                          {isAr ? 'كود الفرع: ' : 'Branch Code: '}{activeEnrollment.branch.code}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsTransferModalOpen(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-primary)] hover:underline cursor-pointer"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                      <span>{isAr ? 'نقل إلى فرع آخر' : 'Transfer to Another Branch'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs pt-2 border-t border-[var(--border-subtle)] text-[var(--text-muted)]">
                    <div>
                      <span className="block text-[11px]">{isAr ? 'تاريخ بدء القيد:' : 'Enrollment Start Date:'}</span>
                      <span className="font-mono text-[var(--text-main)] font-medium">
                        {activeEnrollment.startDate.slice(0, 10)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[11px]">ملاحظات القيد:</span>
                      <span className="text-[var(--text-main)]">
                        {activeEnrollment.notes || 'لا توجد'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-[var(--text-muted)]">
                  {isAr ? 'اللاعب ليس لديه أي اشتراك نشط حالياً بأي فرع.' : 'Athlete does not have an active enrollment in any branch.'}
                </div>
              )}
            </div>

            {/* Branch Enrollment History */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
                <Calendar className="h-5 w-5 text-[var(--accent-primary)]" />
                <h2 className="text-base font-bold text-[var(--text-main)]">
                  {isAr ? `سجل التنقلات والاشتراكات السابقة (${pastEnrollments.length})` : `Transfer & Enrollment History (${pastEnrollments.length})`}
                </h2>
              </div>

              {pastEnrollments.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] py-4 text-center">
                  {isAr ? 'لا توجد تنقلات سابقة مسجلة للاعب.' : 'No previous branch transfers recorded for this athlete.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {pastEnrollments.map((en) => (
                    <div
                      key={en.id}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3.5 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-[var(--text-main)]">{en.branch.name}</div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                          {isAr ? 'من: ' : 'From: '}{en.startDate.slice(0, 10)}{' '}
                          {en.endDate ? `${isAr ? 'إلى: ' : 'To: '}${en.endDate.slice(0, 10)}` : ''}
                        </div>
                        {en.notes && (
                          <div className="text-[11px] text-[var(--text-muted)] mt-1">
                            {en.notes}
                          </div>
                        )}
                      </div>
                      <span className="rounded bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                        {en.status === 'TRANSFERRED'
                          ? 'تم النقل'
                          : en.status === 'COMPLETED'
                            ? 'مكتمل'
                            : 'ملغي'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Col 3: Guardians & Emergency Contacts */}
          <div className="space-y-6">
            {/* Guardians Card */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
                <Users className="h-5 w-5 text-[var(--accent-primary)]" />
                <h2 className="text-base font-bold text-[var(--text-main)]">{isAr ? 'أولياء الأمور' : 'Guardians & Family'}</h2>
              </div>

              <div className="space-y-3">
                {player.guardians.map((g) => (
                  <div
                    key={g.id}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--text-main)] text-xs">
                        {g.firstName} {g.lastName}
                      </span>
                      {g.isPrimary && (
                        <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          ولي أمر رئيسي
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                        <span className="font-mono text-[var(--text-main)]">{g.phone}</span>
                      </div>
                      {g.email && <div className="text-[11px] truncate">{g.email}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Emergency & Health Card */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
                <Heart className="h-5 w-5 text-red-500" />
                <h2 className="text-base font-bold text-[var(--text-main)]">{isAr ? 'الطوارئ والصحة' : 'Emergency & Health'}</h2>
              </div>

              <div className="space-y-3 text-xs">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3.5">
                  <span className="text-[11px] text-[var(--text-muted)] block mb-1">
                    {isAr ? 'جهة اتصال الطوارئ:' : 'Emergency Contact:'}
                  </span>
                  <div className="font-bold text-[var(--text-main)]">
                    {player.emergencyContactName}
                  </div>
                  <div className="font-mono text-[var(--accent-primary)] mt-0.5 flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {player.emergencyContactPhone}
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3.5">
                  <span className="text-[11px] text-[var(--text-muted)] block mb-1">
                    {isAr ? 'الملاحظات الطبية:' : 'Medical Notes:'}
                  </span>
                  <div className="text-[var(--text-main)]">
                    {canViewSensitive
                      ? player.medicalNotes || 'لا توجد ملاحظات طبية أو حساسية مسجلة'
                      : 'محجوبة (لا تملك صلاحية الاطلاع على البيانات الحساسة)'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Transfer Branch Modal */}
        {isTransferModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3 mb-4">
                <h3 className="font-bold text-[var(--text-main)] text-base flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5 text-[var(--accent-primary)]" />
                  نقل اللاعب إلى فرع آخر
                </h3>
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleTransferSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                    الفرع المستهدف *
                  </label>
                  <select
                    required
                    id="select-target-branch"
                    value={targetBranchId}
                    onChange={(e) => setTargetBranchId(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                  >
                    <option value="">{isAr ? 'اختر الفرع الجديد...' : 'Select target branch...'}</option>
                    {branches
                      .filter((b) => b.id !== activeEnrollment?.branchId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} {b.city ? `(${b.city})` : ''}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                    تاريخ النقل الفعلي
                  </label>
                  <input
                    type="date"
                    id="input-transfer-date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                    سبب أو ملاحظات النقل
                  </label>
                  <textarea
                    rows={2}
                    id="textarea-transfer-notes"
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    placeholder={isAr ? 'مثال: بناءً على طلب ولي الأمر بسبب تغيير مكان السكن' : 'e.g. Relocation requested by guardian'}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
                  <button
                    type="button"
                    onClick={() => setIsTransferModalOpen(false)}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-4 py-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    id="btn-confirm-transfer"
                    disabled={isTransferring}
                    className="rounded-xl bg-[var(--accent-primary)] text-white px-5 py-2 text-xs font-semibold shadow hover:brightness-110 disabled:opacity-50 cursor-pointer"
                  >
                    {isTransferring ? (isAr ? 'جارٍ النقل...' : 'Transferring...') : (isAr ? 'تأكيد النقل' : 'Confirm Transfer')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Player Modal */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3 mb-4">
                <h3 className="font-bold text-[var(--text-main)] text-base flex items-center gap-2">
                  <Edit3 className="h-5 w-5 text-[var(--accent-primary)]" />
                  تعديل بيانات اللاعب
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleUpdatePlayerSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                      الاسم الأول
                    </label>
                    <input
                      type="text"
                      required
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                      اسم العائلة
                    </label>
                    <input
                      type="text"
                      required
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                      جهة اتصال الطوارئ
                    </label>
                    <input
                      type="text"
                      required
                      value={editEmergencyName}
                      onChange={(e) => setEditEmergencyName(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                      هاتف الطوارئ
                    </label>
                    <input
                      type="tel"
                      required
                      value={editEmergencyPhone}
                      onChange={(e) => setEditEmergencyPhone(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                    حالة اللاعب
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as PlayerStatus)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                  >
                    <option value="ACTIVE">{isAr ? 'نشط (Active)' : 'Active'}</option>
                    <option value="INACTIVE">{isAr ? 'غير نشط (Inactive)' : 'Inactive'}</option>
                    <option value="SUSPENDED">{isAr ? 'موقوف (Suspended)' : 'Suspended'}</option>
                  </select>
                </div>

                {canViewSensitive ? (
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                      الملاحظات الطبية
                    </label>
                    <textarea
                      rows={2}
                      value={editMedicalNotes}
                      onChange={(e) => setEditMedicalNotes(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3 text-[11px] text-[var(--text-muted)]">
                    {isAr ? 'الملاحظات الطبية محجوبة ولا يمكن تعديلها إلا من قِبل مديري الأكاديمية أو الفروع.' : 'Medical notes are restricted and can only be updated by academy or branch managers.'}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-4 py-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    id="btn-confirm-update-player"
                    disabled={isUpdating}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] text-white px-5 py-2 text-xs font-semibold shadow hover:brightness-110 disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    <span>{isUpdating ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'حفظ التعديلات' : 'Save Changes')}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* QR Membership Card Modal */}
        {isQrModalOpen && qrCard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-md my-8">
              <PlayerQrCard
                card={qrCard}
                isAdmin={canViewSensitive}
                onCardUpdated={(newCard) => setQrCard(newCard)}
                onClose={() => setIsQrModalOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Safe Deletion / Archive Confirmation Modal */}
        {isDeleteModalOpen && deletionImpact && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-lg rounded-2xl border border-rose-500/30 bg-[var(--bg-surface)] p-6 shadow-2xl space-y-5 my-8">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
                <div className="flex items-center gap-2.5 text-rose-500 font-bold text-base">
                  <ShieldAlert className="h-5 w-5" />
                  <span>{isAr ? 'تأكيد أرشفة اللاعب (Safe Player Archive)' : 'Confirm Athlete Safe Archive'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <p className="text-[var(--text-muted)] leading-relaxed">
                  أنت على وشك أرشفة اللاعب{' '}
                  <strong className="text-[var(--text-main)]">{deletionImpact.playerName}</strong>.
                  تحافظ هذه العملية على سلامة الحضور، السجلات المالية، والتقييمات دون حذفها من قاعدة
                  البيانات.
                </p>

                {/* Impact Summary Badges */}
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4 space-y-3">
                  <h4 className="font-bold text-[var(--text-main)]">
                    {isAr ? 'تقرير الأثر والبيانات المرتبطة:' : 'Impact Report & Linked Records:'}
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg bg-[var(--bg-surface)] p-2.5 border border-[var(--border-subtle)]">
                      <span className="text-[var(--text-muted)] block">تسجيلات الفروع النشطة:</span>
                      <strong className="text-amber-500 text-sm">
                        {deletionImpact.activeEnrollments} (سيتم إلغاؤها)
                      </strong>
                    </div>
                    <div className="rounded-lg bg-[var(--bg-surface)] p-2.5 border border-[var(--border-subtle)]">
                      <span className="text-[var(--text-muted)] block">المجموعات التدريبية:</span>
                      <strong className="text-amber-500 text-sm">
                        {deletionImpact.activeGroupMemberships} (سيتم إيقافها)
                      </strong>
                    </div>
                    <div className="rounded-lg bg-[var(--bg-surface)] p-2.5 border border-[var(--border-subtle)]">
                      <span className="text-[var(--text-muted)] block">سجلات الحضور المحفوظة:</span>
                      <strong className="text-emerald-500 text-sm">
                        {deletionImpact.attendanceRecordsCount} حصة
                      </strong>
                    </div>
                    <div className="rounded-lg bg-[var(--bg-surface)] p-2.5 border border-[var(--border-subtle)]">
                      <span className="text-[var(--text-muted)] block">
                        {isAr ? 'المعاملات المالية المحفوظة:' : 'Preserved Financial Ledgers:'}
                      </span>
                      <strong className="text-emerald-500 text-sm">
                        {deletionImpact.financialTransactionsCount} {isAr ? 'معاملة' : 'transactions'}
                      </strong>
                    </div>
                  </div>
                </div>

                {deletionImpact.warnings.length > 0 && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
                    <span className="font-bold text-amber-500 block">{isAr ? 'ملاحظات الأمان:' : 'Safety Notes:'}</span>
                    <ul className="list-disc list-inside space-y-0.5 text-amber-600 dark:text-amber-400 text-[11px]">
                      {deletionImpact.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isDeletingPlayer}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-4 py-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  id="btn-confirm-safe-delete"
                  onClick={handleConfirmDelete}
                  disabled={isDeletingPlayer}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 text-xs font-semibold shadow disabled:opacity-50 cursor-pointer"
                >
                  {isDeletingPlayer ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  <span>{isDeletingPlayer ? (isAr ? 'جارٍ الأرشفة...' : 'Archiving...') : (isAr ? 'تأكيد الأرشفة الآمنة' : 'Confirm Safe Archive')}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
