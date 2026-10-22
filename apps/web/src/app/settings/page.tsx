'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { Navbar } from '../../components/Navbar';
import { api } from '../../lib/api-client';
import type { AcademyProfile, UpdateAcademySettings } from '@academy/shared';
import {
  Settings,
  Building2,
  Globe,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
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
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

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
      <div className="min-h-screen bg-[#0f1c18] flex items-center justify-center text-[#9bb5a8]">
        <RefreshCw className="h-8 w-8 animate-spin text-[#2f9e6b]" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#0f1c18] text-[#e8f0ec] flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#9bb5a8]">
          <Link href="/dashboard" className="hover:text-white transition-colors">
            الرئيسية
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-[#45c387]">إعدادات الأكاديمية</span>
        </div>

        {/* Page Title */}
        <div className="border-b border-[#234235] pb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#45c387] bg-[#2f9e6b]/15 px-2.5 py-0.5 rounded-full border border-[#2f9e6b]/30">
              <Settings className="h-3.5 w-3.5" />
              ملف الأكاديمية
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            إعدادات وهوية الأكاديمية
          </h1>
          <p className="text-xs text-[#9bb5a8] mt-1">
            إدارة الاسم الرسمي ومعلومات الاتصال والموقع والعملة المعيارية للمدفوعات.
          </p>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="rounded-xl border border-[#ef4444]/40 bg-[#ef4444]/10 p-4 text-xs text-[#fca5a5] flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-[#ef4444]" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-[#2f9e6b]/40 bg-[#2f9e6b]/10 p-4 text-xs text-[#45c387] flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-[#45c387]" />
            <div className="flex-1 font-medium">{successMessage}</div>
          </div>
        )}

        {/* Invariant Stats Card */}
        {profile && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-[#234235] bg-[#162821]/80 p-3.5 text-center">
              <span className="text-[11px] text-[#9bb5a8] block mb-0.5">
                معرف الأكاديمية (Slug)
              </span>
              <span className="font-mono text-xs font-bold text-white">{profile.slug}</span>
            </div>

            <div className="rounded-xl border border-[#234235] bg-[#162821]/80 p-3.5 text-center">
              <span className="text-[11px] text-[#9bb5a8] block mb-0.5">عدد الفروع</span>
              <span className="text-sm font-bold text-[#45c387]">
                {profile._count?.branches || 0} فروع
              </span>
            </div>

            <div className="rounded-xl border border-[#234235] bg-[#162821]/80 p-3.5 text-center">
              <span className="text-[11px] text-[#9bb5a8] block mb-0.5">إجمالي اللاعبين</span>
              <span className="text-sm font-bold text-[#3b82f6]">
                {profile._count?.players || 0} لاعب
              </span>
            </div>

            <div className="rounded-xl border border-[#234235] bg-[#162821]/80 p-3.5 text-center">
              <span className="text-[11px] text-[#9bb5a8] block mb-0.5">الكادر النشط</span>
              <span className="text-sm font-bold text-[#a78bfa]">
                {profile._count?.memberships || 0} عضو
              </span>
            </div>
          </div>
        )}

        {/* Profile Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 backdrop-blur-md space-y-4">
            <div className="flex items-center gap-2 border-b border-[#234235] pb-3 text-sm font-bold text-white">
              <Building2 className="h-4 w-4 text-[#2f9e6b]" />
              <span>البيانات الأساسية ومعلومات التواصل</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#9bb5a8] mb-1.5">
                  اسم الأكاديمية الرسمي *
                </label>
                <input
                  type="text"
                  required
                  id="input-academy-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: أكاديمية الأبطال لكرة القدم"
                  className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9bb5a8] mb-1.5">
                  رابط الشعار (Logo URL)
                </label>
                <input
                  type="url"
                  id="input-academy-logo"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9bb5a8] mb-1.5">
                  رقم الهاتف الرسمي
                </label>
                <input
                  type="tel"
                  id="input-academy-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+201012345678"
                  className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9bb5a8] mb-1.5">
                  البريد الإلكتروني الرسمي
                </label>
                <input
                  type="email"
                  id="input-academy-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="info@academy.com"
                  className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#9bb5a8] mb-1.5">
                  المقر الرئيسي / العنوان
                </label>
                <input
                  type="text"
                  id="input-academy-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="المعادي، القاهرة، جمهورية مصر العربية"
                  className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Localization & Financial Settings */}
          <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 backdrop-blur-md space-y-4">
            <div className="flex items-center gap-2 border-b border-[#234235] pb-3 text-sm font-bold text-white">
              <Globe className="h-4 w-4 text-[#3b82f6]" />
              <span>الإعدادات المالية والإقليمية</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#9bb5a8] mb-1.5">
                  العملة الافتراضية
                </label>
                <select
                  id="select-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
                >
                  <option value="EGP">جنيه مصري (EGP)</option>
                  <option value="SAR">ريال سعودي (SAR)</option>
                  <option value="AED">درهم إماراتي (AED)</option>
                  <option value="USD">دولار أمريكي (USD)</option>
                  <option value="EUR">يورو (EUR)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9bb5a8] mb-1.5">
                  المنطقة الزمنية
                </label>
                <select
                  id="select-timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
                >
                  <option value="Africa/Cairo">توقيت القاهرة (UTC+2 / UTC+3)</option>
                  <option value="Asia/Riyadh">توقيت الرياض (UTC+3)</option>
                  <option value="Asia/Dubai">توقيت دبي (UTC+4)</option>
                  <option value="UTC">التوقيت العالمي (UTC)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#234235]">
            <button
              type="submit"
              id="btn-save-settings"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] px-6 py-2.5 text-xs font-semibold text-[#062016] shadow-lg shadow-[#2f9e6b]/20 hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
