'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../lib/auth-context';
import {
  Building2,
  Trophy,
  Sparkles,
  Lock,
  Activity,
  ChevronLeft,
  Users,
  ShieldCheck,
  Award,
  Target,
  BarChart3,
  HeartHandshake,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

export default function HomePage() {
  const { user, activeTenant } = useAuth();
  const [apiHealth, setApiHealth] = useState<'checking' | 'healthy' | 'offline'>('checking');

  useEffect(() => {
    fetch('http://localhost:3001/v1/health')
      .then((res) => (res.ok ? setApiHealth('healthy') : setApiHealth('offline')))
      .catch(() => setApiHealth('offline'));
  }, []);

  const getDashboardHref = () => {
    if (!user) return '/dashboard';
    if (user.isPlatformSuperAdmin) return '/platform';
    if (activeTenant?.role === 'COACH') return '/coach';
    if (user.hasPlayerProfile) return '/player';
    if (user.hasGuardianProfile) return '/guardian';
    return '/dashboard';
  };

  const getDashboardLabel = () => {
    if (!user) return 'لوحة التحكم';
    if (user.isPlatformSuperAdmin) return 'وحدة المشرف العام';
    if (activeTenant?.role === 'COACH') return 'مساحة عمل المدرب';
    if (user.hasPlayerProfile) return 'بوابة اللاعب';
    if (user.hasGuardianProfile) return 'بوابة ولي الأمر';
    return 'لوحة تحكم الأكاديمية';
  };

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
            <div className="text-center max-w-4xl mx-auto space-y-6">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-[#2f9e6b]/30 bg-[#2f9e6b]/10 px-4 py-1.5 text-xs font-semibold text-[#45c387] shadow-sm backdrop-blur-md">
                <Sparkles className="h-4 w-4" />
                <span>الجيل الجديد لإدارة وتطوير الأكاديميات الرياضية بمصر والعالم العربي</span>
              </div>

              {/* Title */}
              <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
                منصة رياضية ذكية متكاملة <br />
                <span className="bg-gradient-to-r from-[#2f9e6b] via-[#45c387] to-[#7be4b0] bg-clip-text text-transparent">
                  من إدارة الفروع حتى تطور اللاعبين والناشئين
                </span>
              </h1>

              {/* Description */}
              <p className="text-base sm:text-lg text-[#9bb5a8] leading-relaxed max-w-3xl mx-auto">
                منظومة سحابية متقدمة متعددة المستأجرين (Multi-Tenant SaaS) تجمع إدارة الفروع، المجموعات
                التدريبية، الحضور الذكي برمز الاستجابة السريعة (QR)، وذكاء تقييم أداء اللاعبين عبر 4 محاور فنية مع بوابات مخصصة للمدرب، اللاعب، وولي الأمر.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                {user ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={getDashboardHref()}
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] px-6 py-3.5 text-sm font-bold text-[#062016] shadow-xl shadow-[#2f9e6b]/30 hover:brightness-110 active:scale-95 transition-all"
                    >
                      <span>{getDashboardLabel()}</span>
                      <ChevronLeft className="h-4 w-4" />
                    </Link>

                    <Link
                      href="/evaluations"
                      className="flex items-center gap-2 rounded-xl border border-[#2b4c3e] bg-[#162821]/80 px-5 py-3.5 text-sm font-semibold text-[#e8f0ec] hover:border-[#2f9e6b] hover:text-[#45c387] transition-all"
                    >
                      <Trophy className="h-4 w-4" />
                      <span>مركز التقييمات والأداء</span>
                    </Link>
                  </div>
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
                  حالة خادم الـ API والخدمات:{' '}
                  {apiHealth === 'healthy' ? (
                    <strong className="text-[#45c387]">متصل ونشط (NestJS 11 + PostgreSQL RLS + Redis)</strong>
                  ) : apiHealth === 'checking' ? (
                    <strong className="text-amber-400">جارٍ التحقق...</strong>
                  ) : (
                    <strong className="text-rose-400">غير متصل محلياً (منفذ 3001)</strong>
                  )}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 5 Distinct Role Portals Showcase */}
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              5 تجارب متخصصة مصممة لكل فرد في المنظومة
            </h2>
            <p className="mt-2 text-sm text-[#9bb5a8]">
              واجهات عمل متقنة تمنح كل مستخدم الأدوات المناسبة لدوره مع ضمان أقصى درجات الخصوصية وعزل الصلاحيات.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 1. Super Admin Console */}
            <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 flex flex-col justify-between hover:border-[#2f9e6b]/50 transition-all group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    Super Admin
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">وحدة المشرف العام للمنصة</h3>
                <p className="text-xs text-[#9bb5a8] leading-relaxed mb-4">
                  مراقبة جميع الأكاديميات المشتركة عبر المستأجرين، تجميد أو تنشيط الاشتراكات، وسجلات التدقيق والأمان المركزية.
                </p>
                <div className="text-xs text-[#7be4b0] space-y-1">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#45c387]" />
                    <span>مؤشرات أداء شاملة (KPIs) لجميع الأكاديميات</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#45c387]" />
                    <span>تتبع أحداث الأمان وتجميد الحسابات فورياً</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-[#234235]">
                <Link
                  href="/platform"
                  className="flex items-center justify-between text-xs font-bold text-purple-400 hover:text-purple-300 transition-colors"
                >
                  <span>استعراض بوابة المنصة</span>
                  <ChevronLeft className="h-4 w-4 transform group-hover:-translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            {/* 2. Academy Management Workspace */}
            <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 flex flex-col justify-between hover:border-[#2f9e6b]/50 transition-all group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2f9e6b]/20 text-[#45c387]">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#2f9e6b]/10 text-[#45c387] border border-[#2f9e6b]/20">
                    Academy Admin
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">مساحة عمل إدارة الأكاديمية</h3>
                <p className="text-xs text-[#9bb5a8] leading-relaxed mb-4">
                  إدارة شاملة للفروع، الملاعب، المجموعات، المدربين، وقوائم اللاعبين مع تقارير الحضور المالي والتشغيلي.
                </p>
                <div className="text-xs text-[#7be4b0] space-y-1">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#45c387]" />
                    <span>إدارة الفروع والمجموعات وقوائم اللاعبين</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#45c387]" />
                    <span>تقارير حضور دقيقة واستخراج ملفات Excel/PDF</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-[#234235]">
                <Link
                  href="/dashboard"
                  className="flex items-center justify-between text-xs font-bold text-[#45c387] hover:text-[#7be4b0] transition-colors"
                >
                  <span>استعراض لوحة التحكم</span>
                  <ChevronLeft className="h-4 w-4 transform group-hover:-translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            {/* 3. Coach Training Workspace */}
            <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 flex flex-col justify-between hover:border-[#2f9e6b]/50 transition-all group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                    <Users className="h-6 w-6" />
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                    Coach Workspace
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">مساحة تدريب المدربين</h3>
                <p className="text-xs text-[#9bb5a8] leading-relaxed mb-4">
                  جدول تدريبات اليوم، تحضير الحصص بالـ QR، تسجيل تقييمات اللاعبين الفنية وملاحظات التطوير الفردية.
                </p>
                <div className="text-xs text-[#7be4b0] space-y-1">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#45c387]" />
                    <span>تحضير سريع برمز الاستجابة السريعة QR</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#45c387]" />
                    <span>تقييم فوري للاعبين مرتبط بالحصص التدريبية</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-[#234235]">
                <Link
                  href="/coach"
                  className="flex items-center justify-between text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <span>استعراض مساحة المدرب</span>
                  <ChevronLeft className="h-4 w-4 transform group-hover:-translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            {/* 4. Player Portal */}
            <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 flex flex-col justify-between hover:border-[#2f9e6b]/50 transition-all group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                    <Target className="h-6 w-6" />
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    Player Portal
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">بوابة اللاعب الرياضي</h3>
                <p className="text-xs text-[#9bb5a8] leading-relaxed mb-4">
                  متابعة جدول الحصص، بطاقة الحضور برمز QR، استعراض المهارات الفنية، والأهداف الشخصية الموضوعة من المدرب.
                </p>
                <div className="text-xs text-[#7be4b0] space-y-1">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#45c387]" />
                    <span>ملف تطوير المهارات والتقييم الرباعي</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#45c387]" />
                    <span>سجل الحضور والالتزام الفعلي</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-[#234235]">
                <Link
                  href="/player"
                  className="flex items-center justify-between text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <span>استعراض بوابة اللاعب</span>
                  <ChevronLeft className="h-4 w-4 transform group-hover:-translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            {/* 5. Parent / Guardian Portal */}
            <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 flex flex-col justify-between hover:border-[#2f9e6b]/50 transition-all group md:col-span-2 lg:col-span-2">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                    <HeartHandshake className="h-6 w-6" />
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    Guardian Portal
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">بوابة أولياء الأمور</h3>
                <p className="text-xs text-[#9bb5a8] leading-relaxed mb-4">
                  لوحة واحدة تتيح لولي الأمر متابعة جميع أبنائه المسجلين بالأكاديمية بكل شفافية: نسبة الحضور الدقيقة، تقييمات الأداء والتقارير الفنية المعتمدة، والتغذية الراجعة التوجيهية مع ربط الحسابات عبر رمز المطالبة (Claim Code).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#7be4b0]">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#45c387]" />
                    <span>مبدل سلس بين ملفات الأبناء في حساب واحد</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#45c387]" />
                    <span>إشعارات الحضور والغياب مع توضيحات المدربين</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#45c387]" />
                    <span>حماية تامة للملاحظات التدريبية السرية الخاصة بالمدرب</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#45c387]" />
                    <span>ربط آمن عبر رمز المطالبة (Claim Code) السري</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-[#234235]">
                <Link
                  href="/guardian"
                  className="flex items-center justify-between text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <span>استعراض بوابة أولياء الأمور</span>
                  <ChevronLeft className="h-4 w-4 transform group-hover:-translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Player Performance Intelligence Spotlight */}
        <section className="border-y border-[#234235] bg-[#12211b]/60 py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-400 mb-4">
                  <Award className="h-3.5 w-3.5" />
                  <span>ذكاء تقييم أداء اللاعبين والمواهب</span>
                </div>
                <h2 className="text-3xl font-extrabold text-white leading-tight">
                  نظام التقييم الرباعي الشامل <br />
                  <span className="text-[#45c387]">وفقاً لأحدث معايير الأكاديميات الدولية</span>
                </h2>
                <p className="mt-4 text-sm text-[#9bb5a8] leading-relaxed">
                  ودّع التقييمات العشوائية وغير المنصفة. توفر المنصة محاور تقييم معيارية قابلة للتخصيص بحسب الفئة السنية، مع حساب رياضي عادل للمعدل الإجمالي وترتيب تنافسي موثوق.
                </p>

                <div className="mt-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-[#2f9e6b]/20 text-[#45c387] shrink-0 mt-0.5">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">المحاور الأربعة المتوازنة</h4>
                      <p className="text-xs text-[#9bb5a8] mt-0.5">
                        فني (التحكم والتمرير)، تكتيكي (التمركز وقراءة اللعب)، بدني (السرعة والتحمل)، وسلوكي (الانضباط والروح الرياضية).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 shrink-0 mt-0.5">
                      <Trophy className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">ترتيب عادل حسب الفئة العمرية</h4>
                      <p className="text-xs text-[#9bb5a8] mt-0.5">
                        مقارنة عادلة بين أقران الفئة العمرية الواحدة (مثل U-11 أو U-13) مع توثيق معادلة الحساب بوضوح تام دون تحيز.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                      <Lock className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">مستويات خصوصية صارمة</h4>
                      <p className="text-xs text-[#9bb5a8] mt-0.5">
                        ملاحظات المدرب الداخلية تظل سرية ومقتصرة على الطاقم الفني، بينما تصل التوجيهات التطويرية لولي الأمر واللاعب.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <Link
                    href="/evaluations"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#2f9e6b] px-6 py-3 text-sm font-bold text-[#062016] shadow-lg shadow-[#2f9e6b]/20 hover:brightness-110 transition-all"
                  >
                    <span>استعراض لوحة التقييمات وقائمة الأفضل</span>
                    <ChevronLeft className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              {/* Interactive Radar Visual Card */}
              <div className="rounded-2xl border border-[#234235] bg-[#162821] p-6 shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between pb-4 border-b border-[#234235]">
                  <div>
                    <span className="text-xs font-semibold text-[#45c387]">نموذج تقرير اللاعب</span>
                    <h3 className="text-lg font-bold text-white">عمر فهد الغامدي (فئة U-11)</h3>
                  </div>
                  <div className="text-left">
                    <span className="text-xs text-[#9bb5a8]">التقييم العام</span>
                    <div className="text-2xl font-black text-[#45c387]">8.6 / 10</div>
                  </div>
                </div>

                {/* 4 Pillars Progress Visual */}
                <div className="mt-6 space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-emerald-400">المحور الفني (Technical)</span>
                      <span className="text-white">8.8 / 10</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#0f1c18] overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: '88%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-blue-400">المحور التكتيكي (Tactical)</span>
                      <span className="text-white">8.2 / 10</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#0f1c18] overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: '82%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-amber-400">المحور البدني (Physical)</span>
                      <span className="text-white">8.5 / 10</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#0f1c18] overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: '85%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-purple-400">المحور السلوكي (Behavioral)</span>
                      <span className="text-white">9.0 / 10</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#0f1c18] overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: '90%' }} />
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#234235] bg-[#0f1c18]/60 p-4 rounded-xl">
                  <div className="text-xs font-bold text-[#45c387] mb-1">ملاحظة المدرب الموجهة لولي الأمر:</div>
                  <p className="text-xs text-[#9bb5a8] leading-relaxed">
                    &quot;عمر يظهر شغفاً كبيراً ودقة متميزة في التمرير القصير. نركز في الأسابيع القادمة على تقوية التسديد بالقدم اليسرى والتمركز السليم عند التحول الدفاعي.&quot;
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Specialized 5-Role Experiences Section */}
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-[var(--border-app)] bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg-base)] p-8 shadow-2xl">
            <div className="text-center max-w-2xl mx-auto mb-8">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
                تجارب استخدام مستقلة ومتخصصة
              </span>
              <h2 className="text-2xl font-bold text-[var(--text-main)] mt-1">
                منظومة أدوار شاملة مصممة لكل مستخدم
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-2">
                تخصيص كامل للصلاحيات وواجهات الاستخدام وفق أعلى معايير أمن البيانات والعزل التام:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Persona 1: Platform Super Admin */}
              <div className="rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] p-4 text-center flex flex-col justify-between hover:border-amber-500/50 transition-all">
                <div>
                  <div className="text-xs font-bold text-amber-400 mb-1">مشرف المنصة</div>
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                    مراقبة صحة النظام، إدارة اشتراكات الأكاديميات، وسجلات الامتثال والتدقيق الأمني.
                  </p>
                </div>
                <Link
                  href="/login"
                  className="mt-4 block text-center text-xs font-semibold text-amber-400 hover:underline"
                >
                  دخول المشرف &larr;
                </Link>
              </div>

              {/* Persona 2: Academy Owner */}
              <div className="rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] p-4 text-center flex flex-col justify-between hover:border-emerald-500/50 transition-all">
                <div>
                  <div className="text-xs font-bold text-emerald-400 mb-1">مالك الأكاديمية</div>
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                    إدارة الفروع، تسجيل اللاعبين، تعيين الطواقم الفنية، والتحكم بالرسوم والاشتراكات.
                  </p>
                </div>
                <Link
                  href="/login"
                  className="mt-4 block text-center text-xs font-semibold text-emerald-400 hover:underline"
                >
                  لوحة الأكاديمية &larr;
                </Link>
              </div>

              {/* Persona 3: Coach */}
              <div className="rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] p-4 text-center flex flex-col justify-between hover:border-blue-500/50 transition-all">
                <div>
                  <div className="text-xs font-bold text-blue-400 mb-1">مدرب معتمد</div>
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                    جدول الحصص التدريبية، التحضير السريع بمسح QR، وتقييم وتطوير مهارات اللاعبين.
                  </p>
                </div>
                <Link
                  href="/login"
                  className="mt-4 block text-center text-xs font-semibold text-blue-400 hover:underline"
                >
                  مساحة المدرب &larr;
                </Link>
              </div>

              {/* Persona 4: Player */}
              <div className="rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] p-4 text-center flex flex-col justify-between hover:border-sky-500/50 transition-all">
                <div>
                  <div className="text-xs font-bold text-sky-400 mb-1">اللاعب</div>
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                    بطاقة العضوية الرقمية (QR)، تتبع سجل الحضور، والاطلاع على التقييمات الفنية.
                  </p>
                </div>
                <Link
                  href="/login"
                  className="mt-4 block text-center text-xs font-semibold text-sky-400 hover:underline"
                >
                  بوابة اللاعب &larr;
                </Link>
              </div>

              {/* Persona 5: Guardian */}
              <div className="rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] p-4 text-center flex flex-col justify-between hover:border-purple-500/50 transition-all">
                <div>
                  <div className="text-xs font-bold text-purple-400 mb-1">ولي الأمر</div>
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                    متابعة حضور الأبناء، تقارير التطور البدني والمهاري، وملاحظات الجهاز التدريبي.
                  </p>
                </div>
                <Link
                  href="/login"
                  className="mt-4 block text-center text-xs font-semibold text-purple-400 hover:underline"
                >
                  بوابة ولي الأمر &larr;
                </Link>
              </div>
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
            <Link href="/evaluations" className="hover:text-white transition-colors">
              التقييمات والأداء
            </Link>
            <a
              href="http://localhost:3001/v1/health"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors flex items-center gap-1"
            >
              <span>فحص الـ API</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
