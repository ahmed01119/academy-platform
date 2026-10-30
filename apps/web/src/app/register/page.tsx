'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { useLocale } from '../../lib/locale-context';
import { Navbar } from '../../components/Navbar';
import { SportexusLogo } from '../../components/brand/SportexusLogo';
import {
  Building,
  User,
  Mail,
  Phone,
  Eye,
  EyeOff,
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
  Check,
} from 'lucide-react';

const SPORTS_OPTIONS = [
  { value: 'FOOTBALL', label: 'كرة قدم (Football)', icon: '⚽' },
  { value: 'PADEL', label: 'بادل (Padel)', icon: '🎾' },
  { value: 'SWIMMING', label: 'سباحة (Swimming)', icon: '🏊' },
  { value: 'BASKETBALL', label: 'كرة سلة (Basketball)', icon: '🏀' },
  { value: 'TENNIS', label: 'تنس أرضي (Tennis)', icon: '🎾' },
  { value: 'MARTIAL_ARTS', label: 'فنون قتالية (Martial Arts)', icon: '🥋' },
  { value: 'OTHER', label: 'رياضة أخرى (Other)', icon: '🏆' },
];

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

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const isAr = locale === 'ar';

    // 1. Academy Name
    if (!academyName.trim()) {
      errors.academyName = isAr ? 'يرجى إدخال اسم الأكاديمية.' : 'Academy name is required.';
    } else if (academyName.trim().length < 3) {
      errors.academyName = isAr
        ? 'اسم الأكاديمية يجب أن يحتوي على 3 أحرف على الأقل.'
        : 'Academy name must contain at least 3 characters.';
    } else if (academyName.trim().length > 100) {
      errors.academyName = isAr ? 'اسم الأكاديمية طويل جدًا.' : 'Academy name is too long.';
    }

    // 2. Owner Name
    if (!ownerName.trim()) {
      errors.ownerName = isAr ? 'يرجى إدخال اسم مالك الأكاديمية.' : 'Owner name is required.';
    } else if (ownerName.trim().length < 3) {
      errors.ownerName = isAr
        ? 'اسم المالك يجب أن يحتوي على 3 أحرف على الأقل.'
        : 'Owner name must contain at least 3 characters.';
    } else if (ownerName.trim().length > 100) {
      errors.ownerName = isAr ? 'اسم المالك طويل جدًا.' : 'Owner name is too long.';
    }

    // 3. Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      errors.email = isAr ? 'يرجى إدخال البريد الإلكتروني.' : 'Email address is required.';
    } else if (!emailRegex.test(email.trim())) {
      errors.email = isAr ? 'البريد الإلكتروني غير صحيح.' : 'Enter a valid email address.';
    }

    // 4. Phone
    if (phone.trim()) {
      const phoneClean = phone.trim().replace(/[\s-]/g, '');
      const phoneRegex = /^\+?[0-9]{8,18}$/;
      if (!phoneRegex.test(phoneClean)) {
        errors.phone = isAr ? 'رقم الهاتف غير صحيح.' : 'Enter a valid phone number.';
      }
    }

    // 5. Password
    if (!password) {
      errors.password = isAr ? 'يرجى إدخال كلمة المرور.' : 'Password is required.';
    } else if (password.length < 8) {
      errors.password = isAr
        ? 'كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل.'
        : 'Password must contain at least 8 characters.';
    } else if (password.length > 100) {
      errors.password = isAr ? 'كلمة المرور طويلة جدًا.' : 'Password is too long.';
    } else if (!/[A-Z]/.test(password)) {
      errors.password = isAr
        ? 'كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل (A-Z).'
        : 'Password must contain at least one uppercase letter (A-Z).';
    } else if (!/[a-z]/.test(password)) {
      errors.password = isAr
        ? 'كلمة المرور يجب أن تحتوي على حرف صغير واحد على الأقل (a-z).'
        : 'Password must contain at least one lowercase letter (a-z).';
    } else if (!/[0-9]/.test(password)) {
      errors.password = isAr
        ? 'كلمة المرور يجب أن تحتوي على رقم واحد على الأقل (0-9).'
        : 'Password must contain at least one number (0-9).';
    }

    // 6. Confirm Password
    if (!confirmPassword) {
      errors.confirmPassword = isAr ? 'يرجى تأكيد كلمة المرور.' : 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = isAr ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.';
    }

    setFieldErrors(errors);

    // Auto-focus the first invalid field
    if (errors.academyName) {
      academyNameRef.current?.focus();
    } else if (errors.ownerName) {
      ownerNameRef.current?.focus();
    } else if (errors.email) {
      emailRef.current?.focus();
    } else if (errors.phone) {
      phoneRef.current?.focus();
    } else if (errors.password) {
      passwordRef.current?.focus();
    } else if (errors.confirmPassword) {
      confirmPasswordRef.current?.focus();
    }

    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
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
      });

      if (res.status === 'PENDING_REVIEW') {
        setSubmittedData({
          academyName: academyName.trim(),
          email: email.trim().toLowerCase(),
          sport,
          city: city.trim() || (locale === 'ar' ? 'غير محددة' : 'Unspecified'),
        });
      } else {
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      const isAr = locale === 'ar';

      if (
        message.includes('already exists') ||
        message.includes('already registered') ||
        message.includes('Email')
      ) {
        setFieldErrors((prev) => ({
          ...prev,
          email: isAr
            ? 'هذا البريد الإلكتروني مسجل بالفعل لدى أكاديمية أخرى أو مستخدم.'
            : 'This email address is already registered.',
        }));
        emailRef.current?.focus();
      } else if (message.includes('slug') || message.includes('Academy name')) {
        setFieldErrors((prev) => ({
          ...prev,
          academyName: isAr
            ? 'اسم الأكاديمية هذا مسجل بالفعل، يرجى اختيار اسم آخر.'
            : 'An academy with this name already exists.',
        }));
        academyNameRef.current?.focus();
      } else {
        setError(
          message ||
            (isAr
              ? 'فشل تسجيل الأكاديمية. يرجى مراجعة البيانات والمحاولة مجدداً.'
              : 'Registration failed. Please review your details and try again.'),
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-main)] flex flex-col transition-colors overflow-x-hidden animate-fade-in">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-2xl">
          {/* Card container — unified navy/blue Sportexus theme */}
          <div className="rounded-3xl border border-[var(--border-app)] bg-[var(--bg-surface)]/95 p-6 sm:p-8 shadow-float backdrop-blur-xl relative overflow-hidden animate-scale-up">
            <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[var(--accent-blue)]/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-[var(--accent-primary)]/10 blur-3xl pointer-events-none" />
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
                  <p className="text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
                    {locale === 'ar'
                      ? `شكراً لك! تم استلام طلب تسجيل أكاديمية "${submittedData.academyName}" بنجاح. يقوم فريق إدارة منصة سبورتكسس حالياً بمراجعة البيانات واعتماد المنظومة.`
                      : `Thank you! Your registration application for "${submittedData.academyName}" has been received. Our platform administrators are reviewing your submission.`}
                  </p>
                </div>

                {/* Details Summary Card */}
                <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 max-w-md mx-auto text-start space-y-3 text-xs sm:text-sm">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-slate-400">
                      {locale === 'ar' ? 'اسم الأكاديمية' : 'Academy Name'}
                    </span>
                    <span className="font-bold text-white">{submittedData.academyName}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-slate-400">
                      {locale === 'ar' ? 'البريد الإلكتروني للإدارة' : 'Admin Email'}
                    </span>
                    <span className="font-semibold text-[var(--accent-primary)]">
                      {submittedData.email}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-slate-400">
                      {locale === 'ar' ? 'الرياضة الأساسية' : 'Sport'}
                    </span>
                    <span className="text-slate-200">
                      {SPORTS_OPTIONS.find((s) => s.value === submittedData.sport)?.label ||
                        submittedData.sport}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">{locale === 'ar' ? 'المدينة' : 'City'}</span>
                    <span className="text-slate-200">{submittedData.city}</span>
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
                    href="/login"
                    className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0A3BFF] to-[#00D6FF] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 hover:brightness-110 transition-all"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>{locale === 'ar' ? 'الانتقال لتسجيل الدخول' : 'Go to Sign In'}</span>
                  </Link>
                  <Link
                    href="/"
                    className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-6 py-3 text-sm font-semibold text-slate-300 hover:border-slate-500 hover:text-white transition-all"
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
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                    {locale === 'ar'
                      ? 'تسجيل أكاديمية رياضية جديدة'
                      : 'Register a New Sports Academy'}
                  </h1>
                  <p className="mt-2 text-sm text-slate-400">
                    {locale === 'ar'
                      ? 'ابدأ بإدارة فروعك، مدربيك، لاعبيك وحضورهم بنظام عزل بيانات متعدد المستأجرين'
                      : 'Manage branches, coaches, players, and attendance with multi-tenant data isolation'}
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
                    <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
                    <div className="leading-relaxed">{error}</div>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                  {/* Section 1: Academy Info */}
                  <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-[var(--accent-primary)] tracking-wider uppercase">
                      <Building className="h-4 w-4" />
                      <span>
                        {locale === 'ar' ? 'بيانات الأكاديمية والرياضة' : 'Academy & Sport Details'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          className="block text-xs font-semibold text-slate-300 mb-1.5"
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
                              ? 'مثال: أكاديمية النجوم لكرة القدم'
                              : 'e.g. Stars Football Academy'
                          }
                          className={`w-full rounded-xl border py-2.5 px-3 text-sm text-white placeholder-slate-500 outline-none transition-all ${
                            fieldErrors.academyName
                              ? 'border-rose-500 bg-rose-500/10 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                              : 'border-[var(--border-app)] bg-[var(--bg-surface-subtle)] text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]'
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
                          className="block text-xs font-semibold text-slate-300 mb-1.5"
                          htmlFor="sport"
                        >
                          {locale === 'ar' ? 'نوع الرياضة الأساسية *' : 'Primary Sport *'}
                        </label>
                        <select
                          id="sport"
                          value={sport}
                          onChange={(e) => setSport(e.target.value)}
                          className="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] py-2.5 px-3 text-sm text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] outline-none transition-all cursor-pointer"
                        >
                          {SPORTS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value} className="bg-slate-900">
                              {opt.icon} {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label
                        className="block text-xs font-semibold text-slate-300 mb-1.5"
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
                          className="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] py-2.5 pr-3 pl-9 text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] outline-none transition-all"
                        />
                        <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Owner Info */}
                  <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-[var(--accent-primary)] tracking-wider uppercase">
                      <User className="h-4 w-4" />
                      <span>
                        {locale === 'ar' ? 'بيانات المالك وحساب الإدارة' : 'Owner & Admin Account'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          className="block text-xs font-semibold text-slate-300 mb-1.5"
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
                          placeholder={locale === 'ar' ? 'الكابتن أحمد محمود' : 'Captain Ahmed'}
                          className={`w-full rounded-xl border py-2.5 px-3 text-sm text-white placeholder-slate-500 outline-none transition-all ${
                            fieldErrors.ownerName
                              ? 'border-rose-500 bg-rose-500/10 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                              : 'border-[var(--border-app)] bg-[var(--bg-surface-subtle)] text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]'
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
                          className="block text-xs font-semibold text-slate-300 mb-1.5"
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
                            placeholder="+20 10 1234 5678"
                            dir="ltr"
                            className={`w-full rounded-xl border py-2.5 pr-3 pl-9 text-sm text-white placeholder-slate-500 outline-none transition-all ${
                              fieldErrors.phone
                                ? 'border-rose-500 bg-rose-500/10 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                                : 'border-[var(--border-app)] bg-[var(--bg-surface-subtle)] text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]'
                            }`}
                          />
                          <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
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
                        className="block text-xs font-semibold text-slate-300 mb-1.5"
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
                          placeholder="owner@academy.com"
                          dir="ltr"
                          className={`w-full rounded-xl border py-2.5 pr-3 pl-9 text-sm text-white placeholder-slate-500 outline-none transition-all ${
                            fieldErrors.email
                              ? 'border-rose-500 bg-rose-500/10 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                              : 'border-[var(--border-app)] bg-[var(--bg-surface-subtle)] text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]'
                          }`}
                        />
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                      </div>
                      {fieldErrors.email && (
                        <p className="mt-1.5 text-xs text-rose-400 flex items-center gap-1 animate-in fade-in duration-150">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>{fieldErrors.email}</span>
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          className="block text-xs font-semibold text-slate-300 mb-1.5"
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
                            className={`w-full rounded-xl border py-2.5 pr-3 pl-9 text-sm text-white placeholder-slate-500 outline-none transition-all ${
                              fieldErrors.password
                                ? 'border-rose-500 bg-rose-500/10 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                                : 'border-[var(--border-app)] bg-[var(--bg-surface-subtle)] text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute left-3 top-3 text-slate-500 hover:text-slate-300"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
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
                          className="block text-xs font-semibold text-slate-300 mb-1.5"
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
                          className={`w-full rounded-xl border py-2.5 px-3 text-sm text-white placeholder-slate-500 outline-none transition-all ${
                            fieldErrors.confirmPassword
                              ? 'border-rose-500 bg-rose-500/10 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                              : 'border-[var(--border-app)] bg-[var(--bg-surface-subtle)] text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]'
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
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] space-y-1.5">
                      <div className="font-semibold text-slate-400">
                        {locale === 'ar'
                          ? 'متطلبات كلمة المرور الآمنة:'
                          : 'Password Security Requirements:'}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <span
                          className={`flex items-center gap-1 ${
                            password.length >= 8 && password.length <= 100
                              ? 'text-emerald-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {password.length >= 8 && password.length <= 100 ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <span className="w-3 h-3 rounded-full border border-slate-600 inline-block" />
                          )}
                          <span>{locale === 'ar' ? '8+ أحرف' : '8+ chars'}</span>
                        </span>

                        <span
                          className={`flex items-center gap-1 ${
                            /[A-Z]/.test(password) ? 'text-emerald-400' : 'text-slate-500'
                          }`}
                        >
                          {/[A-Z]/.test(password) ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <span className="w-3 h-3 rounded-full border border-slate-600 inline-block" />
                          )}
                          <span>{locale === 'ar' ? 'حرف كبير (A-Z)' : 'Uppercase (A-Z)'}</span>
                        </span>

                        <span
                          className={`flex items-center gap-1 ${
                            /[a-z]/.test(password) ? 'text-emerald-400' : 'text-slate-500'
                          }`}
                        >
                          {/[a-z]/.test(password) ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <span className="w-3 h-3 rounded-full border border-slate-600 inline-block" />
                          )}
                          <span>{locale === 'ar' ? 'حرف صغير (a-z)' : 'Lowercase (a-z)'}</span>
                        </span>

                        <span
                          className={`flex items-center gap-1 ${
                            /[0-9]/.test(password) ? 'text-emerald-400' : 'text-slate-500'
                          }`}
                        >
                          {/[0-9]/.test(password) ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <span className="w-3 h-3 rounded-full border border-slate-600 inline-block" />
                          )}
                          <span>{locale === 'ar' ? 'رقم (0-9)' : 'Number (0-9)'}</span>
                        </span>
                      </div>
                    </div>
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
                <div className="mt-8 border-t border-slate-800 pt-6 text-center text-xs text-slate-400 relative z-10">
                  <span>
                    {locale === 'ar'
                      ? 'لديك حساب بالفعل وتريد تسجيل الدخول؟ '
                      : 'Already have an account? '}
                  </span>
                  <Link
                    href="/login"
                    className="font-semibold text-[var(--accent-primary)] hover:underline transition-colors"
                  >
                    {locale === 'ar' ? 'تسجيل الدخول إلى حسابك' : 'Sign in to your account'}
                  </Link>
                </div>
              </>
            )}
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
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
