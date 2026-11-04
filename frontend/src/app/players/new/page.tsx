'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useLocale } from '@/contexts/locale-context';
import { AppShell } from '../../../components/layout/AppShell';
import { PageHeader } from '../../../components/ui/PageHeader';
import { api } from '@/api/client';
import type {
  BranchSummary,
  CreatePlayerRequest,
  GuardianRelationship,
  PlayerGender,
} from '@academy/shared';
import { UserPlus, AlertCircle, Save, User, Heart, Users, GitBranch } from 'lucide-react';

export default function NewPlayerPage() {
  const router = useRouter();
  const { user, activeTenant, isLoading } = useAuth();
  const { locale } = useLocale();

  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<PlayerGender>('MALE');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [useBirthYearOnly, setUseBirthYearOnly] = useState(false);
  const [birthYear, setBirthYear] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [nationalId, setNationalId] = useState('');

  // Emergency & Medical
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');

  // Guardian
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState<GuardianRelationship>('FATHER');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');

  // Branch
  const [branchId, setBranchId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user && activeTenant) {
      void api.branches
        .list({ status: 'ACTIVE' })
        .then((data) => {
          setBranches(data);
          if (data.length > 0 && data[0]?.id) {
            setBranchId((prev) => prev || data[0]?.id || '');
          }
        })
        .catch(() => []);
    }
  }, [user, activeTenant]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const effectiveDob = useBirthYearOnly
      ? birthYear.trim()
        ? `${birthYear.trim()}-01-01`
        : ''
      : dateOfBirth;

    if (!firstName.trim() || !lastName.trim() || !effectiveDob) {
      setErrorMessage(
        locale === 'ar'
          ? (useBirthYearOnly
              ? 'يرجى ملء بيانات الاسم الأول واسم العائلة وسنة الميلاد'
              : 'يرجى ملء بيانات الاسم الأول واسم العائلة وتاريخ الميلاد')
          : (useBirthYearOnly
              ? 'Please fill in first name, last name, and birth year'
              : 'Please fill in first name, last name, and date of birth'),
      );
      return;
    }

    if (useBirthYearOnly) {
      const parsedYear = parseInt(birthYear.trim(), 10);
      const currentYear = new Date().getFullYear();
      if (isNaN(parsedYear) || parsedYear < 1950 || parsedYear > currentYear) {
        setErrorMessage(locale === 'ar' ? `يرجى إدخال سنة ميلاد صحيحة بين 1950 و ${currentYear}` : `Please enter a valid birth year between 1950 and ${currentYear}`);
        return;
      }
    }

    if (!emergencyContactName.trim() || !emergencyContactPhone.trim()) {
      setErrorMessage(locale === 'ar' ? 'يرجى ملء اسم ورقم هاتف الطوارئ' : 'Please fill in emergency contact name and phone');
      return;
    }

    if (!guardianName.trim() || !guardianPhone.trim()) {
      setErrorMessage(locale === 'ar' ? 'يرجى ملء اسم ورقم هاتف ولي الأمر' : 'Please fill in guardian name and phone number');
      return;
    }

    if (!branchId) {
      setErrorMessage(locale === 'ar' ? 'يرجى اختيار الفرع المراد قيد اللاعب به' : 'Please select a branch to enroll the player in');
      return;
    }

    const guardianParts = guardianName.trim().split(/\s+/);
    const guardianFirstName = guardianParts[0] || (locale === 'ar' ? 'ولي' : 'Guardian');
    const guardianLastName = guardianParts.slice(1).join(' ') || (locale === 'ar' ? 'أمر' : 'Contact');

    setIsSubmitting(true);
    try {
      const payload: CreatePlayerRequest = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gender,
        dateOfBirth: effectiveDob,
        birthYear: useBirthYearOnly ? parseInt(birthYear.trim(), 10) : undefined,
        jerseyNumber: jerseyNumber.trim() ? parseInt(jerseyNumber.trim(), 10) : undefined,
        nationalId: nationalId.trim() || undefined,
        emergencyContactName: emergencyContactName.trim(),
        emergencyContactPhone: emergencyContactPhone.trim(),
        medicalNotes: medicalNotes.trim() || undefined,
        initialBranchId: branchId,
        sport: 'FOOTBALL',
        primaryGuardian: {
          firstName: guardianFirstName,
          lastName: guardianLastName,
          relationship: guardianRelationship,
          phone: guardianPhone.trim(),
          email: guardianEmail.trim() || undefined,
          isPrimary: true,
        },
      };

      const created = await api.players.create(payload);
      router.push(`/players/${created.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (locale === 'ar' ? 'فشل في تسجيل اللاعب' : 'Failed to enroll player');
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <AppShell
      breadcrumbs={[
        { label: locale === 'ar' ? 'اللاعبين' : 'Athletes', href: '/players' },
        { label: locale === 'ar' ? 'تسجيل لاعب جديد' : 'Enroll New Player' },
      ]}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <PageHeader
          title={locale === 'ar' ? 'استمارة تسجيل لاعب جديد' : 'New Athlete Enrollment Form'}
          description={locale === 'ar' ? 'تسجيل بيانات اللاعب الرياضية وتعيين ولي الأمر وقيده بالفرع المستهدف فوراً.' : 'Register athlete athletic profile, assign primary guardian, and enroll in target branch.'}
          icon={UserPlus}
        />

        {errorMessage && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-500 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Basic Information */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3 text-sm font-bold text-[var(--text-main)]">
              <User className="h-4 w-4 text-[var(--accent-primary)]" />
              <span>{locale === 'ar' ? '1. البيانات الشخصية للاعب' : '1. Athlete Personal Information'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                  {locale === 'ar' ? 'الاسم الأول *' : 'First Name *'}
                </label>
                <input
                  type="text"
                  required
                  id="input-first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={locale === 'ar' ? 'مثال: يوسف' : 'e.g. Youssef'}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                  {locale === 'ar' ? 'اسم العائلة *' : 'Last Name *'}
                </label>
                <input
                  type="text"
                  required
                  id="input-last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={locale === 'ar' ? 'مثال: الشريف' : 'e.g. El-Sharif'}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                  {locale === 'ar' ? 'الجنس *' : 'Gender *'}
                </label>
                <select
                  id="select-gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value as PlayerGender)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                >
                  <option value="MALE">{locale === 'ar' ? 'ذكر' : 'Male'}</option>
                  <option value="FEMALE">{locale === 'ar' ? 'أنثى' : 'Female'}</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[var(--text-muted)]">
                    {useBirthYearOnly ? (locale === 'ar' ? 'سنة الميلاد *' : 'Birth Year *') : (locale === 'ar' ? 'تاريخ الميلاد *' : 'Date of Birth *')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setUseBirthYearOnly(!useBirthYearOnly)}
                    className="text-[11px] text-[var(--accent-primary)] hover:underline font-medium"
                  >
                    {useBirthYearOnly ? (locale === 'ar' ? 'استخدام تاريخ كامل' : 'Use Full Date') : (locale === 'ar' ? 'سنة الميلاد فقط' : 'Year Only')}
                  </button>
                </div>
                {useBirthYearOnly ? (
                  <input
                    type="number"
                    required
                    id="input-birth-year"
                    min="1950"
                    max={new Date().getFullYear()}
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    placeholder={locale === 'ar' ? 'مثال: 2015' : 'e.g. 2015'}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                  />
                ) : (
                  <input
                    type="date"
                    required
                    id="input-dob"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                  {locale === 'ar' ? 'رقم القميص (اختياري)' : 'Jersey Number (Optional)'}
                </label>
                <input
                  type="number"
                  id="input-jersey-number"
                  min="1"
                  max="99"
                  value={jerseyNumber}
                  onChange={(e) => setJerseyNumber(e.target.value)}
                  placeholder={locale === 'ar' ? 'مثال: 10' : 'e.g. 10'}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                  {locale === 'ar' ? 'الرقم القومي / جواز السفر (اختياري)' : 'National ID / Passport (Optional)'}
                </label>
                <input
                  type="text"
                  id="input-national-id"
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  placeholder={locale === 'ar' ? '14 رقم للرقم القومي' : 'National ID or Passport number'}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Emergency & Health */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3 text-sm font-bold text-[var(--text-main)]">
              <Heart className="h-4 w-4 text-red-500" />
              <span>{locale === 'ar' ? '2. بيانات الطوارئ والملاحظات الطبية' : '2. Emergency & Medical Information'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                  {locale === 'ar' ? 'اسم جهة الاتصال للطوارئ *' : 'Emergency Contact Name *'}
                </label>
                <input
                  type="text"
                  required
                  id="input-emergency-name"
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  placeholder={locale === 'ar' ? 'مثال: أحمد الشريف (الأب)' : 'e.g. Ahmed El-Sharif (Father)'}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                  {locale === 'ar' ? 'هاتف الطوارئ *' : 'Emergency Phone *'}
                </label>
                <input
                  type="tel"
                  required
                  id="input-emergency-phone"
                  value={emergencyContactPhone}
                  onChange={(e) => setEmergencyContactPhone(e.target.value)}
                  placeholder="مثال: +201012345678"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                  {locale === 'ar' ? 'ملاحظات طبية أو حساسية (اختياري)' : 'Medical Notes or Allergies (Optional)'}
                </label>
                <textarea
                  rows={2}
                  id="textarea-medical-notes"
                  value={medicalNotes}
                  onChange={(e) => setMedicalNotes(e.target.value)}
                  placeholder={locale === 'ar' ? 'أي حساسيات أو حالات صحية ينبغي للمدربين مراعاتها...' : 'Any medical conditions, allergies, or notes for coaches...'}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Primary Guardian */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3 text-sm font-bold text-[var(--text-main)]">
              <Users className="h-4 w-4 text-[var(--accent-primary)]" />
              <span>{locale === 'ar' ? '3. بيانات ولي الأمر الأساسي' : '3. Primary Guardian Information'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                  {locale === 'ar' ? 'الاسم الكامل لولي الأمر *' : 'Guardian Full Name *'}
                </label>
                <input
                  type="text"
                  required
                  id="input-guardian-name"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder={locale === 'ar' ? 'الاسم الثلاثي لولي الأمر' : 'Guardian full name'}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                  {locale === 'ar' ? 'صلة القرابة *' : 'Relationship *'}
                </label>
                <select
                  id="select-guardian-relationship"
                  value={guardianRelationship}
                  onChange={(e) => setGuardianRelationship(e.target.value as GuardianRelationship)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                >
                  <option value="FATHER">{locale === 'ar' ? 'الأب' : 'Father'}</option>
                  <option value="MOTHER">{locale === 'ar' ? 'الأم' : 'Mother'}</option>
                  <option value="GUARDIAN">{locale === 'ar' ? 'وصي قانوني' : 'Legal Guardian'}</option>
                  <option value="RELATIVE">{locale === 'ar' ? 'أقارب' : 'Relative'}</option>
                  <option value="OTHER">{locale === 'ar' ? 'أخرى' : 'Other'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                  {locale === 'ar' ? 'رقم الهاتف *' : 'Phone Number *'}
                </label>
                <input
                  type="tel"
                  required
                  id="input-guardian-phone"
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                  placeholder={locale === 'ar' ? 'رقم الهاتف المحمول لولي الأمر' : 'Guardian mobile number'}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                  {locale === 'ar' ? 'البريد الإلكتروني (اختياري)' : 'Email Address (Optional)'}
                </label>
                <input
                  type="email"
                  id="input-guardian-email"
                  value={guardianEmail}
                  onChange={(e) => setGuardianEmail(e.target.value)}
                  placeholder="parent@example.com"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Initial Branch Enrollment */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3 text-sm font-bold text-[var(--text-main)]">
              <GitBranch className="h-4 w-4 text-[var(--accent-primary)]" />
              <span>{locale === 'ar' ? '4. القيد بفرع الأكاديمية' : '4. Branch Enrollment'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                  {locale === 'ar' ? 'الفرع المخصص *' : 'Assigned Branch *'}
                </label>
                <select
                  required
                  id="select-initial-branch"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                >
                  <option value="">{locale === 'ar' ? 'اختر الفرع...' : 'Select branch...'}</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.city ? `(${b.city})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                  {locale === 'ar' ? 'تاريخ بدء القيد' : 'Enrollment Start Date'}
                </label>
                <input
                  type="date"
                  id="input-enrollment-start"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Actions Bar */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
            <Link
              href="/players"
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-5 py-2.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
            >
              إلغاء
            </Link>

            <button
              type="submit"
              id="btn-submit-player"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] text-white px-6 py-2.5 text-xs font-semibold shadow-sm hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>{isSubmitting ? (locale === 'ar' ? 'جارٍ الحفظ...' : 'Saving...') : (locale === 'ar' ? 'تسجيل وقيد اللاعب' : 'Enroll Athlete')}</span>
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
