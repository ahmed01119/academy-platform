'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { useLocale } from '../../lib/locale-context';
import { useTheme, type ThemeMode } from '../../lib/theme-context';
import { translateRole } from '../../lib/data-translator';
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
  Palette,
  Sun,
  Moon,
  Monitor,
  Languages,
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
  const { locale, setLocale, t } = useLocale();
  const { theme, setTheme } = useTheme();
  const ar = locale === 'ar';

  const [activeTab, setActiveTab] = useState<'profile' | 'staff' | 'preferences'>('profile');
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [delegatingId, setDelegatingId] = useState<string | null>(null);

  // Invite Staff Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'OWNER' | 'MANAGER' | 'BRANCH_MANAGER' | 'COACH' | 'RECEPTIONIST' | 'ACCOUNTANT' | 'VIEWER'>('COACH');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  // Form Fields for Profile
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
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
      const [profileData, staffData, invitesData] = await Promise.all([
        api.tenancy.getProfile(),
        api.tenancy.listStaff().catch(() => []),
        apiClient.tenancy.listInvitations().catch(() => []),
      ]);

      setProfile(profileData);
      setStaffList(staffData as StaffMemberItem[]);
      setPendingInvitations(invitesData);

      setName(profileData.name || '');
      setLogoUrl(profileData.logoUrl || '');
      setEmail(profileData.email || '');
      setPhone(profileData.phone || '');
      setAddress(profileData.address || '');
      setCurrency(profileData.currency || 'EGP');
      setTimezone(profileData.timezone || 'Africa/Cairo');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ar ? 'فشل تحميل بيانات الأكاديمية' : 'Failed to load settings';
      setErrorMessage(msg);
    } finally {
      setIsFetching(false);
    }
  }, [user, activeTenant, ar]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!name.trim()) {
      setErrorMessage(ar ? 'اسم الأكاديمية مطلوب' : 'Academy name is required');
      return;
    }

    setIsSaving(true);
    try {
      const payload: UpdateAcademySettings = {
        name: name.trim(),
        logoUrl: logoUrl.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        currency,
        timezone,
      };

      const updated = await api.tenancy.updateProfile(payload);
      setProfile(updated);
      setSuccessMessage(ar ? 'تم حفظ التعديلات بنجاح' : 'Settings saved successfully');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ar ? 'فشل حفظ الإعدادات' : 'Failed to save settings';
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInviteStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteMsg(null);
    if (!inviteEmail.trim()) {
      setInviteMsg({
        type: 'error',
        text: ar ? 'البريد الإلكتروني مطلوب' : 'Email address is required',
      });
      return;
    }

    setIsInviting(true);
    try {
      const res = await api.tenancy.inviteStaff({
        email: inviteEmail.trim(),
        role: inviteRole,
      });

      setInviteMsg({
        type: 'success',
        text: res.deliveryMessage || (ar ? 'تم إرسال رابط الدعوة بنجاح' : 'Staff invitation sent successfully'),
      });
      setInviteEmail('');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ar ? 'فشل إرسال الدعوة' : 'Failed to send invitation';
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
      setSuccessMessage(
        res.deliveryMessage || (ar ? 'تمت إعادة إرسال الدعوة وتحديث رابط التفعيل بنجاح' : 'Invitation resent successfully'),
      );
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ar ? 'فشل إعادة إرسال الدعوة' : 'Failed to resend invitation';
      setErrorMessage(msg);
    } finally {
      setProcessingInvId(null);
    }
  };

  const handleRevokeInvite = async (invitationId: string) => {
    if (
      !window.confirm(
        ar
          ? 'هل أنت متأكد من رغبتك في إلغاء هذه الدعوة وسحب صلاحية رابط التفعيل؟'
          : 'Are you sure you want to revoke this invitation?',
      )
    ) {
      return;
    }
    setProcessingInvId(invitationId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await api.tenancy.revokeInvitation(invitationId);
      setSuccessMessage(ar ? 'تم إلغاء الدعوة بنجاح' : 'Invitation revoked successfully');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ar ? 'فشل إلغاء الدعوة' : 'Failed to revoke invitation';
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
          ? ar
            ? 'تم تفويض المدرب لمراجعة واعتماد طلبات اللاعبين بنجاح'
            : 'Coach delegated for player application review successfully'
          : ar
            ? 'تم سحب تفويض مراجعة طلبات اللاعبين من المدرب'
            : 'Review delegation revoked from coach',
      );
      await loadData();
    } catch (err: unknown) {
      setErrorMessage(
        (err as Error)?.message || (ar ? 'فشل تحديث تفويض المدرب' : 'Failed to update coach delegation'),
      );
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
          breadcrumbs={[
            { label: t('common.home', 'الرئيسية'), href: '/dashboard' },
            { label: t('nav.settings', 'الإعدادات') },
          ]}
          title={ar ? 'إعدادات الأكاديمية والصلاحيات' : 'Academy Settings & Permissions'}
          description={
            ar
              ? 'إدارة الهوية الرسمية، معلومات الاتصال، الكادر التدريبي، ومظهر ولغة المنصة.'
              : 'Manage official branding, contact info, staff permissions, display language, and visual themes.'
          }
        />

        {/* Alerts */}
        {errorMessage && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
            <div className="flex-1 font-medium">{successMessage}</div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'profile'
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--bg-surface)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>{ar ? 'بيانات وهوية الأكاديمية' : 'Academy Profile & Identity'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('staff')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'staff'
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--bg-surface)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{ar ? 'الكادر التدريبي والصلاحيات' : 'Staff & Permissions'}</span>
            <span className="px-1.5 py-0.2 rounded-full text-xs bg-[var(--badge-bg)] font-mono">
              {staffList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preferences')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'preferences'
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--bg-surface)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>{ar ? 'اللغة ومظهر النظام (المود)' : 'Language & Display Mode'}</span>
          </button>
        </div>

        {/* Tab 1: Profile Settings */}
        {activeTab === 'profile' && (
          <>
            {profile && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-center">
                  <span className="text-[10px] text-[var(--text-muted)] block">
                    {ar ? 'المعرف السيادي' : 'Academy Slug'}
                  </span>
                  <span className="text-xs font-mono font-bold text-[var(--text-main)]">
                    {profile.slug}
                  </span>
                </div>
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-center">
                  <span className="text-[10px] text-[var(--text-muted)] block">
                    {ar ? 'العملة المعتمدة' : 'Default Currency'}
                  </span>
                  <span className="text-xs font-bold text-[var(--accent-primary)]">
                    {profile.currency}
                  </span>
                </div>
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-center">
                  <span className="text-[10px] text-[var(--text-muted)] block">
                    {ar ? 'حالة الأكاديمية' : 'Status'}
                  </span>
                  <span className="text-xs font-bold text-emerald-500">{profile.status}</span>
                </div>
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-center">
                  <span className="text-[10px] text-[var(--text-muted)] block">
                    {ar ? 'تاريخ الانضمام' : 'Member Since'}
                  </span>
                  <span className="text-xs font-mono text-[var(--text-muted)]">
                    {new Date(profile.createdAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[var(--accent-primary)]" />
                  <span>{ar ? 'المعلومات الأساسية والهوية' : 'General Academy Information'}</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-main)] block">
                      {ar ? 'اسم الأكاديمية الرسمي *' : 'Official Academy Name *'}
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={ar ? 'أكاديمية النجوم الرياضية' : 'Stars Athletic Academy'}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-main)] block">
                      {ar ? 'رابط الشعار الرسمي (Logo URL)' : 'Official Logo URL'}
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
                      {ar ? 'البريد الإلكتروني الرسمي' : 'Official Contact Email'}
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="info@academy.com"
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-main)] block">
                      {ar ? 'رقم الهاتف للتواصل' : 'Contact Phone Number'}
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+201000000000"
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)] font-mono"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold text-[var(--text-main)] block">
                      {ar ? 'العنوان والموقع الجغرافي للمقر الرئيسي' : 'Headquarters Location & Address'}
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder={ar ? 'القاهرة، مصر' : 'Cairo, Egypt'}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                  <Globe className="h-4 w-4 text-[var(--accent-primary)]" />
                  <span>{ar ? 'المعايير الإقليمية والعملة' : 'Regional & Currency Standards'}</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-main)] block">
                      {ar ? 'العملة الأساسية' : 'Primary Currency'}
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer"
                    >
                      <option value="EGP">{ar ? 'جنيه مصري (EGP)' : 'Egyptian Pound (EGP)'}</option>
                      <option value="SAR">{ar ? 'ريال سعودي (SAR)' : 'Saudi Riyal (SAR)'}</option>
                      <option value="AED">{ar ? 'درهم إماراتي (AED)' : 'UAE Dirham (AED)'}</option>
                      <option value="USD">{ar ? 'دولار أمريكي (USD)' : 'US Dollar (USD)'}</option>
                      <option value="EUR">{ar ? 'يورو أوروبي (EUR)' : 'Euro (EUR)'}</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-main)] block">
                      {ar ? 'المنطقة الزمنية' : 'Timezone'}
                    </label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer"
                    >
                      <option value="Africa/Cairo">{ar ? 'توقيت القاهرة (Africa/Cairo - GMT+2)' : 'Cairo Time (Africa/Cairo - GMT+2)'}</option>
                      <option value="Asia/Riyadh">{ar ? 'توقيت الرياض ومكة (Asia/Riyadh - GMT+3)' : 'Riyadh Time (Asia/Riyadh - GMT+3)'}</option>
                      <option value="Asia/Dubai">{ar ? 'توقيت دبي (Asia/Dubai - GMT+4)' : 'Dubai Time (Asia/Dubai - GMT+4)'}</option>
                      <option value="UTC">{ar ? 'التوقيت العالمي الموحد (UTC)' : 'Coordinated Universal Time (UTC)'}</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-6 py-2.5 text-xs font-semibold text-white shadow hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  <span>{isSaving ? (ar ? 'جارٍ الحفظ...' : 'Saving...') : ar ? 'حفظ التعديلات' : 'Save Changes'}</span>
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
                      <span>{ar ? 'دعوة موظف جديد للانضمام' : 'Invite New Staff Member'}</span>
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      {ar
                        ? 'سيتلقى المدعو رابط دعوة عبر البريد الإلكتروني لإنشاء حساب والانضمام للأكاديمية بالدور المحدد.'
                        : 'The invitee will receive an email link to activate their membership with the assigned role.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsInviteModalOpen(true);
                      setInviteMsg(null);
                    }}
                    className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-blue-500/15 border border-blue-500/30 px-4 py-2 text-xs font-bold text-blue-400 hover:bg-blue-500/25 transition-all cursor-pointer"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>{ar ? 'دعوة موظف' : 'Invite Staff'}</span>
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-5 shadow-sm space-y-2">
              <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span>{ar ? 'تفويض صلاحيات الكادر التدريبي (RBAC)' : 'Staff Role & Delegation (RBAC)'}</span>
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                {ar
                  ? 'تتيح هذه اللوحة لمالك الأكاديمية تفويض مدربين محددين بمراجعة وقبول أو رفض طلبات انضمام اللاعبين الجدد داخل فروعهم وفرقهم الرياضية دون منحهم صلاحيات إدارية عامة.'
                  : 'Delegates player application review privileges to selected head coaches for their assigned branches without granting unrestricted admin permissions.'}
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] overflow-hidden shadow-sm">
              <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-main)]">
                  {ar ? 'قائمة الكادر والمدربين' : 'Staff Directory & Coaches'}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {staffList.length} {ar ? 'أعضاء' : 'members'}
                </span>
              </div>

              {staffList.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--text-muted)]">
                  {ar ? 'لا يوجد كادر مسجل حالياً.' : 'No staff members registered at this time.'}
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
                              <span>{member.user?.name || (ar ? 'مستخدم بدون اسم' : 'Unnamed Staff')}</span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  member.role === 'OWNER'
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : isCoach
                                      ? 'bg-blue-500/20 text-blue-400'
                                      : 'bg-emerald-500/20 text-emerald-400'
                                }`}
                              >
                                {translateRole(member.role, locale)}
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
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
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
                                  ? ar
                                    ? 'جارٍ التحديث...'
                                    : 'Updating...'
                                  : canReview
                                    ? ar
                                      ? 'مفوض لمراجعة طلبات اللاعبين'
                                      : 'Review Applications Delegated'
                                    : ar
                                      ? 'تفعيل تفويض مراجعة الطلبات'
                                      : 'Enable Review Delegation'}
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
                              {canReview ? (ar ? 'مفوض لمراجعة الطلبات' : 'Review Delegated') : ar ? 'مشاهدة فقط' : 'View Only'}
                            </span>
                          ) : (
                            <span className="text-[11px] text-[var(--text-muted)]">
                              {member.role === 'OWNER'
                                ? ar
                                  ? 'صلاحيات المالك كاملة'
                                  : 'Full Owner Privileges'
                                : ar
                                  ? 'صلاحيات إدارية'
                                  : 'Administrative Staff'}
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
                        {ar ? 'الدعوات المعلقة بانتظار التفعيل' : 'Pending Invitations'} ({pendingInvitations.length})
                      </h3>
                    </div>
                    <span className="text-xs text-[var(--text-muted)]">
                      {ar ? 'تنتهي صلاحية الروابط تلقائياً بعد 7 أيام' : 'Links expire automatically in 7 days'}
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
                                {translateRole(inv.role, locale)}
                              </span>
                              {inv.branchName && (
                                <span className="text-[10px] text-[var(--text-muted)]">
                                  ({inv.branchName})
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] mt-0.5 flex items-center gap-2">
                              <span>
                                {ar ? 'أُرسلت في: ' : 'Sent: '}
                                {new Date(inv.createdAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}
                              </span>
                              <span>•</span>
                              <span className={inv.isExpired ? 'text-rose-400 font-bold' : ''}>
                                {inv.isExpired
                                  ? ar
                                    ? 'منتهية الصلاحية'
                                    : 'Expired'
                                  : `${ar ? 'تنتهي في: ' : 'Expires: '}${new Date(inv.expiresAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}`}
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
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-main)] hover:border-blue-500 hover:text-blue-400 transition-all font-semibold disabled:opacity-50 cursor-pointer"
                          >
                            <RotateCw
                              className={`h-3.5 w-3.5 ${processingInvId === inv.id ? 'animate-spin' : ''}`}
                            />
                            <span>{ar ? 'إعادة الإرسال' : 'Resend'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRevokeInvite(inv.id)}
                            disabled={processingInvId === inv.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all font-semibold disabled:opacity-50 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>{ar ? 'إلغاء' : 'Revoke'}</span>
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

        {/* Tab 3: Language & Display Preferences */}
        {activeTab === 'preferences' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Display Language Section */}
            <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--badge-bg)] text-[var(--accent-primary)]">
                  <Languages className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-main)]">
                    {t('settings.languageSection', 'لغة العرض والاتجاه')}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {t(
                      'settings.languageDesc',
                      'التبديل بين اللغتين العربية (من اليمين لليسار) والإنجليزية (من اليسار لليمين).',
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setLocale('ar')}
                  className={`flex items-center justify-between p-4 rounded-2xl border text-start transition-all cursor-pointer ${
                    locale === 'ar'
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 ring-2 ring-[var(--accent-primary)]/20'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-base)] hover:border-[var(--accent-primary)]/40'
                  }`}
                >
                  <div>
                    <span className="font-bold text-sm text-[var(--text-main)] block">
                      العربية (Arabic)
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      محاذاة من اليمين لليسار (RTL) مع خط IBM Plex Sans Arabic
                    </span>
                  </div>
                  {locale === 'ar' && (
                    <span className="h-2 w-2 rounded-full bg-[var(--accent-primary)]" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setLocale('en')}
                  className={`flex items-center justify-between p-4 rounded-2xl border text-start transition-all cursor-pointer ${
                    locale === 'en'
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 ring-2 ring-[var(--accent-primary)]/20'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-base)] hover:border-[var(--accent-primary)]/40'
                  }`}
                >
                  <div>
                    <span className="font-bold text-sm text-[var(--text-main)] block">
                      English
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      Left-to-Right layout (LTR) with Latin typography
                    </span>
                  </div>
                  {locale === 'en' && (
                    <span className="h-2 w-2 rounded-full bg-[var(--accent-primary)]" />
                  )}
                </button>
              </div>
            </div>

            {/* Display Theme Mode Section */}
            <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                  <Palette className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-main)]">
                    {t('settings.appearanceSection', 'مظهر واجهة المنصة (المود)')}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {t(
                      'settings.appearanceDesc',
                      'اختر المظهر الملائم لطبيعة استخدامك (نهاري أو ليلي عالي التباين).',
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                {[
                  {
                    id: 'light' as ThemeMode,
                    title: ar ? 'المظهر النهاري (Light)' : 'Light Mode',
                    desc: ar ? 'خلفيات بيضاء ناصعة وتباين عالي' : 'Clean white surfaces with high contrast',
                    icon: Sun,
                    iconColor: 'text-amber-500',
                  },
                  {
                    id: 'dark' as ThemeMode,
                    title: ar ? 'المظهر الليلي (Dark)' : 'Dark Mode',
                    desc: ar ? 'سماء ليلية وألوان مريحة للعين' : 'Deep stadium navy with reduced eye strain',
                    icon: Moon,
                    iconColor: 'text-emerald-400',
                  },
                  {
                    id: 'system' as ThemeMode,
                    title: ar ? 'تلقائي (System)' : 'System Mode',
                    desc: ar ? 'يتطابق تلقائياً مع نظام جهازك' : 'Automatically adapts to OS preference',
                    icon: Monitor,
                    iconColor: 'text-sky-400',
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = theme === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTheme(item.id)}
                      className={`flex flex-col justify-between p-4 rounded-2xl border text-start transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 ring-2 ring-[var(--accent-primary)]/20'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-base)] hover:border-[var(--accent-primary)]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-3">
                        <div className={`p-2 rounded-xl bg-[var(--bg-surface)] ${item.iconColor}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        {isSelected && (
                          <span className="h-2 w-2 rounded-full bg-[var(--accent-primary)]" />
                        )}
                      </div>
                      <div>
                        <span className="font-bold text-xs text-[var(--text-main)] block mb-0.5">
                          {item.title}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                          {item.desc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Invite Staff Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] shadow-2xl animate-in zoom-in-95 duration-200 text-start">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-blue-500/15 flex items-center justify-center">
                  <UserPlus className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <div className="font-bold text-sm text-[var(--text-main)]">
                    {ar ? 'دعوة موظف جديد' : 'Invite New Staff Member'}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {ar ? 'سيتلقى دعوة عبر البريد الإلكتروني' : 'Activation link will be emailed'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsInviteModalOpen(false);
                  setInviteMsg(null);
                }}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
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
                  {ar ? 'البريد الإلكتروني للمدعو' : 'Invitee Email Address'}
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
                  {ar ? 'الدور الوظيفي' : 'Role Assignment'}
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'OWNER' | 'MANAGER' | 'BRANCH_MANAGER' | 'COACH' | 'RECEPTIONIST' | 'ACCOUNTANT' | 'VIEWER')}
                  className="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-base)] px-3 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]/20 transition-all cursor-pointer"
                >
                  <option value="COACH">{ar ? 'مدرب (COACH)' : 'Coach'}</option>
                  <option value="MANAGER">{ar ? 'مدير عام (MANAGER)' : 'General Manager'}</option>
                  <option value="BRANCH_MANAGER">{ar ? 'مدير فرع (BRANCH_MANAGER)' : 'Branch Manager'}</option>
                  <option value="RECEPTIONIST">{ar ? 'موظف استقبال (RECEPTIONIST)' : 'Receptionist'}</option>
                  <option value="ACCOUNTANT">{ar ? 'محاسب (ACCOUNTANT)' : 'Accountant'}</option>
                  <option value="VIEWER">{ar ? 'مراقب فقط (VIEWER)' : 'Viewer'}</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsInviteModalOpen(false);
                    setInviteMsg(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-[var(--border-app)] text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--text-muted)] transition-all cursor-pointer"
                >
                  {ar ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-5 py-2 text-xs font-bold text-white shadow hover:bg-blue-600 transition-all disabled:opacity-60 cursor-pointer"
                >
                  {isInviting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span>{isInviting ? (ar ? 'جارٍ الإرسال...' : 'Sending...') : ar ? 'إرسال الدعوة' : 'Send Invitation'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
