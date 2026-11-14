'use client';

import React, { useMemo, useState } from 'react';
import { useLocale } from '@/contexts/locale-context';
import type { PlatformUserItem } from '@academy/shared';
import { Search, LogOut, KeyRound, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface PlatformUsersTabProps {
  users: PlatformUserItem[];
  actionLoading: string | null;
  onForceLogout: (user: PlatformUserItem) => void;
  onTogglePasswordReset: (user: PlatformUserItem) => void;
  onToggleUserSuspension: (user: PlatformUserItem) => void;
}

export function PlatformUsersTab({
  users,
  actionLoading,
  onForceLogout,
  onTogglePasswordReset,
  onToggleUserSuspension,
}: PlatformUsersTabProps) {
  const { t, locale } = useLocale();
  const isAr = locale === 'ar';

  const [userSearchQuery, setUserSearchQuery] = useState('');

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (!userSearchQuery) return true;
      const q = userSearchQuery.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.memberships.some((m) => m.tenantName.toLowerCase().includes(q))
      );
    });
  }, [users, userSearchQuery]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 inset-s-3 text-(--text-muted)" />
          <input
            type="text"
            value={userSearchQuery}
            onChange={(e) => setUserSearchQuery(e.target.value)}
            placeholder={t(
              'platform.userSearchPlaceholder',
              isAr ? 'بحث باسم المستخدم أو البريد...' : 'Search by name or email...',
            )}
            className="w-full ps-9 pe-4 py-2 rounded-xl bg-[var(--bg-surface)] border border-(--border-subtle) text-sm text-(--text-main) placeholder-(--text-muted) focus:outline-none focus:border-(--accent-primary)"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-(--border-subtle) bg-[var(--bg-surface)]">
        <table className="w-full text-sm text-start rtl:text-right ltr:text-left">
          <thead className="bg-(--bg-surface-subtle) border-b border-(--border-subtle) text-xs text-(--text-muted)">
            <tr>
              <th className="px-4 py-3">{isAr ? 'المستخدم' : 'User'}</th>
              <th className="px-4 py-3">{isAr ? 'الأكاديميات والأدوار' : 'Academies & Roles'}</th>
              <th className="px-4 py-3">{isAr ? 'الجلسات النشطة' : 'Active Sessions'}</th>
              <th className="px-4 py-3">{isAr ? 'حالة الحساب' : 'Account Status'}</th>
              <th className="px-4 py-3">{isAr ? 'إجراءات الأمان' : 'Security Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-(--text-muted) text-xs">
                  {isAr ? 'لا يوجد مستخدمين مطابقين' : 'No users found'}
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-(--bg-surface-subtle)/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-(--text-main)">{u.name}</div>
                    <div className="text-xs text-(--text-muted) font-mono">{u.email}</div>
                    {u.isPlatformSuperAdmin && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                        SUPER ADMIN
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {u.memberships.map((m, idx) => (
                        <div key={idx} className="text-xs">
                          <span className="font-medium text-(--text-main)">{m.tenantName}</span>
                          <span className="ms-1.5 px-1.5 py-0.5 rounded text-[10px] bg-(--bg-surface-subtle) text-(--text-muted) font-mono">
                            {m.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 font-mono text-xs px-2.5 py-1 rounded-full border ${
                        u.activeSessionsCount > 0
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : 'bg-(--bg-surface-subtle) text-(--text-muted) border-(--border-subtle)'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          u.activeSessionsCount > 0 ? 'bg-emerald-500' : 'bg-gray-400'
                        }`}
                      />
                      {u.activeSessionsCount} {isAr ? 'جلسة' : 'sessions'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.isSuspended ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                        <XCircle className="w-3.5 h-3.5" />
                        {isAr ? 'حساب معلق' : 'Suspended'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isAr ? 'نشط' : 'Active'}
                      </span>
                    )}
                    {u.mustResetPassword && (
                      <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                        {isAr ? 'مطلوب تعيين كلمة مرور' : 'Reset Required'}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onForceLogout(u)}
                        disabled={actionLoading === `user-logout-${u.id}`}
                        startIcon={<LogOut className="w-3 h-3 text-rose-600" />}
                        title={
                          isAr
                            ? 'إنهاء كافة الجلسات النشطة للمستخدم فوراً'
                            : 'Force logout user from all devices'
                        }
                      >
                        {isAr ? 'طرد من الجلسات' : 'Force Logout'}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onTogglePasswordReset(u)}
                        disabled={actionLoading === `user-pwd-${u.id}`}
                        startIcon={<KeyRound className="w-3 h-3 text-amber-500" />}
                      >
                        {u.mustResetPassword
                          ? isAr
                            ? 'إلغاء الإلزام'
                            : 'Clear Reset'
                          : isAr
                            ? 'إلزام تغيير المرور'
                            : 'Force Reset'}
                      </Button>

                      <Button
                        size="sm"
                        variant={u.isSuspended ? 'outline' : 'ghost'}
                        onClick={() => onToggleUserSuspension(u)}
                        disabled={actionLoading === `user-suspend-${u.id}`}
                      >
                        {u.isSuspended
                          ? isAr
                            ? 'فك التجميد'
                            : 'Unsuspend'
                          : isAr
                            ? 'تجميد الحساب'
                            : 'Suspend'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
