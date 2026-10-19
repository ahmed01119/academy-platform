'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../lib/auth-context';
import { Building2, Trophy, Sparkles, Lock, Database, Activity, ChevronLeft } from 'lucide-react';

export default function HomePage() {
  const { user } = useAuth();
  const [apiHealth, setApiHealth] = useState<'checking' | 'healthy' | 'offline'>('checking');

  useEffect(() => {
    fetch('http://localhost:3001/v1/health')
      .then((res) => (res.ok ? setApiHealth('healthy') : setApiHealth('offline')))
      .catch(() => setApiHealth('offline'));
  }, []);

  return (
    <div className="min-h-screen bg-[#0f1c18] text-[#e8f0ec] flex flex-col selection:bg-[#2f9e6b] selection:text-[#062016]">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-32">
          {/* Background ambient glowing spheres */}
          <div className="absolute top-1/4 -right-20 h-96 w-96 rounded-full bg-[#2f9e6b]/15 blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 -left-20 h-96 w-96 rounded-full bg-[#36b379]/10 blur-3xl pointer-events-none" />

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-3xl mx-auto space-y-6">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-[#2f9e6b]/30 bg-[#2f9e6b]/10 px-4 py-1.5 text-xs font-semibold text-[#45c387] shadow-sm backdrop-blur-md">
                <Sparkles className="h-4 w-4" />
                <span>الجيل الجديد لإدارة الأكاديميات الرياضية بمصر والعالم العربي</span>
              </div>

              {/* Title */}
              <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
                إدارة احترافية متكاملة <br />
                <span className="bg-gradient-to-r from-[#2f9e6b] via-[#45c387] to-[#7be4b0] bg-clip-text text-transparent">
                  لأكاديميتك الرياضية وفروعها
                </span>
              </h1>

              {/* Description */}
              <p className="text-base sm:text-lg text-[#9bb5a8] leading-relaxed max-w-2xl mx-auto">
                منصة سحابية متقدمة متعددة المستأجرين (Multi-Tenant SaaS) تدعم كرة القدم، البادل،
                السباحة والرياضات المتعددة، مع أمان مصرفي وعزل تام للبيانات على مستوى قاعدة
                البيانات.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                {user ? (
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] px-6 py-3.5 text-sm font-bold text-[#062016] shadow-xl shadow-[#2f9e6b]/30 hover:brightness-110 active:scale-95 transition-all"
                  >
                    <span>لوحة تحكم الأكاديمية</span>
                    <ChevronLeft className="h-4 w-4" />
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/register"
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] px-6 py-3.5 text-sm font-bold text-[#062016] shadow-xl shadow-[#2f9e6b]/30 hover:brightness-110 active:scale-95 transition-all"
                    >
                      <Trophy className="h-4 w-4" />
                      <span>تسجيل أكاديمية جديدة مجاناً</span>
                      <ChevronLeft className="h-4 w-4" />
                    </Link>

                    <Link
                      href="/login"
                      className="flex items-center gap-2 rounded-xl border border-[#2b4c3e] bg-[#162821]/80 px-6 py-3.5 text-sm font-semibold text-[#e8f0ec] hover:border-[#2f9e6b] hover:text-[#45c387] transition-all"
                    >
                      <span>تسجيل الدخول</span>
                    </Link>
                  </>
                )}
              </div>

              {/* Live Backend Health Indicator */}
              <div className="pt-6 flex items-center justify-center gap-2 text-xs text-[#9bb5a8]">
                <Activity
                  className={`h-4 w-4 ${
                    apiHealth === 'healthy'
                      ? 'text-[#45c387]'
                      : apiHealth === 'checking'
                        ? 'text-amber-400 animate-pulse'
                        : 'text-rose-400'
                  }`}
                />
                <span>
                  حالة خادم الـ API:{' '}
                  {apiHealth === 'healthy' ? (
                    <strong className="text-[#45c387]">متصل ونشط (NestJS 11 + Redis)</strong>
                  ) : apiHealth === 'checking' ? (
                    <strong className="text-amber-400">جارٍ التحقق...</strong>
                  ) : (
                    <strong className="text-rose-400">غير متصل محلياً (3001)</strong>
                  )}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Features / Sprint 1 Pillar Grid */}
        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pillar 1 */}
            <div className="rounded-2xl border border-[#234235] bg-[#162821]/70 p-6 backdrop-blur-md hover:border-[#2f9e6b]/50 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2f9e6b]/20 text-[#45c387] mb-5">
                <Database className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">
                عزل بيانات كامل (PostgreSQL RLS)
              </h2>
              <p className="text-xs text-[#9bb5a8] leading-relaxed">
                كل استعلام يتم تنفيذه في سياق المستأجر النشط، مما يضمن استحالة وصول أي أكاديمية
                لبيانات أكاديمية أخرى أو تسريب بيانات اللاعبين والمدربين.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="rounded-2xl border border-[#234235] bg-[#162821]/70 p-6 backdrop-blur-md hover:border-[#2f9e6b]/50 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2f9e6b]/20 text-[#45c387] mb-5">
                <Lock className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">
                تشفير متطور (Argon2id & JWT Rotation)
              </h2>
              <p className="text-xs text-[#9bb5a8] leading-relaxed">
                حماية الحسابات بتشفير Argon2id المقاوم لأجهزة التعدين، مع نظام تدوير تلقائي لعائلات
                رموز التحديث واكتشاف فوري لمحاولات إعادة الاستخدام.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="rounded-2xl border border-[#234235] bg-[#162821]/70 p-6 backdrop-blur-md hover:border-[#2f9e6b]/50 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2f9e6b]/20 text-[#45c387] mb-5">
                <Building2 className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">
                إدارة الفروع والصلاحيات المنضبطة
              </h2>
              <p className="text-xs text-[#9bb5a8] leading-relaxed">
                توزيع دقيق للأدوار بين المالك، مديري الفروع، المحاسب، والمدربين، مع حصر الصلاحيات
                حسب الفرع وتتبع كامل للعمليات عبر سجل التدقيق (Audit Log).
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#234235] bg-[#0c1714] py-8 text-center text-xs text-[#9bb5a8]">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 منصة إدارة الأكاديميات الرياضية (Academy Platform). جميع الحقوق محفوظة.</p>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-white transition-colors">
              تسجيل الدخول
            </Link>
            <Link href="/register" className="hover:text-white transition-colors">
              تسجيل أكاديمية
            </Link>
            <Link
              href="/auth-test"
              className="text-[#45c387] hover:underline transition-colors font-medium"
            >
              فحص الأمان (Auth Test)
            </Link>
            <a
              href="http://localhost:3001/v1/health"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors"
            >
              فحص الـ API
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
