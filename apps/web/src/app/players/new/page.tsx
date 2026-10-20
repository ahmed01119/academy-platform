'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { Navbar } from '../../../components/Navbar';
import { api } from '../../../lib/api-client';
import type {
  BranchSummary,
  CreatePlayerRequest,
  GuardianRelationship,
  PlayerGender,
} from '@academy/shared';
import {
  UserPlus,
  ChevronRight,
  AlertCircle,
  Save,
  User,
  Heart,
  Users,
  GitBranch,
} from 'lucide-react';

export default function NewPlayerPage() {
  const router = useRouter();
  const { user, activeTenant, isLoading } = useAuth();

  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<PlayerGender>('MALE');
  const [dateOfBirth, setDateOfBirth] = useState('');
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

    if (!firstName.trim() || !lastName.trim() || !dateOfBirth) {
      setErrorMessage('يرجى ملء بيانات الاسم الأول واسم العائلة وتاريخ الميلاد');
      return;
    }

    if (!emergencyContactName.trim() || !emergencyContactPhone.trim()) {
      setErrorMessage('يرجى ملء اسم ورقم هاتف الطوارئ');
      return;
    }

    if (!guardianName.trim() || !guardianPhone.trim()) {
      setErrorMessage('يرجى ملء اسم ورقم هاتف ولي الأمر');
      return;
    }

    if (!branchId) {
      setErrorMessage('يرجى اختيار الفرع المراد قيد اللاعب به');
      return;
    }

    const guardianParts = guardianName.trim().split(/\s+/);
    const guardianFirstName = guardianParts[0] || 'ولي';
    const guardianLastName = guardianParts.slice(1).join(' ') || 'أمر';

    setIsSubmitting(true);
    try {
      const payload: CreatePlayerRequest = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gender,
        dateOfBirth,
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
      const msg = err instanceof Error ? err.message : 'فشل في تسجيل اللاعب';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return null;
  }

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
          <Link href="/players" className="hover:text-white transition-colors">
            اللاعبين
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-[#45c387]">تسجيل لاعب جديد</span>
        </div>

        {/* Page Title */}
        <div className="border-b border-[#234235] pb-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <UserPlus className="h-7 w-7 text-[#2f9e6b]" />
            استمارة تسجيل لاعب جديد
          </h1>
          <p className="text-xs text-[#9bb5a8] mt-1">
            تسجيل بيانات اللاعب الرياضية وتعيين ولي الأمر وقيده بالفرع المستهدف فوراً.
          </p>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-[#ef4444]/40 bg-[#ef4444]/10 p-4 text-xs text-[#fca5a5] flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-[#ef4444]" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Basic Information */}
          <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 backdrop-blur-md space-y-4">
            <div className="flex items-center gap-2 border-b border-[#234235] pb-3 text-sm font-bold text-white">
              <User className="h-4 w-4 text-[#2f9e6b]" />
              <span>1. البيانات الشخصية للاعب</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#9bb5a8] mb-1.5">
                  الاسم الأول *
                </label>
                <input
                  type="text"
                  required
                  id="input-first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="مثال: يوسف"
                  className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9bb5a8] mb-1.5">
                  اسم العائلة *
                </label>
                <input
                  type="text"
                  required
                  id="input-last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="مثال: الشريف"
                  className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9bb5a8] mb-1.5">الجنس *</label>
                <select
                  id="select-gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value as PlayerGender)}
                  className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
                >
                  <option value="MALE">ذكر</option>
                  <option value="FEMALE">أنثى</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9bb5a8] mb-1.5">
                  تاريخ الميلاد *
                </label>
                <input
                  type="date"
                  required
                  id="input-dob"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#9bb5a8] mb-1.5">
                  الرقم القومي / جواز السفر (اختياري)
                </label>
                <input
                  type="text"
                  id="input-national-id"
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  placeholder="14 رقم للرقم القومي"
                  className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Emergency & Health */}
          <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 backdrop-blur-md space-y-4">
            <div className="flex items-center gap-2 border-b border-[#234235] pb-3 text-sm font-bold text-white">
              <Heart className="h-4 w-4 text-[#ef4444]" />
              <span>2. بيانات الطوارئ والملاحظات الطبية</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#9bb5a8] mb-1.5">
                  اسم جهة الاتصال للطوارئ *
                </label>
                <input
                  type="text"
                  required
                  id="input-emergency-name"
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  placeholder="مثال: أحمد الشريف (الأب)"
                  className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9bb5a8] mb-1.5">
                  هاتف الطوارئ *
                </label>
                <input
                  type="tel"
                  required
                  id="input-emergency-phone"
                  value={emergencyContactPhone}
                  onChange={(e) => setEmergencyContactPhone(e.target.value)}
                  placeholder="مثال: +201012345678"
                  className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#9bb5a8] mb-1.5">
                  ملاحظات طبية أو حساسية (اختياري)
                </label>
                <textarea
                  rows={2}
                  id="textarea-medical-notes"
                  value={medicalNotes}
                  onChange={(e) => setMedicalNotes(e.target.value)}
                  placeholder="أي حساسيات أو حالات صحية ينبغي للمدربين مراعاتها..."
                  className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Primary Guardian */}
          <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 backdrop-blur-md space-y-4">
            <div className="flex items-center gap-2 border-b border-[#234235] pb-3 text-sm font-bold text-white">
              <Users className="h-4 w-4 text-[#2f9e6b]" />
              <span>3. بيانات ولي الأمر الأساسي</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#9bb5a8] mb-1.5">
                  الاسم الكامل لولي الأمر *
                </label>
                <input
                  type="text"
                  required
                  id="input-guardian-name"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder="الاسم الثلاثي لولي الأمر"
                  className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9bb5a8] mb-1.5">
                  صلة القرابة *
                </label>
                <select
                  id="select-guardian-relationship"
                  value={guardianRelationship}
                  onChange={(e) => setGuardianRelationship(e.target.value as GuardianRelationship)}
                  className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
                >
                  <option value="FATHER">الأب</option>
                  <option value="MOTHER">الأم</option>
                  <option value="GUARDIAN">وصي قانوني</option>
                  <option value="RELATIVE">أقارب (أخ / أخت / عم / خال)</option>
                  <option value="OTHER">أخرى</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9bb5a8] mb-1.5">
                  رقم الهاتف *
                </label>
                <input
                  type="tel"
                  required
                  id="input-guardian-phone"
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                  placeholder="رقم الهاتف المحمول لولي الأمر"
                  className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9bb5a8] mb-1.5">
                  البريد الإلكتروني (اختياري)
                </label>
                <input
                  type="email"
                  id="input-guardian-email"
                  value={guardianEmail}
                  onChange={(e) => setGuardianEmail(e.target.value)}
                  placeholder="parent@example.com"
                  className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Initial Branch Enrollment */}
          <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 backdrop-blur-md space-y-4">
            <div className="flex items-center gap-2 border-b border-[#234235] pb-3 text-sm font-bold text-white">
              <GitBranch className="h-4 w-4 text-[#3b82f6]" />
              <span>4. القيد بفرع الأكاديمية</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#9bb5a8] mb-1.5">
                  الفرع المخصص *
                </label>
                <select
                  required
                  id="select-initial-branch"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
                >
                  <option value="">اختر الفرع...</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.city ? `(${b.city})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9bb5a8] mb-1.5">
                  تاريخ بدء القيد
                </label>
                <input
                  type="date"
                  id="input-enrollment-start"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] px-3.5 py-2.5 text-xs text-[#e8f0ec] focus:border-[#2f9e6b] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Actions Bar */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#234235]">
            <Link
              href="/players"
              className="rounded-xl border border-[#234235] bg-[#0f1c18] px-5 py-2.5 text-xs font-semibold text-[#9bb5a8] hover:text-white transition-colors"
            >
              إلغاء
            </Link>

            <button
              type="submit"
              id="btn-submit-player"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] px-6 py-2.5 text-xs font-semibold text-[#062016] shadow-lg shadow-[#2f9e6b]/20 hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>{isSubmitting ? 'جارٍ الحفظ...' : 'تسجيل وقيد اللاعب'}</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
