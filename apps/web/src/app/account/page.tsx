'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { useLocale } from '../../lib/locale-context';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/ui/PageHeader';
import { api } from '../../lib/api-client';
import {
  User,
  Mail,
  Phone,
  KeyRound,
  Save,
  Shield,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Sparkles,
} from 'lucide-react';

export default function AccountPage() {
  const router = useRouter();
  const { user, isLoading, refreshUser } = useAuth();
  const { locale } = useLocale();

  // Profile form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setIsSavingProfile(true);
    try {
      const res = await api.auth.updateProfile({
        name: name.trim(),
        phone: phone.trim() || null,
      });
      setProfileMsg({
        type: 'success',
        text:
          locale === 'ar'
            ? 'تم تحديث الملف الشخصي بنجاح'
            : res.message || 'Profile updated successfully',
      });
      await refreshUser();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : locale === 'ar'
            ? 'فشل تحديث الملف الشخصي'
            : 'Failed to update profile';
      setProfileMsg({ type: 'error', text: msg });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword !== confirmPassword) {
      setPasswordMsg({
        type: 'error',
        text:
          locale === 'ar'
            ? 'كلمة المرور الجديدة وتأكيدها غير متطابقين'
            : 'New password and confirmation do not match',
      });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordMsg({
        type: 'error',
        text:
          locale === 'ar'
            ? 'يجب ألا تقل كلمة المرور الجديدة عن 8 أحرف'
            : 'New password must be at least 8 characters',
      });
      return;
    }

    setIsSavingPassword(true);
    try {
      const res = await api.auth.changePassword({
        currentPassword,
        newPassword,
      });
      setPasswordMsg({
        type: 'success',
        text:
          locale === 'ar'
            ? 'تم تغيير كلمة المرور بنجاح'
            : res.message || 'Password changed successfully',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : locale === 'ar'
            ? 'فشل تغيير كلمة المرور'
            : 'Failed to change password';
      setPasswordMsg({ type: 'error', text: msg });
    } finally {
      setIsSavingPassword(false);
    }
  };

  if (isLoading || !user) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--accent-primary)]" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumbs={[{ label: locale === 'ar' ? 'الحساب الشخصي' : 'My Account' }]}>
      <PageHeader
        title={locale === 'ar' ? 'إدارة الحساب الشخصي' : 'Account Settings'}
        description={
          locale === 'ar'
            ? 'تعديل بيانات ملفك الشخصي وتغيير كلمة المرور ومراجعة أمان حسابك'
            : 'Update your profile details, change your password, and review account security'
        }
        icon={User}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Information Card */}
        <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-[var(--border-subtle)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-lg font-extrabold text-white shadow-lg shadow-emerald-500/25">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--text-main)]">
                {locale === 'ar' ? 'الملف الشخصي' : 'Profile Information'}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {locale === 'ar' ? 'بيانات الحساب الأساسية' : 'Your basic account details'}
              </p>
            </div>
          </div>

          {profileMsg && (
            <div
              className={`flex items-center gap-2 rounded-xl p-3 text-xs font-medium ${
                profileMsg.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}
            >
              {profileMsg.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              {profileMsg.text}
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            {/* Email (read-only) */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  {locale === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
                </span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] py-2.5 px-3 text-sm text-[var(--text-muted)] cursor-not-allowed"
                  dir="ltr"
                />
                {user.isEmailVerified ? (
                  <span className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-1.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3" />
                    {locale === 'ar' ? 'مؤكد' : 'Verified'}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-1.5 text-[10px] font-bold text-amber-400 border border-amber-500/20">
                    <AlertCircle className="h-3 w-3" />
                    {locale === 'ar' ? 'غير مؤكد' : 'Unverified'}
                  </span>
                )}
              </div>
            </div>

            {/* Name */}
            <div>
              <label
                htmlFor="account-name"
                className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5"
              >
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  {locale === 'ar' ? 'الاسم الكامل *' : 'Full Name *'}
                </span>
              </label>
              <input
                id="account-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] py-2.5 px-3 text-sm text-[var(--text-main)] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>

            {/* Phone */}
            <div>
              <label
                htmlFor="account-phone"
                className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5"
              >
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {locale === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
                </span>
              </label>
              <input
                id="account-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+20 10 1234 5678"
                dir="ltr"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] py-2.5 px-3 text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>

            {/* Account metadata */}
            <div className="flex items-center gap-4 pt-2 text-[10px] text-[var(--text-muted)]">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {locale === 'ar' ? 'تم الإنشاء: ' : 'Created: '}
                {new Date(user.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
              {(user.isPlatformSuperAdmin || user.isPlatformOwner) && (
                <span className="flex items-center gap-1 text-amber-400 font-bold">
                  <Shield className="h-3 w-3" />
                  {locale === 'ar' ? 'مشرف المنصة' : 'Platform Admin'}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isSavingProfile}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {isSavingProfile ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {locale === 'ar' ? 'حفظ التعديلات' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Change Password Card */}
        <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-[var(--border-subtle)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--text-main)]">
                {locale === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {locale === 'ar'
                  ? 'أدخل كلمة مرورك الحالية ثم كلمة المرور الجديدة'
                  : 'Enter your current password and set a new one'}
              </p>
            </div>
          </div>

          {passwordMsg && (
            <div
              className={`flex items-center gap-2 rounded-xl p-3 text-xs font-medium ${
                passwordMsg.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}
            >
              {passwordMsg.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              {passwordMsg.text}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label
                htmlFor="current-password"
                className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5"
              >
                {locale === 'ar' ? 'كلمة المرور الحالية *' : 'Current Password *'}
              </label>
              <div className="relative">
                <input
                  id="current-password"
                  type={showPasswords ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] py-2.5 px-3 pe-10 text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute end-3 top-3 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                >
                  {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="new-password"
                className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5"
              >
                {locale === 'ar' ? 'كلمة المرور الجديدة *' : 'New Password *'}
              </label>
              <input
                id="new-password"
                type={showPasswords ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] py-2.5 px-3 text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              />
              <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                {locale === 'ar'
                  ? 'حد أدنى 8 أحرف مع حرف كبير، حرف صغير، ورقم'
                  : 'Min 8 characters with uppercase, lowercase, and number'}
              </p>
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5"
              >
                {locale === 'ar' ? 'تأكيد كلمة المرور الجديدة *' : 'Confirm New Password *'}
              </label>
              <input
                id="confirm-password"
                type={showPasswords ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] py-2.5 px-3 text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isSavingPassword}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {isSavingPassword ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              {locale === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>

      {/* Security Info Card */}
      <div className="mt-6 rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-6 shadow-sm">
        <div className="flex items-center gap-3 pb-4 border-b border-[var(--border-subtle)]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--text-main)]">
              {locale === 'ar' ? 'معلومات الأمان' : 'Security Information'}
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              {locale === 'ar'
                ? 'ملخص حالة أمان حسابك'
                : 'Overview of your account security status'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4 space-y-2">
            <div className="text-xs font-bold text-[var(--text-main)] flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-emerald-400" />
              {locale === 'ar' ? 'تأكيد البريد' : 'Email Verification'}
            </div>
            <div
              className={`text-xs font-semibold ${user.isEmailVerified ? 'text-emerald-400' : 'text-amber-400'}`}
            >
              {user.isEmailVerified
                ? locale === 'ar'
                  ? '✓ مؤكد'
                  : '✓ Verified'
                : locale === 'ar'
                  ? '⚠ غير مؤكد'
                  : '⚠ Unverified'}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4 space-y-2">
            <div className="text-xs font-bold text-[var(--text-main)] flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-blue-400" />
              {locale === 'ar' ? 'حماية كلمة المرور' : 'Password Protection'}
            </div>
            <div className="text-xs font-semibold text-emerald-400">
              {locale === 'ar' ? '✓ مُشفّرة ومحمية' : '✓ Encrypted & Protected'}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4 space-y-2">
            <div className="text-xs font-bold text-[var(--text-main)] flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-purple-400" />
              {locale === 'ar' ? 'مستوى الحساب' : 'Account Tier'}
            </div>
            <div className="text-xs font-semibold text-purple-400">
              {user.isPlatformSuperAdmin
                ? locale === 'ar'
                  ? 'مشرف المنصة'
                  : 'Platform Super Admin'
                : user.isPlatformOwner
                  ? locale === 'ar'
                    ? 'مالك المنصة'
                    : 'Platform Owner'
                  : locale === 'ar'
                    ? 'مستخدم عادي'
                    : 'Standard User'}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
