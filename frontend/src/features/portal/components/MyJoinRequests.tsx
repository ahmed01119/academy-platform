'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardList, PlusCircle, RefreshCw } from 'lucide-react';
import type { JoinRequesterType, PlayerJoinRequestItem } from '@academy/shared';
import { portalApi } from '@/features/portal/api';
import { getErrorMessage } from '@/lib/http/api-error';
import { PlayerJoinRequestModal } from '@/features/landing/components/PlayerJoinRequestModal';

/**
 * The signed-in user's own join requests, shown in the guardian and player portals (K6).
 *
 * A guardian or player who already uses the portal can send another request (another child, another academy) from
 * here. Their account keeps working; the new request is listed with its status until the academy reviews it. After
 * approval the new child (GUARDIAN) or profile (PLAYER) appears in the portal itself.
 */
export interface MyJoinRequestsProps {
  ar: boolean;
  /** Pre-selected requester type of the "new request" form: GUARDIAN in the guardian portal, PLAYER in the player one. */
  requesterType: JoinRequesterType;
}

const STATUS_LABELS: Record<string, { ar: string; en: string; className: string }> = {
  PENDING_REVIEW: {
    ar: 'قيد المراجعة',
    en: 'Pending review',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300',
  },
  MORE_INFO_REQUESTED: {
    ar: 'مطلوب معلومات إضافية',
    en: 'More info requested',
    className: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300',
  },
  APPROVED: {
    ar: 'تمت الموافقة',
    en: 'Approved',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  },
  REJECTED: {
    ar: 'مرفوض',
    en: 'Rejected',
    className: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300',
  },
};

export function MyJoinRequests({ ar, requesterType }: MyJoinRequestsProps) {
  const [requests, setRequests] = useState<PlayerJoinRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setRequests(await portalApi.listMyJoinRequests());
    } catch (err) {
      setError(
        getErrorMessage(err, ar ? 'تعذر تحميل طلبات الانضمام' : 'Could not load join requests'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [ar]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section
      aria-labelledby="my-join-requests-title"
      className="rounded-2xl border border-(--border-subtle) bg-[var(--bg-surface)] p-5 shadow-sm space-y-4"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2
          id="my-join-requests-title"
          className="flex items-center gap-2 text-sm font-bold text-(--text-main)"
        >
          <ClipboardList className="h-4 w-4 text-[var(--accent-primary)]" />
          {ar ? 'طلبات الانضمام' : 'Join Requests'}
        </h2>
        <NewRequestButton ar={ar} onClick={() => setIsFormOpen(true)} />
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 text-xs text-(--text-muted)">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          {ar ? 'جارٍ التحميل...' : 'Loading...'}
        </p>
      ) : error ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="font-bold underline cursor-pointer"
          >
            {ar ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      ) : requests.length === 0 ? (
        <p className="text-xs text-(--text-muted)">
          {ar ? 'لا توجد طلبات انضمام.' : 'No join requests yet.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {requests.map((request) => {
            const status = STATUS_LABELS[request.status];
            return (
              <li
                key={request.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle)/40 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-(--text-main)">
                    {request.playerName}
                  </p>
                  <p className="truncate text-[11px] text-(--text-muted)">
                    {request.tenantName ?? (ar ? 'أكاديمية' : 'Academy')} ·{' '}
                    {new Date(request.createdAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}
                  </p>
                  {request.reviewNotes && (
                    <p className="mt-1 text-[11px] text-(--text-muted)">{request.reviewNotes}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${status?.className ?? ''}`}
                >
                  {status ? (ar ? status.ar : status.en) : request.status}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <PlayerJoinRequestModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        defaultRequesterType={requesterType}
        onSubmitted={() => void load()}
      />
    </section>
  );
}

function NewRequestButton({ ar, onClick }: { ar: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-3 py-2 text-xs font-semibold text-(--text-main) hover:border-(--accent-primary)/50 transition-colors cursor-pointer"
    >
      <PlusCircle className="h-4 w-4 text-[var(--accent-primary)]" />
      {ar ? 'طلب انضمام جديد' : 'New join request'}
    </button>
  );
}
