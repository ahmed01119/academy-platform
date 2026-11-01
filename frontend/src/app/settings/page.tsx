'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { canAccessAdminRoutes, getRoleHomeRoute } from '../../lib/role-routing';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/ui/PageHeader';
import { api, apiClient } from '../../lib/api-client';
import type { AcademyProfile, UpdateAcademySettings } from '@academy/shared';
import {
  Building2,
  Globe,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Users,
  ShieldCheck,
  Mail,
  GitBranch,
  UserPlus,
  X,
  Send,
  Loader2,
  Clock,
  RotateCw,
  Trash2,
} from 'lucide-react';

interface StaffMemberItem {
  id: string;
  role: string;
  status: string;
  canReviewApplications?: boolean;
  user?: { id: string; email: string; name: string; phone?: string | null };
  branch?: { id: string; name: string; code?: string | null } | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, activeTenant, isLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'staff'>('profile');
  const [profile, setProfile] = useState<AcademyProfile | null>(null);
  const [staffList, setStaffList] = useState<StaffMemberItem[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<
    Array<{
      id: string;
      email: string;
      role: string;
      status: string;
      branchName: string | null;
      invitedByName: string | null;
      expiresAt: string;
      createdAt: string;
      isExpired: boolean;
    }>
  >([]);
  const [processingInvId, setProcessingInvId] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [delegatingId, setDelegatingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Invite Staff Modal
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('COACH');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  // Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [currency, setCurrency] = useState('EGP');
  const [timezone, setTimezone] = useState('Africa/Cairo');

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      if (!canAccessAdminRoutes(user, activeTenant)) {
        router.push(getRoleHomeRoute(user, activeTenant));
      }
    }
  }, [user, activeTenant, isLoading, router]);

  const loadData = useCallback(async () => {
    if (!user || !activeTenant) return;
    setIsFetching(true);
    try {
      const [data, sList, invList] = await Promise.all([
        api.tenancy.getProfile().catch(() => null),
        apiClient.tenancy.listStaff().catch(() => []),
        api.tenancy.listInvitations().catch(() => []),
      ]);
      if (data) {
        setProfile(data);
        setName(data.name);
        setPhone(data.phone || '');
        setEmail(data.email || '');
        setAddress(data.address || '');
        setLogoUrl(data.logoUrl || '');
        setCurrency(data.currency || 'EGP');
        setTimezone(data.timezone || 'Africa/Cairo');
      }
      setStaffList(sList || []);
      setPendingInvitations(invList || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل تحميل بيانات الأكاديمية';
      setErrorMessage(msg);
    } finally {
      setIsFetching(false);
    }
  }, [user, activeTenant]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!name.trim()) {
      setErrorMessage('اسم الأكاديمية مطلوب');
      return;
    }

    setIsSaving(true);
    try {
      const payload: UpdateAcademySettings = {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        logoUrl: logoUrl.trim() || null,
        currency,
        timezone,
      };

      const updated = await api.tenancy.updateProfile(payload);
      setProfile(updated);
      setSuccessMessage('تم حفظ إعدادات الأكاديمية بنجاح');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل حفظ الإعدادات';
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInviteStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteMsg(null);
    if (!inviteEmail.trim()) {
      setInviteMsg({ type: 'error', text: 'البريد الإلكتروني مطلوب' });
      return;
    }
    setIsInviting(true);
    try {
      const res = await api.tenancy.inviteStaff({
        email: inviteEmail.trim(),
        role: inviteRole as
          'COACH' | 'MANAGER' | 'BRANCH_MANAGER' | 'RECEPTIONIST' | 'ACCOUNTANT' | 'VIEWER',
      });

      setInviteMsg({
        type: res.emailDelivered ? 'success' : 'error',
        text: res.deliveryMessage || `تم إرسال دعوة للانضمام إلى ${inviteEmail.trim()} بنجاح`,
      });
      setInviteEmail('');
      setInviteRole('COACH');
      await loadData();
      if (res.emailDelivered) {
        setTimeout(() => {
          setIsInviteModalOpen(false);
          setInviteMsg(null);
        }, 2500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل إرسال الدعوة';
      setInviteMsg({ type: 'error', text: msg });
    } finally {
      setIsInviting(false);
    }
  };

  const handleResendInvite = async (invitationId: string) => {
    setProcessingInvId(invitationId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await api.tenancy.resendInvitation(invitationId);
      setSuccessMessage(res.deliveryMessage || 'تمت إعادة إرسال الدعوة وتحديث رابط التفعيل بنجاح');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل إعادة إرسال الدعوة';
      setErrorMessage(msg);
    } finally {
      setProcessingInvId(null);
    }
  };

  const handleRevokeInvite = async (invitationId: string) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في إلغاء هذه الدعوة وسحب صلاحية رابط التفعيل؟')) {
      return;
    }
    setProcessingInvId(invitationId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await api.tenancy.revokeInvitation(invitationId);
      setSuccessMessage('تم إلغاء الدعوة بنجاح');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل إلغاء الدعوة';
      setErrorMessage(msg);
    } finally {
      setProcessingInvId(null);
    }
  };

  const handleToggleCoachDelegation = async (membershipId: string, currentStatus: boolean) => {
    setDelegatingId(membershipId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await apiClient.tenancy.updateCoachDelegation(membershipId, {
        canReviewApplications: !currentStatus,
      });
      setSuccessMessage(
        !currentStatus
          ? 'تم تفويض المدرب لمراجعة واعتماد طلبات اللاعبين بنجاح'
          : 'تم سحب تفويض مراجعة طلبات اللاعبين من المدرب',
      );
      await loadData();
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || 'فشل تحديث تفويض المدرب');
    } finally {
      setDelegatingId(null);
    }
  };

  if (isLoading || isFetching) {
    return (
      <AppShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-[var(--accent-primary)]" />
        </div>
      </AppShell>
    );
  }

  if (!user) return null;

  const isOwner = activeTenant?.role === 'OWNER';

  return (
    <AppShell>
      <div className="max-w-4xl space-y-6">
        <PageHeader
          breadcrumbs={[{ label: 'الرئيسية', href: '/dashboard' }, { label: 'إعدادات الأكاديمية' }]}
          title="إعدادات الأكاديمية والصلاحيات"
          description="إدارة الهوية الرسمية، معلومات الاتصال، الكادر التدريبي، وتفويض صلاحيات مراجعة طلبات الانضمام."
        />

        {/* Alerts */}
        {errorMessage && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-600 dark:text-rose-300 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-600 dark:text-emerald-300 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
            <div className="flex-1 font-medium">{successMessage}</div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--bg-surface)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>بيانات وهوية الأكاديمية</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('staff')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'staff'
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--bg-surface)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>الكادر التدريبي والصلاحيات</span>
            <span className="px-1.5 py-0.2 rounded-full text-xs bg-[var(--badge-bg)] font-mono">
              {staffList.length}
            </span>
          </button>
        </div>

        {/* Tab 1: Profile Settings */}
        {activeTab === 'profile' && (
          <>
            {profile && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-center">
                  <span className="text-[10px] text-[var(--text-muted)] block">المعرف السيادي</span>
                  <span className="text-xs font-mono font-bold text-[var(--text-main)]">
                    {profile.slug}
                  </span>
                </div>
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-center">
                  <span className="text-[10px] text-[var(--text-muted)] block">
                    العملة المعتمدة
                  </span>
                  <span className="text-xs font-bold text-[var(--accent-primary)]">
                    {profile.currency}
                  </span>
                </div>
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-center">
                  <span className="text-[10px] text-[var(--text-muted)] block">
                    حالة الأكاديمية
                  </span>
                  <span className="text-xs font-bold text-emerald-500">{profile.status}</span>
                </div>
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-center">
                  <span className="text-[10px] text-[var(--text-muted)] block">تاريخ الانضمام</span>
                  <span className="text-xs font-mono text-[var(--text-muted)]">
                    {new Date(profile.createdAt).toLocaleDateString('ar-EG')}
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[var(--accent-primary)]" />
                  <span>المعلومات الأساسية والهوية</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-main)] block">
                      اسم الأكاديمية الرسمي <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="أكاديمية النجوم الرياضية"
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-main)] block">
                      رابط الشعار الرسمي (Logo URL)
                    </label>
                    <input
                      type="url"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://example.com/logo.png"
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-main)] block">
                      البريد الإلكتروني الرسمي
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="info@academy.sa"
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-main)] block">
                      رقم الهاتف للتواصل
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+966500000000"
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)] font-mono"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold text-[var(--text-main)] block">
                      العنوان والموقع الجغرافي للمقر الرئيسي
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="الرياض، المملكة العربية السعودية"
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                  <Globe className="h-4 w-4 text-[var(--accent-primary)]" />
                  <span>المعايير الإقليمية والعملة</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-main)] block">
                      العملة الأساسية
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)]"
                    >
                      <option value="SAR">ريال سعودي (SAR)</option>
                      <option value="EGP">جنيه مصري (EGP)</option>
                      <option value="AED">درهم إماراتي (AED)</option>
                      <option value="USD">دولار أمريكي (USD)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-main)] block">
                      المنطقة الزمنية
                    </label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)]"
                    >
                      <option value="Asia/Riyadh">توقيت مكة والرياض (Asia/Riyadh - GMT+3)</option>
                      <option value="Africa/Cairo">توقيت القاهرة (Africa/Cairo - GMT+2)</option>
                      <option value="Asia/Dubai">توقيت دبي (Asia/Dubai - GMT+4)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-6 py-2.5 text-xs font-semibold text-white shadow hover:brightness-110 transition-all disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>{isSaving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}</span>
                </button>
              </div>
            </form>
          </>
        )}

        {/* Tab 2: Staff & Delegation Management */}
        {activeTab === 'staff' && (
          <div className="space-y-4">
            {/* Invite Staff Card */}
            {isOwner && (
              <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                      <UserPlus className="h-4 w-4 text-blue-400" />
                      <span>دعوة موظف جديد للانضمام</span>
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      سيتلقى المدعو رابط دعوة عبر البريد الإلكتروني لإنشاء حساب والانضمام للأكاديمية
                      بالدور المحدد.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsInviteModalOpen(true);
                      setInviteMsg(null);
                    }}
                    className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-blue-500/15 border border-blue-500/30 px-4 py-2 text-xs font-bold text-blue-400 hover:bg-blue-500/25 transition-all"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>دعوة موظف</span>
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-5 shadow-sm space-y-2">
              <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span>تفويض صلاحيات الكادر التدريبي (RBAC)</span>
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                تتيح هذه اللوحة لمالك الأكاديمية تفويض مدربين محددين بمراجعة وقبول أو رفض طلبات
                انضمام اللاعبين الجدد داخل فروعهم وفرقهم الرياضية دون منحهم صلاحيات إدارية عامة.
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] overflow-hidden shadow-sm">
              <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-main)]">
                  قائمة الكادر والمدربين
                </span>
                <span className="text-xs text-[var(--text-muted)]">{staffList.length} أعضاء</span>
              </div>

              {staffList.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--text-muted)]">
                  لا يوجد كادر مسجل حالياً.
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {staffList.map((member) => {
                    const isCoach = member.role === 'COACH';
                    const canReview = Boolean(member.canReviewApplications);

                    return (
                      <div
                        key={member.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[var(--bg-surface-subtle)] transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                              isCoach
                                ? 'bg-blue-500/10 text-blue-400'
                                : 'bg-emerald-500/10 text-emerald-400'
                            }`}
                          >
                            {member.user?.name ? member.user.name.slice(0, 2).toUpperCase() : 'ST'}
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-[var(--text-main)] flex items-center gap-2">
                              <span>{member.user?.name || 'مستخدم بدون اسم'}</span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  member.role === 'OWNER'
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : isCoach
                                      ? 'bg-blue-500/20 text-blue-400'
                                      : 'bg-emerald-500/20 text-emerald-400'
                                }`}
                              >
                                {member.role}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
                              <span className="flex items-center gap-1 font-mono">
                                <Mail className="h-3 w-3" />
                                {member.user?.email}
                              </span>
                              {member.branch?.name && (
                                <span className="flex items-center gap-1">
                                  <GitBranch className="h-3 w-3" />
                                  {member.branch.name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Delegation Controls */}
                        <div className="flex items-center gap-3 self-end sm:self-auto">
                          {isCoach && isOwner ? (
                            <button
                              type="button"
                              onClick={() => void handleToggleCoachDelegation(member.id, canReview)}
                              disabled={delegatingId === member.id}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                                canReview
                                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25'
                                  : 'bg-[var(--bg-base)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--accent-primary)]'
                              }`}
                            >
                              <ShieldCheck
                                className={`h-3.5 w-3.5 ${canReview ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`}
                              />
                              <span>
                                {delegatingId === member.id
                                  ? 'جارٍ التحديث...'
                                  : canReview
                                    ? 'مفوض لمراجعة طلبات اللاعبين'
                                    : 'تفعيل تفويض مراجعة الطلبات'}
                              </span>
                            </button>
                          ) : isCoach ? (
                            <span
                              className={`text-[11px] font-medium px-2 py-1 rounded-lg ${
                                canReview
                                  ? 'text-emerald-400 bg-emerald-500/10'
                                  : 'text-[var(--text-muted)] bg-[var(--bg-base)]'
                              }`}
                            >
                              {canReview ? 'مفوض لمراجعة الطلبات' : 'مشاهدة فقط'}
                            </span>
                          ) : (
                            <span className="text-[11px] text-[var(--text-muted)]">
                              {member.role === 'OWNER' ? 'صلاحيات المالك كاملة' : 'صلاحيات إدارية'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pending Invitations Section */}
              {pendingInvitations.length > 0 && (
                <div className="mt-8 pt-6 border-t border-[var(--border-subtle)] space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-400" />
                      <h3 className="text-sm font-bold text-[var(--text-main)]">
                        الدعوات المعلقة بانتظار التفعيل ({pendingInvitations.length})
                      </h3>
                    </div>
                    <span className="text-xs text-[var(--text-muted)]">
                      تنتهي صلاحية روابط التفعيل تلقائياً بعد 7 أيام
                    </span>
                  </div>

                  <div className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)]">
                    {pendingInvitations.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 text-xs"
                      >
                        <div className="flex items-start sm:items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
                            <Mail className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-[var(--text-main)] flex items-center gap-2">
                              <span>{inv.email}</span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                {inv.role}
                              </span>
                              {inv.branchName && (
                                <span className="text-[10px] text-[var(--text-muted)]">
                                  ({inv.branchName})
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] mt-0.5 flex items-center gap-2">
                              <span>
                                أُرسلت في: {new Date(inv.createdAt).toLocaleDateString('ar-EG')}
                              </span>
                              <span>•</span>
                              <span className={inv.isExpired ? 'text-rose-400 font-bold' : ''}>
                                {inv.isExpired
                                  ? 'منتهية الصلاحية'
                                  : `تنتهي في: ${new Date(inv.expiresAt).toLocaleDateString('ar-EG')}`}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Resend and Revoke Actions */}
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => void handleResendInvite(inv.id)}
                            disabled={processingInvId === inv.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-main)] hover:border-blue-500 hover:text-blue-400 transition-all font-semibold disabled:opacity-50"
                          >
                            <RotateCw
                              className={`h-3.5 w-3.5 ${processingInvId === inv.id ? 'animate-spin' : ''}`}
                            />
                            <span>إعادة الإرسال</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRevokeInvite(inv.id)}
                            disabled={processingInvId === inv.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all font-semibold disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>إلغاء</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Invite Staff Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-blue-500/15 flex items-center justify-center">
                  <UserPlus className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <div className="font-bold text-sm text-[var(--text-main)]">دعوة موظف جديد</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    سيتلقى دعوة عبر البريد الإلكتروني
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsInviteModalOpen(false);
                  setInviteMsg(null);
                }}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={(e) => void handleInviteStaff(e)} className="p-5 space-y-4">
              {inviteMsg && (
                <div
                  className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs ${
                    inviteMsg.type === 'success'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                  }`}
                >
                  {inviteMsg.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  )}
                  <span>{inviteMsg.text}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[var(--text-main)]">
                  البريد الإلكتروني للمدعو
                </label>
                <div className="relative">
                  <Mail className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="email@example.com"
                    required
                    className="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-base)] ps-9 pe-3 py-2.5 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]/20 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[var(--text-main)]">
                  الدور الوظيفي
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-base)] px-3 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]/20 transition-all"
                >
                  <option value="COACH">مدرب (COACH)</option>
                  <option value="MANAGER">مدير عام (MANAGER)</option>
                  <option value="BRANCH_MANAGER">مدير فرع (BRANCH_MANAGER)</option>
                  <option value="RECEPTIONIST">موظف استقبال (RECEPTIONIST)</option>
                  <option value="ACCOUNTANT">محاسب (ACCOUNTANT)</option>
                  <option value="VIEWER">مراقب فقط (VIEWER)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsInviteModalOpen(false);
                    setInviteMsg(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-[var(--border-app)] text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--text-muted)] transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-5 py-2 text-xs font-bold text-white shadow hover:bg-blue-600 transition-all disabled:opacity-60"
                >
                  {isInviting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span>{isInviting ? 'جارٍ الإرسال...' : 'إرسال الدعوة'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
