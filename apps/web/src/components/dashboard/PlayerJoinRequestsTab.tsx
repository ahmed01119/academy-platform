'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useLocale } from '../../lib/locale-context';
import { useAuth } from '../../lib/auth-context';
import { apiClient } from '../../lib/api-client';
import { useToast } from '../ui/Toast';
import {
  UserPlus,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Phone,
  Mail,
  Calendar,
  User,
  RefreshCw,
  ChevronDown,
  MessageSquare,
  ShieldAlert,
  GitBranch,
  Users,
  Eye,
} from 'lucide-react';
import type { PlayerJoinRequestItem, BranchSummary, TrainingGroupSummary } from '@academy/shared';

type StatusFilter = 'ALL' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'MORE_INFO_REQUESTED';

const statusConfig = {
  PENDING_REVIEW: {
    ar: 'قيد المراجعة',
    en: 'Pending Review',
    color: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
    icon: Clock,
  },
  APPROVED: {
    ar: 'مقبول',
    en: 'Approved',
    color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
    icon: CheckCircle2,
  },
  REJECTED: {
    ar: 'مرفوض',
    en: 'Rejected',
    color: 'text-rose-400 bg-rose-500/15 border-rose-500/30',
    icon: XCircle,
  },
  MORE_INFO_REQUESTED: {
    ar: 'مزيد من المعلومات',
    en: 'More Info Needed',
    color: 'text-blue-400 bg-blue-500/15 border-blue-500/30',
    icon: MessageSquare,
  },
} as const;

export function PlayerJoinRequestsTab() {
  const { locale } = useLocale();
  const { activeTenant } = useAuth();
  const { toast } = useToast();
  const ar = locale === 'ar';

  const [requests, setRequests] = useState<PlayerJoinRequestItem[]>([]);
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [groups, setGroups] = useState<TrainingGroupSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected request for modal review or viewing
  const [selectedRequest, setSelectedRequest] = useState<PlayerJoinRequestItem | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVED' | 'REJECTED' | 'MORE_INFO_REQUESTED'>('APPROVED');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Authorization checks
  const isOwnerOrManager =
    activeTenant?.role === 'OWNER' ||
    activeTenant?.role === 'MANAGER' ||
    activeTenant?.role === 'BRANCH_MANAGER';
  const canCoachReview =
    activeTenant?.role === 'COACH' && Boolean(activeTenant?.canReviewApplications);
  const canReview = isOwnerOrManager || canCoachReview;
  const isCoachWithoutDelegation = activeTenant?.role === 'COACH' && !activeTenant?.canReviewApplications;

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [list, bList, gList] = await Promise.all([
        apiClient.players.listJoinRequests(statusFilter !== 'ALL' ? statusFilter : undefined),
        apiClient.branches.list().catch(() => []),
        apiClient.groups.list().catch(() => ({ items: [] })),
      ]);
      setRequests(list);
      setBranches(bList || []);
      setGroups(gList?.items || []);
      if (bList && bList.length > 0 && bList[0] && !selectedBranchId) {
        setSelectedBranchId(bList[0].id);
      }
    } catch {
      toast.error(ar ? 'فشل تحميل طلبات الانضمام' : 'Failed to load join requests');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, ar, toast, selectedBranchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !canReview) return;
    setIsSubmitting(true);
    try {
      await apiClient.players.reviewJoinRequest(selectedRequest.id, {
        status: reviewAction,
        branchId: reviewAction === 'APPROVED' ? selectedBranchId || undefined : undefined,
        groupId: reviewAction === 'APPROVED' ? selectedGroupId || undefined : undefined,
        reviewNotes: reviewNotes.trim() || undefined,
      });
      toast.success(
        reviewAction === 'APPROVED'
          ? ar
            ? `✅ تم قبول طلب ${selectedRequest.playerName} وإضافته للأكاديمية بنجاح`
            : `✅ ${selectedRequest.playerName}'s request approved and enrolled successfully`
          : reviewAction === 'REJECTED'
          ? ar
            ? `تم رفض طلب ${selectedRequest.playerName}`
            : `${selectedRequest.playerName}'s request rejected`
          : ar
          ? 'تم طلب معلومات إضافية من المتقدم'
          : 'Additional information requested from applicant',
      );
      setSelectedRequest(null);
      setReviewNotes('');
      await load();
    } catch (err: unknown) {
      toast.error((err as Error)?.message || (ar ? 'فشل مراجعة الطلب' : 'Failed to review request'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = requests.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      !q ||
      r.playerName.toLowerCase().includes(q) ||
      r.contactEmail.toLowerCase().includes(q) ||
      (r.contactPhone && r.contactPhone.includes(q))
    );
  });

  const pendingCount = requests.filter((r) => r.status === 'PENDING_REVIEW').length;
  const filteredGroups = groups.filter((g) => !selectedBranchId || g.branchId === selectedBranchId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-[var(--accent-primary)]" />
            {ar ? 'طلبات انضمام اللاعبين للأكاديمية' : 'Player Academy Join Requests'}
            {pendingCount > 0 && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-400 border border-amber-500/30">
                {pendingCount} {ar ? 'طلب جديد معلق' : 'pending'}
              </span>
            )}
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {ar
              ? 'مراجعة طلبات الانضمام العامة، التدقيق في بيانات اللاعبين وأولياء الأمور، وتوزيعهم على الفروع والفرق الرياضية.'
              : 'Review public join requests, verify player/guardian records, and assign approved players to branches and teams.'}
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="h-9 w-9 flex items-center justify-center rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] transition-colors self-start sm:self-auto shadow-sm"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Delegation Notice for Coach */}
      {isCoachWithoutDelegation && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <h4 className="text-xs font-bold text-amber-300">
              {ar ? 'وضع المشاهدة فقط (غير مفوض للاعتماد)' : 'Read-only Mode (Delegation Required)'}
            </h4>
            <p className="text-xs text-amber-300/80 mt-0.5">
              {ar
                ? 'يمكنك الاطلاع على طلبات الانضمام وبيانات اللاعبين. لاعتماد الطلبات أو رفضها وتسكين اللاعبين، يلزم الحصول على تفويض مراجعة الطلبات من مالك الأكاديمية.'
                : 'You can inspect join requests. To approve, reject, or assign players, delegation must be granted by the academy owner.'}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={ar ? 'بحث باسم اللاعب، ولي الأمر، أو البريد...' : 'Search by player name, guardian, email...'}
            className="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] ps-9 pe-4 py-2.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]/60"
          />
        </div>
        <div className="relative">
          <Filter className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] ps-8 pe-8 py-2.5 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)]/60 appearance-none"
          >
            <option value="ALL">{ar ? 'جميع الطلبات' : 'All Requests'}</option>
            <option value="PENDING_REVIEW">{ar ? 'قيد المراجعة' : 'Pending Review'}</option>
            <option value="APPROVED">{ar ? 'مقبولة ومفعلة' : 'Approved'}</option>
            <option value="REJECTED">{ar ? 'مرفوضة' : 'Rejected'}</option>
            <option value="MORE_INFO_REQUESTED">{ar ? 'بانتظار معلومات' : 'More Info'}</option>
          </select>
          <ChevronDown className="absolute end-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)] pointer-events-none" />
        </div>
      </div>

      {/* Review / Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <h3 className="font-bold text-sm text-[var(--text-main)] flex items-center gap-2">
                <User className="h-4 w-4 text-[var(--accent-primary)]" />
                {canReview ? (ar ? 'مراجعة واعتماد طلب اللاعب' : 'Review Player Join Request') : (ar ? 'تفاصيل طلب الانضمام' : 'Join Request Details')}
              </h3>
              <button
                onClick={() => setSelectedRequest(null)}
                className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>

            {/* Application Data Card */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4 space-y-2.5 text-xs text-[var(--text-muted)]">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
                <span className="font-semibold text-sm text-[var(--text-main)]">{selectedRequest.playerName}</span>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusConfig[selectedRequest.status as keyof typeof statusConfig]?.color}`}>
                  {statusConfig[selectedRequest.status as keyof typeof statusConfig]?.ar || selectedRequest.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] block">{ar ? 'البريد الإلكتروني:' : 'Email:'}</span>
                  <span className="font-medium text-[var(--text-main)]">{selectedRequest.contactEmail}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] block">{ar ? 'الهاتف للتواصل:' : 'Phone:'}</span>
                  <span className="font-medium text-[var(--text-main)]">{selectedRequest.contactPhone || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] block">{ar ? 'تاريخ الميلاد:' : 'Date of Birth:'}</span>
                  <span className="font-medium text-[var(--text-main)]">
                    {selectedRequest.dateOfBirth
                      ? new Date(selectedRequest.dateOfBirth).toLocaleDateString(ar ? 'ar-EG' : 'en-US')
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] block">{ar ? 'ولي الأمر (للقُصّر):' : 'Guardian:'}</span>
                  <span className="font-medium text-[var(--text-main)]">{selectedRequest.guardianName || '—'}</span>
                </div>
              </div>
              {selectedRequest.reviewNotes && (
                <div className="pt-2 border-t border-[var(--border-subtle)]">
                  <span className="text-[10px] text-[var(--text-muted)] block">{ar ? 'ملاحظات المراجعة والتوثيق:' : 'Review Notes:'}</span>
                  <p className="text-[var(--text-main)] mt-0.5 italic">{selectedRequest.reviewNotes}</p>
                </div>
              )}
              <div className="pt-2 text-[10px] text-[var(--text-muted)]">
                {ar ? 'تاريخ تقديم الطلب:' : 'Submitted at:'} {new Date(selectedRequest.createdAt).toLocaleString(ar ? 'ar-EG' : 'en-US')}
              </div>
            </div>

            {/* Decision Form (for authorized reviewers) */}
            {canReview && selectedRequest.status === 'PENDING_REVIEW' ? (
              <form onSubmit={(e) => void handleReview(e)} className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-2">
                    {ar ? 'القرار الإداري' : 'Administrative Decision'}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { value: 'APPROVED', ar: 'قبول وتسكين', en: 'Approve', color: 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10' },
                        { value: 'REJECTED', ar: 'رفض الطلب', en: 'Reject', color: 'border-rose-500/50 text-rose-400 bg-rose-500/10' },
                        { value: 'MORE_INFO_REQUESTED', ar: 'طلب معلومات', en: 'Request Info', color: 'border-blue-500/50 text-blue-400 bg-blue-500/10' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setReviewAction(opt.value)}
                        className={`rounded-xl border py-2.5 text-xs font-bold transition-all ${
                          reviewAction === opt.value
                            ? opt.color + ' ring-2 ring-offset-1 ring-offset-[var(--bg-surface)]'
                            : 'border-[var(--border-app)] text-[var(--text-muted)] hover:border-[var(--border-subtle)]'
                        }`}
                      >
                        {ar ? opt.ar : opt.en}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Branch and Team Selection on Approval */}
                {reviewAction === 'APPROVED' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)]">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-main)] mb-1 flex items-center gap-1.5">
                        <GitBranch className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                        {ar ? 'الفرع المستهدف' : 'Branch Assignment'}
                      </label>
                      <select
                        value={selectedBranchId}
                        onChange={(e) => {
                          setSelectedBranchId(e.target.value);
                          setSelectedGroupId('');
                        }}
                        className="w-full rounded-lg border border-[var(--border-app)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs text-[var(--text-main)] font-medium focus:outline-none"
                      >
                        <option value="">{ar ? 'اختر الفرع الرياضي...' : 'Select branch...'}</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>{b.name} ({b.city || 'الفرع'})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-main)] mb-1 flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                        {ar ? 'المجموعة / الفريق (اختياري)' : 'Training Group'}
                      </label>
                      <select
                        value={selectedGroupId}
                        onChange={(e) => setSelectedGroupId(e.target.value)}
                        className="w-full rounded-lg border border-[var(--border-app)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs text-[var(--text-main)] font-medium focus:outline-none"
                      >
                        <option value="">{ar ? 'بدون فريق حالياً (تسكين لاحق)' : 'None (Assign later)'}</option>
                        {filteredGroups.map((g) => (
                          <option key={g.id} value={g.id}>{g.name} ({g.sport})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                    {ar ? 'ملاحظات وتوثيق القرار (اختياري)' : 'Decision Notes (optional)'}
                  </label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    rows={2}
                    placeholder={
                      reviewAction === 'REJECTED'
                        ? (ar ? 'وضح سبب الرفض لإبلاغ المتقدم...' : 'State reason for rejection...')
                        : (ar ? 'أدخل أي ملاحظات فنية أو إدارية...' : 'Any technical notes...')
                    }
                    className="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]/60 resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRequest(null)}
                    className="flex-1 rounded-xl border border-[var(--border-app)] py-2.5 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
                  >
                    {ar ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`flex-1 rounded-xl py-2.5 text-xs font-bold text-white disabled:opacity-50 transition-all shadow-md ${
                      reviewAction === 'APPROVED'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110'
                        : reviewAction === 'REJECTED'
                        ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:brightness-110'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110'
                    }`}
                  >
                    {isSubmitting
                      ? (ar ? 'جارٍ المعالجة...' : 'Processing...')
                      : reviewAction === 'APPROVED'
                      ? (ar ? 'اعتماد وإضافة اللاعب' : 'Approve & Enroll')
                      : reviewAction === 'REJECTED'
                      ? (ar ? 'تأكيد الرفض' : 'Confirm Rejection')
                      : (ar ? 'طلب معلومات إضافية' : 'Request Info')}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRequest(null)}
                  className="px-5 py-2 rounded-xl bg-[var(--bg-surface-subtle)] text-xs font-bold text-[var(--text-main)] hover:bg-[var(--border-subtle)]"
                >
                  {ar ? 'إغلاق' : 'Close'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-[var(--text-muted)] flex items-center justify-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-[var(--accent-primary)]" />
          <span>{ar ? 'جارٍ تحميل طلبات الانضمام...' : 'Loading applications...'}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] py-12 text-center">
          <UserPlus className="h-10 w-10 text-[var(--text-muted)]/40 mx-auto mb-3" />
          <p className="text-sm font-semibold text-[var(--text-main)]">
            {searchQuery
              ? (ar ? 'لا توجد نتائج مطابقة لشروط البحث' : 'No matching results found')
              : statusFilter !== 'ALL'
              ? (ar ? 'لا توجد طلبات بهذه الحالة المحددة' : 'No applications in this category')
              : (ar ? 'لا توجد طلبات انضمام جديدة حتى الآن' : 'No join applications received yet')}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
            {ar
              ? 'تصل الطلبات تلقائياً عندما يقوم لاعب أو ولي أمر بالتسجيل من البوابة العامة للأكاديمية.'
              : 'Applications will appear here automatically when players submit join requests through the public portal.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => {
            const cfg = statusConfig[req.status as keyof typeof statusConfig];
            const StatusIcon = cfg?.icon ?? Clock;

            return (
              <div
                key={req.id}
                className="rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-[var(--accent-primary)]/40 transition-colors shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-[var(--badge-bg)] border border-[var(--border-subtle)] flex items-center justify-center text-sm font-bold text-[var(--accent-primary)] shrink-0">
                    {req.playerName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-[var(--text-main)] flex items-center gap-2">
                      <span>{req.playerName}</span>
                      {req.guardianName && (
                        <span className="text-[10px] text-[var(--text-muted)] font-normal">
                          ({ar ? 'ولي الأمر:' : 'Guardian:'} {req.guardianName})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-[var(--text-muted)]">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3 text-[var(--text-muted)]" />
                        {req.contactEmail}
                      </span>
                      {req.contactPhone && (
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="h-3 w-3 text-[var(--text-muted)]" />
                          {req.contactPhone}
                        </span>
                      )}
                      {req.dateOfBirth && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-[var(--text-muted)]" />
                          {new Date(req.dateOfBirth).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${cfg?.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {cfg ? (ar ? cfg.ar : cfg.en) : req.status}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {new Date(req.createdAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US', { dateStyle: 'medium' })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  {canReview && req.status === 'PENDING_REVIEW' ? (
                    <button
                      onClick={() => {
                        setSelectedRequest(req);
                        setReviewAction('APPROVED');
                        setReviewNotes('');
                      }}
                      className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:brightness-110 transition-all"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {ar ? 'مراجعة واتخاذ قرار' : 'Review & Decide'}
                    </button>
                  ) : (
                    <button
                      onClick={() => setSelectedRequest(req)}
                      className="flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--border-subtle)] transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                      {ar ? 'عرض التفاصيل' : 'View Details'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
