'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { canAccessAdminRoutes, getRoleHomeRoute } from '../../lib/role-routing';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/ui/PageHeader';
import { ThemeToggle } from '../../components/ThemeToggle';
import { LocaleToggle } from '../../components/LocaleToggle';
import { api } from '../../lib/api-client';
import type { AcademyProfile, UpdateAcademySettings } from '@academy/shared';
import {
  Building2,
  Globe,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Palette,
} from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const { user, activeTenant, isLoading } = useAuth();

  const [profile, setProfile] = useState<AcademyProfile | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  const loadProfile = useCallback(async () => {
    if (!user || !activeTenant) return;
    setIsFetching(true);
    try {
      const data = await api.tenancy.getProfile();
      setProfile(data);
      setName(data.name);
      setPhone(data.phone || '');
      setEmail(data.email || '');
      setAddress(data.address || '');
      setLogoUrl(data.logoUrl || '');
      setCurrency(data.currency || 'EGP');
      setTimezone(data.timezone || 'Africa/Cairo');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل تحميل بيانات الأكاديمية';
      setErrorMessage(msg);
    } finally {
      setIsFetching(false);
    }
  }, [user, activeTenant]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

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

  if (isLoading || isFetching) {
    return (
      <AppShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-[var(--brand-primary)]" />
        </div>
      </AppShell>
    );
  }

  if (!user) return null;

  return (
    <AppShell>
      <div className="max-w-4xl space-y-6">
        <PageHeader
          breadcrumbs={[
            { label: 'الرئيسية', href: '/dashboard' },
            { label: 'إعدادات الأكاديمية' },
          ]}
          title="إعدادات وهوية الأكاديمية"
          description="إدارة الاسم الرسمي ومعلومات الاتصال والموقع والعملة المعيارية للمدفوعات."
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

        {/* Invariant Stats Card */}
        {profile && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 text-center">
              <span className="text-[11px] text-[var(--text-muted)] block mb-0.5">
                معرف الأكاديمية (Slug)
              </span>
              <span className="font-mono text-xs font-bold text-[var(--text-primary)]">{profile.slug}</span>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 text-center">
              <span className="text-[11px] text-[var(--text-muted)] block mb-0.5">عدد الفروع</span>
              <span className="text-sm font-bold text-[var(--brand-primary)]">
                {profile._count?.branches || 0} فروع
              </span>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 text-center">
              <span className="text-[11px] text-[var(--text-muted)] block mb-0.5">إجمالي اللاعبين</span>
              <span className="text-sm font-bold text-blue-500">
                {profile._count?.players || 0} لاعب
              </span>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 text-center">
              <span className="text-[11px] text-[var(--text-muted)] block mb-0.5">الكادر النشط</span>
              <span className="text-sm font-bold text-purple-500">
                {profile._count?.memberships || 0} عضو
              </span>
            </div>
          </div>
        )}

        {/* Profile Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3 text-sm font-bold text-[var(--text-primary)]">
              <Building2 className="h-4 w-4 text-[var(--brand-primary)]" />
              <span>البيانات الأساسية ومعلومات التواصل</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  اسم الأكاديمية الرسمي *
                </label>
                <input
                  type="text"
                  required
                  id="input-academy-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: أكاديمية الأبطال لكرة القدم"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2.5 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  رابط الشعار (Logo URL)
                </label>
                <input
                  type="url"
                  id="input-academy-logo"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2.5 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  رقم الهاتف الرسمي
                </label>
                <input
                  type="tel"
                  id="input-academy-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+201012345678"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2.5 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  البريد الإلكتروني الرسمي
                </label>
                <input
                  type="email"
                  id="input-academy-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="info@academy.com"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2.5 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  المقر الرئيسي / العنوان
                </label>
                <input
                  type="text"
                  id="input-academy-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="المعادي، القاهرة، جمهورية مصر العربية"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2.5 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Localization & Financial Settings */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3 text-sm font-bold text-[var(--text-primary)]">
              <Globe className="h-4 w-4 text-blue-500" />
              <span>الإعدادات المالية والإقليمية</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  العملة الافتراضية
                </label>
                <select
                  id="select-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2.5 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
                >
                  <option value="EGP">جنيه مصري (EGP)</option>
                  <option value="SAR">ريال سعودي (SAR)</option>
                  <option value="AED">درهم إماراتي (AED)</option>
                  <option value="USD">دولار أمريكي (USD)</option>
                  <option value="EUR">يورو (EUR)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  المنطقة الزمنية
                </label>
                <select
                  id="select-timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 py-2.5 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
                >
                  <option value="Africa/Cairo">توقيت القاهرة (UTC+2 / UTC+3)</option>
                  <option value="Asia/Riyadh">توقيت الرياض (UTC+3)</option>
                  <option value="Asia/Dubai">توقيت دبي (UTC+4)</option>
                  <option value="UTC">التوقيت العالمي (UTC)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Appearance & Personal Preferences */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3 text-sm font-bold text-[var(--text-primary)]">
              <Palette className="h-4 w-4 text-[var(--brand-primary)]" />
              <span>المظهر واللغة (Appearance & Language)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  نمط المظهر (Theme Mode)
                </label>
                <div className="flex items-center gap-3">
                  <ThemeToggle />
                  <span className="text-xs text-[var(--text-muted)]">
                    دعم الوضع النهاري والليلي وتفضيل النظام تلقائياً
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  لغة الواجهة (Interface Language)
                </label>
                <div className="flex items-center gap-3">
                  <LocaleToggle />
                  <span className="text-xs text-[var(--text-muted)]">
                    التبديل الفوري بين العربية (RTL) والإنجليزية (LTR)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
            <button
              type="submit"
              id="btn-save-settings"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-6 py-2.5 text-xs font-semibold text-white shadow hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}</span>
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
