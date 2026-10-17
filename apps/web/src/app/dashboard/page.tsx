'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { Navbar } from '../../components/Navbar';
import { api } from '../../lib/api-client';
import {
  Building2,
  Users,
  GitBranch,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Trophy,
  CheckCircle2,
  Lock,
} from 'lucide-react';

const ROLE_LABELS_AR: Record<string, string> = {
  OWNER: 'مالك الأكاديمية (Owner)',
  MANAGER: 'مدير عام (Manager)',
  BRANCH_MANAGER: 'مدير فرع (Branch Manager)',
  COACH: 'مدرب معتمد (Coach)',
  RECEPTIONIST: 'استقبال (Receptionist)',
  ACCOUNTANT: 'محاسب مالي (Accountant)',
  VIEWER: 'مراقب (Viewer)',
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, activeTenant, memberships, isLoading, switchTenant, refreshUser } = useAuth();

  const [staff, setStaff] = useState<
    Array<{
      id: string;
      role: string;
      status: string;
      user: { id: string; email: string; name: string; phone?: string | null };
      branch?: { id: string; name: string; code?: string | null } | null;
    }>
  >([]);
  const [branches, setBranches] = useState<
    Array<{ id: string; name: string; code?: string | null; city?: string | null }>
  >([]);
  const [isFetchingData, setIsFetchingData] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user && activeTenant) {
      const loadData = async () => {
        setIsFetchingData(true);
        try {
          const [staffData, branchData] = await Promise.all([
            api.tenancy.listStaff().catch(() => []),
            api.tenancy.listBranches().catch(() => []),
          ]);
          setStaff(staffData);
          setBranches(branchData);
        } finally {
          setIsFetchingData(false);
        }
      };
      void loadData();
    }
  }, [user, activeTenant]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f1c18] flex items-center justify-center text-[#9bb5a8]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-[#2f9e6b]" />
          <p className="text-sm font-medium">جارٍ التحقق من الجلسة الآمنة...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0f1c18] text-[#e8f0ec] flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Welcome and Identity Hero Card */}
        <div className="rounded-2xl border border-[#234235] bg-gradient-to-r from-[#162821] via-[#12231c] to-[#162821] p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-96 h-96 bg-[#2f9e6b]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#45c387] bg-[#2f9e6b]/15 px-2.5 py-1 rounded-full border border-[#2f9e6b]/30">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  جلسة آمنة ومحققة
                </span>
                <span className="text-xs text-[#9bb5a8]">Sprint 1 Identity Foundation</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                أهلاً بك، {user.name} 👋
              </h1>
              <p className="mt-1 text-sm text-[#9bb5a8]">
                البريد: <span className="font-mono text-white/90">{user.email}</span> • الحساب:{' '}
                <span className="text-[#45c387] font-medium">مُفعل ونشط</span>
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void refreshUser()}
                className="flex items-center gap-2 rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-4 py-2.5 text-xs font-medium text-[#e8f0ec] hover:border-[#2f9e6b] transition-colors cursor-pointer"
              >
                <RefreshCw className={`h-4 w-4 ${isFetchingData ? 'animate-spin' : ''}`} />
                <span>تحديث البيانات</span>
              </button>

              <Link
                href="/register"
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] px-4 py-2.5 text-xs font-semibold text-[#062016] shadow-md shadow-[#2f9e6b]/20 hover:brightness-110 transition-all"
              >
                <Sparkles className="h-4 w-4" />
                <span>تسجيل أكاديمية ثانية</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Multi-Tenancy & Active Academy Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Active Academy Card */}
          <div className="md:col-span-2 rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 backdrop-blur-md">
            <div className="flex items-center justify-between pb-4 border-b border-[#234235]">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2f9e6b]/20 border border-[#2f9e6b]/40 text-[#45c387]">
                  <Trophy className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {activeTenant?.tenantName || 'الأكاديمية النشطة'}
                  </h2>
                  <p className="text-xs text-[#9bb5a8]">
                    معرف المستأجر: <span className="font-mono">{activeTenant?.tenantId}</span>
                  </p>
                </div>
              </div>

              <span className="rounded-lg bg-[#234235] px-3 py-1 text-xs font-semibold text-[#45c387] border border-[#2b4c3e]">
                {activeTenant?.role
                  ? ROLE_LABELS_AR[activeTenant.role] || activeTenant.role
                  : 'عضو'}
              </span>
            </div>

            {/* Academy Details */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6">
              <div className="rounded-xl border border-[#234235] bg-[#0f1c18]/60 p-3.5">
                <span className="text-[11px] text-[#9bb5a8] block mb-1">الرياضة الأساسية</span>
                <span className="text-sm font-semibold text-white">كرة قدم (Football)</span>
              </div>
              <div className="rounded-xl border border-[#234235] bg-[#0f1c18]/60 p-3.5">
                <span className="text-[11px] text-[#9bb5a8] block mb-1">الفرع الحالي</span>
                <span className="text-sm font-semibold text-white">الفرع الرئيسي (HQ)</span>
              </div>
              <div className="rounded-xl border border-[#234235] bg-[#0f1c18]/60 p-3.5">
                <span className="text-[11px] text-[#9bb5a8] block mb-1">عزل البيانات (RLS)</span>
                <span className="text-sm font-semibold text-[#45c387] flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4" /> فعّال ومحمي
                </span>
              </div>
            </div>

            {/* Tenant switcher selector if user has more than 1 membership */}
            {memberships.length > 1 && (
              <div className="mt-6 pt-4 border-t border-[#234235]">
                <label className="block text-xs font-semibold text-[#9bb5a8] mb-2">
                  التبديل بين أكاديمياتك المتاحة ({memberships.length}):
                </label>
                <div className="flex flex-wrap gap-2">
                  {memberships.map((m) => (
                    <button
                      key={m.tenantId}
                      type="button"
                      onClick={() => void switchTenant(m.tenantId)}
                      className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
                        m.tenantId === activeTenant?.tenantId
                          ? 'border border-[#2f9e6b] bg-[#2f9e6b]/20 text-[#45c387] shadow-sm'
                          : 'border border-[#234235] bg-[#0f1c18] text-[#9bb5a8] hover:border-[#2b4c3e] hover:text-white'
                      }`}
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      <span>{m.tenantName}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Security & Invariants Card */}
          <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 backdrop-blur-md space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Lock className="h-4 w-4 text-[#2f9e6b]" />
              ضمانات الأمان المطبقة (Security Invariants)
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-[#45c387] shrink-0 mt-0.5" />
                <p className="text-[#9bb5a8]">
                  <strong className="text-white">Argon2id Hashing:</strong> حماية كلمات المرور بأعلى
                  معايير التشفير ضد هجمات القوة الغاشمة.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-[#45c387] shrink-0 mt-0.5" />
                <p className="text-[#9bb5a8]">
                  <strong className="text-white">PostgreSQL Tenant RLS:</strong> عزل تام لقواعد
                  البيانات لكل أكاديمية بدون إمكانية تداخل السجلات.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-[#45c387] shrink-0 mt-0.5" />
                <p className="text-[#9bb5a8]">
                  <strong className="text-white">Token Family Rotation:</strong> كشف فوري لإعادة
                  استخدام رموز التحديث وإلغاء العائلة المخترقة تلقائياً.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-[#45c387] shrink-0 mt-0.5" />
                <p className="text-[#9bb5a8]">
                  <strong className="text-white">HttpOnly Cookies:</strong> الرموز محصنة ضد ثغرات
                  XSS وعمليات الاستيلاء على الجلسة.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Staff & Branches Overview (Sprint 1 Operational Verification) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Staff Members */}
          <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-[#2f9e6b]" />
                <h3 className="font-bold text-white text-base">طاقم الأكاديمية (Staff)</h3>
              </div>
              <span className="rounded-md bg-[#234235] px-2 py-0.5 text-xs text-[#9bb5a8]">
                {staff.length} أعضاء
              </span>
            </div>

            <div className="divide-y divide-[#234235] overflow-hidden rounded-xl border border-[#234235] bg-[#0f1c18]/60">
              {staff.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#9bb5a8]">
                  لا يوجد أعضاء طاقم إضافيين حتى الآن. يمكنك دعوة مدربين واستقبال قريباً.
                </div>
              ) : (
                staff.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3.5 hover:bg-[#162821]/50 transition-colors"
                  >
                    <div>
                      <p className="text-xs font-semibold text-white">{member.user.name}</p>
                      <p className="text-[11px] text-[#9bb5a8] font-mono">{member.user.email}</p>
                    </div>
                    <div className="text-left">
                      <span className="inline-block rounded bg-[#234235] px-2 py-0.5 text-[11px] text-[#45c387]">
                        {ROLE_LABELS_AR[member.role] || member.role}
                      </span>
                      {member.branch && (
                        <p className="text-[10px] text-[#9bb5a8] mt-0.5">{member.branch.name}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Branches */}
          <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-[#2f9e6b]" />
                <h3 className="font-bold text-white text-base">فروع الأكاديمية (Branches)</h3>
              </div>
              <span className="rounded-md bg-[#234235] px-2 py-0.5 text-xs text-[#9bb5a8]">
                {branches.length} فروع
              </span>
            </div>

            <div className="divide-y divide-[#234235] overflow-hidden rounded-xl border border-[#234235] bg-[#0f1c18]/60">
              {branches.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#9bb5a8]">
                  يتم تحميل بيانات الفروع...
                </div>
              ) : (
                branches.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between p-3.5 hover:bg-[#162821]/50 transition-colors"
                  >
                    <div>
                      <p className="text-xs font-semibold text-white">{b.name}</p>
                      <p className="text-[11px] text-[#9bb5a8]">{b.city || 'الفرع الرئيسي'}</p>
                    </div>
                    <span className="rounded bg-[#234235] px-2 py-0.5 text-[11px] font-mono text-[#9bb5a8]">
                      {b.code || 'MAIN'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
