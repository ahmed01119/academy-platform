'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { useLocale } from '../../../lib/locale-context';
import { AppShell } from '../../../components/layout/AppShell';
import { useToast } from '../../../components/ui/Toast';
import { api } from '../../../lib/api-client';
import type { PlayerSummary, TrainingGroupDetails } from '@academy/shared';
import {
  Users,
  CalendarCheck,
  Calendar,
  Clock,
  MapPin,
  Plus,
  Trash2,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Building2,
  X,
  UserPlus,
} from 'lucide-react';

const DAYS_OF_WEEK = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export default function GroupDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;
  const { user, activeTenant, isLoading } = useAuth();
  const { t } = useLocale();
  const { toast } = useToast();

  const [group, setGroup] = useState<TrainingGroupDetails | null>(null);
  const [activeTab, setActiveTab] = useState<'members' | 'coaches' | 'schedules'>('members');
  const [isFetching, setIsFetching] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modals state
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isAddCoachModalOpen, setIsAddCoachModalOpen] = useState(false);
  const [isAddScheduleModalOpen, setIsAddScheduleModalOpen] = useState(false);

  // Available staff and branch players for assignment
  const [availableStaff, setAvailableStaff] = useState<
    Array<{ id: string; role: string; user: { id: string; name: string; email: string } }>
  >([]);
  const [availablePlayers, setAvailablePlayers] = useState<PlayerSummary[]>([]);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form States
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [selectedCoachUserId, setSelectedCoachUserId] = useState('');
  const [isHeadCoach, setIsHeadCoach] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    dayOfWeek: 0,
    startTime: '17:00',
    endTime: '18:30',
    location: 'الملعب الرئيسي',
  });

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  const loadGroupDetails = useCallback(async () => {
    if (!groupId) return;
    setIsFetching(true);
    setErrorMsg(null);
    try {
      const data = await api.groups.get(groupId);
      setGroup(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'فشل تحميل بيانات المجموعة');
    } finally {
      setIsFetching(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (user && activeTenant && groupId) {
      void loadGroupDetails();
    }
  }, [user, activeTenant, groupId, loadGroupDetails]);

  // Load available coaches when opening coach modal
  const handleOpenAddCoachModal = async () => {
    setActionError(null);
    try {
      const staff = await api.tenancy.listStaff();
      const coaches = staff.filter(
        (s) => s.role === 'COACH' || s.role === 'MANAGER' || s.role === 'BRANCH_MANAGER',
      );
      setAvailableStaff(coaches);
      const firstCoach = coaches[0];
      if (firstCoach) {
        setSelectedCoachUserId(firstCoach.user.id);
      }
      setIsAddCoachModalOpen(true);
    } catch (err) {
      console.error('Failed to load staff:', err);
    }
  };

  // Load available branch players when opening member modal
  const handleOpenAddMemberModal = async () => {
    if (!group) return;
    setActionError(null);
    try {
      const res = await api.players.list({
        branchId: group.branchId,
        limit: 100,
      });
      // Filter out players already in the group
      const existingPlayerIds = new Set(group.members.map((m) => m.playerId));
      const candidates = res.items.filter((p) => !existingPlayerIds.has(p.id));
      setAvailablePlayers(candidates);
      const firstCandidate = candidates[0];
      if (firstCandidate) {
        setSelectedPlayerId(firstCandidate.id);
      }
      setIsAddMemberModalOpen(true);
    } catch (err) {
      console.error('Failed to load players:', err);
    }
  };

  const handleAssignMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayerId) {
      setActionError('يرجى تحديد لاعب من القائمة');
      return;
    }
    setSubmittingAction(true);
    setActionError(null);
    try {
      await api.groups.assignPlayer(groupId, {
        playerId: selectedPlayerId,
        startDate: new Date().toISOString().slice(0, 10),
      });
      setIsAddMemberModalOpen(false);
      toast.success('تمت إضافة اللاعب للمجموعة التدريبية بنجاح');
      await loadGroupDetails();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'فشل إضافة اللاعب للمجموعة');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleRemoveMember = async (playerId: string, playerName: string) => {
    if (!confirm(`هل أنت متأكد من إزالة اللاعب "${playerName}" من هذه المجموعة؟`)) {
      return;
    }
    try {
      await api.groups.removePlayer(groupId, playerId);
      toast.success(`تمت إزالة اللاعب "${playerName}" من المجموعة بنجاح`);
      await loadGroupDetails();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل إزالة اللاعب');
    }
  };

  const handleAssignCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoachUserId) {
      setActionError('يرجى تحديد مدرب من القائمة');
      return;
    }
    setSubmittingAction(true);
    setActionError(null);
    try {
      await api.groups.assignCoach(groupId, {
        coachUserId: selectedCoachUserId,
        isHeadCoach,
      });
      setIsAddCoachModalOpen(false);
      toast.success('تم تعيين المدرب للمجموعة التدريبية بنجاح');
      await loadGroupDetails();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'فشل تعيين المدرب للمجموعة');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleRemoveCoach = async (coachUserId: string, coachName: string) => {
    if (!confirm(`هل أنت متأكد من إزالة المدرب "${coachName}" من تدريب المجموعة؟`)) {
      return;
    }
    try {
      await api.groups.removeCoach(groupId, coachUserId);
      toast.success(`تمت إزالة المدرب "${coachName}" من تدريب المجموعة`);
      await loadGroupDetails();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل إزالة المدرب');
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingAction(true);
    setActionError(null);
    try {
      await api.groups.createSchedule(groupId, {
        dayOfWeek: Number(scheduleForm.dayOfWeek),
        startTime: scheduleForm.startTime,
        endTime: scheduleForm.endTime,
        location: scheduleForm.location.trim() || undefined,
      });
      setIsAddScheduleModalOpen(false);
      toast.success('تمت إضافة الموعد التدريبي الأسبوعي بنجاح');
      await loadGroupDetails();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'فشل إضافة الموعد التدريبي');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الموعد التدريبي الأسبوعي؟')) {
      return;
    }
    try {
      await api.groups.deleteSchedule(groupId, scheduleId);
      toast.success('تم حذف الموعد التدريبي الأسبوعي');
      await loadGroupDetails();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل حذف الموعد التدريبي');
    }
  };

  if (isLoading || isFetching) {
    return (
      <AppShell>
        <div className="flex h-96 flex-col items-center justify-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-[var(--brand-primary)]" />
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            جارٍ تحميل تفاصيل المجموعة التدريبية...
          </p>
        </div>
      </AppShell>
    );
  }

  if (errorMsg || !group) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto py-16 text-center space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            لم نتمكن من العثور على المجموعة
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            {errorMsg || 'المجموعة غير موجودة أو تم حذفها'}
          </p>
          <Link
            href="/groups"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-primary)] text-white px-4 py-2 text-xs font-semibold hover:brightness-110"
          >
            العودة لقائمة المجموعات
          </Link>
        </div>
      </AppShell>
    );
  }

  const capacity = group.capacity || null;
  const fillPercentage = capacity
    ? Math.min(100, Math.round((group.memberCount / capacity) * 100))
    : 0;

  return (
    <AppShell breadcrumbs={[{ label: t('nav.groups'), href: '/groups' }, { label: group.name }]}>
      <div className="space-y-8">
        {/* Hero Group Card */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8 shadow-sm relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                    group.status === 'ACTIVE'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  }`}
                >
                  {group.status === 'ACTIVE' ? 'مجموعة نشطة' : 'غير نشطة'}
                </span>
                {group.ageCategory && (
                  <span className="rounded-full bg-[var(--bg-elevated)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                    {group.ageCategory}
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                  <Building2 className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                  {group.branchName}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">
                {group.name}
              </h1>
              {group.description && (
                <p className="text-sm text-[var(--text-secondary)] max-w-2xl">
                  {group.description}
                </p>
              )}
            </div>

            {/* Capacity & Quick Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 min-w-[200px] space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-secondary)]">سعة الفريق:</span>
                  <span className="font-bold text-[var(--text-primary)]">
                    {group.members.length} {capacity ? `/ ${capacity}` : 'لاعب'}
                  </span>
                </div>
                {capacity && (
                  <div className="h-2 w-full rounded-full bg-[var(--bg-surface)] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        group.members.length >= capacity
                          ? 'bg-red-500'
                          : 'bg-[var(--brand-primary)]'
                      }`}
                      style={{ width: `${fillPercentage}%` }}
                    />
                  </div>
                )}
              </div>

              <Link
                href={`/sessions?groupId=${group.id}&branchId=${group.branchId}&create=true`}
                id="btn-start-session"
                className="flex items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] text-white px-5 py-3 text-xs font-bold shadow-sm hover:brightness-110 transition-all cursor-pointer"
              >
                <CalendarCheck className="h-4 w-4" />
                <span>بدء حصة تدريبية فورية</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)]">
          <button
            type="button"
            id="tab-btn-members"
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'members'
                ? 'border-[var(--brand-primary)] text-[var(--brand-primary)] bg-[var(--bg-elevated)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>قائمة اللاعبين ({group.members.length})</span>
          </button>

          <button
            type="button"
            id="tab-btn-coaches"
            onClick={() => setActiveTab('coaches')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'coaches'
                ? 'border-[var(--brand-primary)] text-[var(--brand-primary)] bg-[var(--bg-elevated)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>الكادر التدريبي ({group.coaches.length})</span>
          </button>

          <button
            type="button"
            id="tab-btn-schedules"
            onClick={() => setActiveTab('schedules')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'schedules'
                ? 'border-[var(--brand-primary)] text-[var(--brand-primary)] bg-[var(--bg-elevated)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>جدول المواعيد الأسبوعية ({group.schedules.length})</span>
          </button>
        </div>

        {/* TAB 1: MEMBERS */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  اللاعبين المقيدين بالمجموعة
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  هؤلاء اللاعبين سيتم إدراجهم تلقائياً في كشف الحضور عند بدء أي حصة تدريبية
                  للمجموعة.
                </p>
              </div>
              <button
                type="button"
                id="btn-open-add-member"
                onClick={handleOpenAddMemberModal}
                className="flex items-center gap-1.5 rounded-xl bg-[var(--brand-primary)] text-white px-3.5 py-2 text-xs font-semibold hover:brightness-110 transition-all cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                <span>إضافة لاعب للمجموعة</span>
              </button>
            </div>

            {group.members.length === 0 ? (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-10 text-center text-[var(--text-secondary)] space-y-3">
                <Users className="h-8 w-8 mx-auto text-[var(--brand-primary)]" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  لا يوجد لاعبين مقيدين بالمجموعة حتى الآن
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  أضف اللاعبين المسجلين في فرع {group.branchName} إلى هذه المجموعة.
                </p>
                <button
                  type="button"
                  onClick={handleOpenAddMemberModal}
                  className="rounded-xl border border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 px-4 py-2 text-xs font-semibold text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/20 transition-all cursor-pointer"
                >
                  إضافة أول لاعب
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.members.map((member) => (
                  <div
                    key={member.id}
                    id={`member-card-${member.playerId}`}
                    className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 flex items-center justify-between gap-3 shadow-sm hover:border-[var(--brand-primary)]/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        {member.playerName.slice(0, 2)}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[var(--text-primary)]">
                          {member.playerName}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)] mt-0.5">
                          <span>{member.playerGender === 'MALE' ? 'ذكر' : 'أنثى'}</span>
                          <span>•</span>
                          <span>مواليد {member.playerDateOfBirth}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      id={`btn-remove-member-${member.playerId}`}
                      onClick={() => handleRemoveMember(member.playerId, member.playerName)}
                      className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="إزالة اللاعب من المجموعة"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: COACHES */}
        {activeTab === 'coaches' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  المدربين المسؤولين عن المجموعة
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  المدرب المعين يتمتع بصلاحية أخذ الحضور وإدارة جلسات وتدريبات هذه المجموعة.
                </p>
              </div>
              <button
                type="button"
                id="btn-open-add-coach"
                onClick={handleOpenAddCoachModal}
                className="flex items-center gap-1.5 rounded-xl bg-[var(--brand-primary)] text-white px-3.5 py-2 text-xs font-semibold hover:brightness-110 transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>تعيين مدرب للمجموعة</span>
              </button>
            </div>

            {group.coaches.length === 0 ? (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-10 text-center text-[var(--text-secondary)] space-y-3">
                <ShieldCheck className="h-8 w-8 mx-auto text-[var(--brand-primary)]" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  لم يتم تعيين أي مدرب لهذه المجموعة بعد
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  قم بتعيين مدرب رئيسي للإشراف الفني وأخذ حضور الحصص.
                </p>
                <button
                  type="button"
                  onClick={handleOpenAddCoachModal}
                  className="rounded-xl border border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 px-4 py-2 text-xs font-semibold text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/20 transition-all cursor-pointer"
                >
                  تعيين مدرب الآن
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.coaches.map((c) => (
                  <div
                    key={c.id}
                    id={`coach-card-${c.coachUserId}`}
                    className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-3 shadow-sm hover:border-[var(--brand-primary)]/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                          {c.coachName.slice(0, 2)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-[var(--text-primary)]">
                              {c.coachName}
                            </h4>
                            {c.isHeadCoach && (
                              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                مدرب رئيسي
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                            {c.coachEmail}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        id={`btn-remove-coach-${c.coachUserId}`}
                        onClick={() => handleRemoveCoach(c.coachUserId, c.coachName)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="إزالة المدرب من المجموعة"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SCHEDULES */}
        {activeTab === 'schedules' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  المواعيد التدريبية الأسبوعية
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  أوقات التمارين الدورية التي تكرر أسبوعياً لهذه المجموعة على أرض الملعب.
                </p>
              </div>
              <button
                type="button"
                id="btn-open-add-schedule"
                onClick={() => {
                  setActionError(null);
                  setIsAddScheduleModalOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-[var(--brand-primary)] text-white px-3.5 py-2 text-xs font-semibold hover:brightness-110 transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>إضافة موعد تدريبي</span>
              </button>
            </div>

            {group.schedules.length === 0 ? (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-10 text-center text-[var(--text-secondary)] space-y-3">
                <Clock className="h-8 w-8 mx-auto text-[var(--brand-primary)]" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  لا توجد مواعيد أسبوعية مسجلة
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  أضف أيام وساعات التمرين المنتظمة لتسهيل إنشاء الحصص التدريبية.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddScheduleModalOpen(true)}
                  className="rounded-xl border border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 px-4 py-2 text-xs font-semibold text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/20 transition-all cursor-pointer"
                >
                  إضافة أول موعد
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.schedules.map((s) => (
                  <div
                    key={s.id}
                    id={`schedule-card-${s.id}`}
                    className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-3 shadow-sm hover:border-[var(--brand-primary)]/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
                          <Calendar className="h-4 w-4" />
                        </span>
                        <span className="font-bold text-[var(--text-primary)] text-base">
                          يوم {DAYS_OF_WEEK[s.dayOfWeek]}
                        </span>
                      </div>
                      <button
                        type="button"
                        id={`btn-delete-schedule-${s.id}`}
                        onClick={() => handleDeleteSchedule(s.id)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="حذف الموعد التدريبي"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                      <div className="flex items-center gap-2 text-[var(--text-primary)] font-medium">
                        <Clock className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                        <span>
                          من {s.startTime} إلى {s.endTime}
                        </span>
                      </div>
                      {s.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                          <span>الموقع: {s.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL: ADD MEMBER */}
      {isAddMemberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl relative space-y-5">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                إضافة لاعب للمجموعة التدريبية
              </h3>
              <button
                type="button"
                onClick={() => setIsAddMemberModalOpen(false)}
                className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {actionError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
                {actionError}
              </div>
            )}

            <form onSubmit={handleAssignMember} className="space-y-4">
              <div>
                <label
                  htmlFor="select-member-player"
                  className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
                >
                  اختر اللاعب (من مقيدي فرع {group.branchName})
                </label>
                {availablePlayers.length === 0 ? (
                  <p className="text-xs text-amber-500">
                    لا يوجد لاعبين غير معينين في هذا الفرع حالياً.
                  </p>
                ) : (
                  <select
                    id="select-member-player"
                    value={selectedPlayerId}
                    onChange={(e) => setSelectedPlayerId(e.target.value)}
                    required
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none transition-colors"
                  >
                    {availablePlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.firstName} {p.lastName} ({p.gender === 'MALE' ? 'ذكر' : 'أنثى'} - مواليد{' '}
                        {p.dateOfBirth})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setIsAddMemberModalOpen(false)}
                  className="px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  id="btn-submit-add-member"
                  disabled={submittingAction || availablePlayers.length === 0}
                  className="rounded-xl bg-[var(--brand-primary)] text-white px-4 py-2 text-xs font-bold hover:brightness-110 disabled:opacity-50 cursor-pointer"
                >
                  {submittingAction ? 'جارٍ الحفظ...' : 'تأكيد الإضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD COACH */}
      {isAddCoachModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl relative space-y-5">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                تعيين مدرب للمجموعة
              </h3>
              <button
                type="button"
                onClick={() => setIsAddCoachModalOpen(false)}
                className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {actionError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
                {actionError}
              </div>
            )}

            <form onSubmit={handleAssignCoach} className="space-y-4">
              <div>
                <label
                  htmlFor="select-coach-user"
                  className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
                >
                  اختر المدرب من طاقم الأكاديمية
                </label>
                {availableStaff.length === 0 ? (
                  <p className="text-xs text-amber-500">
                    لا يوجد أعضاء طاقم بدور مدرب متاحين حالياً.
                  </p>
                ) : (
                  <select
                    id="select-coach-user"
                    value={selectedCoachUserId}
                    onChange={(e) => setSelectedCoachUserId(e.target.value)}
                    required
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none transition-colors"
                  >
                    {availableStaff.map((s) => (
                      <option key={s.user.id} value={s.user.id}>
                        {s.user.name} ({s.user.email})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="checkbox-head-coach"
                  checked={isHeadCoach}
                  onChange={(e) => setIsHeadCoach(e.target.checked)}
                  className="rounded border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                />
                <label htmlFor="checkbox-head-coach" className="text-xs text-[var(--text-primary)]">
                  تعيين كمدرب رئيسي للمجموعة (Head Coach)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setIsAddCoachModalOpen(false)}
                  className="px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  id="btn-submit-add-coach"
                  disabled={submittingAction || availableStaff.length === 0}
                  className="rounded-xl bg-[var(--brand-primary)] text-white px-4 py-2 text-xs font-bold hover:brightness-110 disabled:opacity-50 cursor-pointer"
                >
                  {submittingAction ? 'جارٍ الحفظ...' : 'تأكيد التعيين'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD SCHEDULE */}
      {isAddScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl relative space-y-5">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                إضافة موعد تدريبي أسبوعي
              </h3>
              <button
                type="button"
                onClick={() => setIsAddScheduleModalOpen(false)}
                className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {actionError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
                {actionError}
              </div>
            )}

            <form onSubmit={handleCreateSchedule} className="space-y-4">
              <div>
                <label
                  htmlFor="select-schedule-day"
                  className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
                >
                  يوم الأسبوع
                </label>
                <select
                  id="select-schedule-day"
                  value={scheduleForm.dayOfWeek}
                  onChange={(e) =>
                    setScheduleForm({ ...scheduleForm, dayOfWeek: Number(e.target.value) })
                  }
                  required
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none transition-colors"
                >
                  {DAYS_OF_WEEK.map((day, idx) => (
                    <option key={idx} value={idx}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="input-start-time"
                    className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
                  >
                    وقت البدء (HH:MM)
                  </label>
                  <input
                    type="time"
                    id="input-start-time"
                    value={scheduleForm.startTime}
                    onChange={(e) =>
                      setScheduleForm({ ...scheduleForm, startTime: e.target.value })
                    }
                    required
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label
                    htmlFor="input-end-time"
                    className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
                  >
                    وقت الانتهاء (HH:MM)
                  </label>
                  <input
                    type="time"
                    id="input-end-time"
                    value={scheduleForm.endTime}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, endTime: e.target.value })}
                    required
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="input-schedule-location"
                  className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
                >
                  المكان / الملعب
                </label>
                <input
                  type="text"
                  id="input-schedule-location"
                  value={scheduleForm.location}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, location: e.target.value })}
                  placeholder="مثال: الملعب الرئيسي A"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setIsAddScheduleModalOpen(false)}
                  className="px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  id="btn-submit-add-schedule"
                  disabled={submittingAction}
                  className="rounded-xl bg-[var(--brand-primary)] text-white px-4 py-2 text-xs font-bold hover:brightness-110 disabled:opacity-50 cursor-pointer"
                >
                  {submittingAction ? 'جارٍ الحفظ...' : 'حفظ الموعد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
