'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useLocale } from '../../lib/locale-context';
import { useAuth } from '../../lib/auth-context';
import { apiClient } from '../../lib/api-client';
import { useToast } from '../ui/Toast';
import {
  Crown,
  UserPlus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Mail,
  RefreshCw,
  Search,
  AlertTriangle,
  Check,
  X,
  KeyRound,
} from 'lucide-react';
import type { PlatformUserItem } from '@academy/shared';

export function CoOwnerTab() {
  const { locale } = useLocale();
  const { user } = useAuth();
  const { toast } = useToast();
  const ar = locale === 'ar';

  const [admins, setAdmins] = useState<PlatformUserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'PLATFORM_CO_OWNER' | 'SUPER_ADMIN'>('PLATFORM_CO_OWNER');
  const [isInviting, setIsInviting] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isPlatformOwner = Boolean(user?.isPlatformOwner);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await apiClient.platform.listUsers();
      // Filter to platform-level admins only
      const platformAdmins = list.filter(
        (u) => u.isPlatformSuperAdmin || u.isPlatformOwner,
      );
      setAdmins(platformAdmins);
    } catch {
      toast.error(ar ? 'فشل تحميل قائمة مديري المنصة' : 'Failed to load platform admins');
    } finally {
      setIsLoading(false);
    }
  }, [ar, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) return;
    setIsInviting(true);
    try {
      await apiClient.platform.inviteSuperAdmin({
        email: inviteEmail.trim().toLowerCase(),
        name: inviteName.trim(),
        role: inviteRole,
      });
      toast.success(
        ar
          ? `تمت دعوة ${inviteName} بنجاح كـ ${inviteRole === 'PLATFORM_CO_OWNER' ? 'مالك مشارك للمنصة' : 'مدير منصة'}`
          : `${inviteName} has been invited as ${inviteRole === 'PLATFORM_CO_OWNER' ? 'Platform Co-Owner' : 'Platform Super Admin'}`,
      );
      setInviteEmail('');
      setInviteName('');
      setShowInviteForm(false);
      await load();
    } catch (err: unknown) {
      toast.error((err as Error)?.message || (ar ? 'فشل إرسال الدعوة' : 'Failed to send invite'));
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateRole = async (
    targetUserId: string,
    targetName: string,
    newRole: 'SUPER_ADMIN' | 'PLATFORM_OWNER' | 'REVOKE',
  ) => {
    setActionLoading(`role-${targetUserId}`);
    try {
      await apiClient.platform.updatePlatformAdminRole(targetUserId, { role: newRole });
      toast.success(
        ar
          ? `تم تحديث دور ${targetName} بنجاح`
          : `Role for ${targetName} updated successfully`,
      );
      await load();
    } catch (err: unknown) {
      toast.error((err as Error)?.message || (ar ? 'فشل تحديث الدور' : 'Failed to update role'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeSession = async (userId: string, userName: string) => {
    if (userId === user?.id) {
      toast.error(ar ? 'لا يمكنك إلغاء جلستك الخاصة' : 'Cannot revoke your own session');
      return;
    }
    try {
      await apiClient.platform.revokeUserSessions(userId);
      toast.success(ar ? `تم إلغاء جلسات ${userName}` : `Sessions revoked for ${userName}`);
      setConfirmRevoke(null);
    } catch (err: unknown) {
      toast.error((err as Error)?.message || (ar ? 'فشل إلغاء الجلسات' : 'Failed to revoke sessions'));
    }
  };

  const filtered = admins.filter((a) => {
    const q = searchQuery.toLowerCase();
    return (
      !q ||
      a.name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-400" />
            {ar ? 'إدارة مديري المنصة' : 'Platform Ownership Management'}
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {ar
              ? 'تحكم كامل في مديري المنصة والأذونات العليا. محمي بصلاحيات المالك الأساسي فقط.'
              : 'Full control over platform administrators. Protected by Primary Owner permissions only.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void load()}
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {isPlatformOwner && (
            <button
              id="btn-invite-admin"
              onClick={() => setShowInviteForm(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-xs font-bold text-white shadow-md hover:brightness-110 transition-all"
            >
              <UserPlus className="h-4 w-4" />
              {ar ? 'دعوة شريك / مدير منصة' : 'Invite Platform Co-Owner'}
            </button>
          )}
        </div>
      </div>

      {/* Owner-only guard notice */}
      {!isPlatformOwner && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-300">
            {ar
              ? 'إجراءات الدعوة والإلغاء محجوزة للمالك الأساسي للمنصة فقط. يمكنك الاطلاع على القائمة.'
              : 'Invite and revoke actions are restricted to the Primary Platform Owner. You can view the list.'}
          </p>
        </div>
      )}

      {/* Invite Form Modal */}
      {showInviteForm && isPlatformOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-[var(--text-main)] flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-amber-400" />
                {ar ? 'دعوة مدير منصة جديد' : 'Invite New Platform Admin'}
              </h3>
              <button
                onClick={() => setShowInviteForm(false)}
                className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 mb-4">
              <p className="text-[11px] text-amber-300">
                {ar
                  ? '⚠️ سيحصل هذا المستخدم على صلاحيات مدير المنصة الكاملة بما فيها الوصول لبيانات جميع الأكاديميات.'
                  : '⚠️ This user will receive full Platform Super Admin privileges including access to all academy data.'}
              </p>
            </div>

            <form onSubmit={(e) => void handleInvite(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                  {ar ? 'الاسم الكامل' : 'Full Name'}
                </label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder={ar ? 'أدخل الاسم الكامل' : 'Enter full name'}
                  className="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-base)] px-3 py-2.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-amber-500/60"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                  {ar ? 'البريد الإلكتروني' : 'Email Address'}
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder={ar ? 'example@domain.com' : 'example@domain.com'}
                  className="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-base)] px-3 py-2.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-amber-500/60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                  {ar ? 'مستوى الصلاحية والملكية' : 'Role & Privileges'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setInviteRole('PLATFORM_CO_OWNER')}
                    className={`rounded-xl border p-3 text-start transition-all ${
                      inviteRole === 'PLATFORM_CO_OWNER'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-300 ring-2 ring-amber-500/30'
                        : 'border-[var(--border-app)] bg-[var(--bg-base)] text-[var(--text-muted)] hover:border-[var(--border-subtle)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Crown className="h-3.5 w-3.5 text-amber-400" />
                      {ar ? 'مالك مشارك' : 'Co-Owner'}
                    </div>
                    <div className="text-[10px] mt-1 text-[var(--text-muted)]">
                      {ar ? 'صلاحيات سيادية كاملة' : 'Full sovereign access'}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInviteRole('SUPER_ADMIN')}
                    className={`rounded-xl border p-3 text-start transition-all ${
                      inviteRole === 'SUPER_ADMIN'
                        ? 'border-blue-500 bg-blue-500/10 text-blue-300 ring-2 ring-blue-500/30'
                        : 'border-[var(--border-app)] bg-[var(--bg-base)] text-[var(--text-muted)] hover:border-[var(--border-subtle)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Shield className="h-3.5 w-3.5 text-blue-400" />
                      {ar ? 'مدير منصة' : 'Super Admin'}
                    </div>
                    <div className="text-[10px] mt-1 text-[var(--text-muted)]">
                      {ar ? 'إدارة تشغيلية' : 'Operational control'}
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteForm(false)}
                  className="flex-1 rounded-xl border border-[var(--border-app)] py-2.5 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
                >
                  {ar ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 text-xs font-bold text-white disabled:opacity-50 hover:brightness-110 transition-all"
                >
                  {isInviting
                    ? (ar ? 'جارٍ الإرسال...' : 'Sending...')
                    : (ar ? 'إرسال الدعوة' : 'Send Invite')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={ar ? 'بحث في مديري المنصة...' : 'Search platform admins...'}
          className="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] ps-9 pe-4 py-2.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]/60"
        />
      </div>

      {/* Admins List */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-[var(--text-muted)]">
          {ar ? 'جارٍ التحميل...' : 'Loading...'}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-[var(--text-muted)]">
          {ar ? 'لا يوجد مديرو منصة' : 'No platform admins found'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((admin) => {
            const isCurrentUser = admin.id === user?.id;
            const isOwner = admin.isPlatformOwner;

            return (
              <div
                key={admin.id}
                className="rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold ${isOwner ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'}`}>
                    {admin.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[var(--text-main)]">{admin.name}</span>
                      {isOwner && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30">
                          <Crown className="h-2.5 w-2.5" />
                          {ar ? 'المالك الأساسي' : 'Primary Owner'}
                        </span>
                      )}
                      {!isOwner && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-400 border border-blue-500/30">
                          <Shield className="h-2.5 w-2.5" />
                          {ar ? 'مدير منصة' : 'Super Admin'}
                        </span>
                      )}
                      {isCurrentUser && (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                          {ar ? 'أنت' : 'You'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Mail className="h-3 w-3 text-[var(--text-muted)]" />
                      <span className="text-xs text-[var(--text-muted)]">{admin.email}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {admin.isSuspended ? (
                        <span className="text-[10px] text-rose-400 flex items-center gap-1">
                          <X className="h-3 w-3" />
                          {ar ? 'معلق' : 'Suspended'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          {ar ? 'نشط' : 'Active'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {isPlatformOwner && !isCurrentUser && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {admin.email === 'superadmin@platform.sa' ? (
                      <span className="text-[11px] text-amber-400 font-semibold px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        {ar ? 'المالك الأساسي محمي' : 'Primary Owner Protected'}
                      </span>
                    ) : (
                      <>
                        {isOwner ? (
                          <button
                            onClick={() => void handleUpdateRole(admin.id, admin.name, 'SUPER_ADMIN')}
                            disabled={actionLoading === `role-${admin.id}`}
                            className="flex items-center gap-1 rounded-xl border border-blue-500/40 bg-blue-500/10 px-2.5 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 transition-colors"
                            title={ar ? 'تخفيض إلى مدير منصة عادي' : 'Demote to Super Admin'}
                          >
                            <Shield className="h-3 w-3 text-blue-400" />
                            <span>{ar ? 'تخفيض لمدير' : 'Demote to Admin'}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => void handleUpdateRole(admin.id, admin.name, 'PLATFORM_OWNER')}
                            disabled={actionLoading === `role-${admin.id}`}
                            className="flex items-center gap-1 rounded-xl border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors"
                            title={ar ? 'ترقية المستخدم لمالك مشارك للمنصة' : 'Promote to Platform Co-Owner'}
                          >
                            <Crown className="h-3 w-3 text-amber-400" />
                            <span>{ar ? 'ترقية لمالك مشارك' : 'Make Co-Owner'}</span>
                          </button>
                        )}

                        <button
                          onClick={() => void handleUpdateRole(admin.id, admin.name, 'REVOKE')}
                          disabled={actionLoading === `role-${admin.id}`}
                          className="flex items-center gap-1 rounded-xl border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition-colors"
                          title={ar ? 'سحب جميع صلاحيات إدارة المنصة' : 'Revoke platform admin privileges'}
                        >
                          <X className="h-3 w-3" />
                          <span>{ar ? 'إلغاء الصلاحية' : 'Revoke'}</span>
                        </button>

                        {confirmRevoke === admin.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => void handleRevokeSession(admin.id, admin.name)}
                              className="rounded-lg bg-rose-500/20 px-2.5 py-1 text-xs font-bold text-rose-400 hover:bg-rose-500/30 transition-colors"
                            >
                              {ar ? 'تأكيد الطرد' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => setConfirmRevoke(null)}
                              className="rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
                            >
                              {ar ? 'إلغاء' : 'Cancel'}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmRevoke(admin.id)}
                            className="flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
                          >
                            <KeyRound className="h-3 w-3" />
                            <span>{ar ? 'طرد من الجلسات' : 'Revoke Sessions'}</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
        {[
          {
            icon: Crown,
            label: ar ? 'المالك الأساسي' : 'Primary Owner',
            value: admins.filter(a => a.isPlatformOwner).length,
            color: 'text-amber-400 bg-amber-500/10',
          },
          {
            icon: ShieldCheck,
            label: ar ? 'مديرو المنصة' : 'Super Admins',
            value: admins.filter(a => a.isPlatformSuperAdmin && !a.isPlatformOwner).length,
            color: 'text-blue-400 bg-blue-500/10',
          },
          {
            icon: ShieldAlert,
            label: ar ? 'المعلقون' : 'Suspended',
            value: admins.filter(a => a.isSuspended).length,
            color: 'text-rose-400 bg-rose-500/10',
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-4 flex items-center gap-3">
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${stat.color}`}>
              <stat.icon className="h-4 w-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-[var(--text-main)]">{stat.value}</div>
              <div className="text-[10px] text-[var(--text-muted)]">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
