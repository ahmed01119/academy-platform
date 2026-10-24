'use client';

import React, { useState } from 'react';
import { useLocale } from '../../lib/locale-context';
import { useAuth } from '../../lib/auth-context';
import apiClient from '../../lib/api-client';
import { useToast } from '../ui/Toast';
import { Shield, UserPlus, Crown, LogOut } from 'lucide-react';
import type { PlatformUserItem, PlatformAcademyItem } from '@academy/shared';

interface GovernanceTabProps {
  users: PlatformUserItem[];
  academies: PlatformAcademyItem[];
  onRefresh: () => Promise<void>;
  isLoading: boolean;
}

export function GovernanceTab({
  users,
  academies,
  onRefresh,
  isLoading: _isLoading,
}: GovernanceTabProps) {
  const { user } = useAuth();
  const { locale } = useLocale();
  const { toast } = useToast();

  const isCurrentPlatformOwner = Boolean(user?.isPlatformOwner);

  // Invite Super Admin Modal
  const [isSuperAdminModalOpen, setIsSuperAdminModalOpen] = useState(false);
  const [saName, setSaName] = useState('');
  const [saEmail, setSaEmail] = useState('');
  const [isSubmittingSa, setIsSubmittingSa] = useState(false);

  // Invite User Modal
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState<
    'OWNER' | 'MANAGER' | 'BRANCH_MANAGER' | 'RECEPTIONIST' | 'COACH' | 'ACCOUNTANT'
  >('MANAGER');
  const [userTenantId, setUserTenantId] = useState<string>(academies[0]?.id || '');
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  const superAdmins = users.filter((u) => u.isPlatformSuperAdmin || u.isPlatformOwner);

  const handleInviteSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saName.trim() || !saEmail.trim()) return;

    setIsSubmittingSa(true);
    try {
      await apiClient.platform.inviteSuperAdmin({
        name: saName.trim(),
        email: saEmail.trim(),
      });

      toast.success(
        locale === 'ar'
          ? 'تم إرسال دعوة مسؤول المنصة بنجاح.'
          : 'Super Admin invitation created successfully.',
      );

      setIsSuperAdminModalOpen(false);
      setSaName('');
      setSaEmail('');
      await onRefresh();
    } catch (err: unknown) {
      toast.error(
        (err as Error)?.message ||
          (locale === 'ar' ? 'فشل إرسال الدعوة' : 'Failed to invite super admin'),
      );
    } finally {
      setIsSubmittingSa(false);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !userEmail.trim()) return;

    setIsSubmittingUser(true);
    try {
      await apiClient.platform.inviteUser({
        name: userName.trim(),
        email: userEmail.trim(),
        role: userRole,
        tenantId: userTenantId,
      });

      toast.success(
        locale === 'ar' ? 'تم إرسال دعوة المستخدم بنجاح.' : 'User invited to academy successfully.',
      );

      setIsUserModalOpen(false);
      setUserName('');
      setUserEmail('');
      await onRefresh();
    } catch (err: unknown) {
      toast.error(
        (err as Error)?.message || (locale === 'ar' ? 'فشل إرسال الدعوة' : 'Failed to invite user'),
      );
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleRevokeSessions = async (targetUser: PlatformUserItem) => {
    try {
      const res = await apiClient.platform.revokeUserSessions(targetUser.id);
      toast.success(
        locale === 'ar'
          ? `تم إنهاء ${res.revokedCount} جلسة نشطة للمستخدم.`
          : `Revoked ${res.revokedCount} active sessions.`,
      );
      await onRefresh();
    } catch (err: unknown) {
      toast.error(
        (err as Error)?.message ||
          (locale === 'ar' ? 'فشل إنهاء الجلسات' : 'Failed to revoke sessions'),
      );
    }
  };

  const handleToggleSuspension = async (targetUser: PlatformUserItem) => {
    const nextSuspended = !targetUser.isSuspended;
    try {
      await apiClient.platform.updateUserSecurityPolicy(targetUser.id, {
        isSuspended: nextSuspended,
        reason: nextSuspended ? 'Suspended by Platform Governance' : 'Reactivated',
      });

      toast.success(
        nextSuspended
          ? locale === 'ar'
            ? 'تم تجميد حساب المسؤول بنجاح.'
            : 'Super admin suspended.'
          : locale === 'ar'
            ? 'تمت إعادة تفعيل حساب المسؤول.'
            : 'Super admin reactivated.',
      );
      await onRefresh();
    } catch (err: unknown) {
      toast.error(
        (err as Error)?.message ||
          (locale === 'ar' ? 'فشل تعديل حالة الحساب' : 'Failed to toggle account status'),
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Governance Banner */}
      <div className="p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[var(--text-main)]">
                {locale === 'ar'
                  ? 'حوكمة ملاك المنصة (Platform Governance)'
                  : 'Platform Owner Governance'}
              </h3>
              {isCurrentPlatformOwner && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {locale === 'ar' ? 'أنت مالك منصة معتمد' : 'You are Platform Owner'}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {locale === 'ar'
                ? 'إدارة الحسابات السيادية للمنصة، دعوة مدراء النظام، وتعيين أعضاء الأكاديميات مركزياً.'
                : 'Sovereign platform control: invite super admins, manage delegates, and assign academy users.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {isCurrentPlatformOwner && (
            <button
              type="button"
              onClick={() => setIsSuperAdminModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white shadow-sm transition-all"
            >
              <Shield className="w-3.5 h-3.5" />
              {locale === 'ar' ? 'دعوة مسؤول منصة Super Admin' : 'Invite Super Admin'}
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsUserModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-sm transition-all"
          >
            <UserPlus className="w-3.5 h-3.5" />
            {locale === 'ar' ? 'دعوة مستخدم للأكاديمية' : 'Invite Academy User'}
          </button>
        </div>
      </div>

      {/* Super Admins & Owners Table */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="p-4 border-b border-[var(--border-subtle)]">
          <h4 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" />
            {locale === 'ar' ? 'مسؤولو المنصة وملاك النظام' : 'Super Admins & Platform Owners'}
          </h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="bg-[var(--bg-surface-subtle)] border-b border-[var(--border-subtle)] text-[var(--text-muted)] font-semibold uppercase">
              <tr>
                <th className="px-4 py-3 text-start">{locale === 'ar' ? 'المسؤول' : 'Admin'}</th>
                <th className="px-4 py-3 text-start">
                  {locale === 'ar' ? 'الرتبة السيادية' : 'Role'}
                </th>
                <th className="px-4 py-3 text-start">{locale === 'ar' ? 'الحالة' : 'Status'}</th>
                <th className="px-4 py-3 text-start">{locale === 'ar' ? 'الجلسات' : 'Sessions'}</th>
                <th className="px-4 py-3 text-end">{locale === 'ar' ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {superAdmins.map((adm) => (
                <tr
                  key={adm.id}
                  className="hover:bg-[var(--bg-surface-subtle)]/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-bold text-[var(--text-main)]">{adm.name}</div>
                    <div className="text-[11px] font-mono text-[var(--text-muted)]">
                      {adm.email}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {adm.isPlatformOwner ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        <Crown className="w-3 h-3" />
                        {locale === 'ar' ? 'مالك المنصة' : 'Platform Owner'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <Shield className="w-3 h-3" />
                        {locale === 'ar' ? 'مسؤول منصة' : 'Super Admin'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {adm.isSuspended ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400">
                        {locale === 'ar' ? 'معلق ومجمد' : 'Suspended'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                        {locale === 'ar' ? 'نشط' : 'Active'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[var(--text-muted)]">
                    {adm.activeSessionsCount} {locale === 'ar' ? 'أجهزة' : 'devices'}
                  </td>
                  <td className="px-4 py-3 text-end space-x-2 rtl:space-x-reverse">
                    <button
                      type="button"
                      onClick={() => handleRevokeSessions(adm)}
                      className="px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:bg-[var(--bg-surface-subtle)] text-[11px] text-[var(--text-muted)] hover:text-rose-400 transition-colors"
                      title={locale === 'ar' ? 'إنهاء كافة الجلسات' : 'Revoke sessions'}
                    >
                      <LogOut className="w-3 h-3 inline me-1" />
                      {locale === 'ar' ? 'إنهاء الجلسات' : 'Revoke'}
                    </button>

                    {/* Suspension toggle (only Platform Owner can toggle other admins) */}
                    {isCurrentPlatformOwner && adm.id !== user?.id && (
                      <button
                        type="button"
                        onClick={() => handleToggleSuspension(adm)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                          adm.isSuspended
                            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                        }`}
                      >
                        {adm.isSuspended
                          ? locale === 'ar'
                            ? 'تفعيل'
                            : 'Reactivate'
                          : locale === 'ar'
                            ? 'تجميد'
                            : 'Suspend'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Super Admin Modal */}
      {isSuperAdminModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsSuperAdminModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--border-app)] bg-[var(--bg-card)] p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-[var(--border-subtle)] pb-3">
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                {locale === 'ar'
                  ? 'دعوة مسؤول منصة Super Admin جديد'
                  : 'Invite Platform Super Admin'}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {locale === 'ar'
                  ? 'يتم إصدار حساب إداري سيادي مع تفعيل شرط إعادة تعيين كلمة المرور فور الدخول.'
                  : 'Provisions administrative platform credentials with required first-sign-in password change.'}
              </p>
            </div>

            <form onSubmit={handleInviteSuperAdmin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-primary)]">
                  {locale === 'ar' ? 'اسم المسؤول' : 'Full Name'}
                </label>
                <input
                  type="text"
                  required
                  value={saName}
                  onChange={(e) => setSaName(e.target.value)}
                  placeholder="e.g. Captain Ahmed"
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-primary)]">
                  {locale === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
                </label>
                <input
                  type="email"
                  required
                  value={saEmail}
                  onChange={(e) => setSaEmail(e.target.value)}
                  placeholder="admin@platform.com"
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                {locale === 'ar'
                  ? 'بموجب السياسة الصارمة، لا يستطيع المسؤول المفوض إزالة مالك المنصة الأصلي أو ترقية نفسه لمالك.'
                  : 'Per sovereign platform policy, delegated super admins cannot remove or self-promote to Platform Owner.'}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setIsSuperAdminModalOpen(false)}
                  disabled={isSubmittingSa}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--bg-card-hover)] text-[var(--text-secondary)]"
                >
                  {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSa}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-500 text-white shadow-sm"
                >
                  {isSubmittingSa
                    ? locale === 'ar'
                      ? 'جاري الإصدار...'
                      : 'Issuing...'
                    : locale === 'ar'
                      ? 'إرسال الدعوة'
                      : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite User to Academy Modal */}
      {isUserModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsUserModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--border-app)] bg-[var(--bg-card)] p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-[var(--border-subtle)] pb-3">
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                {locale === 'ar' ? 'دعوة مستخدم للأكاديمية' : 'Invite Academy Member'}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {locale === 'ar'
                  ? 'تعيين مستخدم جديد أو قائم بدور محدد داخل الأكاديمية المستهدفة.'
                  : 'Assign new or existing user to a role in the target academy.'}
              </p>
            </div>

            <form onSubmit={handleInviteUser} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-primary)]">
                  {locale === 'ar' ? 'الأكاديمية المستهدفة' : 'Target Academy'}
                </label>
                <select
                  value={userTenantId}
                  onChange={(e) => setUserTenantId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                >
                  {academies.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-primary)]">
                  {locale === 'ar' ? 'الاسم الكامل' : 'Full Name'}
                </label>
                <input
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="e.g. Coach Tarek"
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-primary)]">
                  {locale === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
                </label>
                <input
                  type="email"
                  required
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-primary)]">
                  {locale === 'ar' ? 'الدور الوظيفي' : 'Role'}
                </label>
                <select
                  value={userRole}
                  onChange={(e) =>
                    setUserRole(
                      e.target.value as
                        | 'OWNER'
                        | 'MANAGER'
                        | 'BRANCH_MANAGER'
                        | 'RECEPTIONIST'
                        | 'COACH'
                        | 'ACCOUNTANT',
                    )
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                >
                  <option value="COACH">{locale === 'ar' ? 'مدرب (COACH)' : 'Coach'}</option>
                  <option value="BRANCH_MANAGER">
                    {locale === 'ar' ? 'مدير فرع (BRANCH_MANAGER)' : 'Branch Manager'}
                  </option>
                  <option value="RECEPTIONIST">
                    {locale === 'ar' ? 'استقبال (RECEPTIONIST)' : 'Receptionist'}
                  </option>
                  <option value="ACCOUNTANT">
                    {locale === 'ar' ? 'محاسب (ACCOUNTANT)' : 'Accountant'}
                  </option>
                  <option value="MANAGER">
                    {locale === 'ar' ? 'مدير عام (MANAGER)' : 'Manager'}
                  </option>
                  <option value="OWNER">{locale === 'ar' ? 'مالك (OWNER)' : 'Owner'}</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  disabled={isSubmittingUser}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--bg-card-hover)] text-[var(--text-secondary)]"
                >
                  {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUser}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                >
                  {isSubmittingUser
                    ? locale === 'ar'
                      ? 'جاري الإرسال...'
                      : 'Sending...'
                    : locale === 'ar'
                      ? 'إرسال الدعوة'
                      : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
