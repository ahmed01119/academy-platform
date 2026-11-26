'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { SportexusLogo } from '@/components/brand/SportexusLogo';
import { useAuth } from '@/contexts/auth-context';
import { useLocale } from '@/contexts/locale-context';
import {
  Building2,
  Trophy,
  Sparkles,
  Lock,
  ChevronLeft,
  ChevronRight,
  Users,
  ShieldCheck,
  Award,
  HeartHandshake,
  CheckCircle2,
  QrCode,
  DollarSign,
  CalendarCheck,
  HelpCircle,
  ChevronDown,
  Zap,
  UserPlus,
} from 'lucide-react';
import { PlayerJoinRequestModal } from '@/features/landing/components/PlayerJoinRequestModal';

export default function HomePage() {
  const { user, activeTenant } = useAuth();
  const { t, locale, isRtl } = useLocale();
  const [activePreviewTab, setActivePreviewTab] = useState<
    'attendance' | 'evaluations' | 'portals' | 'finance'
  >('attendance');

  // Player Join Request Modal State (mirrors Enroll New Player form)
  const [isPlayerJoinModalOpen, setIsPlayerJoinModalOpen] = useState(false);
  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const getDashboardHref = () => {
    if (!user) return '/dashboard';
    if (user.isPlatformSuperAdmin) return '/platform';
    if (activeTenant?.role === 'COACH') return '/coach';
    if (user.hasPlayerProfile) return '/player';
    if (user.hasGuardianProfile) return '/guardian';
    return '/dashboard';
  };

  const getDashboardLabel = () => {
    if (!user) return t('landing.dashboardCta');
    if (user.isPlatformSuperAdmin) return t('nav.platformAdmin');
    if (activeTenant?.role === 'COACH') return t('nav.coachWorkspace');
    if (user.hasPlayerProfile) return t('nav.playerPortal');
    if (user.hasGuardianProfile) return t('nav.guardianPortal');
    return t('nav.dashboard');
  };

  // Two separate entry points: a player applies for themself, a guardian registers a child.
  const [joinRequesterType, setJoinRequesterType] = useState<'PLAYER' | 'GUARDIAN'>('PLAYER');
  const openJoinAsPlayer = () => {
    setJoinRequesterType('PLAYER');
    setIsPlayerJoinModalOpen(true);
  };
  const openJoinAsGuardian = () => {
    setJoinRequesterType('GUARDIAN');
    setIsPlayerJoinModalOpen(true);
  };

  const ChevronIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div className="min-h-screen bg-(--bg-base) text-(--text-main) flex flex-col transition-colors">
      <Navbar />

      <main className="flex-1 animate-fade-in">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 border-b border-(--border-subtle)">
          {/* Ambient Glowing Spheres */}
          <div className="absolute top-1/4 -right-20 h-96 w-96 rounded-full bg-[var(--ambient-glow-1)] blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 -left-20 h-96 w-96 rounded-full bg-[var(--ambient-glow-2)] blur-3xl pointer-events-none" />

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-4xl mx-auto space-y-6">
              {/* Sportexus Grand Brand Presentation */}
              <div className="flex justify-center pb-2">
                <SportexusLogo size="xl" showTagline />
              </div>

              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-(--border-app) bg-(--bg-surface-subtle) px-4 py-1.5 text-xs font-semibold text-[var(--accent-primary)] shadow-sm backdrop-blur-md">
                <Sparkles className="h-4 w-4 shrink-0" />
                <span>{t('landing.badge')}</span>
              </div>

              {/* Title */}
              <h1 className="text-3xl xs:text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-(--text-main) leading-tight">
                {t('landing.heroTitlePrefix')} <br />
                <span className="bg-gradient-to-r from-[var(--accent-primary)] via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  {t('landing.heroTitleSuffix')}
                </span>
              </h1>

              {/* Description */}
              <p className="text-base sm:text-lg text-(--text-muted) leading-relaxed max-w-3xl mx-auto">
                {t('landing.heroDesc')}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                {user ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={getDashboardHref()}
                      className="flex items-center gap-2 rounded-xl bg-(--accent-primary) px-6 py-3.5 text-sm font-bold text-(--accent-primary-fg) shadow-float hover:opacity-90 active:scale-95 transition-all"
                    >
                      <span>{getDashboardLabel()}</span>
                      <ChevronIcon className="h-4 w-4" />
                    </Link>

                    <Link
                      href="/evaluations"
                      className="flex items-center gap-2 rounded-xl border border-(--border-app) bg-[var(--bg-surface)] px-5 py-3.5 text-sm font-semibold text-(--text-main) hover:border-[var(--accent-primary)] hover:text-(--accent-primary) transition-all shadow-sm"
                    >
                      <Trophy className="h-4 w-4 text-[var(--accent-primary)]" />
                      <span>{t('nav.evaluations')}</span>
                    </Link>
                  </div>
                ) : (
                  <>
                    <Link
                      href="/register"
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0A3BFF] to-[#00D6FF] px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-blue-600/25 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>{locale === 'ar' ? 'تسجيل أكاديمية جديدة' : 'Register Academy'}</span>
                      <ChevronIcon className="h-4 w-4" />
                    </Link>

                    <button
                      type="button"
                      onClick={openJoinAsPlayer}
                      className="flex items-center gap-2 rounded-xl border border-(--border-app) bg-[var(--bg-surface)] px-5 py-3.5 text-sm font-semibold text-(--text-main) hover:border-[var(--accent-primary)] hover:text-(--accent-primary) transition-all shadow-sm cursor-pointer"
                    >
                      <UserPlus className="h-4 w-4 text-[var(--accent-primary)]" />
                      <span>{locale === 'ar' ? 'انضمام كلاعب' : 'Join as a player'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={openJoinAsGuardian}
                      className="flex items-center gap-2 rounded-xl border border-(--border-app) bg-[var(--bg-surface)] px-5 py-3.5 text-sm font-semibold text-(--text-main) hover:border-[var(--accent-primary)] hover:text-(--accent-primary) transition-all shadow-sm cursor-pointer"
                    >
                      <Users className="h-4 w-4 text-[var(--accent-primary)]" />
                      <span>
                        {locale === 'ar'
                          ? 'تسجيل ابني / ابنتي (ولي أمر)'
                          : 'Register my child (guardian)'}
                      </span>
                    </button>

                    <Link
                      href="/login"
                      className="flex items-center gap-2 rounded-xl border border-transparent px-5 py-3.5 text-sm font-semibold text-(--text-muted) hover:text-(--text-main) transition-colors"
                    >
                      <span>{t('landing.loginCta')}</span>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Feature Previews Showcase */}
        <section className="py-16 sm:py-24 bg-(--bg-surface-subtle) border-b border-(--border-subtle)">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="text-center max-w-3xl mx-auto space-y-3">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-(--text-main)">
                {t('landing.featuresTitle')}
              </h2>
              <p className="text-sm sm:text-base text-(--text-muted)">
                {t('landing.featuresDesc')}
              </p>
            </div>

            {/* Preview Navigation Tabs */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setActivePreviewTab('attendance')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  activePreviewTab === 'attendance'
                    ? 'bg-(--accent-primary) text-(--accent-primary-fg) font-bold shadow-sm'
                    : 'bg-[var(--bg-surface)] text-(--text-main) border border-(--border-app) hover:border-[var(--accent-primary)]'
                }`}
              >
                <QrCode className="h-4 w-4" />
                <span>{t('landing.featureAttendance')}</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePreviewTab('evaluations')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  activePreviewTab === 'evaluations'
                    ? 'bg-(--accent-primary) text-(--accent-primary-fg) font-bold shadow-sm'
                    : 'bg-[var(--bg-surface)] text-(--text-main) border border-(--border-app) hover:border-[var(--accent-primary)]'
                }`}
              >
                <Award className="h-4 w-4" />
                <span>{t('landing.radarSectionBadge')}</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePreviewTab('finance')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  activePreviewTab === 'finance'
                    ? 'bg-(--accent-primary) text-(--accent-primary-fg) font-bold shadow-sm'
                    : 'bg-[var(--bg-surface)] text-(--text-main) border border-(--border-app) hover:border-[var(--accent-primary)]'
                }`}
              >
                <DollarSign className="h-4 w-4" />
                <span>{t('landing.featureFinance')}</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePreviewTab('portals')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  activePreviewTab === 'portals'
                    ? 'bg-(--accent-primary) text-(--accent-primary-fg) font-bold shadow-sm'
                    : 'bg-[var(--bg-surface)] text-(--text-main) border border-(--border-app) hover:border-[var(--accent-primary)]'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>{t('landing.rolesSectionTitle')}</span>
              </button>
            </div>

            {/* Interactive Preview Canvas */}
            <div className="rounded-3xl border border-(--border-app) bg-[var(--bg-surface)] p-6 sm:p-10 shadow-xl overflow-hidden relative">
              {activePreviewTab === 'attendance' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div className="space-y-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)] bg-(--badge-bg) px-3 py-1 rounded-full border border-(--badge-border)">
                      <Zap className="h-3.5 w-3.5" />
                      {t('landing.featureAttendance')}
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-bold text-(--text-main)">
                      {locale === 'ar'
                        ? 'التحضير السريع بالباركود ومزامنة عدم الاتصال'
                        : 'Instant QR Camera Check-in & Offline Sync'}
                    </h3>
                    <p className="text-sm text-(--text-muted) leading-relaxed">
                      {t('landing.featureAttendanceDesc')}
                    </p>
                    <ul className="space-y-2.5 text-xs sm:text-sm text-(--text-main)">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-[var(--accent-primary)] shrink-0" />
                        <span>
                          {locale === 'ar'
                            ? 'ماسح كاميرا مستمر بمعدل استجابة أقل من 50ms'
                            : 'Continuous video stream scanning under 50ms'}
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-[var(--accent-primary)] shrink-0" />
                        <span>
                          {locale === 'ar'
                            ? 'بطاقة عضوية رقمية للاعبين مع رمز QR مشفر للتجديد'
                            : 'Digital membership player cards with rotatable tokens'}
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-[var(--accent-primary)] shrink-0" />
                        <span>
                          {locale === 'ar'
                            ? 'حساب تأخير الحضور بدقة بتوقيت القاهرة مع فترة سماح قابلة للضبط'
                            : 'Authoritative Cairo lateness calculations with grace periods'}
                        </span>
                      </li>
                    </ul>
                  </div>

                  {/* Mock Visual UI */}
                  <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-base) p-5 space-y-4 shadow-inner">
                    <div className="flex items-center justify-between border-b border-(--border-subtle) pb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-emerald-500 animate-ping" />
                        <span className="text-xs font-bold text-(--text-main)">
                          {locale === 'ar' ? 'الماسح الميداني النشط' : 'Active Field Scanner'}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {locale === 'ar' ? 'وضع عدم الاتصال جاهز' : 'Offline Engine Ready'}
                      </span>
                    </div>

                    <div className="h-44 rounded-xl border border-dashed border-(--border-app) flex flex-col items-center justify-center gap-2 bg-[var(--bg-surface)] text-center p-4">
                      <QrCode className="h-12 w-12 text-[var(--accent-primary)]" />
                      <p className="text-xs text-(--text-muted)">
                        {locale === 'ar'
                          ? 'وجه كاميرا الهاتف إلى بطاقة اللاعب للتسجيل الفوري'
                          : 'Point camera at player QR card for instant verification'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-(--text-muted) pt-1">
                      <span>
                        {locale === 'ar' ? 'الحصة التدريبية: فريق U-14' : 'Session: U-14 Squad'}
                      </span>
                      <span className="font-bold text-[var(--accent-primary)]">
                        {locale === 'ar' ? 'تم الحضور: 18 / 20' : 'Attended: 18 / 20'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activePreviewTab === 'evaluations' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div className="space-y-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)] bg-(--badge-bg) px-3 py-1 rounded-full border border-(--badge-border)">
                      <Trophy className="h-3.5 w-3.5" />
                      {t('landing.radarSectionBadge')}
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-bold text-(--text-main)">
                      {t('landing.radarSectionTitle')}
                    </h3>
                    <p className="text-sm text-(--text-muted) leading-relaxed">
                      {t('landing.radarSectionDesc')}
                    </p>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="rounded-xl border border-(--border-subtle) bg-(--bg-base) p-3">
                        <div className="text-xs font-bold text-emerald-500">
                          {t('landing.pillarTechnical')}
                        </div>
                        <div className="text-[11px] text-(--text-muted) mt-1">
                          {locale === 'ar'
                            ? 'التمرير، المراوغة، التسديد والتمركز'
                            : 'Passing, dribbling, shooting & control'}
                        </div>
                      </div>
                      <div className="rounded-xl border border-(--border-subtle) bg-(--bg-base) p-3">
                        <div className="text-xs font-bold text-blue-500">
                          {t('landing.pillarTactical')}
                        </div>
                        <div className="text-[11px] text-(--text-muted) mt-1">
                          {locale === 'ar'
                            ? 'رؤية الملعب وسرعة اتخاذ القرار'
                            : 'Vision, game awareness & decisions'}
                        </div>
                      </div>
                      <div className="rounded-xl border border-(--border-subtle) bg-(--bg-base) p-3">
                        <div className="text-xs font-bold text-amber-500">
                          {t('landing.pillarPhysical')}
                        </div>
                        <div className="text-[11px] text-(--text-muted) mt-1">
                          {locale === 'ar'
                            ? 'السرعة، الرشاقة واللياقة الهوائية'
                            : 'Speed, agility, strength & stamina'}
                        </div>
                      </div>
                      <div className="rounded-xl border border-(--border-subtle) bg-(--bg-base) p-3">
                        <div className="text-xs font-bold text-purple-500">
                          {t('landing.pillarBehavioral')}
                        </div>
                        <div className="text-[11px] text-(--text-muted) mt-1">
                          {locale === 'ar'
                            ? 'الانضباط والروح الجماعية والشغف'
                            : 'Discipline, leadership & teamwork'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Radar Mock */}
                  <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-base) p-6 space-y-4 shadow-inner">
                    <div className="flex items-center justify-between border-b border-(--border-subtle) pb-3">
                      <div>
                        <div className="text-sm font-bold text-(--text-main)">
                          {locale === 'ar'
                            ? 'الملف الرياضي: عمر الغامدي'
                            : 'Development Profile: Omar Al-Ghamdi'}
                        </div>
                        <div className="text-xs text-(--text-muted)">
                          {locale === 'ar'
                            ? 'الفئة: ناشئين U-13 • مركز: وسط هجومي'
                            : 'Category: Youth U-13 • Attacking Midfielder'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-extrabold text-[var(--accent-primary)]">
                          <span dir="ltr">8.75 / 10</span>
                        </div>
                        <div className="text-[10px] text-emerald-500 font-bold">
                          {locale === 'ar' ? 'المركز 1 في الفئة' : 'Rank #1 in Age Tier'}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>{t('landing.pillarTechnical')}</span>
                          <span className="font-bold">8.5</span>
                        </div>
                        <div className="h-2 rounded-full bg-(--bg-surface-subtle) overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full w-[85%]" />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>{t('landing.pillarTactical')}</span>
                          <span className="font-bold">8.8</span>
                        </div>
                        <div className="h-2 rounded-full bg-(--bg-surface-subtle) overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full w-[88%]" />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>{t('landing.pillarPhysical')}</span>
                          <span className="font-bold">8.2</span>
                        </div>
                        <div className="h-2 rounded-full bg-(--bg-surface-subtle) overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full w-[82%]" />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>{t('landing.pillarBehavioral')}</span>
                          <span className="font-bold">9.5</span>
                        </div>
                        <div className="h-2 rounded-full bg-(--bg-surface-subtle) overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full w-[95%]" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activePreviewTab === 'finance' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div className="space-y-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)] bg-(--badge-bg) px-3 py-1 rounded-full border border-(--badge-border)">
                      <DollarSign className="h-3.5 w-3.5" />
                      {t('landing.featureFinance')}
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-bold text-(--text-main)">
                      {locale === 'ar'
                        ? 'إدارة التحصيلات وتسوية الصناديق اليومية'
                        : 'Session Cashier Reconciliation & Player Subscriptions'}
                    </h3>
                    <p className="text-sm text-(--text-muted) leading-relaxed">
                      {t('landing.featureFinanceDesc')}
                    </p>
                    <ul className="space-y-2.5 text-xs sm:text-sm text-(--text-main)">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-[var(--accent-primary)] shrink-0" />
                        <span>
                          {locale === 'ar'
                            ? 'عرض حالة السداد والمبالغ المستحقة فورياً أثناء التحضير'
                            : 'View live payment balance directly beside attendance scanner'}
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-[var(--accent-primary)] shrink-0" />
                        <span>
                          {locale === 'ar'
                            ? 'تسوية صندوق الحصة التدريبية (نقدية، تحويلات، مصروفات)'
                            : 'Full session cashier closing (cash, bank transfers, expenses)'}
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-[var(--accent-primary)] shrink-0" />
                        <span>
                          {locale === 'ar'
                            ? 'إيصالات دفع فورية وتتبع تفصيلي للأرصدة المتأخرة'
                            : 'Instant receipts and authoritative overdue receivables tracking'}
                        </span>
                      </li>
                    </ul>
                  </div>

                  {/* Cashier Mock */}
                  <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-base) p-5 space-y-4 shadow-inner">
                    <div className="flex items-center justify-between border-b border-(--border-subtle) pb-3">
                      <div>
                        <div className="text-xs font-bold text-(--text-main)">
                          {locale === 'ar'
                            ? 'تسوية صندوق الحصة #S-104'
                            : 'Session Cashier Closing #S-104'}
                        </div>
                        <div className="text-[11px] text-(--text-muted)">
                          {locale === 'ar'
                            ? 'الفرع: النادي الرئيسي • المدرب المسؤول: كابتن أحمد'
                            : 'Main Branch • Coach: Capt. Ahmed'}
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {locale === 'ar' ? 'تمت المطابقة' : 'Reconciled'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] p-3 text-center">
                        <div className="text-[10px] text-(--text-muted)">
                          {locale === 'ar' ? 'تحصيلات كاش' : 'Cash Collected'}
                        </div>
                        <div className="text-sm font-extrabold text-[var(--accent-primary)] mt-1">
                          {locale === 'ar' ? '1,800 ج.م' : '1,800 EGP'}
                        </div>
                      </div>
                      <div className="rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] p-3 text-center">
                        <div className="text-[10px] text-(--text-muted)">
                          {locale === 'ar' ? 'تحويل إلكتروني' : 'Electronic'}
                        </div>
                        <div className="text-sm font-extrabold text-blue-500 mt-1">
                          {locale === 'ar' ? '2,400 ج.م' : '2,400 EGP'}
                        </div>
                      </div>
                      <div className="rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] p-3 text-center">
                        <div className="text-[10px] text-(--text-muted)">
                          {locale === 'ar' ? 'صافي الحصة' : 'Net Cash'}
                        </div>
                        <div className="text-sm font-extrabold text-emerald-500 mt-1">
                          {locale === 'ar' ? '4,200 ج.م' : '4,200 EGP'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activePreviewTab === 'portals' && (
                <div className="space-y-6">
                  <div className="text-center max-w-2xl mx-auto space-y-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)] bg-(--badge-bg) px-3 py-1 rounded-full border border-(--badge-border)">
                      <Users className="h-3.5 w-3.5" />
                      {t('landing.rolesSectionTitle')}
                    </span>
                    <h3 className="text-2xl font-bold text-(--text-main)">
                      {t('landing.rolesSectionDesc')}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-base) p-4 space-y-2">
                      <div className="flex items-center gap-2 text-purple-500 font-bold text-sm">
                        <ShieldCheck className="h-4 w-4" />
                        <span>{t('landing.roleSuperAdminTitle')}</span>
                      </div>
                      <p className="text-xs text-(--text-muted) leading-relaxed">
                        {t('landing.roleSuperAdminDesc')}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-base) p-4 space-y-2">
                      <div className="flex items-center gap-2 text-[var(--accent-primary)] font-bold text-sm">
                        <Building2 className="h-4 w-4" />
                        <span>{t('landing.roleAcademyTitle')}</span>
                      </div>
                      <p className="text-xs text-(--text-muted) leading-relaxed">
                        {t('landing.roleAcademyDesc')}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-base) p-4 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-500 font-bold text-sm">
                        <CalendarCheck className="h-4 w-4" />
                        <span>{t('landing.roleCoachTitle')}</span>
                      </div>
                      <p className="text-xs text-(--text-muted) leading-relaxed">
                        {t('landing.roleCoachDesc')}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-base) p-4 space-y-2">
                      <div className="flex items-center gap-2 text-blue-500 font-bold text-sm">
                        <Trophy className="h-4 w-4" />
                        <span>{t('landing.rolePlayerTitle')}</span>
                      </div>
                      <p className="text-xs text-(--text-muted) leading-relaxed">
                        {t('landing.rolePlayerDesc')}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-base) p-4 space-y-2">
                      <div className="flex items-center gap-2 text-rose-500 font-bold text-sm">
                        <HeartHandshake className="h-4 w-4" />
                        <span>{t('landing.roleGuardianTitle')}</span>
                      </div>
                      <p className="text-xs text-(--text-muted) leading-relaxed">
                        {t('landing.roleGuardianDesc')}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-base) p-4 space-y-2">
                      <div className="flex items-center gap-2 text-amber-500 font-bold text-sm">
                        <Lock className="h-4 w-4" />
                        <span>{t('landing.featureSecurity')}</span>
                      </div>
                      <p className="text-xs text-(--text-muted) leading-relaxed">
                        {t('landing.featureSecurityDesc')}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Unified Academy Registration CTA Section */}
        <section
          id="academy-application"
          className="py-16 sm:py-24 bg-[var(--bg-surface)] border-b border-(--border-subtle)"
        >
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-(--border-subtle) bg-linear-to-br from-[var(--bg-surface-elevated)] via-[var(--bg-surface)] to-[var(--bg-surface-subtle)] p-8 sm:p-12 shadow-xl relative overflow-hidden text-center space-y-6">
              <div className="absolute -top-20 -right-20 h-52 w-52 rounded-full bg-[var(--accent-primary)]/10 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 h-52 w-52 rounded-full bg-[var(--accent-secondary)]/10 blur-3xl pointer-events-none" />

              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 px-4 py-1.5 text-xs font-bold text-[var(--accent-primary)]">
                <Building2 className="h-4 w-4" />
                <span>{locale === 'ar' ? 'انضم إلى شبكة سبورتكسس' : 'Join Sportexus Network'}</span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-extrabold text-[var(--text-main)] tracking-tight">
                {locale === 'ar'
                  ? 'جاهز لنقل أكاديميتك الرياضية إلى المستوى الاحترافي؟'
                  : 'Ready to Elevate Your Sports Academy?'}
              </h2>

              <p className="text-sm sm:text-base text-[var(--text-muted)] max-w-2xl mx-auto leading-relaxed">
                {locale === 'ar'
                  ? 'سجّل أكاديميتك الآن عبر بوابة التسجيل الموحدة. يقوم فريق إدارة المنصة بمراجعة الطلبات واعتماد بيئة العمل السحابية المعزولة وتفعيل حساب المالك فوراً.'
                  : 'Register your academy now through our unified onboarding portal. Our platform administrators review applications and activate your isolated multi-tenant workspace.'}
              </p>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/register"
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0A3BFF] via-[#0077FF] to-[#00D6FF] px-8 py-4 text-base font-bold text-white shadow-xl shadow-blue-600/30 hover:brightness-110 active:scale-95 transition-all"
                >
                  <Sparkles className="h-5 w-5" />
                  <span>
                    {locale === 'ar' ? 'ابدأ تسجيل الأكاديمية الآن' : 'Register Academy Now'}
                  </span>
                  <ChevronIcon className="h-5 w-5" />
                </Link>
                <button
                  type="button"
                  onClick={openJoinAsPlayer}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] px-6 py-4 text-sm font-semibold text-[var(--text-main)] hover:border-[var(--accent-primary)] hover:text-(--accent-primary) transition-all cursor-pointer shadow-xs"
                >
                  <UserPlus className="h-4 w-4 text-[var(--accent-primary)]" />
                  <span>{locale === 'ar' ? 'انضمام كلاعب' : 'Join as a player'}</span>
                </button>
                <button
                  type="button"
                  onClick={openJoinAsGuardian}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-(--border-subtle) bg-[var(--bg-surface)] px-6 py-4 text-sm font-semibold text-[var(--text-main)] hover:border-[var(--accent-primary)] hover:text-(--accent-primary) transition-all cursor-pointer shadow-xs"
                >
                  <Users className="h-4 w-4 text-[var(--accent-primary)]" />
                  <span>
                    {locale === 'ar'
                      ? 'تسجيل ابني / ابنتي (ولي أمر)'
                      : 'Register my child (guardian)'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section
          id="faq"
          className="py-20 bg-(--bg-surface-subtle) border-b border-(--border-subtle)"
        >
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="text-center space-y-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)] bg-(--badge-bg) px-3 py-1 rounded-full border border-(--badge-border)">
                <HelpCircle className="h-3.5 w-3.5" />
                <span>{t('landing.faqTitle')}</span>
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-(--text-main)">
                {t('landing.faqDesc')}
              </h2>
            </div>

            <div className="space-y-3">
              {[
                { q: t('landing.faq1Q'), a: t('landing.faq1A') },
                { q: t('landing.faq2Q'), a: t('landing.faq2A') },
                { q: t('landing.faq3Q'), a: t('landing.faq3A') },
                { q: t('landing.faq4Q'), a: t('landing.faq4A') },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-(--border-app) bg-[var(--bg-surface)] overflow-hidden transition-all shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full flex items-center justify-between p-5 text-start font-bold text-sm sm:text-base text-(--text-main) hover:text-(--accent-primary) transition-colors"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 text-(--text-muted) shrink-0 transition-transform ${
                        openFaq === idx ? 'rotate-180 text-[var(--accent-primary)]' : ''
                      }`}
                    />
                  </button>
                  {openFaq === idx && (
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-(--text-muted) leading-relaxed border-t border-(--border-subtle)">
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-(--border-app) bg-[var(--bg-surface)] py-10 transition-colors">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-(--text-muted)">
          <div className="flex items-center gap-2 font-bold text-(--text-main)">
            <ShieldCheck className="h-5 w-5 text-[var(--accent-primary)]" />
            <span>
              {t('common.academyPlatform')} &copy; {new Date().getFullYear()}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-emerald-500 font-semibold">
              <Lock className="h-3.5 w-3.5" />
              <span>Multi-Tenant RLS Protected</span>
            </span>
            <span>•</span>
            <a href="#academy-application" className="hover:text-(--text-main) transition-colors">
              {locale === 'ar' ? 'تسجيل أكاديمية' : 'Apply for Academy'}
            </a>
            <span>•</span>
            <button
              type="button"
              onClick={openJoinAsPlayer}
              className="hover:text-(--text-main) transition-colors cursor-pointer"
            >
              {locale === 'ar' ? 'انضمام كلاعب' : 'Join as a player'}
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={openJoinAsGuardian}
              className="hover:text-(--text-main) transition-colors cursor-pointer"
            >
              {locale === 'ar' ? 'تسجيل ولي أمر' : 'Register as a guardian'}
            </button>
            <span>•</span>
            <Link href="/login" className="hover:text-(--text-main) transition-colors">
              {t('common.login')}
            </Link>
          </div>
        </div>
      </footer>

      {/* Player Join Request Modal (matches Enroll New Player design) */}
      <PlayerJoinRequestModal
        isOpen={isPlayerJoinModalOpen}
        onClose={() => setIsPlayerJoinModalOpen(false)}
        defaultRequesterType={joinRequesterType}
      />
    </div>
  );
}
