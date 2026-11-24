'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  BranchSummary,
  PlayerDeletionImpact,
  PlayerDetails,
  PlayerQrCardResponse,
} from '@academy/shared';
import { useAuth } from '@/contexts/auth-context';
import { getErrorMessage } from '@/lib/http/api-error';
import { playersApi } from '@/features/players/api';
import { branchesApi } from '@/features/branches/api';
import { enrollmentsApi } from '@/features/enrollments/api';
import {
  canArchivePlayer,
  canIssueGuardianLinkCode,
  canViewSensitivePlayerData,
} from '@/features/players/player-permissions';
import {
  buildPlayerUpdatePayload,
  editFormFromPlayer,
  validateBranchTransfer,
  type PlayerEditForm,
} from '@/features/players/player-profile';

type Locale = 'ar' | 'en';

const EMPTY_EDIT_FORM: PlayerEditForm = {
  firstName: '',
  lastName: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  medicalNotes: '',
  status: 'ACTIVE',
};

/**
 * Data, permissions and actions of the player profile page (`/players/[id]`).
 * Behaviour moved verbatim from the page: same API calls, same ordering, same messages.
 */
export function usePlayerProfile(playerId: string, locale: Locale) {
  const { user, activeTenant, isLoading: isAuthLoading } = useAuth();
  const isAr = locale === 'ar';

  const canViewSensitive = canViewSensitivePlayerData(activeTenant?.role);
  const canDelete = canArchivePlayer(activeTenant?.role);
  const canIssueLinkCode = canIssueGuardianLinkCode(activeTenant?.role);

  const [player, setPlayer] = useState<PlayerDetails | null>(null);
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Transfer
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [targetBranchId, setTargetBranchId] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [transferNotes, setTransferNotes] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  // Edit
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<PlayerEditForm>(EMPTY_EDIT_FORM);
  const [isUpdating, setIsUpdating] = useState(false);

  // QR card
  const [qrCard, setQrCard] = useState<PlayerQrCardResponse | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isLoadingQrCard, setIsLoadingQrCard] = useState(false);

  // Safe archive
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isFetchingImpact, setIsFetchingImpact] = useState(false);
  const [deletionImpact, setDeletionImpact] = useState<PlayerDeletionImpact | null>(null);
  const [isDeletingPlayer, setIsDeletingPlayer] = useState(false);

  const loadPlayerData = useCallback(async () => {
    if (!user || !activeTenant || !playerId) return;
    setIsFetching(true);
    try {
      const [playerData, branchList] = await Promise.all([
        playersApi.get(playerId),
        branchesApi.list().catch(() => []),
      ]);
      setPlayer(playerData);
      setBranches(branchList);
      setEditForm(editFormFromPlayer(playerData)); // pre-fill edit form
    } catch (err: unknown) {
      setErrorMessage(
        getErrorMessage(err, isAr ? 'فشل تحميل بيانات اللاعب' : 'Failed to load athlete profile'),
      );
    } finally {
      setIsFetching(false);
    }
  }, [user, activeTenant, playerId, isAr]);

  useEffect(() => {
    void loadPlayerData();
  }, [loadPlayerData]);

  const openQrCard = async () => {
    setIsLoadingQrCard(true);
    setErrorMessage(null);
    try {
      setQrCard(await playersApi.getQrCard(playerId));
      setIsQrModalOpen(true);
    } catch (err: unknown) {
      setErrorMessage(
        getErrorMessage(
          err,
          isAr ? 'فشل تحميل بطاقة العضوية' : 'Failed to load membership QR card',
        ),
      );
    } finally {
      setIsLoadingQrCard(false);
    }
  };

  const openArchive = async () => {
    setIsFetchingImpact(true);
    setErrorMessage(null);
    try {
      setDeletionImpact(await playersApi.getDeletionImpact(playerId));
      setIsDeleteModalOpen(true);
    } catch (err: unknown) {
      setErrorMessage(
        getErrorMessage(
          err,
          isAr ? 'فشل في احتساب تقرير أرشفة اللاعب' : 'Failed to compute archive impact report',
        ),
      );
    } finally {
      setIsFetchingImpact(false);
    }
  };

  const confirmArchive = async () => {
    setIsDeletingPlayer(true);
    setErrorMessage(null);
    try {
      const res = await playersApi.safeDelete(playerId);
      setSuccessMessage(res.message);
      setIsDeleteModalOpen(false);
      await loadPlayerData();
    } catch (err: unknown) {
      setErrorMessage(
        getErrorMessage(err, isAr ? 'فشل في أرشفة اللاعب' : 'Failed to archive athlete'),
      );
    } finally {
      setIsDeletingPlayer(false);
    }
  };

  const submitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const check = validateBranchTransfer(player, targetBranchId, locale);
    if ('error' in check) {
      setErrorMessage(check.error);
      return;
    }

    setIsTransferring(true);
    try {
      await enrollmentsApi.transfer(check.enrollmentId, {
        targetBranchId,
        effectiveDate: transferDate || undefined,
        notes: transferNotes.trim() || undefined,
      });
      setSuccessMessage(
        isAr
          ? 'تم نقل اللاعب إلى الفرع الجديد بنجاح'
          : 'Athlete transferred to new branch successfully',
      );
      setIsTransferModalOpen(false);
      setTransferNotes('');
      await loadPlayerData();
    } catch (err: unknown) {
      setErrorMessage(
        getErrorMessage(err, isAr ? 'فشل في نقل اللاعب' : 'Failed to transfer athlete'),
      );
    } finally {
      setIsTransferring(false);
    }
  };

  const submitUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    setIsUpdating(true);
    try {
      await playersApi.update(playerId, buildPlayerUpdatePayload(editForm, canViewSensitive));
      setSuccessMessage(
        isAr ? 'تم تحديث بيانات اللاعب بنجاح' : 'Athlete profile updated successfully',
      );
      setIsEditModalOpen(false);
      await loadPlayerData();
    } catch (err: unknown) {
      setErrorMessage(
        getErrorMessage(
          err,
          isAr ? 'فشل في تحديث بيانات اللاعب' : 'Failed to update athlete profile',
        ),
      );
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    isLoading: isAuthLoading || isFetching,
    player,
    branches,
    errorMessage,
    successMessage,
    permissions: { canViewSensitive, canDelete, canIssueLinkCode },
    transfer: {
      isOpen: isTransferModalOpen,
      open: () => setIsTransferModalOpen(true),
      close: () => setIsTransferModalOpen(false),
      targetBranchId,
      setTargetBranchId,
      transferDate,
      setTransferDate,
      notes: transferNotes,
      setNotes: setTransferNotes,
      isSubmitting: isTransferring,
      submit: submitTransfer,
    },
    edit: {
      isOpen: isEditModalOpen,
      open: () => setIsEditModalOpen(true),
      close: () => setIsEditModalOpen(false),
      form: editForm,
      setField: <K extends keyof PlayerEditForm>(key: K, value: PlayerEditForm[K]) =>
        setEditForm((prev) => ({ ...prev, [key]: value })),
      isSubmitting: isUpdating,
      submit: submitUpdate,
    },
    qr: {
      card: qrCard,
      isOpen: isQrModalOpen,
      isLoading: isLoadingQrCard,
      open: openQrCard,
      close: () => setIsQrModalOpen(false),
      setCard: setQrCard,
    },
    archive: {
      isOpen: isDeleteModalOpen,
      isLoadingImpact: isFetchingImpact,
      impact: deletionImpact,
      isSubmitting: isDeletingPlayer,
      open: openArchive,
      close: () => setIsDeleteModalOpen(false),
      confirm: confirmArchive,
    },
  };
}

export type PlayerProfileState = ReturnType<typeof usePlayerProfile>;
