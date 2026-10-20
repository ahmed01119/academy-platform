'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '../../components/Navbar';
import { useAuth } from '../../lib/auth-context';
import { api, ApiError } from '../../lib/api-client';
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  RefreshCw,
  LogOut,
  Mail,
  Lock,
  Building2,
  User,
  Key,
  CheckCircle2,
  AlertCircle,
  Activity,
  Terminal,
  Send,
  UserPlus,
  LogIn,
  RotateCw,
  type LucideIcon,
} from 'lucide-react';

type TabId = 'session' | 'register' | 'login' | 'email' | 'password' | 'tenant' | 'security';

interface TestLog {
  id: string;
  timestamp: string;
  flow: string;
  status: 'SUCCESS' | 'ERROR' | 'INFO';
  statusCode?: number;
  message: string;
  details?: unknown;
}

export default function AuthTestPage() {
  const {
    user,
    activeTenant,
    memberships,
    isLoading: isAuthLoading,
    login,
    register,
    logout,
    refreshToken,
    switchTenant,
    refreshUser,
  } = useAuth();

  // Test Harness Logs
  const [logs, setLogs] = useState<TestLog[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('session');

  // Form states - Registration
  const [regAcademyName, setRegAcademyName] = useState('أكاديمية النخبة الرياضية');
  const [regSport, setRegSport] = useState('FOOTBALL');
  const [regOwnerName, setRegOwnerName] = useState('الكابتن عبد الرحمن');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('+201012345678');
  const [regPassword, setRegPassword] = useState('P@ssword123!');
  const [isRegistering, setIsRegistering] = useState(false);

  // Form states - Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('P@ssword123!');
  const [loginRememberMe, setLoginRememberMe] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Form states - Email Verification
  const [verifyEmailAddress, setVerifyEmailAddress] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [lastDebugVerificationToken, setLastDebugVerificationToken] = useState<string | null>(null);
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);

  // Form states - Password Reset
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('NewP@ssword456!');
  const [lastDebugResetToken, setLastDebugResetToken] = useState<string | null>(null);
  const [isSendingForgot, setIsSendingForgot] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Form states - Switch Tenant
  const [targetTenantId, setTargetTenantId] = useState('');
  const [isSwitchingTenant, setIsSwitchingTenant] = useState(false);

  // General action loaders
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);
  const [isFetchingMe, setIsFetchingMe] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isTestingSecurity, setIsTestingSecurity] = useState(false);

  // Set default unique email for rapid testing
  useEffect(() => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const generatedEmail = `test.user.${randomSuffix}@academy-test.local`;
    setRegEmail(generatedEmail);
    setLoginEmail(generatedEmail);
    setVerifyEmailAddress(generatedEmail);
    setForgotEmail(generatedEmail);
  }, []);

  // Update target tenant id when memberships change
  useEffect(() => {
    if (memberships.length > 0 && !targetTenantId) {
      setTargetTenantId(memberships[0]?.tenantId || '');
    }
  }, [memberships, targetTenantId]);

  const addLog = useCallback(
    (
      flow: string,
      status: 'SUCCESS' | 'ERROR' | 'INFO',
      message: string,
      statusCode?: number,
      details?: unknown,
    ) => {
      const newEntry: TestLog = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour12: false }),
        flow,
        status,
        statusCode,
        message,
        details,
      };
      setLogs((prev) => [newEntry, ...prev.slice(0, 49)]); // keep latest 50
    },
    [],
  );

  // 1. Flow: Register Account & Academy
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegistering) return;
    setIsRegistering(true);

    try {
      addLog('Register', 'INFO', `بدء تسجيل حساب جديد: ${regEmail}...`);
      await register({
        academyName: regAcademyName.trim(),
        sport: 'FOOTBALL',
        name: regOwnerName.trim(),
        email: regEmail.trim().toLowerCase(),
        phone: regPhone.trim() || undefined,
        password: regPassword,
      });

      addLog(
        'Register',
        'SUCCESS',
        `تم تسجيل الأكاديمية بنجاح وتعيين ملف الجلسة للمستخدم: ${regEmail}`,
        201,
      );
      setLoginEmail(regEmail);
      setVerifyEmailAddress(regEmail);
      setForgotEmail(regEmail);
    } catch (err: unknown) {
      const status = err instanceof ApiError ? err.statusCode : 500;
      const msg = err instanceof Error ? err.message : 'فشل التسجيل';
      addLog('Register', 'ERROR', msg, status, err instanceof ApiError ? err.details : undefined);
    } finally {
      setIsRegistering(false);
    }
  };

  // 2. Flow: Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;
    setIsLoggingIn(true);

    try {
      addLog('Login', 'INFO', `محاولة تسجيل الدخول للمستخدم: ${loginEmail}...`);
      await login({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
        rememberMe: loginRememberMe,
      });

      addLog('Login', 'SUCCESS', `تم تسجيل الدخول بنجاح وتثبيت ملفات تعريف الارتباط HttpOnly`, 200);
    } catch (err: unknown) {
      const status = err instanceof ApiError ? err.statusCode : 500;
      const msg = err instanceof Error ? err.message : 'فشل تسجيل الدخول';
      addLog('Login', 'ERROR', msg, status, err instanceof ApiError ? err.details : undefined);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 3. Flow: Logout
  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      addLog('Logout', 'INFO', 'إرسال طلب تسجيل الخروج وإبطال الجلسة...');
      await logout();
      addLog('Logout', 'SUCCESS', 'تم تسجيل الخروج بنجاح ومسح ملفات تعريف الارتباط بالكامل', 200);
    } catch (err: unknown) {
      const status = err instanceof ApiError ? err.statusCode : 500;
      const msg = err instanceof Error ? err.message : 'فشل تسجيل الخروج';
      addLog('Logout', 'ERROR', msg, status);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // 4. Flow: Refresh Token
  const handleRefreshToken = async () => {
    if (isRefreshingToken) return;
    setIsRefreshingToken(true);

    try {
      addLog('RefreshToken', 'INFO', 'طلب تدوير رمز الوصول وتحديث الجلسة (/auth/refresh)...');
      await refreshToken();
      addLog(
        'RefreshToken',
        'SUCCESS',
        'تم تدوير رمز التحديث بنجاح واستلام رمز وصول جديد مع الحفاظ على عزل الجلسة',
        200,
      );
    } catch (err: unknown) {
      const status = err instanceof ApiError ? err.statusCode : 500;
      const msg = err instanceof Error ? err.message : 'فشل تدوير رمز التحديث';
      addLog(
        'RefreshToken',
        'ERROR',
        msg,
        status,
        err instanceof ApiError ? err.details : undefined,
      );
    } finally {
      setIsRefreshingToken(false);
    }
  };

  // 5. Flow: Get Current Authenticated User (/auth/me)
  const handleGetMe = async () => {
    if (isFetchingMe) return;
    setIsFetchingMe(true);

    try {
      addLog('GetMe', 'INFO', 'استعلام بيانات الجلسة الحالية من خادم الـ API (/auth/me)...');
      const meData = await api.auth.getMe();
      await refreshUser();
      addLog(
        'GetMe',
        'SUCCESS',
        `تم جلب بيانات الجلسة بنجاح: ${meData.user.email} (المستأجر النشط: ${meData.activeTenant?.tenantName || 'لا يوجد'})`,
        200,
        meData,
      );
    } catch (err: unknown) {
      const status = err instanceof ApiError ? err.statusCode : 500;
      const msg = err instanceof Error ? err.message : 'فشل جلب بيانات الجلسة الحالية';
      addLog('GetMe', 'ERROR', msg, status, err instanceof ApiError ? err.details : undefined);
    } finally {
      setIsFetchingMe(false);
    }
  };

  // 6. Flow: Resend Email Verification
  const handleResendVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isResendingVerification) return;
    setIsResendingVerification(true);

    try {
      addLog('ResendVerification', 'INFO', `إرسال رمز التحقق للبريد: ${verifyEmailAddress}...`);
      const res = await api.auth.resendVerification(verifyEmailAddress.trim().toLowerCase());
      if (res.debugToken) {
        setLastDebugVerificationToken(res.debugToken);
        setVerifyToken(res.debugToken);
        addLog(
          'ResendVerification',
          'SUCCESS',
          `تم إنشاء رمز التحقق (بيئة الاختبار): تم استخراج الرمز تلقائياً للاختبار السريع`,
          200,
          { debugToken: res.debugToken },
        );
      } else {
        addLog(
          'ResendVerification',
          'SUCCESS',
          'تم إرسال بريد التحقق بنجاح (راجع مزود البريد أو السجلات)',
          200,
        );
      }
    } catch (err: unknown) {
      const status = err instanceof ApiError ? err.statusCode : 500;
      const msg = err instanceof Error ? err.message : 'فشل إرسال رمز التحقق';
      addLog(
        'ResendVerification',
        'ERROR',
        msg,
        status,
        err instanceof ApiError ? err.details : undefined,
      );
    } finally {
      setIsResendingVerification(false);
    }
  };

  // 7. Flow: Verify Email
  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isVerifyingEmail) return;
    setIsVerifyingEmail(true);

    try {
      addLog('VerifyEmail', 'INFO', `التحقق من البريد الإلكتروني بالرمز المُدخل...`);
      const res = await api.auth.verifyEmail(verifyToken.trim());
      addLog('VerifyEmail', 'SUCCESS', res.message || 'تم تأكيد البريد الإلكتروني بنجاح', 200);
      await refreshUser();
    } catch (err: unknown) {
      const status = err instanceof ApiError ? err.statusCode : 500;
      const msg = err instanceof Error ? err.message : 'فشل تأكيد البريد الإلكتروني';
      addLog(
        'VerifyEmail',
        'ERROR',
        msg,
        status,
        err instanceof ApiError ? err.details : undefined,
      );
    } finally {
      setIsVerifyingEmail(false);
    }
  };

  // 8. Flow: Forgot Password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSendingForgot) return;
    setIsSendingForgot(true);

    try {
      addLog('ForgotPassword', 'INFO', `طلب رابط استعادة كلمة المرور للبريد: ${forgotEmail}...`);
      const res = await api.auth.forgotPassword({ email: forgotEmail.trim().toLowerCase() });
      if (res.debugToken) {
        setLastDebugResetToken(res.debugToken);
        setResetToken(res.debugToken);
        addLog(
          'ForgotPassword',
          'SUCCESS',
          `تم إنشاء رمز استعادة كلمة المرور (بيئة الاختبار): تم نسخه لحقل الإعادة تلقائياً`,
          200,
          { debugToken: res.debugToken },
        );
      } else {
        addLog(
          'ForgotPassword',
          'SUCCESS',
          'تم إرسال تعليمات إعادة التعيين إن وجد حساب بهذا البريد',
          200,
        );
      }
    } catch (err: unknown) {
      const status = err instanceof ApiError ? err.statusCode : 500;
      const msg = err instanceof Error ? err.message : 'فشل طلب استعادة كلمة المرور';
      addLog(
        'ForgotPassword',
        'ERROR',
        msg,
        status,
        err instanceof ApiError ? err.details : undefined,
      );
    } finally {
      setIsSendingForgot(false);
    }
  };

  // 9. Flow: Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isResettingPassword) return;
    setIsResettingPassword(true);

    try {
      addLog('ResetPassword', 'INFO', 'تطبيق كلمة المرور الجديدة باستخدام الرمز المعتمد...');
      const res = await api.auth.resetPassword({
        token: resetToken.trim(),
        newPassword: resetNewPassword,
      });
      addLog(
        'ResetPassword',
        'SUCCESS',
        res.message || 'تم تحديث كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بها.',
        200,
      );
      setLoginPassword(resetNewPassword);
    } catch (err: unknown) {
      const status = err instanceof ApiError ? err.statusCode : 500;
      const msg = err instanceof Error ? err.message : 'فشل إعادة تعيين كلمة المرور';
      addLog(
        'ResetPassword',
        'ERROR',
        msg,
        status,
        err instanceof ApiError ? err.details : undefined,
      );
    } finally {
      setIsResettingPassword(false);
    }
  };

  // 10. Flow: Switch Academy / Tenant
  const handleSwitchTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSwitchingTenant || !targetTenantId) return;
    setIsSwitchingTenant(true);

    try {
      addLog('SwitchTenant', 'INFO', `التبديل إلى الأكاديمية المستهدفة: ${targetTenantId}...`);
      await switchTenant(targetTenantId);
      addLog(
        'SwitchTenant',
        'SUCCESS',
        `تم تبديل سياق المستأجر بنجاح وتحديث ترويسة x-tenant-id`,
        200,
      );
    } catch (err: unknown) {
      const status = err instanceof ApiError ? err.statusCode : 500;
      const msg = err instanceof Error ? err.message : 'فشل التبديل بين الأكاديميات';
      addLog(
        'SwitchTenant',
        'ERROR',
        msg,
        status,
        err instanceof ApiError ? err.details : undefined,
      );
    } finally {
      setIsSwitchingTenant(false);
    }
  };

  // Negative Tests: Verify security boundaries fail gracefully
  const runNegativeTest = async (
    testType: 'INVALID_CREDENTIALS' | 'EXPIRED_TOKEN' | 'UNAUTHORIZED',
  ) => {
    setIsTestingSecurity(true);
    try {
      if (testType === 'INVALID_CREDENTIALS') {
        addLog('SecurityTest', 'INFO', 'اختبار سلبي: محاولة تسجيل الدخول بكلمة مرور غير صحيحة...');
        await api.auth.login({
          email: 'nonexistent-user@invalid.test',
          password: 'WrongPassword999!',
          rememberMe: false,
        });
        addLog('SecurityTest', 'ERROR', 'خطأ أمني: سُمح بتسجيل الدخول ببيانات خاطئة!', 200);
      } else if (testType === 'EXPIRED_TOKEN') {
        addLog('SecurityTest', 'INFO', 'اختبار سلبي: محاولة التحقق برمز غير صالح أو منتهي...');
        await api.auth.verifyEmail('invalid-or-expired-token-boundary-test');
        addLog('SecurityTest', 'ERROR', 'خطأ أمني: تم قبول رمز تحقق عشوائي!', 200);
      } else if (testType === 'UNAUTHORIZED') {
        addLog(
          'SecurityTest',
          'INFO',
          'اختبار سلبي: محاولة تبديل لمستأجر غير مصرح به أو عشوائي...',
        );
        await api.tenancy.switchTenant('00000000-0000-0000-0000-000000000000');
        addLog('SecurityTest', 'ERROR', 'خطأ أمني: تم التبديل لمستأجر وهمي!', 200);
      }
    } catch (err: unknown) {
      const status = err instanceof ApiError ? err.statusCode : 500;
      const msg = err instanceof Error ? err.message : 'تم الرفض بنجاح';
      addLog(
        'SecurityTest',
        'SUCCESS',
        `نجح الاختبار الأمني: رفض الخادم الطلب بشكل صحيح برمز (${status}): ${msg}`,
        status,
        err instanceof ApiError ? err.details : undefined,
      );
    } finally {
      setIsTestingSecurity(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1c18] text-[#e8f0ec] flex flex-col selection:bg-[#2f9e6b] selection:text-[#062016]">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Top Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#234235] pb-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#2f9e6b]/30 bg-[#2f9e6b]/10 px-3 py-1 text-xs font-semibold text-[#45c387] mb-2">
              <Activity className="h-3.5 w-3.5" />
              <span>مختبر فحص ومصادقة سبرنت 1 (Sprint 1 Auth & Security Harness)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              لوحة اختبار عمليات المصادقة والأمان
            </h1>
            <p className="text-xs sm:text-sm text-[#9bb5a8] mt-1">
              فحص شامل وتفاعلي لجميع التدفقات العشرة للمصادقة وحماية الجلسات مع عزل RLS المتعدد.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              id="btn-refresh-user"
              onClick={handleGetMe}
              disabled={isFetchingMe}
              className="flex items-center gap-1.5 rounded-lg border border-[#2b4c3e] bg-[#162821] px-3 py-2 text-xs font-medium text-[#e8f0ec] hover:border-[#2f9e6b] hover:text-[#45c387] disabled:opacity-50 transition-all cursor-pointer"
            >
              {isFetchingMe ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#45c387]" />
              ) : (
                <User className="h-3.5 w-3.5 text-[#45c387]" />
              )}
              <span>فحص /auth/me</span>
            </button>

            <button
              type="button"
              id="btn-refresh-token"
              onClick={handleRefreshToken}
              disabled={isRefreshingToken}
              className="flex items-center gap-1.5 rounded-lg border border-[#2b4c3e] bg-[#162821] px-3 py-2 text-xs font-medium text-[#e8f0ec] hover:border-[#2f9e6b] hover:text-[#45c387] disabled:opacity-50 transition-all cursor-pointer"
            >
              {isRefreshingToken ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#45c387]" />
              ) : (
                <RotateCw className="h-3.5 w-3.5 text-[#45c387]" />
              )}
              <span>تدوير الرمز /refresh</span>
            </button>

            {user && (
              <button
                type="button"
                id="btn-logout"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isLoggingOut ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LogOut className="h-3.5 w-3.5" />
                )}
                <span>تسجيل الخروج</span>
              </button>
            )}
          </div>
        </div>

        {/* Current Auth Status Banner */}
        <div className="mb-8 rounded-2xl border border-[#234235] bg-[#162821]/80 p-5 backdrop-blur-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  user
                    ? 'bg-[#2f9e6b]/20 text-[#45c387] border border-[#2f9e6b]/40'
                    : 'bg-[#234235]/40 text-[#9bb5a8] border border-[#234235]'
                }`}
              >
                {user ? <ShieldCheck className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[#9bb5a8]">حالة الجلسة:</span>
                  {isAuthLoading ? (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>جارٍ التحقق من الجلسة...</span>
                    </span>
                  ) : user ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2f9e6b]/20 border border-[#2f9e6b]/40 px-2.5 py-0.5 text-xs font-bold text-[#45c387]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#45c387] animate-pulse" />
                      <span>جلسة نشطة ({user.email})</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 border border-rose-500/30 px-2.5 py-0.5 text-xs font-semibold text-rose-300">
                      <span>غير مسجل الدخول (Anonymous)</span>
                    </span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#9bb5a8]">
                  <span>
                    الاسم:{' '}
                    <strong className="text-white font-medium">{user ? user.name : '—'}</strong>
                  </span>
                  <span>
                    البريد:{' '}
                    <strong className="text-white font-medium">{user ? user.email : '—'}</strong>
                  </span>
                  <span>
                    حالة التحقق:{' '}
                    {user?.isEmailVerified ? (
                      <strong className="text-[#45c387]">مؤكد ✓</strong>
                    ) : user ? (
                      <strong className="text-amber-400">غير مؤكد ⚠</strong>
                    ) : (
                      '—'
                    )}
                  </span>
                  <span>
                    الأكاديمية النشطة:{' '}
                    <strong className="text-white font-medium">
                      {activeTenant?.tenantName || '—'}
                    </strong>
                  </span>
                  <span>
                    الدور:{' '}
                    <strong className="text-[#45c387] font-medium">
                      {activeTenant?.role || '—'}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-[#9bb5a8]">
              <span className="rounded-lg bg-[#0f1c18] border border-[#234235] px-3 py-1.5 font-mono text-[11px]">
                عدد العضويات: {memberships.length}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 flex overflow-x-auto border-b border-[#234235] pb-px scrollbar-none gap-2">
          {(
            [
              { id: 'session', label: '1. نظرة عامة وتفاصيل الجلسة', icon: User },
              { id: 'register', label: '2. تسجيل أكاديمية جديدة', icon: UserPlus },
              { id: 'login', label: '3. تسجيل الدخول', icon: LogIn },
              { id: 'email', label: '4. تأكيد البريد الإلكتروني', icon: Mail },
              { id: 'password', label: '5. استعادة كلمة المرور', icon: Key },
              { id: 'tenant', label: '6. التبديل بين الأكاديميات', icon: Building2 },
              { id: 'security', label: '7. الفحوصات الأمنية السلبية', icon: ShieldAlert },
            ] as Array<{ id: TabId; label: string; icon: LucideIcon }>
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all cursor-pointer ${
                  isActive
                    ? 'border-b-2 border-[#2f9e6b] bg-[#162821] text-[#45c387]'
                    : 'text-[#9bb5a8] hover:bg-[#162821]/50 hover:text-white'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-[#45c387]' : 'text-[#9bb5a8]'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Content Layout: Active Tab Form on Right (or top), Live Logs on Left (or bottom) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form Panel (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Tab: Session Overview */}
            {activeTab === 'session' && (
              <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#234235]">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <User className="h-5 w-5 text-[#2f9e6b]" />
                    <span>بيانات المستخدم وعضويات المستأجرين الحالية</span>
                  </h2>
                  <button
                    type="button"
                    onClick={handleGetMe}
                    disabled={isFetchingMe}
                    className="flex items-center gap-1.5 text-xs text-[#45c387] hover:underline cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isFetchingMe ? 'animate-spin' : ''}`} />
                    <span>تحديث الآن</span>
                  </button>
                </div>

                {user ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-[#0f1c18] border border-[#234235]">
                        <span className="text-[#9bb5a8] block mb-1">معرف المستخدم (ID):</span>
                        <code className="text-[#45c387] font-mono select-all">{user.id}</code>
                      </div>
                      <div className="p-3 rounded-xl bg-[#0f1c18] border border-[#234235]">
                        <span className="text-[#9bb5a8] block mb-1">البريد الإلكتروني:</span>
                        <span className="text-white font-medium">{user.email}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#0f1c18] border border-[#234235]">
                        <span className="text-[#9bb5a8] block mb-1">الاسم الكامل:</span>
                        <span className="text-white font-medium">{user.name}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#0f1c18] border border-[#234235]">
                        <span className="text-[#9bb5a8] block mb-1">حالة البريد الإلكتروني:</span>
                        <span
                          className={`font-semibold ${user.isEmailVerified ? 'text-[#45c387]' : 'text-amber-400'}`}
                        >
                          {user.isEmailVerified ? 'مفعل ومؤكد' : 'غير مؤكد'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <span className="text-xs font-bold text-white block mb-2">
                        الأكاديميات والعضويات ({memberships.length}):
                      </span>
                      {memberships.length > 0 ? (
                        <div className="space-y-2">
                          {memberships.map((m) => (
                            <div
                              key={m.tenantId}
                              className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-colors ${
                                m.tenantId === activeTenant?.tenantId
                                  ? 'bg-[#2f9e6b]/15 border-[#2f9e6b]/40 text-white'
                                  : 'bg-[#0f1c18] border-[#234235] text-[#9bb5a8]'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <Building2
                                  className={`h-4 w-4 ${m.tenantId === activeTenant?.tenantId ? 'text-[#45c387]' : 'text-[#9bb5a8]'}`}
                                />
                                <div>
                                  <span className="font-semibold block text-white">
                                    {m.tenantName}
                                  </span>
                                  <span className="text-[10px] text-[#9bb5a8] font-mono">
                                    ID: {m.tenantId}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="rounded bg-[#234235] px-2 py-0.5 text-[11px] font-medium text-[#45c387]">
                                  {m.role}
                                </span>
                                {m.tenantId !== activeTenant?.tenantId && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await switchTenant(m.tenantId);
                                      addLog(
                                        'SwitchTenant',
                                        'SUCCESS',
                                        `تم التبديل للأكاديمية: ${m.tenantName}`,
                                        200,
                                      );
                                    }}
                                    className="rounded border border-[#2b4c3e] px-2 py-1 text-[11px] text-[#e8f0ec] hover:border-[#2f9e6b] transition-colors"
                                  >
                                    تبديل إليها
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#9bb5a8]">لا توجد عضويات مسجلة لهذا الحساب.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Lock className="h-10 w-10 text-[#9bb5a8] mx-auto mb-2 opacity-50" />
                    <p className="text-xs text-[#9bb5a8]">
                      لا توجد جلسة نشطة حالياً. يرجى تسجيل الدخول أو إنشاء حساب لاختبار المصادقة.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Register */}
            {activeTab === 'register' && (
              <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#234235]">
                  <UserPlus className="h-5 w-5 text-[#2f9e6b]" />
                  <h2 className="text-base font-bold text-white">
                    تسجيل حساب جديد وتأسيس أكاديمية
                  </h2>
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#9bb5a8] mb-1">
                        اسم الأكاديمية
                      </label>
                      <input
                        id="reg-academy-name"
                        type="text"
                        required
                        value={regAcademyName}
                        onChange={(e) => setRegAcademyName(e.target.value)}
                        className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] py-2 px-3 text-xs text-white placeholder-[#5a7a6c] focus:border-[#2f9e6b] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#9bb5a8] mb-1">
                        نوع الرياضة
                      </label>
                      <select
                        id="reg-sport"
                        value={regSport}
                        onChange={(e) => setRegSport(e.target.value)}
                        className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] py-2 px-3 text-xs text-white focus:border-[#2f9e6b] outline-none"
                      >
                        <option value="FOOTBALL">كرة قدم (Football)</option>
                        <option value="PADEL">بادل (Padel)</option>
                        <option value="SWIMMING">سباحة (Swimming)</option>
                        <option value="BASKETBALL">كرة سلة (Basketball)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#9bb5a8] mb-1">
                        اسم المالك
                      </label>
                      <input
                        id="reg-owner-name"
                        type="text"
                        required
                        value={regOwnerName}
                        onChange={(e) => setRegOwnerName(e.target.value)}
                        className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] py-2 px-3 text-xs text-white placeholder-[#5a7a6c] focus:border-[#2f9e6b] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#9bb5a8] mb-1">
                        رقم الهاتف
                      </label>
                      <input
                        id="reg-phone"
                        type="tel"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        dir="ltr"
                        className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] py-2 px-3 text-xs text-white placeholder-[#5a7a6c] focus:border-[#2f9e6b] outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#9bb5a8] mb-1">
                        البريد الإلكتروني
                      </label>
                      <input
                        id="reg-email"
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        dir="ltr"
                        className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] py-2 px-3 text-xs text-white placeholder-[#5a7a6c] focus:border-[#2f9e6b] outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#9bb5a8] mb-1">
                        كلمة المرور
                      </label>
                      <input
                        id="reg-password"
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        dir="ltr"
                        className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] py-2 px-3 text-xs text-white placeholder-[#5a7a6c] focus:border-[#2f9e6b] outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    id="btn-submit-register"
                    disabled={isRegistering}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] py-2.5 text-xs font-bold text-[#062016] hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {isRegistering ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>جارٍ إرسال طلب التأسيس...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" />
                        <span>تنفيذ طلب التسجيل (POST /v1/auth/register)</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* Tab: Login */}
            {activeTab === 'login' && (
              <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#234235]">
                  <LogIn className="h-5 w-5 text-[#2f9e6b]" />
                  <h2 className="text-base font-bold text-white">
                    تسجيل الدخول واستلام رموز الجلسة
                  </h2>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#9bb5a8] mb-1">
                      البريد الإلكتروني
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      dir="ltr"
                      className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] py-2 px-3 text-xs text-white placeholder-[#5a7a6c] focus:border-[#2f9e6b] outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#9bb5a8] mb-1">
                      كلمة المرور
                    </label>
                    <input
                      id="login-password"
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      dir="ltr"
                      className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] py-2 px-3 text-xs text-white placeholder-[#5a7a6c] focus:border-[#2f9e6b] outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      id="login-remember"
                      type="checkbox"
                      checked={loginRememberMe}
                      onChange={(e) => setLoginRememberMe(e.target.checked)}
                      className="rounded border-[#2b4c3e] bg-[#0f1c18] text-[#2f9e6b] focus:ring-[#2f9e6b] cursor-pointer"
                    />
                    <label
                      htmlFor="login-remember"
                      className="text-xs text-[#9bb5a8] cursor-pointer"
                    >
                      تذكر بيانات الجلسة (تمديد مدة رمز التحديث)
                    </label>
                  </div>

                  <button
                    type="submit"
                    id="btn-submit-login"
                    disabled={isLoggingIn}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] py-2.5 text-xs font-bold text-[#062016] hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {isLoggingIn ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>جارٍ تسجيل الدخول...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="h-4 w-4" />
                        <span>تسجيل الدخول (POST /v1/auth/login)</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* Tab: Email Verification */}
            {activeTab === 'email' && (
              <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#234235]">
                    <Mail className="h-5 w-5 text-[#2f9e6b]" />
                    <h2 className="text-base font-bold text-white">
                      إعادة إرسال وتأكيد البريد الإلكتروني
                    </h2>
                  </div>

                  {/* Step A: Resend Verification */}
                  <form onSubmit={handleResendVerification} className="space-y-3 mb-6">
                    <label className="block text-xs font-semibold text-[#9bb5a8]">
                      الخطوة 1: طلب إرسال رمز التحقق
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="verify-email-input"
                        type="email"
                        required
                        value={verifyEmailAddress}
                        onChange={(e) => setVerifyEmailAddress(e.target.value)}
                        placeholder="email@example.com"
                        dir="ltr"
                        className="flex-1 rounded-xl border border-[#2b4c3e] bg-[#0f1c18] py-2 px-3 text-xs text-white placeholder-[#5a7a6c] focus:border-[#2f9e6b] outline-none font-mono"
                      />
                      <button
                        type="submit"
                        id="btn-resend-verification"
                        disabled={isResendingVerification}
                        className="flex items-center gap-1.5 rounded-xl border border-[#2b4c3e] bg-[#162821] px-4 py-2 text-xs font-medium text-[#e8f0ec] hover:border-[#2f9e6b] hover:text-[#45c387] disabled:opacity-50 transition-all cursor-pointer"
                      >
                        {isResendingVerification ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        <span>إرسال الرمز</span>
                      </button>
                    </div>

                    {lastDebugVerificationToken && (
                      <div className="mt-2 p-3 rounded-xl bg-[#2f9e6b]/10 border border-[#2f9e6b]/30 text-xs">
                        <span className="text-[#45c387] font-semibold block mb-1">
                          رمز التحقق المستخرج تلقائياً (بيئة الاختبار):
                        </span>
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-[#7be4b0] font-mono text-[11px] truncate select-all">
                            {lastDebugVerificationToken}
                          </code>
                          <button
                            type="button"
                            onClick={() => setVerifyToken(lastDebugVerificationToken)}
                            className="shrink-0 rounded bg-[#2f9e6b] px-2 py-1 text-[10px] font-bold text-[#062016] hover:brightness-110"
                          >
                            تعبئة الحقل
                          </button>
                        </div>
                      </div>
                    )}
                  </form>

                  {/* Step B: Verify Token */}
                  <form
                    onSubmit={handleVerifyEmail}
                    className="space-y-3 pt-4 border-t border-[#234235]"
                  >
                    <label className="block text-xs font-semibold text-[#9bb5a8]">
                      الخطوة 2: إدخال رمز التحقق وتأكيد الحساب
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="verify-token-input"
                        type="text"
                        required
                        value={verifyToken}
                        onChange={(e) => setVerifyToken(e.target.value)}
                        placeholder="أدخل رمز التحقق (Verification Token)..."
                        dir="ltr"
                        className="flex-1 rounded-xl border border-[#2b4c3e] bg-[#0f1c18] py-2 px-3 text-xs text-white placeholder-[#5a7a6c] focus:border-[#2f9e6b] outline-none font-mono"
                      />
                      <button
                        type="submit"
                        id="btn-verify-email"
                        disabled={isVerifyingEmail}
                        className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] px-4 py-2 text-xs font-bold text-[#062016] hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
                      >
                        {isVerifyingEmail ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        <span>تأكيد البريد</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Tab: Password Reset */}
            {activeTab === 'password' && (
              <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#234235]">
                    <Key className="h-5 w-5 text-[#2f9e6b]" />
                    <h2 className="text-base font-bold text-white">استعادة وتعيين كلمة المرور</h2>
                  </div>

                  {/* Step 1: Forgot Password */}
                  <form onSubmit={handleForgotPassword} className="space-y-3 mb-6">
                    <label className="block text-xs font-semibold text-[#9bb5a8]">
                      الخطوة 1: طلب استعادة كلمة المرور
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="forgot-email-input"
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="email@example.com"
                        dir="ltr"
                        className="flex-1 rounded-xl border border-[#2b4c3e] bg-[#0f1c18] py-2 px-3 text-xs text-white placeholder-[#5a7a6c] focus:border-[#2f9e6b] outline-none font-mono"
                      />
                      <button
                        type="submit"
                        id="btn-forgot-password"
                        disabled={isSendingForgot}
                        className="flex items-center gap-1.5 rounded-xl border border-[#2b4c3e] bg-[#162821] px-4 py-2 text-xs font-medium text-[#e8f0ec] hover:border-[#2f9e6b] hover:text-[#45c387] disabled:opacity-50 transition-all cursor-pointer"
                      >
                        {isSendingForgot ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        <span>إرسال الرابط</span>
                      </button>
                    </div>

                    {lastDebugResetToken && (
                      <div className="mt-2 p-3 rounded-xl bg-[#2f9e6b]/10 border border-[#2f9e6b]/30 text-xs">
                        <span className="text-[#45c387] font-semibold block mb-1">
                          رمز الاستعادة المستخرج تلقائياً (بيئة الاختبار):
                        </span>
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-[#7be4b0] font-mono text-[11px] truncate select-all">
                            {lastDebugResetToken}
                          </code>
                          <button
                            type="button"
                            onClick={() => setResetToken(lastDebugResetToken)}
                            className="shrink-0 rounded bg-[#2f9e6b] px-2 py-1 text-[10px] font-bold text-[#062016] hover:brightness-110"
                          >
                            تعبئة الحقل
                          </button>
                        </div>
                      </div>
                    )}
                  </form>

                  {/* Step 2: Reset Password */}
                  <form
                    onSubmit={handleResetPassword}
                    className="space-y-4 pt-4 border-t border-[#234235]"
                  >
                    <label className="block text-xs font-semibold text-[#9bb5a8]">
                      الخطوة 2: إدخال الرمز وكلمة المرور الجديدة
                    </label>

                    <div>
                      <input
                        id="reset-token-input"
                        type="text"
                        required
                        value={resetToken}
                        onChange={(e) => setResetToken(e.target.value)}
                        placeholder="أدخل رمز الاستعادة (Reset Token)..."
                        dir="ltr"
                        className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] py-2 px-3 text-xs text-white placeholder-[#5a7a6c] focus:border-[#2f9e6b] outline-none font-mono mb-3"
                      />
                    </div>

                    <div>
                      <input
                        id="reset-new-password"
                        type="password"
                        required
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        placeholder="كلمة المرور الجديدة (مثال: NewP@ssword456!)"
                        dir="ltr"
                        className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] py-2 px-3 text-xs text-white placeholder-[#5a7a6c] focus:border-[#2f9e6b] outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      id="btn-reset-password"
                      disabled={isResettingPassword}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] py-2.5 text-xs font-bold text-[#062016] hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      {isResettingPassword ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>جارٍ تحديث كلمة المرور...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <span>تأكيد وحفظ كلمة المرور الجديدة (POST /v1/auth/reset-password)</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Tab: Tenant Switch */}
            {activeTab === 'tenant' && (
              <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#234235]">
                  <Building2 className="h-5 w-5 text-[#2f9e6b]" />
                  <h2 className="text-base font-bold text-white">
                    التبديل بين الأكاديميات (Tenant Switching)
                  </h2>
                </div>

                <form onSubmit={handleSwitchTenant} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#9bb5a8] mb-1">
                      معرف الأكاديمية المستهدفة (Tenant ID UUID)
                    </label>
                    <input
                      id="target-tenant-id"
                      type="text"
                      required
                      value={targetTenantId}
                      onChange={(e) => setTargetTenantId(e.target.value)}
                      placeholder="00000000-0000-0000-0000-000000000000"
                      dir="ltr"
                      className="w-full rounded-xl border border-[#2b4c3e] bg-[#0f1c18] py-2 px-3 text-xs text-white placeholder-[#5a7a6c] focus:border-[#2f9e6b] outline-none font-mono"
                    />
                  </div>

                  {memberships.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[11px] text-[#9bb5a8] block">
                        اختر من عضوياتك الحالية:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {memberships.map((m) => (
                          <button
                            key={m.tenantId}
                            type="button"
                            onClick={() => setTargetTenantId(m.tenantId)}
                            className={`rounded-lg border px-2.5 py-1 text-[11px] transition-colors cursor-pointer ${
                              targetTenantId === m.tenantId
                                ? 'border-[#2f9e6b] bg-[#2f9e6b]/20 text-[#45c387]'
                                : 'border-[#234235] bg-[#0f1c18] text-[#9bb5a8] hover:text-white'
                            }`}
                          >
                            {m.tenantName} ({m.role})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    id="btn-switch-tenant"
                    disabled={isSwitchingTenant || !targetTenantId}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2f9e6b] to-[#36b379] py-2.5 text-xs font-bold text-[#062016] hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {isSwitchingTenant ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>جارٍ تبديل المستأجر...</span>
                      </>
                    ) : (
                      <>
                        <Building2 className="h-4 w-4" />
                        <span>تبديل السياق وتعيين x-tenant-id</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* Tab: Security Negative Tests */}
            {activeTab === 'security' && (
              <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-6 space-y-4">
                <div className="flex items-center gap-2 mb-2 pb-3 border-b border-[#234235]">
                  <ShieldAlert className="h-5 w-5 text-rose-400" />
                  <h2 className="text-base font-bold text-white">
                    فحوصات الأمان السلبية (Negative Security Test Matrix)
                  </h2>
                </div>
                <p className="text-xs text-[#9bb5a8]">
                  تشغيل استعلامات لاختبار الحدود الأمنية، والتأكد من إرجاع الأخطاء المناسبة دون حدوث
                  أي تسريب بيانات أو تجاوز لصلاحيات RLS:
                </p>

                <div className="space-y-3">
                  <div className="p-4 rounded-xl border border-[#234235] bg-[#0f1c18] flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white block">
                        1. محاولة تسجيل الدخول ببيانات اعتماد خاطئة
                      </span>
                      <span className="text-[11px] text-[#9bb5a8]">
                        التحقق من إرجاع كود 401 Unauthorized ورفض إنشاء جلسة
                      </span>
                    </div>
                    <button
                      type="button"
                      id="btn-test-invalid-creds"
                      onClick={() => runNegativeTest('INVALID_CREDENTIALS')}
                      disabled={isTestingSecurity}
                      className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 disabled:opacity-50 cursor-pointer"
                    >
                      فحص 401
                    </button>
                  </div>

                  <div className="p-4 rounded-xl border border-[#234235] bg-[#0f1c18] flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white block">
                        2. محاولة تأكيد البريد برمز منتهي أو عشوائي
                      </span>
                      <span className="text-[11px] text-[#9bb5a8]">
                        التحقق من إرجاع 400 Validation Error وعدم تفعيل الحساب
                      </span>
                    </div>
                    <button
                      type="button"
                      id="btn-test-expired-token"
                      onClick={() => runNegativeTest('EXPIRED_TOKEN')}
                      disabled={isTestingSecurity}
                      className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20 disabled:opacity-50 cursor-pointer"
                    >
                      فحص 400
                    </button>
                  </div>

                  <div className="p-4 rounded-xl border border-[#234235] bg-[#0f1c18] flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white block">
                        3. محاولة تبديل لمستأجر غير مصرح به أو وهمي
                      </span>
                      <span className="text-[11px] text-[#9bb5a8]">
                        التحقق من عزل RLS وإرجاع 404 أو 403 Forbidden
                      </span>
                    </div>
                    <button
                      type="button"
                      id="btn-test-unauthorized-tenant"
                      onClick={() => runNegativeTest('UNAUTHORIZED')}
                      disabled={isTestingSecurity}
                      className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-300 hover:bg-purple-500/20 disabled:opacity-50 cursor-pointer"
                    >
                      فحص 403/404
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Real-time Response & Audit Log Panel (5 cols) */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-[#234235] bg-[#162821]/80 p-5 sticky top-20 flex flex-col h-[580px]">
              <div className="flex items-center justify-between pb-3 border-b border-[#234235] mb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-[#45c387]" />
                  <span className="text-xs font-bold text-white">
                    سجل العمليات والاستجابات اللحظية
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setLogs([])}
                  className="text-[11px] text-[#9bb5a8] hover:text-white transition-colors"
                >
                  مسح السجل
                </button>
              </div>

              {/* Logs Stream */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 font-mono text-[11px]">
                {logs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#5a7a6c]">
                    <Activity className="h-8 w-8 mb-2 opacity-40 animate-pulse" />
                    <p>في انتظار تنفيذ العمليات من النماذج أعلاه...</p>
                    <p className="text-[10px] mt-1 text-[#45c387]">
                      جميع الردود وأكواد الـ HTTP ستظهر هنا فورياً.
                    </p>
                  </div>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-2.5 rounded-xl border transition-all ${
                        log.status === 'SUCCESS'
                          ? 'bg-[#2f9e6b]/10 border-[#2f9e6b]/30 text-[#e8f0ec]'
                          : log.status === 'ERROR'
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                            : 'bg-[#0f1c18] border-[#234235] text-[#9bb5a8]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5">
                          {log.status === 'SUCCESS' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-[#45c387] shrink-0" />
                          ) : log.status === 'ERROR' ? (
                            <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                          ) : (
                            <Activity className="h-3.5 w-3.5 text-[#9bb5a8] shrink-0" />
                          )}
                          <span className="font-bold text-white">{log.flow}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {log.statusCode && (
                            <span
                              className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                                log.statusCode >= 200 && log.statusCode < 300
                                  ? 'bg-[#2f9e6b]/30 text-[#45c387]'
                                  : 'bg-rose-500/30 text-rose-300'
                              }`}
                            >
                              HTTP {log.statusCode}
                            </span>
                          )}
                          <span className="text-[10px] text-[#5a7a6c]">{log.timestamp}</span>
                        </div>
                      </div>

                      <p className="text-[11px] leading-relaxed break-words">{log.message}</p>

                      {log.details ? (
                        <pre className="mt-2 p-2 rounded bg-[#0a1210] border border-[#234235] overflow-x-auto text-[10px] text-[#7be4b0] max-h-32">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
