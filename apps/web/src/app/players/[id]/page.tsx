'use client';

import React, { useCallback, useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { Navbar } from '../../../components/Navbar';
import { api } from '../../../lib/api-client';
import type {
  BranchSummary,
  PlayerDetails,
  PlayerStatus,
  UpdatePlayerRequest,
  PlayerQrCardResponse,
} from '@academy/shared';
import {
  GitBranch,
  Phone,
  Heart,
  ChevronRight,
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
} from 'lucide-react';
import { PlayerQrCard } from '../../../components/player-qr-card';

export default function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const playerId = resolvedParams.id;

  const router = useRouter();
  const { user, activeTenant, isLoading } = useAuth();

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
      setErrorMessage((err as Error)?.message || 'فشل تحميل بطاقة العضوية');
    } finally {
      setIsLoadingQrCard(false);
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
      const msg = err instanceof Error ? err.message : 'فشل تحميل بيانات اللاعب';
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
      setErrorMessage('لا يوجد اشتراك نشط حالياً لنقله');
      return;
    }

    if (!targetBranchId) {
      setErrorMessage('يرجى اختيار الفرع المستهدف');
      return;
    }

    if (targetBranchId === activeEnrollment.branchId) {
      setErrorMessage('اللاعب مسجل بالفعل في هذا الفرع');
      return;
    }

    setIsTransferring(true);
    try {
      await api.enrollments.transfer(activeEnrollment.id, {
        targetBranchId,
        effectiveDate: transferDate || undefined,
        notes: transferNotes.trim() || undefined,
      });

      setSuccessMessage('تم نقل اللاعب إلى الفرع الجديد بنجاح');
      setIsTransferModalOpen(false);
      setTransferNotes('');
      await loadPlayerData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل في نقل اللاعب';
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
      setSuccessMessage('تم تحديث بيانات اللاعب بنجاح');
      setIsEditModalOpen(false);
      await loadPlayerData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل في تحديث بيانات اللاعب';
      setErrorMessage(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading || isFetching) {
    return (
      <div className="min-h-screen bg-[#0f1c18] flex items-center justify-center text-[#9bb5a8]">
        <RefreshCw className="h-8 w-8 animate-spin text-[#2f9e6b]" />
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-[#0f1c18] text-[#e8f0ec] flex flex-col font-sans">
        <Navbar />
        <div className="py-20 text-center">
          <AlertCircle className="h-12 w-12 text-[#ef4444] mx-auto mb-3" />
          <p className="text-white font-bold">اللاعب غير موجود أو تم حذفه</p>
          <Link href="/players" className="mt-4 inline-block text-xs text-[#45c387] underline">
            العودة لقائمة اللاعبين
          </Link>
        </div>
      </div>
    );
  }

  const activeEnrollment = player.enrollments.find((en) => en.status === 'ACTIVE');
  const pastEnrollments = player.enrollments.filter((en) => en.status !== 'ACTIVE');

  return (
    <div className="min-h-screen bg-[#0f1c18] text-[#e8f0ec] flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#9bb5a8]">
          <Link href="/dashboard" className="hover:text-white transition-colors">
            الرئيسية
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href="/players" className="hover:text-white transition-colors">
            اللاعبين
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-[#45c387]">
            {player.firstName} {player.lastName}
          </span>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="rounded-xl border border-[#ef4444]/40 bg-[#ef4444]/10 p-4 text-xs text-[#fca5a5] flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-[#ef4444]" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-[#2f9e6b]/40 bg-[#2f9e6b]/10 p-4 text-xs text-[#45c387] flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-[#45c387]" />
            <div className="flex-1 font-medium">{successMessage}</div>
          </div>
        )}

        {/* Player Profile Header Card */}
        <div className="rounded-2xl border border-[#234235] bg-gradient-to-r from-[#162821] via-[#12231c] to-[#162821] p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#2f9e6b] to-[#45c387] text-[#062016] text-2xl sm:text-3xl font-extrabold shadow-lg shadow-[#2f9e6b]/20">
                {player.firstName.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl sm:text-3xl font-bold text-white">
                    {player.firstName} {player.lastName}
                  </h1>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-bold ${
                      player.status === 'ACTIVE'
                        ? 'bg-[#2f9e6b]/20 text-[#45c387] border border-[#2f9e6b]/40'
                        : player.status === 'SUSPENDED'
                          ? 'bg-[#eab308]/20 text-[#facc15] border border-[#eab308]/40'
                          : 'bg-[#ef4444]/20 text-[#fca5a5] border border-[#ef4444]/40'
                    }`}
                  >
                    {player.status === 'ACTIVE'
                      ? 'نشط'
                      : player.status === 'SUSPENDED'
                        ? 'موقوف'
                        : 'غير نشط'}
                  </span>
                </div>
                <p className="text-xs text-[#9bb5a8]">
                  تاريخ الميلاد:{' '}
                  <span className="text-white font-mono">{player.dateOfBirth.slice(0, 10)}</span> •
                  الجنس:{' '}
                  <span className="text-white">{player.gender === 'MALE' ? 'ذكر' : 'أنثى'}</span>
                  {player.nationalId ? (
                    <>
                      {' '}
                      • الرقم القومي:{' '}
                      <span className="text-white font-mono">{player.nationalId}</span>
                    </>
                  ) : !canViewSensitive ? (
                    <>
                      {' '}
                      • الرقم القومي:{' '}
                      <span className="text-[#9bb5a8] italic text-[11px]">محجوب للخصوصية</span>
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
                className="inline-flex items-center gap-2 rounded-xl border border-[#2b5944] bg-[#162e24] px-4 py-2.5 text-xs font-semibold text-white hover:border-[#45c387] hover:bg-[#1c392c] transition-colors cursor-pointer disabled:opacity-50"
              >
                {isLoadingQrCard ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-[#45c387]" />
                ) : (
                  <QrCode className="h-4 w-4 text-[#45c387]" />
                )}
                <span>بطاقة العضوية (QR Card)</span>
              </button>

              <button
                type="button"
                id="btn-edit-player"
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-4 py-2.5 text-xs font-medium text-[#e8f0ec] hover:border-[#2f9e6b] transition-colors cursor-pointer"
              >
                <Edit3 className="h-4 w-4 text-[#2f9e6b]" />
                <span>تعديل البيانات</span>
              </button>

              <button
                type="button"
                id="btn-transfer-branch"
                onClick={() => setIsTransferModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] px-4 py-2.5 text-xs font-semibold text-[#062016] shadow-md shadow-[#2f9e6b]/20 hover:brightness-110 transition-all cursor-pointer"
              >
                <ArrowRightLeft className="h-4 w-4" />
                <span>نقل لفرع آخر</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Col 1 & 2: Branch Enrollments & History */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Branch Enrollment */}
            <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 backdrop-blur-md space-y-4">
              <div className="flex items-center justify-between border-b border-[#234235] pb-3">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-[#3b82f6]" />
                  <h2 className="text-base font-bold text-white">الفرع الحالي المقيد به</h2>
                </div>
                {activeEnrollment && (
                  <span className="rounded-full bg-[#3b82f6]/20 px-2.5 py-0.5 text-xs font-semibold text-[#60a5fa] border border-[#3b82f6]/30">
                    قيد فعّال
                  </span>
                )}
              </div>

              {activeEnrollment ? (
                <div className="rounded-xl border border-[#234235] bg-[#0f1c18]/60 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {activeEnrollment.branch.name}
                      </h3>
                      {activeEnrollment.branch.code && (
                        <span className="text-[10px] font-mono text-[#9bb5a8]">
                          كود الفرع: {activeEnrollment.branch.code}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsTransferModalOpen(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#45c387] hover:underline"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                      <span>نقل إلى فرع آخر</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs pt-2 border-t border-[#234235]/60 text-[#9bb5a8]">
                    <div>
                      <span className="block text-[11px]">تاريخ بدء القيد:</span>
                      <span className="font-mono text-white font-medium">
                        {activeEnrollment.startDate.slice(0, 10)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[11px]">ملاحظات القيد:</span>
                      <span className="text-white">{activeEnrollment.notes || 'لا توجد'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-[#9bb5a8]">
                  اللاعب ليس لديه أي اشتراك نشط حالياً بأي فرع.
                </div>
              )}
            </div>

            {/* Branch Enrollment History */}
            <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 backdrop-blur-md space-y-4">
              <div className="flex items-center gap-2 border-b border-[#234235] pb-3">
                <Calendar className="h-5 w-5 text-[#2f9e6b]" />
                <h2 className="text-base font-bold text-white">
                  سجل التنقلات والاشتراكات السابقة ({pastEnrollments.length})
                </h2>
              </div>

              {pastEnrollments.length === 0 ? (
                <p className="text-xs text-[#9bb5a8] py-4 text-center">
                  لا توجد تنقلات سابقة مسجلة للاعب.
                </p>
              ) : (
                <div className="space-y-3">
                  {pastEnrollments.map((en) => (
                    <div
                      key={en.id}
                      className="rounded-xl border border-[#234235] bg-[#0f1c18]/50 p-3.5 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-white">{en.branch.name}</div>
                        <div className="text-[11px] text-[#9bb5a8] mt-0.5">
                          من: {en.startDate.slice(0, 10)}{' '}
                          {en.endDate ? `إلى: ${en.endDate.slice(0, 10)}` : ''}
                        </div>
                        {en.notes && (
                          <div className="text-[11px] text-[#9bb5a8]/80 mt-1">{en.notes}</div>
                        )}
                      </div>
                      <span className="rounded bg-[#234235] px-2 py-0.5 text-[10px] text-[#9bb5a8]">
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
            <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 backdrop-blur-md space-y-4">
              <div className="flex items-center gap-2 border-b border-[#234235] pb-3">
                <Users className="h-5 w-5 text-[#2f9e6b]" />
                <h2 className="text-base font-bold text-white">أولياء الأمور</h2>
              </div>

              <div className="space-y-3">
                {player.guardians.map((g) => (
                  <div
                    key={g.id}
                    className="rounded-xl border border-[#234235] bg-[#0f1c18]/60 p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs">
                        {g.firstName} {g.lastName}
                      </span>
                      {g.isPrimary && (
                        <span className="rounded bg-[#2f9e6b]/20 px-2 py-0.5 text-[10px] font-semibold text-[#45c387] border border-[#2f9e6b]/30">
                          ولي أمر رئيسي
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#9bb5a8] space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-[#2f9e6b]" />
                        <span className="font-mono text-white">{g.phone}</span>
                      </div>
                      {g.email && <div className="text-[11px] truncate">{g.email}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Emergency & Health Card */}
            <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 backdrop-blur-md space-y-4">
              <div className="flex items-center gap-2 border-b border-[#234235] pb-3">
                <Heart className="h-5 w-5 text-[#ef4444]" />
                <h2 className="text-base font-bold text-white">الطوارئ والصحة</h2>
              </div>

              <div className="space-y-3 text-xs">
                <div className="rounded-xl border border-[#234235] bg-[#0f1c18]/60 p-3.5">
                  <span className="text-[11px] text-[#9bb5a8] block mb-1">جهة اتصال الطوارئ:</span>
                  <div className="font-bold text-white">{player.emergencyContactName}</div>
                  <div className="font-mono text-[#45c387] mt-0.5 flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {player.emergencyContactPhone}
                  </div>
                </div>

                <div className="rounded-xl border border-[#234235] bg-[#0f1c18]/60 p-3.5">
                  <span className="text-[11px] text-[#9bb5a8] block mb-1">الملاحظات الطبية:</span>
                  <div className="text-white">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-[#234235] bg-[#162821] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-[#234235] pb-3 mb-4">
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5 text-[#2f9e6b]" />
                  نقل اللاعب إلى فرع آخر
                </h3>
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="rounded-lg p-1 text-[#9bb5a8] hover:bg-[#234235] hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleTransferSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#9bb5a8] mb-1.5">
                    الفرع المستهدف *
                  </label>
                  <select
                    required
                    id="select-target-branch"
                    value={targetBranchId}
                    onChange={(e) => setTargetBranchId(e.target.value)}
                    className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
                  >
                    <option value="">اختر الفرع الجديد...</option>
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
                  <label className="block text-xs font-semibold text-[#9bb5a8] mb-1.5">
                    تاريخ النقل الفعلي
                  </label>
                  <input
                    type="date"
                    id="input-transfer-date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#9bb5a8] mb-1.5">
                    سبب أو ملاحظات النقل
                  </label>
                  <textarea
                    rows={2}
                    id="textarea-transfer-notes"
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    placeholder="مثال: بناءً على طلب ولي الأمر بسبب تغيير مكان السكن"
                    className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#234235]">
                  <button
                    type="button"
                    onClick={() => setIsTransferModalOpen(false)}
                    className="rounded-xl border border-[#234235] bg-[#0f1c18] px-4 py-2 text-xs font-medium text-[#9bb5a8] hover:text-white"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    id="btn-confirm-transfer"
                    disabled={isTransferring}
                    className="rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] px-5 py-2 text-xs font-semibold text-[#062016] shadow hover:brightness-110 disabled:opacity-50 cursor-pointer"
                  >
                    {isTransferring ? 'جارٍ النقل...' : 'تأكيد النقل'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Player Modal */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl border border-[#234235] bg-[#162821] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-[#234235] pb-3 mb-4">
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Edit3 className="h-5 w-5 text-[#2f9e6b]" />
                  تعديل بيانات اللاعب
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-lg p-1 text-[#9bb5a8] hover:bg-[#234235] hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleUpdatePlayerSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#9bb5a8] mb-1">
                      الاسم الأول
                    </label>
                    <input
                      type="text"
                      required
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)}
                      className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#9bb5a8] mb-1">
                      اسم العائلة
                    </label>
                    <input
                      type="text"
                      required
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                      className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#9bb5a8] mb-1">
                      جهة اتصال الطوارئ
                    </label>
                    <input
                      type="text"
                      required
                      value={editEmergencyName}
                      onChange={(e) => setEditEmergencyName(e.target.value)}
                      className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#9bb5a8] mb-1">
                      هاتف الطوارئ
                    </label>
                    <input
                      type="tel"
                      required
                      value={editEmergencyPhone}
                      onChange={(e) => setEditEmergencyPhone(e.target.value)}
                      className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#9bb5a8] mb-1">
                    حالة اللاعب
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as PlayerStatus)}
                    className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
                  >
                    <option value="ACTIVE">نشط (Active)</option>
                    <option value="INACTIVE">غير نشط (Inactive)</option>
                    <option value="SUSPENDED">موقوف (Suspended)</option>
                  </select>
                </div>

                {canViewSensitive ? (
                  <div>
                    <label className="block text-xs font-semibold text-[#9bb5a8] mb-1">
                      الملاحظات الطبية
                    </label>
                    <textarea
                      rows={2}
                      value={editMedicalNotes}
                      onChange={(e) => setEditMedicalNotes(e.target.value)}
                      className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#234235] bg-[#0f1c18]/40 p-3 text-[11px] text-[#9bb5a8]">
                    الملاحظات الطبية محجوبة ولا يمكن تعديلها إلا من قِبل مديري الأكاديمية أو الفروع.
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#234235]">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="rounded-xl border border-[#234235] bg-[#0f1c18] px-4 py-2 text-xs font-medium text-[#9bb5a8] hover:text-white"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    id="btn-confirm-update-player"
                    disabled={isUpdating}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] px-5 py-2 text-xs font-semibold text-[#062016] shadow hover:brightness-110 disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    <span>{isUpdating ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}</span>
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
      </main>
    </div>
  );
}
