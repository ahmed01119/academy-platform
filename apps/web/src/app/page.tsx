'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../lib/auth-context';
import { useLocale } from '../lib/locale-context';
import {
  Building2,
  Trophy,
  Sparkles,
  Lock,
  Activity,
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
  Send,
  HelpCircle,
  ChevronDown,
  Zap,
} from 'lucide-react';

export default function HomePage() {
  const { user, activeTenant } = useAuth();
  const { t, locale, isRtl } = useLocale();
  const [apiHealth, setApiHealth] = useState<'checking' | 'healthy' | 'offline'>('checking');
  const [activePreviewTab, setActivePreviewTab] = useState<'attendance' | 'evaluations' | 'portals' | 'finance'>('attendance');

  // Demo Request Form State
  const [demoAcademyName, setDemoAcademyName] = useState('');
  const [demoSport, setDemoSport] = useState('FOOTBALL');
  const [demoCity, setDemoCity] = useState('');
  const [demoContactName, setDemoContactName] = useState('');
  const [demoEmail, setDemoEmail] = useState('');
  const [demoPhone, setDemoPhone] = useState('');
  const [demoPlayersCount, setDemoPlayersCount] = useState('100-300');
  const [isSubmittingDemo, setIsSubmittingDemo] = useState(false);
  const [demoSubmitted, setDemoSubmitted] = useState(false);

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

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
    if (!user) return t('landing.dashboardCta');
    if (user.isPlatformSuperAdmin) return t('nav.platformAdmin');
    if (activeTenant?.role === 'COACH') return t('nav.coachWorkspace');
    if (user.hasPlayerProfile) return t('nav.playerPortal');
    if (user.hasGuardianProfile) return t('nav.guardianPortal');
    return t('nav.dashboard');
  };

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingDemo(true);
    // Simulate API request dispatch
    setTimeout(() => {
      setIsSubmittingDemo(false);
      setDemoSubmitted(true);
    }, 800);
  };

  const ChevronIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-main)] flex flex-col transition-colors">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 border-b border-[var(--border-subtle)]">
          {/* Ambient Glowing Spheres */}
          <div className="absolute top-1/4 -right-20 h-96 w-96 rounded-full bg-[var(--ambient-glow-1)] blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 -left-20 h-96 w-96 rounded-full bg-[var(--ambient-glow-2)] blur-3xl pointer-events-none" />

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-4xl mx-auto space-y-6">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] px-4 py-1.5 text-xs font-semibold text-[var(--accent-primary)] shadow-sm backdrop-blur-md">
                <Sparkles className="h-4 w-4 shrink-0" />
                <span>{t('landing.badge')}</span>
              </div>

              {/* Title */}
              <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-[var(--text-main)] leading-tight">
                {t('landing.heroTitlePrefix')} <br />
                <span className="bg-gradient-to-r from-[var(--accent-primary)] via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  {t('landing.heroTitleSuffix')}
                </span>
              </h1>

              {/* Description */}
              <p className="text-base sm:text-lg text-[var(--text-muted)] leading-relaxed max-w-3xl mx-auto">
                {t('landing.heroDesc')}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                {user ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={getDashboardHref()}
                      className="flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-emerald-600/25 hover:opacity-90 active:scale-95 transition-all"
                    >
                      <span>{getDashboardLabel()}</span>
                      <ChevronIcon className="h-4 w-4" />
                    </Link>

                    <Link
                      href="/evaluations"
                      className="flex items-center gap-2 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] px-5 py-3.5 text-sm font-semibold text-[var(--text-main)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-all shadow-sm"
                    >
                      <Trophy className="h-4 w-4 text-[var(--accent-primary)]" />
                      <span>{t('nav.evaluations')}</span>
                    </Link>
                  </div>
                ) : (
                  <>
                    <a
                      href="#demo-request"
                      className="flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-emerald-600/25 hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>{t('landing.requestDemoCta')}</span>
                      <ChevronIcon className="h-4 w-4" />
                    </a>

                    <a
                      href="#faq"
                      className="flex items-center gap-2 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] px-6 py-3.5 text-sm font-semibold text-[var(--text-main)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-all shadow-sm"
                    >
                      <span>{t('landing.contactSalesCta')}</span>
                    </a>

                    <Link
                      href="/login"
                      className="flex items-center gap-2 rounded-xl border border-transparent px-5 py-3.5 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                    >
                      <span>{t('landing.loginCta')}</span>
                    </Link>
                  </>
                )}
              </div>

              {/* Health Indicator */}
              <div className="pt-4 flex items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
                <Activity
                  className={`h-4 w-4 ${
                    apiHealth === 'healthy'
                      ? 'text-emerald-500'
                      : apiHealth === 'checking'
                        ? 'text-amber-500 animate-pulse'
                        : 'text-rose-500'
                  }`}
                />
                <span>
                  {t('landing.apiHealth')}{' '}
                  {apiHealth === 'healthy' ? (
                    <strong className="text-emerald-500">{t('landing.apiConnected')}</strong>
                  ) : apiHealth === 'checking' ? (
                    <strong className="text-amber-500">{t('landing.apiChecking')}</strong>
                  ) : (
                    <strong className="text-rose-500">{t('landing.apiOffline')}</strong>
                  )}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Feature Previews Showcase */}
        <section className="py-16 sm:py-24 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-subtle)]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="text-center max-w-3xl mx-auto space-y-3">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-main)]">
                {t('landing.featuresTitle')}
              </h2>
              <p className="text-sm sm:text-base text-[var(--text-muted)]">
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
                    ? 'bg-[var(--accent-primary)] text-white shadow-md'
                    : 'bg-[var(--bg-surface)] text-[var(--text-main)] border border-[var(--border-app)] hover:border-[var(--accent-primary)]'
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
                    ? 'bg-[var(--accent-primary)] text-white shadow-md'
                    : 'bg-[var(--bg-surface)] text-[var(--text-main)] border border-[var(--border-app)] hover:border-[var(--accent-primary)]'
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
                    ? 'bg-[var(--accent-primary)] text-white shadow-md'
                    : 'bg-[var(--bg-surface)] text-[var(--text-main)] border border-[var(--border-app)] hover:border-[var(--accent-primary)]'
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
                    ? 'bg-[var(--accent-primary)] text-white shadow-md'
                    : 'bg-[var(--bg-surface)] text-[var(--text-main)] border border-[var(--border-app)] hover:border-[var(--accent-primary)]'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>{t('landing.rolesSectionTitle')}</span>
              </button>
            </div>

            {/* Interactive Preview Canvas */}
            <div className="rounded-3xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-6 sm:p-10 shadow-xl overflow-hidden relative">
              {activePreviewTab === 'attendance' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div className="space-y-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)] bg-[var(--badge-bg)] px-3 py-1 rounded-full border border-[var(--badge-border)]">
                      <Zap className="h-3.5 w-3.5" />
                      {t('landing.featureAttendance')}
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-bold text-[var(--text-main)]">
                      {locale === 'ar' ? 'التحضير السريع بالباركود ومزامنة عدم الاتصال' : 'Instant QR Camera Check-in & Offline Sync'}
                    </h3>
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                      {t('landing.featureAttendanceDesc')}
                    </p>
                    <ul className="space-y-2.5 text-xs sm:text-sm text-[var(--text-main)]">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-[var(--accent-primary)] shrink-0" />
                        <span>{locale === 'ar' ? 'ماسح كاميرا مستمر بمعدل استجابة أقل من 50ms' : 'Continuous video stream scanning under 50ms'}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-[var(--accent-primary)] shrink-0" />
                        <span>{locale === 'ar' ? 'بطاقة عضوية رقمية للاعبين مع رمز QR مشفر للتجديد' : 'Digital membership player cards with rotatable tokens'}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-[var(--accent-primary)] shrink-0" />
                        <span>{locale === 'ar' ? 'حساب تأخير الحضور بدقة بتوقيت القاهرة مع فترة سماح قابلة للضبط' : 'Authoritative Cairo lateness calculations with grace periods'}</span>
                      </li>
                    </ul>
                  </div>

                  {/* Mock Visual UI */}
                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-5 space-y-4 shadow-inner">
                    <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-emerald-500 animate-ping" />
                        <span className="text-xs font-bold text-[var(--text-main)]">
                          {locale === 'ar' ? 'الماسح الميداني النشط' : 'Active Field Scanner'}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {locale === 'ar' ? 'وضع عدم الاتصال جاهز' : 'Offline Engine Ready'}
                      </span>
                    </div>

                    <div className="h-44 rounded-xl border border-dashed border-[var(--border-app)] flex flex-col items-center justify-center gap-2 bg-[var(--bg-surface)] text-center p-4">
                      <QrCode className="h-12 w-12 text-[var(--accent-primary)]" />
                      <p className="text-xs text-[var(--text-muted)]">
                        {locale === 'ar' ? 'وجه كاميرا الهاتف إلى بطاقة اللاعب للتسجيل الفوري' : 'Point camera at player QR card for instant verification'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-1">
                      <span>{locale === 'ar' ? 'الحصة التدريبية: فريق U-14' : 'Session: U-14 Football Squad'}</span>
                      <span className="font-bold text-[var(--accent-primary)]">{locale === 'ar' ? 'تم الحضور: 18 / 20' : 'Attended: 18 / 20'}</span>
                    </div>
                  </div>
                </div>
              )}

              {activePreviewTab === 'evaluations' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div className="space-y-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)] bg-[var(--badge-bg)] px-3 py-1 rounded-full border border-[var(--badge-border)]">
                      <Trophy className="h-3.5 w-3.5" />
                      {t('landing.radarSectionBadge')}
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-bold text-[var(--text-main)]">
                      {t('landing.radarSectionTitle')}
                    </h3>
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                      {t('landing.radarSectionDesc')}
                    </p>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
                        <div className="text-xs font-bold text-emerald-500">{t('landing.pillarTechnical')}</div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-1">{locale === 'ar' ? 'التمرير، المراوغة، التسديد والتمركز' : 'Passing, dribbling, shooting & control'}</div>
                      </div>
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
                        <div className="text-xs font-bold text-blue-500">{t('landing.pillarTactical')}</div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-1">{locale === 'ar' ? 'رؤية الملعب وسرعة اتخاذ القرار' : 'Vision, game awareness & decisions'}</div>
                      </div>
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
                        <div className="text-xs font-bold text-amber-500">{t('landing.pillarPhysical')}</div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-1">{locale === 'ar' ? 'السرعة، الرشاقة واللياقة الهوائية' : 'Speed, agility, strength & stamina'}</div>
                      </div>
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
                        <div className="text-xs font-bold text-purple-500">{t('landing.pillarBehavioral')}</div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-1">{locale === 'ar' ? 'الانضباط والروح الجماعية والشغف' : 'Discipline, leadership & teamwork'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Radar Mock */}
                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-6 space-y-4 shadow-inner">
                    <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                      <div>
                        <div className="text-sm font-bold text-[var(--text-main)]">{locale === 'ar' ? 'الملف الرياضي: عمر الغامدي' : 'Development Profile: Omar Al-Ghamdi'}</div>
                        <div className="text-xs text-[var(--text-muted)]">{locale === 'ar' ? 'الفئة: ناشئين U-13 • مركز: وسط هجومي' : 'Category: Youth U-13 • Attacking Midfielder'}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-extrabold text-[var(--accent-primary)]">8.75 / 10</div>
                        <div className="text-[10px] text-emerald-500 font-bold">{locale === 'ar' ? 'المركز 1 في الفئة' : 'Rank #1 in Age Tier'}</div>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>{t('landing.pillarTechnical')}</span>
                          <span className="font-bold">8.5</span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--bg-surface-subtle)] overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full w-[85%]" />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>{t('landing.pillarTactical')}</span>
                          <span className="font-bold">8.8</span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--bg-surface-subtle)] overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full w-[88%]" />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>{t('landing.pillarPhysical')}</span>
                          <span className="font-bold">8.2</span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--bg-surface-subtle)] overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full w-[82%]" />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>{t('landing.pillarBehavioral')}</span>
                          <span className="font-bold">9.5</span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--bg-surface-subtle)] overflow-hidden">
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
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)] bg-[var(--badge-bg)] px-3 py-1 rounded-full border border-[var(--badge-border)]">
                      <DollarSign className="h-3.5 w-3.5" />
                      {t('landing.featureFinance')}
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-bold text-[var(--text-main)]">
                      {locale === 'ar' ? 'إدارة التحصيلات وتسوية الصناديق اليومية' : 'Session Cashier Reconciliation & Player Subscriptions'}
                    </h3>
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                      {t('landing.featureFinanceDesc')}
                    </p>
                    <ul className="space-y-2.5 text-xs sm:text-sm text-[var(--text-main)]">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-[var(--accent-primary)] shrink-0" />
                        <span>{locale === 'ar' ? 'عرض حالة السداد والمبالغ المستحقة فورياً أثناء التحضير' : 'View live payment balance directly beside attendance scanner'}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-[var(--accent-primary)] shrink-0" />
                        <span>{locale === 'ar' ? 'تسوية صندوق الحصة التدريبية (نقدية، تحويلات، مصروفات)' : 'Full session cashier closing (cash, bank transfers, expenses)'}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-[var(--accent-primary)] shrink-0" />
                        <span>{locale === 'ar' ? 'إيصالات دفع فورية وتتبع تفصيلي للأرصدة المتأخرة' : 'Instant receipts and authoritative overdue receivables tracking'}</span>
                      </li>
                    </ul>
                  </div>

                  {/* Cashier Mock */}
                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-5 space-y-4 shadow-inner">
                    <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                      <div>
                        <div className="text-xs font-bold text-[var(--text-main)]">{locale === 'ar' ? 'تسوية صندوق الحصة #S-104' : 'Session Cashier Closing #S-104'}</div>
                        <div className="text-[11px] text-[var(--text-muted)]">{locale === 'ar' ? 'الفرع: النادي الرئيسي • المدرب المسؤول: كابتن أحمد' : 'Main Branch • Coach: Capt. Ahmed'}</div>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {locale === 'ar' ? 'تمت المطابقة' : 'Reconciled'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-center">
                        <div className="text-[10px] text-[var(--text-muted)]">{locale === 'ar' ? 'تحصيلات كاش' : 'Cash Collected'}</div>
                        <div className="text-sm font-extrabold text-[var(--accent-primary)] mt-1">1,800 ج.م</div>
                      </div>
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-center">
                        <div className="text-[10px] text-[var(--text-muted)]">{locale === 'ar' ? 'تحويل إلكتروني' : 'Electronic'}</div>
                        <div className="text-sm font-extrabold text-blue-500 mt-1">2,400 ج.م</div>
                      </div>
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-center">
                        <div className="text-[10px] text-[var(--text-muted)]">{locale === 'ar' ? 'صافي الحصة' : 'Net Cash'}</div>
                        <div className="text-sm font-extrabold text-emerald-500 mt-1">4,200 ج.م</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activePreviewTab === 'portals' && (
                <div className="space-y-6">
                  <div className="text-center max-w-2xl mx-auto space-y-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)] bg-[var(--badge-bg)] px-3 py-1 rounded-full border border-[var(--badge-border)]">
                      <Users className="h-3.5 w-3.5" />
                      {t('landing.rolesSectionTitle')}
                    </span>
                    <h3 className="text-2xl font-bold text-[var(--text-main)]">
                      {t('landing.rolesSectionDesc')}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4 space-y-2">
                      <div className="flex items-center gap-2 text-purple-500 font-bold text-sm">
                        <ShieldCheck className="h-4 w-4" />
                        <span>{t('landing.roleSuperAdminTitle')}</span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">{t('landing.roleSuperAdminDesc')}</p>
                    </div>

                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4 space-y-2">
                      <div className="flex items-center gap-2 text-[var(--accent-primary)] font-bold text-sm">
                        <Building2 className="h-4 w-4" />
                        <span>{t('landing.roleAcademyTitle')}</span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">{t('landing.roleAcademyDesc')}</p>
                    </div>

                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-500 font-bold text-sm">
                        <CalendarCheck className="h-4 w-4" />
                        <span>{t('landing.roleCoachTitle')}</span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">{t('landing.roleCoachDesc')}</p>
                    </div>

                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4 space-y-2">
                      <div className="flex items-center gap-2 text-blue-500 font-bold text-sm">
                        <Trophy className="h-4 w-4" />
                        <span>{t('landing.rolePlayerTitle')}</span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">{t('landing.rolePlayerDesc')}</p>
                    </div>

                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4 space-y-2">
                      <div className="flex items-center gap-2 text-rose-500 font-bold text-sm">
                        <HeartHandshake className="h-4 w-4" />
                        <span>{t('landing.roleGuardianTitle')}</span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">{t('landing.roleGuardianDesc')}</p>
                    </div>

                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4 space-y-2">
                      <div className="flex items-center gap-2 text-amber-500 font-bold text-sm">
                        <Lock className="h-4 w-4" />
                        <span>{t('landing.featureSecurity')}</span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">{t('landing.featureSecurityDesc')}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Demo Request Section */}
        <section id="demo-request" className="py-20 bg-[var(--bg-base)] border-b border-[var(--border-subtle)]">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-6 sm:p-12 shadow-2xl space-y-8">
              <div className="text-center space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-app)] bg-[var(--badge-bg)] px-4 py-1 text-xs font-bold text-[var(--accent-primary)]">
                  <Sparkles className="h-4 w-4" />
                  <span>{t('landing.demoModalTitle')}</span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-[var(--text-main)]">
                  {locale === 'ar' ? 'جاهز لنقل أكاديميتك إلى المستوى الاحترافي؟' : 'Ready to Elevate Your Sports Academy?'}
                </h2>
                <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-2xl mx-auto">
                  {t('landing.demoModalDesc')}
                </p>
              </div>

              {demoSubmitted ? (
                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-8 text-center space-y-3 animate-in fade-in">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
                  <h3 className="text-xl font-bold text-[var(--text-main)]">{t('landing.demoSuccessTitle')}</h3>
                  <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">{t('landing.demoSuccessDesc')}</p>
                </div>
              ) : (
                <form onSubmit={handleDemoSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-main)]">{t('landing.demoAcademyName')} *</label>
                      <input
                        type="text"
                        required
                        value={demoAcademyName}
                        onChange={(e) => setDemoAcademyName(e.target.value)}
                        placeholder={locale === 'ar' ? 'مثال: أكاديمية النجوم الدولية' : 'e.g. Star Sports Academy'}
                        className="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-base)] px-4 py-2.5 text-sm text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-main)]">{t('landing.demoSport')} *</label>
                      <select
                        value={demoSport}
                        onChange={(e) => setDemoSport(e.target.value)}
                        className="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-base)] px-4 py-2.5 text-sm text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
                      >
                        <option value="FOOTBALL">⚽ {locale === 'ar' ? 'كرة قدم (Football)' : 'Football (Soccer)'}</option>
                        <option value="PADEL">🎾 {locale === 'ar' ? 'بادل (Padel)' : 'Padel'}</option>
                        <option value="SWIMMING">🏊 {locale === 'ar' ? 'سباحة (Swimming)' : 'Swimming'}</option>
                        <option value="BASKETBALL">🏀 {locale === 'ar' ? 'كرة سلة (Basketball)' : 'Basketball'}</option>
                        <option value="TENNIS">🎾 {locale === 'ar' ? 'تنس أرضي (Tennis)' : 'Tennis'}</option>
                        <option value="OTHER">🏆 {locale === 'ar' ? 'رياضة أخرى' : 'Other Sport'}</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-main)]">{t('landing.demoContactName')} *</label>
                      <input
                        type="text"
                        required
                        value={demoContactName}
                        onChange={(e) => setDemoContactName(e.target.value)}
                        placeholder={locale === 'ar' ? 'اسم مدير أو مالك الأكاديمية' : 'Full Name'}
                        className="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-base)] px-4 py-2.5 text-sm text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-main)]">{t('landing.demoCity')} *</label>
                      <input
                        type="text"
                        required
                        value={demoCity}
                        onChange={(e) => setDemoCity(e.target.value)}
                        placeholder={locale === 'ar' ? 'مثال: القاهرة، مصر' : 'e.g. Cairo, Egypt'}
                        className="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-base)] px-4 py-2.5 text-sm text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-main)]">{t('landing.demoEmail')} *</label>
                      <input
                        type="email"
                        required
                        value={demoEmail}
                        onChange={(e) => setDemoEmail(e.target.value)}
                        placeholder="admin@academy.com"
                        className="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-base)] px-4 py-2.5 text-sm text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-main)]">{t('landing.demoPhone')} *</label>
                      <input
                        type="tel"
                        required
                        value={demoPhone}
                        onChange={(e) => setDemoPhone(e.target.value)}
                        placeholder="+20 100 123 4567"
                        className="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-base)] px-4 py-2.5 text-sm text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-main)]">{t('landing.demoPlayersCount')}</label>
                    <select
                      value={demoPlayersCount}
                      onChange={(e) => setDemoPlayersCount(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-base)] px-4 py-2.5 text-sm text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
                    >
                      <option value="50-150">50 - 150 {locale === 'ar' ? 'لاعب' : 'players'}</option>
                      <option value="150-300">150 - 300 {locale === 'ar' ? 'لاعب' : 'players'}</option>
                      <option value="300-600">300 - 600 {locale === 'ar' ? 'لاعب' : 'players'}</option>
                      <option value="600+">600+ {locale === 'ar' ? 'لاعب (فروع متعددة)' : 'players (multi-branch)'}</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingDemo}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-emerald-600/20 hover:opacity-95 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="h-4 w-4" />
                    <span>{isSubmittingDemo ? t('landing.demoSubmitting') : t('landing.demoSubmit')}</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-20 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-subtle)]">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="text-center space-y-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)] bg-[var(--badge-bg)] px-3 py-1 rounded-full border border-[var(--badge-border)]">
                <HelpCircle className="h-3.5 w-3.5" />
                <span>{t('landing.faqTitle')}</span>
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-main)]">
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
                  className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] overflow-hidden transition-all shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full flex items-center justify-between p-5 text-start font-bold text-sm sm:text-base text-[var(--text-main)] hover:text-[var(--accent-primary)] transition-colors"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 text-[var(--text-muted)] shrink-0 transition-transform ${
                        openFaq === idx ? 'rotate-180 text-[var(--accent-primary)]' : ''
                      }`}
                    />
                  </button>
                  {openFaq === idx && (
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed border-t border-[var(--border-subtle)]">
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
      <footer className="border-t border-[var(--border-app)] bg-[var(--bg-surface)] py-10 transition-colors">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-2 font-bold text-[var(--text-main)]">
            <ShieldCheck className="h-5 w-5 text-[var(--accent-primary)]" />
            <span>{t('common.academyPlatform')} &copy; {new Date().getFullYear()}</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-emerald-500 font-semibold">
              <Lock className="h-3.5 w-3.5" />
              <span>Multi-Tenant RLS Protected</span>
            </span>
            <span>•</span>
            <a href="#demo-request" className="hover:text-[var(--text-main)] transition-colors">
              {t('landing.requestDemoCta')}
            </a>
            <span>•</span>
            <Link href="/login" className="hover:text-[var(--text-main)] transition-colors">
              {t('common.login')}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
