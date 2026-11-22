'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SPORT_CODES } from '@academy/shared';
import { SPORT_ICONS, SPORT_TRANSLATIONS } from '@/utils/data-translator';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useLocale } from '@/contexts/locale-context';
import { PasswordStrengthMeter } from '@/components/ui/PasswordStrengthMeter';
import {
  firstInvalidField,
  resolveRegisterError,
  validateRegisterForm,
  type RegisterField,
  type RegisterFieldErrors,
} from '@/features/auth/register-form';
import { PasswordVisibilityToggle } from '@/features/auth/components/PasswordVisibilityToggle';
import { EmailCodeVerification } from '@/features/auth/components/EmailCodeVerification';
import { emailNotConfirmedMessage } from '@/features/auth/email-code';
import { readReturnPath, withReturnPath } from '@/lib/auth/safe-return-path';
import { useSafeReturnPath } from '@/hooks/useSafeReturnPath';
import { Navbar } from '../../components/Navbar';
import { SportexusLogo } from '../../components/brand/SportexusLogo';
import {
  Building,
  User,
  Mail,
  Lock,
  Phone,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Loader2,
  Sparkles,
  MapPin,
  CheckCircle2,
  Clock,
  Home,
  LogIn,
} from 'lucide-react';

// Every sport the platform supports (one list for the whole product: @academy/shared SPORT_CODES).
const SPORTS_OPTIONS = SPORT_CODES.map((code) => ({
  value: code,
  labelAr: SPORT_TRANSLATIONS.ar[code] ?? code,
  labelEn: SPORT_TRANSLATIONS.en[code] ?? code,
  icon: SPORT_ICONS[code] ?? '🏅',
}));

export default function RegisterPage() {
  const router = useRouter();
  const { user, register } = useAuth();
  const { locale } = useLocale();

  const [academyName, setAcademyName] = useState('');
  const [sport, setSport] = useState('FOOTBALL');
  const [city, setCity] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Proof that the e-mail was confirmed with a code (POST /auth/email-code/verify).
  const [emailProof, setEmailProof] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const academyNameRef = useRef<HTMLInputElement>(null);
  const ownerNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const [submittedData, setSubmittedData] = useState<{
    academyName: string;
    email: string;
    sport: string;
    city: string;
  } | null>(null);

  // Validated `?redirect=` for links; redirects below re-read it at call time to avoid a
  // race with the initial render (a signed-in user may already be present on mount).
  const returnPath = useSafeReturnPath();

  useEffect(() => {
    if (user) {
      router.push(readReturnPath(window.location.search) ?? '/dashboard');
    }
  }, [user, router]);

  const fieldRefs: Record<RegisterField, React.RefObject<HTMLInputElement | null>> = {
    academyName: academyNameRef,
    ownerName: ownerNameRef,
    email: emailRef,
    phone: phoneRef,
    password: passwordRef,
    confirmPassword: confirmPasswordRef,
  };

  const validateForm = (): boolean => {
    const errors = validateRegisterForm(
      { academyName, sport, city, ownerName, email, phone, password, confirmPassword },
      locale,
    );
    setFieldErrors(errors);

    // Auto-focus the first invalid field
    const first = firstInvalidField(errors);
    if (first) fieldRefs[first].current?.focus();

    return first === null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }
    if (!emailProof) {
      setFieldErrors((prev) => ({ ...prev, email: emailNotConfirmedMessage(locale) }));
      emailRef.current?.focus();
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await register({
        academyName: academyName.trim(),
        sport: sport as Parameters<typeof register>[0]['sport'],
        city: city.trim() || undefined,
        name: ownerName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() ? phone.trim() : undefined,
        password,
        emailProof,
      });

      if (res.status === 'PENDING_REVIEW') {
        setSubmittedData({
          academyName: academyName.trim(),
          email: email.trim().toLowerCase(),
          sport,
          city: city.trim() || (locale === 'ar' ? 'غير محددة' : 'Unspecified'),
        });
      } else {
        router.push(readReturnPath(window.location.search) ?? '/dashboard');
      }
    } catch (err: unknown) {
      const resolution = resolveRegisterError(err, locale);
      if (resolution.kind === 'field') {
        setFieldErrors((prev) => ({ ...prev, [resolution.field]: resolution.message }));
        fieldRefs[resolution.field].current?.focus();
      } else {
        setError(resolution.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-(--bg-base) text-(--text-main) flex flex-col transition-colors overflow-x-hidden animate-fade-in">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-2xl">
          {/* Card container — unified navy/blue Sportexus theme */}
          <div className="rounded-3xl border border-(--border-app) bg-(--bg-surface)/95 p-6 sm:p-8 shadow-float backdrop-blur-xl relative overflow-hidden animate-scale-up">
            <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-(--accent-blue)/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-(--accent-primary)/10 blur-3xl pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-48 w-48 rounded-full bg-[#22C55E]/10 blur-3xl pointer-events-none" />

            {/* Confirmation State if registration application was submitted */}
            {submittedData ? (
              <div className="text-center py-6 space-y-6 relative z-10">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-xl shadow-emerald-500/10">
                  <CheckCircle2 className="h-10 w-10 animate-pulse" />
                </div>

                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-300">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {locale === 'ar'
                        ? 'الطلب قيد المراجعة والاعتماد'
                        : 'Pending Review & Approval'}
                    </span>
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                    {locale === 'ar'
                      ? 'تم تقديم طلب التسجيل بنجاح!'
                      : 'Application Submitted Successfully!'}
                  </h1>
                  <p className="text-sm text-(--text-sub) max-w-lg mx-auto leading-relaxed">
                    {locale === 'ar'
                      ? `شكراً لك! تم استلام طلب تسجيل أكاديمية "${submittedData.academyName}" بنجاح. يقوم فريق إدارة منصة سبورتكسس حالياً بمراجعة البيانات واعتماد المنظومة.`
                      : `Thank you! Your registration application for "${submittedData.academyName}" has been received. Our platform administrators are reviewing your submission.`}
                  </p>
                </div>

                {/* Details Summary Card */}
                <div className="rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) p-4 max-w-md mx-auto text-start space-y-3 text-xs sm:text-sm">
                  <div className="flex justify-between items-center border-b border-(--border-subtle) pb-2">
                    <span className="text-(--text-muted)">
                      {locale === 'ar' ? 'اسم الأكاديمية' : 'Academy Name'}
                    </span>
                    <span className="font-bold text-(--text-main)">
                      {submittedData.academyName}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-(--border-subtle) pb-2">
                    <span className="text-(--text-muted)">
                      {locale === 'ar' ? 'البريد الإلكتروني للإدارة' : 'Admin Email'}
                    </span>
                    <span className="font-semibold text-[var(--accent-primary)]">
                      {submittedData.email}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-(--border-subtle) pb-2">
                    <span className="text-(--text-muted)">
                      {locale === 'ar' ? 'الرياضة الأساسية' : 'Sport'}
                    </span>
                    <span className="text-(--text-main)">
                      {(() => {
                        const opt = SPORTS_OPTIONS.find((s) => s.value === submittedData.sport);
                        return opt
                          ? locale === 'ar'
                            ? opt.labelAr
                            : opt.labelEn
                          : submittedData.sport;
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-(--text-muted)">
                      {locale === 'ar' ? 'المدينة' : 'City'}
                    </span>
                    <span className="text-(--text-main)">{submittedData.city}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/10 text-xs text-blue-200 max-w-md mx-auto leading-relaxed">
                  {locale === 'ar'
                    ? 'ستصلك رسالة تأكيد وتفعيل على بريدك الإلكتروني فور اعتماد الأكاديمية، لتتمكن من تسجيل الدخول مباشرة بكلمة المرور التي اخترتها.'
                    : 'You will receive an activation email as soon as your academy is approved. You will then be able to log in with your chosen password.'}
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                  <Link
                    href={withReturnPath('/login', returnPath)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0A3BFF] to-[#00D6FF] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 hover:brightness-110 transition-all"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>{locale === 'ar' ? 'الانتقال لتسجيل الدخول' : 'Go to Sign In'}</span>
                  </Link>
                  <Link
                    href="/"
                    className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) px-6 py-3 text-sm font-semibold text-(--text-sub) hover:border-[var(--accent-primary)] hover:text-(--text-main) transition-all"
                  >
                    <Home className="h-4 w-4" />
                    <span>{locale === 'ar' ? 'العودة للصفحة الرئيسية' : 'Return to Home'}</span>
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {/* Header with Sportexus Logo */}
                <div className="text-center mb-8 relative z-10 flex flex-col items-center">
                  <SportexusLogo size="lg" className="mb-4" />
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-(--text-main)">
                    {locale === 'ar'
                      ? 'تسجيل أكاديمية رياضية جديدة'
                      : 'Register a New Sports Academy'}
                  </h1>
                  <p className="mt-2 text-sm text-(--text-muted)">
                    {locale === 'ar'
                      ? 'ابدأ بإدارة فروعك، مدربيك، لاعبيك وحضورهم بنظام عزل بيانات متعدد المستأجرين'
                      : 'Manage branches, coaches, players, and attendance with multi-tenant data isolation'}
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div
                    role="alert"
                    className="mb-6 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300"
                  >
                    <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
                    <div className="leading-relaxed">{error}</div>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                  {/* Section 1: Academy Info */}
                  <div className="rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) p-4 space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-[var(--accent-primary)] tracking-wider uppercase">
                      <Building className="h-4 w-4" />
                      <span>
                        {locale === 'ar' ? 'بيانات الأكاديمية والرياضة' : 'Academy & Sport Details'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          className="block text-xs font-semibold text-(--text-sub) mb-1.5"
                          htmlFor="academyName"
                        >
                          {locale === 'ar' ? 'اسم الأكاديمية *' : 'Academy Name *'}
                        </label>
                        <input
                          id="academyName"
                          ref={academyNameRef}
                          type="text"
                          value={academyName}
                          onChange={(e) => {
                            setAcademyName(e.target.value);
                            if (fieldErrors.academyName) {
                              setFieldErrors((prev) => ({ ...prev, academyName: '' }));
                            }
                          }}
                          placeholder={
                            locale === 'ar'
                              ? 'مثال: أكاديمية النجوم الرياضية'
                              : 'e.g. Stars Sports Academy'
                          }
                          className={`w-full rounded-xl border py-2.5 px-3 text-sm text-(--text-main) placeholder-(--text-muted) outline-none transition-all ${
                            fieldErrors.academyName
                              ? 'border-rose-500 bg-rose-500/10 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                              : 'border-(--border-app) bg-(--bg-surface-subtle) text-(--text-main) placeholder-(--text-muted) focus:border-(--accent-primary) focus:ring-1 focus:ring-(--accent-primary)'
                          }`}
                        />
                        {fieldErrors.academyName && (
                          <p className="mt-1.5 text-xs text-rose-400 flex items-center gap-1 animate-in fade-in duration-150">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>{fieldErrors.academyName}</span>
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          className="block text-xs font-semibold text-(--text-sub) mb-1.5"
                          htmlFor="sport"
                        >
                          {locale === 'ar' ? 'نوع الرياضة الأساسية *' : 'Primary Sport *'}
                        </label>
                        <select
                          id="sport"
                          value={sport}
                          onChange={(e) => setSport(e.target.value)}
                          className="w-full rounded-xl border border-(--border-app) bg-(--bg-surface-subtle) py-2.5 px-3 text-sm text-(--text-main) focus:border-(--accent-primary) focus:ring-1 focus:ring-(--accent-primary) outline-none transition-all cursor-pointer"
                        >
                          {SPORTS_OPTIONS.map((opt) => (
                            <option
                              key={opt.value}
                              value={opt.value}
                              className="bg-[var(--bg-surface)]"
                            >
                              {opt.icon} {locale === 'ar' ? opt.labelAr : opt.labelEn}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label
                        className="block text-xs font-semibold text-(--text-sub) mb-1.5"
                        htmlFor="city"
                      >
                        {locale === 'ar'
                          ? 'المدينة / الدولة (اختياري)'
                          : 'City / Country (optional)'}
                      </label>
                      <div className="relative">
                        <input
                          id="city"
                          type="text"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder={
                            locale === 'ar' ? 'مثال: الرياض، السعودية' : 'e.g. Riyadh, KSA'
                          }
                          className="w-full rounded-xl border border-(--border-app) bg-(--bg-surface-subtle) py-2.5 pr-3 pl-9 text-sm text-(--text-main) placeholder-(--text-muted) focus:border-(--accent-primary) focus:ring-1 focus:ring-(--accent-primary) outline-none transition-all"
                        />
                        <MapPin className="absolute left-3 top-3 h-4 w-4 text-(--text-muted)" />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Owner Info */}
                  <div className="rounded-xl border border-(--border-subtle) bg-(--bg-surface-subtle) p-4 space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-[var(--accent-primary)] tracking-wider uppercase">
                      <User className="h-4 w-4" />
                      <span>
                        {locale === 'ar' ? 'بيانات المالك وحساب الإدارة' : 'Owner & Admin Account'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          className="block text-xs font-semibold text-(--text-sub) mb-1.5"
                          htmlFor="ownerName"
                        >
                          {locale === 'ar' ? 'اسم مالك الأكاديمية *' : 'Academy Owner Name *'}
                        </label>
                        <input
                          id="ownerName"
                          ref={ownerNameRef}
                          type="text"
                          value={ownerName}
                          onChange={(e) => {
                            setOwnerName(e.target.value);
                            if (fieldErrors.ownerName) {
                              setFieldErrors((prev) => ({ ...prev, ownerName: '' }));
                            }
                          }}
                          placeholder={locale === 'ar' ? 'الاسم بالكامل' : 'Full name'}
                          className={`w-full rounded-xl border py-2.5 px-3 text-sm text-(--text-main) placeholder-(--text-muted) outline-none transition-all ${
                            fieldErrors.ownerName
                              ? 'border-rose-500 bg-rose-500/10 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                              : 'border-(--border-app) bg-(--bg-surface-subtle) text-(--text-main) placeholder-(--text-muted) focus:border-(--accent-primary) focus:ring-1 focus:ring-(--accent-primary)'
                          }`}
                        />
                        {fieldErrors.ownerName && (
                          <p className="mt-1.5 text-xs text-rose-400 flex items-center gap-1 animate-in fade-in duration-150">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>{fieldErrors.ownerName}</span>
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          className="block text-xs font-semibold text-(--text-sub) mb-1.5"
                          htmlFor="phone"
                        >
                          {locale === 'ar' ? 'رقم الهاتف (اختياري)' : 'Phone (optional)'}
                        </label>
                        <div className="relative">
                          <input
                            id="phone"
                            ref={phoneRef}
                            type="tel"
                            value={phone}
                            onChange={(e) => {
                              setPhone(e.target.value);
                              if (fieldErrors.phone) {
                                setFieldErrors((prev) => ({ ...prev, phone: '' }));
                              }
                            }}
                            placeholder="01XXXXXXXXX"
                            dir="ltr"
                            className={`w-full rounded-xl border py-2.5 pr-3 pl-9 text-sm text-(--text-main) placeholder-(--text-muted) outline-none transition-all ${
                              fieldErrors.phone
                                ? 'border-rose-500 bg-rose-500/10 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                                : 'border-(--border-app) bg-(--bg-surface-subtle) text-(--text-main) placeholder-(--text-muted) focus:border-(--accent-primary) focus:ring-1 focus:ring-(--accent-primary)'
                            }`}
                          />
                          <Phone className="absolute left-3 top-3 h-4 w-4 text-(--text-muted)" />
                        </div>
                        {fieldErrors.phone && (
                          <p className="mt-1.5 text-xs text-rose-400 flex items-center gap-1 animate-in fade-in duration-150">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>{fieldErrors.phone}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label
                        className="block text-xs font-semibold text-(--text-sub) mb-1.5"
                        htmlFor="email"
                      >
                        {locale === 'ar' ? 'البريد الإلكتروني للإدارة *' : 'Admin Email *'}
                      </label>
                      <div className="relative">
                        <input
                          id="email"
                          ref={emailRef}
                          type="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (fieldErrors.email) {
                              setFieldErrors((prev) => ({ ...prev, email: '' }));
                            }
                          }}
                          placeholder="name@example.com"
                          dir="ltr"
                          className={`w-full rounded-xl border py-2.5 pr-3 pl-9 text-sm text-(--text-main) placeholder-(--text-muted) outline-none transition-all ${
                            fieldErrors.email
                              ? 'border-rose-500 bg-rose-500/10 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                              : 'border-(--border-app) bg-(--bg-surface-subtle) text-(--text-main) placeholder-(--text-muted) focus:border-(--accent-primary) focus:ring-1 focus:ring-(--accent-primary)'
                          }`}
                        />
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-(--text-muted)" />
                      </div>
                      {fieldErrors.email && (
                        <p className="mt-1.5 text-xs text-rose-400 flex items-center gap-1 animate-in fade-in duration-150">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>{fieldErrors.email}</span>
                        </p>
                      )}
                      <EmailCodeVerification
                        email={email}
                        locale={locale}
                        onProofChange={(proof) => {
                          setEmailProof(proof);
                          if (proof) setFieldErrors((prev) => ({ ...prev, email: '' }));
                        }}
                        disabled={isSubmitting}
                        idPrefix="register"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          className="block text-xs font-semibold text-(--text-sub) mb-1.5"
                          htmlFor="password"
                        >
                          {locale === 'ar' ? 'كلمة المرور *' : 'Password *'}
                        </label>
                        <div className="relative">
                          <input
                            id="password"
                            ref={passwordRef}
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => {
                              setPassword(e.target.value);
                              if (fieldErrors.password) {
                                setFieldErrors((prev) => ({ ...prev, password: '' }));
                              }
                            }}
                            placeholder="••••••••••••"
                            dir="ltr"
                            className={`w-full rounded-xl border py-2.5 pr-10 pl-10 text-sm text-(--text-main) placeholder-(--text-muted) outline-none transition-all ${
                              fieldErrors.password
                                ? 'border-rose-500 bg-rose-500/10 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                                : 'border-(--border-app) bg-(--bg-surface-subtle) text-(--text-main) placeholder-(--text-muted) focus:border-(--accent-primary) focus:ring-1 focus:ring-(--accent-primary)'
                            }`}
                          />
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-(--text-muted)" />
                          <PasswordVisibilityToggle
                            visible={showPassword}
                            onToggle={() => setShowPassword(!showPassword)}
                            controls="password"
                            className="absolute right-3 top-3 text-(--text-muted) hover:text-(--text-main) transition-colors p-0.5 focus:outline-none"
                          />
                        </div>
                        {fieldErrors.password && (
                          <p className="mt-1.5 text-xs text-rose-400 flex items-center gap-1 animate-in fade-in duration-150">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>{fieldErrors.password}</span>
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          className="block text-xs font-semibold text-(--text-sub) mb-1.5"
                          htmlFor="confirmPassword"
                        >
                          {locale === 'ar' ? 'تأكيد كلمة المرور *' : 'Confirm Password *'}
                        </label>
                        <input
                          id="confirmPassword"
                          ref={confirmPasswordRef}
                          type={showPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            if (fieldErrors.confirmPassword) {
                              setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }));
                            }
                          }}
                          placeholder="••••••••••••"
                          dir="ltr"
                          className={`w-full rounded-xl border py-2.5 px-3 text-sm text-(--text-main) placeholder-(--text-muted) outline-none transition-all ${
                            fieldErrors.confirmPassword
                              ? 'border-rose-500 bg-rose-500/10 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                              : 'border-(--border-app) bg-(--bg-surface-subtle) text-(--text-main) placeholder-(--text-muted) focus:border-(--accent-primary) focus:ring-1 focus:ring-(--accent-primary)'
                          }`}
                        />
                        {fieldErrors.confirmPassword && (
                          <p className="mt-1.5 text-xs text-rose-400 flex items-center gap-1 animate-in fade-in duration-150">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>{fieldErrors.confirmPassword}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Real-time Password Strength Criteria Checklist */}
                    <PasswordStrengthMeter
                      password={password}
                      locale={locale}
                      showChecklist={true}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0A3BFF] via-[#0077FF] to-[#00D6FF] py-3.5 text-sm font-bold text-white shadow-xl shadow-blue-600/30 hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>
                          {locale === 'ar'
                            ? 'جارٍ تقديم طلب تسجيل الأكاديمية...'
                            : 'Submitting registration application...'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>
                          {locale === 'ar'
                            ? 'تقديم طلب تسجيل الأكاديمية'
                            : 'Submit Academy Registration'}
                        </span>
                        <ArrowRight className="h-4 w-4 rotate-180" />
                      </>
                    )}
                  </button>
                </form>

                {/* Footer link */}
                <div className="mt-8 border-t border-(--border-subtle) pt-6 text-center text-xs text-(--text-muted) relative z-10">
                  <span>
                    {locale === 'ar'
                      ? 'لديك حساب بالفعل وتريد تسجيل الدخول؟ '
                      : 'Already have an account? '}
                  </span>
                  <Link
                    href={withReturnPath('/login', returnPath)}
                    className="font-semibold text-[var(--accent-primary)] hover:underline transition-colors"
                  >
                    {locale === 'ar' ? 'تسجيل الدخول إلى حسابك' : 'Sign in to your account'}
                  </Link>
                </div>
              </>
            )}
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-(--text-muted)">
            <ShieldCheck className="h-4 w-4 text-[#22C55E]" />
            <span>
              {locale === 'ar'
                ? 'يتم اعتماد وتفعيل الأكاديمية بموجب معايير الأمان وعزل البيانات متعدد المستأجرين'
                : 'Academies are approved and activated with multi-tenant data isolation and security'}
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
