'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import jsQR from 'jsqr';
import {
  Camera,
  CameraOff,
  SwitchCamera,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  UploadCloud,
  RefreshCw,
  Search,
  Sparkles,
  QrCode,
  CreditCard,
  X,
} from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { useLocale } from '../../../lib/locale-context';
import { AppShell } from '../../../components/layout/AppShell';
import { PageHeader } from '../../../components/ui/PageHeader';
import { useToast } from '../../../components/ui/Toast';
import { apiClient } from '../../../lib/api-client';
import { offlineStore } from '../../../lib/offline-attendance-store';
import { prepareForOfflineUse } from '../../../lib/offline-engine';
import type { ScanPlayerQrResponse, SessionSummary } from '@academy/shared';

interface ScanFeedback {
  type: 'ON_TIME' | 'LATE' | 'DUPLICATE' | 'OFFLINE_QUEUED' | 'ERROR';
  title: string;
  playerName?: string;
  membershipNumber?: string;
  latenessMinutes?: number;
  message: string;
  timestamp: string;
  playerId?: string;
  paymentStatus?: ScanPlayerQrResponse['paymentStatus'];
}

export default function MobileAttendanceScannerPage() {
  const router = useRouter();
  const { user, activeTenant, isLoading: authLoading } = useAuth();
  const { t } = useLocale();
  const { toast } = useToast();

  // Session State
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  // Camera State
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Audio / Feedback Settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [recentScans, setRecentScans] = useState<ScanFeedback[]>([]);
  const [activeFeedback, setActiveFeedback] = useState<ScanFeedback | null>(null);

  // Network & Offline Queue State
  const [isOnline, setIsOnline] = useState(true);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);
  const [syncStatusBanner, setSyncStatusBanner] = useState<string | null>(null);
  const [isPreparingOffline, setIsPreparingOffline] = useState(false);
  const [offlinePreparedBanner, setOfflinePreparedBanner] = useState<string | null>(null);

  // Manual Input Fallback
  const [manualCode, setManualCode] = useState('');
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  // Quick Fee Collection inside Scanner
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentPlayer, setPaymentPlayer] = useState<{
    id: string;
    name: string;
    outstandingBalance: number;
    subscriptionId?: string;
  } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'POS' | 'BANK_TRANSFER'>(
    'CASH',
  );
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const handleOpenQuickPayment = (fb: ScanFeedback) => {
    if (!fb.playerId || !fb.playerName) return;
    const due = fb.paymentStatus?.outstandingBalance || fb.paymentStatus?.feeAmount || 650;
    setPaymentPlayer({
      id: fb.playerId,
      name: fb.playerName,
      outstandingBalance: due,
      subscriptionId: fb.paymentStatus?.subscriptionId || undefined,
    });
    setPaymentAmount(due);
    setPaymentMethod('CASH');
    setPaymentNotes('');
    setIsPaymentModalOpen(true);
  };

  const handleSubmitQuickPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentPlayer || !selectedSessionId || paymentAmount <= 0) return;
    const session = sessions.find((s) => s.id === selectedSessionId);
    if (!session) return;
    setIsSubmittingPayment(true);
    try {
      await apiClient.finance.recordPayment({
        playerId: paymentPlayer.id,
        subscriptionId: paymentPlayer.subscriptionId,
        branchId: session.branchId,
        sessionId: selectedSessionId,
        amount: Number(paymentAmount),
        paymentMethod,
        notes: paymentNotes || undefined,
      });
      setIsPaymentModalOpen(false);
      if (activeFeedback) {
        setActiveFeedback({
          ...activeFeedback,
          paymentStatus: {
            status: 'ACTIVE',
            outstandingBalance: 0,
            feeAmount: activeFeedback.paymentStatus?.feeAmount || 650,
          },
          message: `${activeFeedback.message} • تم تحصيل ${paymentAmount} ر.س بنجاح!`,
        });
      }
      toast.success(`تم تحصيل ${paymentAmount} ر.س بنجاح وتحديث حالة اللاعب`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل تسجيل الدفعة');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Continuous Scan Guard
  const lastScannedCodeRef = useRef<string>('');
  const lastScanTimeRef = useRef<number>(0);
  const isProcessingScanRef = useRef<boolean>(false);

  // Sound Synthesizer
  const playFeedbackSound = useCallback(
    (type: ScanFeedback['type']) => {
      if (!soundEnabled || typeof window === 'undefined') return;
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'ON_TIME') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
          osc.start();
          osc.stop(ctx.currentTime + 0.15);
        } else if (type === 'LATE') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(660, ctx.currentTime);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
          osc.start();
          osc.stop(ctx.currentTime + 0.2);
        } else if (type === 'DUPLICATE' || type === 'OFFLINE_QUEUED') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(550, ctx.currentTime);
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.12);
          osc.start();
          osc.stop(ctx.currentTime + 0.12);
        } else {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(350, ctx.currentTime);
          osc.frequency.linearRampToValueAtTime(220, ctx.currentTime + 0.25);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
          osc.start();
          osc.stop(ctx.currentTime + 0.25);
        }
      } catch {
        // Audio autoplay policy catch
      }
    },
    [soundEnabled],
  );

  // Haptic Feedback
  const triggerHaptic = useCallback((type: ScanFeedback['type']) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      if (type === 'ON_TIME') {
        navigator.vibrate(100);
      } else if (type === 'LATE' || type === 'DUPLICATE' || type === 'OFFLINE_QUEUED') {
        navigator.vibrate([100, 60, 100]);
      } else {
        navigator.vibrate([200, 100, 200]);
      }
    }
  }, []);

  // Update Pending Queue Count
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await offlineStore.getPendingCount();
      setPendingQueueCount(count);
    } catch {
      setPendingQueueCount(0);
    }
  }, []);

  // Sync Pending Offline Scans
  const handleSyncPendingScans = useCallback(async () => {
    if (!selectedSessionId || isSyncingOffline) return;
    setIsSyncingOffline(true);
    setSyncStatusBanner(null);
    try {
      const res = await offlineStore.syncPendingScans(selectedSessionId);
      if (res) {
        setSyncStatusBanner(
          `تمت المزامنة بنجاح: ${res.syncedCount} عملية ناجحة${
            res.failedCount > 0 ? ` (${res.failedCount} غير صالحة)` : ''
          }`,
        );
      }
      await refreshPendingCount();
    } catch (err: unknown) {
      setSyncStatusBanner((err as Error)?.message || 'فشلت المزامنة، يرجى المحاولة لاحقاً');
    } finally {
      setIsSyncingOffline(false);
    }
  }, [selectedSessionId, isSyncingOffline, refreshPendingCount]);

  // Prepare for Offline Use (caches rosters & upcoming sessions into IndexedDB)
  const handlePrepareOffline = useCallback(async () => {
    if (!activeTenant?.tenantId) return;
    setIsPreparingOffline(true);
    setOfflinePreparedBanner(null);
    try {
      const currentSession = sessions.find((s) => s.id === selectedSessionId);
      const res = await prepareForOfflineUse(activeTenant.tenantId, currentSession?.branchId);
      const msg = `جاهز للعمل دون اتصال: تم تخزين ${res.sessionsCached} حصص و ${res.playersCached} لاعباً في الذاكرة المحلية بنجاح`;
      setOfflinePreparedBanner(msg);
      toast.success(msg);
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'فشل تجهيز البيانات للاستخدام دون إنترنت');
    } finally {
      setIsPreparingOffline(false);
    }
  }, [activeTenant?.tenantId, selectedSessionId, sessions, toast]);

  // Online / Offline Listeners
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      void handleSyncPendingScans();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    void refreshPendingCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleSyncPendingScans, refreshPendingCount]);

  // Auth Guard
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      if (activeTenant?.role === 'COACH') {
        toast.error('غير مصرح للمدربين بمسح أو تسجيل الحضور وفقاً للسياسات الإدارية المعتمدة');
        router.push('/attendance');
      }
    }
  }, [authLoading, user, activeTenant, router, toast]);

  // Load Sessions
  useEffect(() => {
    if (!user || !activeTenant) return;
    async function loadSessions() {
      setIsLoadingSessions(true);
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const res = await apiClient.attendance.listSessions({
          dateFrom: todayStr,
          limit: 20,
        });

        // If today has sessions, show them, else fallback to all active
        let available = res.items;
        if (available.length === 0) {
          const fallback = await apiClient.attendance.listSessions({ limit: 15 });
          available = fallback.items;
        }

        setSessions(available);
        const urlParams =
          typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const querySessionId = urlParams?.get('sessionId');

        if (querySessionId) {
          setSelectedSessionId(querySessionId);
          if (!available.some((s) => s.id === querySessionId)) {
            try {
              const single = await apiClient.attendance.getSession(querySessionId);
              setSessions((prev) => [single, ...prev.filter((p) => p.id !== single.id)]);
            } catch {
              // Ignore if failed to fetch extra session
            }
          }
        } else if (available.length > 0) {
          setSelectedSessionId((curr) => curr || (available[0]?.id ?? ''));
        }
      } catch (err) {
        console.error('Failed to load attendance sessions:', err);
      } finally {
        setIsLoadingSessions(false);
      }
    }
    void loadSessions();
  }, [user, activeTenant]);

  // Start Camera Stream
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('متصفحك لا يدعم الوصول للكاميرا');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (err: unknown) {
      setCameraError(
        (err as Error)?.message || 'تعذر تشغيل الكاميرا. يرجى التأكد من منح الإذن للمتصفح.',
      );
      setIsCameraActive(false);
    }
  }, [facingMode]);

  // Stop Camera Stream
  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  // Toggle Camera
  useEffect(() => {
    if (selectedSessionId) {
      void startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [selectedSessionId, startCamera, stopCamera]);

  // Switch Camera Direction
  const handleToggleFacingMode = () => {
    stopCamera();
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Process Scanned QR Card Code
  const handleProcessQrCode = useCallback(
    async (rawCode: string) => {
      const cleanCode = rawCode.trim();
      if (!cleanCode || !selectedSessionId || isProcessingScanRef.current) return;

      const now = Date.now();
      // Anti-flood throttle: avoid re-scanning identical code within 2 seconds
      if (lastScannedCodeRef.current === cleanCode && now - lastScanTimeRef.current < 2000) {
        return;
      }

      isProcessingScanRef.current = true;
      lastScannedCodeRef.current = cleanCode;
      lastScanTimeRef.current = now;

      const deviceObservedTime = new Date().toISOString();

      // Check if Online
      if (navigator.onLine) {
        try {
          const res: ScanPlayerQrResponse = await apiClient.attendance.scanPlayerQr(
            selectedSessionId,
            {
              qrCardCode: cleanCode,
              deviceObservedTime,
            },
          );

          let feedbackType: ScanFeedback['type'] = 'ON_TIME';
          let title = 'حضور في الموعد (On Time)';

          if (res.alreadyCheckedIn) {
            feedbackType = 'DUPLICATE';
            title = 'مسجل مسبقاً (Already Checked In)';
          } else if (res.status === 'LATE') {
            feedbackType = 'LATE';
            title = `حضور متأخر (${res.latenessMinutes} دقيقة)`;
          }

          const fb: ScanFeedback = {
            type: feedbackType,
            title,
            playerName: res.player.name,
            membershipNumber: res.player.membershipNumber,
            latenessMinutes: res.latenessMinutes,
            message: res.message,
            timestamp: new Date().toLocaleTimeString('ar-EG', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            playerId: res.player.id,
            paymentStatus: res.paymentStatus,
          };

          setActiveFeedback(fb);
          setRecentScans((prev) => [fb, ...prev.slice(0, 19)]);
          playFeedbackSound(feedbackType);
          triggerHaptic(feedbackType);
        } catch (err: unknown) {
          const errMsg = (err as Error)?.message || 'بطاقة غير صالحة أو غير مسجلة';
          const fb: ScanFeedback = {
            type: 'ERROR',
            title: 'خطأ في المسح (Scan Rejected)',
            message: errMsg,
            timestamp: new Date().toLocaleTimeString('ar-EG', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
          };
          setActiveFeedback(fb);
          setRecentScans((prev) => [fb, ...prev.slice(0, 19)]);
          playFeedbackSound('ERROR');
          triggerHaptic('ERROR');
        } finally {
          isProcessingScanRef.current = false;
        }
      } else {
        // Offline Fallback Queue
        try {
          await offlineStore.enqueueScan({
            sessionId: selectedSessionId,
            qrCardCode: cleanCode,
            deviceObservedTime,
            reason: 'Offline scanner queue',
          });
          await refreshPendingCount();

          const fb: ScanFeedback = {
            type: 'OFFLINE_QUEUED',
            title: 'تم الحفظ محلياً (Queued Offline)',
            message: 'تم تسجيل الحضور محلياً بنجاح وستتم المزامنة فور عودة الاتصال.',
            timestamp: new Date().toLocaleTimeString('ar-EG', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
          };
          setActiveFeedback(fb);
          setRecentScans((prev) => [fb, ...prev.slice(0, 19)]);
          playFeedbackSound('OFFLINE_QUEUED');
          triggerHaptic('OFFLINE_QUEUED');
        } catch (queueErr: unknown) {
          console.error('Failed to queue offline scan:', queueErr);
        } finally {
          isProcessingScanRef.current = false;
        }
      }
    },
    [selectedSessionId, playFeedbackSound, triggerHaptic, refreshPendingCount],
  );

  // Continuous Camera Frame Scanner Loop
  useEffect(() => {
    let animId: number;
    let isDetecting = false;

    // Check Native BarcodeDetector
    type NativeDetectorConstructor = new (opts?: { formats: string[] }) => {
      detect: (src: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
    };
    const BarcodeDetectorClass =
      typeof window !== 'undefined' && 'BarcodeDetector' in window
        ? (window as unknown as { BarcodeDetector: NativeDetectorConstructor }).BarcodeDetector
        : null;
    const nativeDetector = BarcodeDetectorClass
      ? new BarcodeDetectorClass({ formats: ['qr_code'] })
      : null;

    const scanFrame = async () => {
      if (
        !isCameraActive ||
        !videoRef.current ||
        videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA
      ) {
        animId = requestAnimationFrame(scanFrame);
        return;
      }

      if (isDetecting) {
        animId = requestAnimationFrame(scanFrame);
        return;
      }

      isDetecting = true;
      const video = videoRef.current;

      try {
        if (nativeDetector) {
          // Native Hardware Accelerated Detection
          const barcodes = await nativeDetector.detect(video);
          if (barcodes.length > 0 && barcodes[0]?.rawValue) {
            void handleProcessQrCode(barcodes[0].rawValue);
          }
        } else if (canvasRef.current) {
          // Canvas + jsQR Fallback
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });
            if (code && code.data) {
              void handleProcessQrCode(code.data);
            }
          }
        }
      } catch (err) {
        console.warn('Frame detection frame dropped:', err);
      } finally {
        isDetecting = false;
        animId = requestAnimationFrame(scanFrame);
      }
    };

    if (isCameraActive) {
      animId = requestAnimationFrame(scanFrame);
    }

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isCameraActive, handleProcessQrCode]);

  // Handle Manual Code Submission
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    setIsSubmittingManual(true);
    await handleProcessQrCode(manualCode.trim());
    setManualCode('');
    setIsSubmittingManual(false);
  };

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  return (
    <AppShell
      breadcrumbs={[
        { label: t('nav.sessions'), href: '/sessions' },
        { label: t('attendance.scanner') || 'ماسح الحضور السريع (QR Scanner)' },
      ]}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header with Network Indicator */}
        <PageHeader
          title={t('attendance.scanner') || 'ماسح الحضور السريع (QR Scanner)'}
          description="تسجيل الحضور الفوري بالكاميرا أو يدوياً مع الدعم الكامل لوضع عدم الاتصال والمزامنة التلقائية."
          icon={QrCode}
          actions={
            <div className="flex items-center gap-3">
              {pendingQueueCount > 0 && (
                <button
                  type="button"
                  onClick={handleSyncPendingScans}
                  disabled={isSyncingOffline || !isOnline}
                  className="flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <UploadCloud
                    className={`h-3.5 w-3.5 ${isSyncingOffline ? 'animate-bounce' : ''}`}
                  />
                  <span>مزامنة ({pendingQueueCount})</span>
                </button>
              )}

              <button
                type="button"
                onClick={handlePrepareOffline}
                disabled={isPreparingOffline || !isOnline}
                title="تحميل الحصص وقوائم اللاعبين إلى التخزين المحلي للاستخدام عند انقطاع الإنترنت"
                className="flex items-center gap-1.5 rounded-full bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 px-3 py-1 text-[11px] font-bold text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <Sparkles className={`h-3.5 w-3.5 ${isPreparingOffline ? 'animate-spin' : ''}`} />
                <span>{isPreparingOffline ? 'جارٍ التجهيز...' : 'تجهيز لعدم الاتصال'}</span>
              </button>

              <span
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold border ${
                  isOnline
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-red-500/10 border-red-500/30 text-red-500'
                }`}
              >
                {isOnline ? (
                  <>
                    <Wifi className="h-3 w-3 text-emerald-500" />
                    <span>متصل</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3 text-red-500" />
                    <span>بدون إنترنت</span>
                  </>
                )}
              </span>
            </div>
          }
        />

        {/* Sync Status Banner */}
        {syncStatusBanner && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
            <span>{syncStatusBanner}</span>
            <button
              type="button"
              onClick={() => setSyncStatusBanner(null)}
              className="text-emerald-600 dark:text-emerald-400 hover:underline text-xs cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        )}

        {/* Offline Readiness Banner */}
        {offlinePreparedBanner && (
          <div className="rounded-xl border border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/10 p-3 text-xs text-[var(--accent-primary)] flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span className="font-semibold">{offlinePreparedBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setOfflinePreparedBanner(null)}
              className="text-[var(--accent-primary)] hover:underline text-xs cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        )}

        {/* Session Selector Header */}
        <div className="rounded-3xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <label
                htmlFor="session-selector"
                className="block text-xs font-bold text-[var(--text-muted)] mb-1.5"
              >
                اختر الحصة التدريبية المراد تسجيل الحضور لها:
              </label>

              {isLoadingSessions ? (
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-[var(--accent-primary)]" />
                  <span>جارٍ تحميل الحصص المتاحة...</span>
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-xs text-amber-500">
                  لا توجد حصص تدريبية متاحة حالياً. يرجى إنشاء حصة أولاً.
                </div>
              ) : (
                <select
                  id="session-selector"
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="w-full sm:w-80 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs font-semibold text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none cursor-pointer transition-colors"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.groupName} • {s.branchName} • {s.sessionDate} ({s.startTime})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedSession && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-lg bg-[var(--bg-surface-subtle)] px-3 py-1.5 text-[var(--accent-primary)] font-semibold border border-[var(--border-subtle)]">
                  📅 {selectedSession.sessionDate}
                </span>
                <span className="rounded-lg bg-[var(--bg-surface-subtle)] px-3 py-1.5 text-[var(--accent-primary)] font-semibold border border-[var(--border-subtle)]">
                  ⏰ {selectedSession.startTime} - {selectedSession.endTime}
                </span>
                <span className="rounded-lg bg-[var(--bg-surface-subtle)] px-3 py-1.5 text-[var(--text-main)] font-semibold border border-[var(--border-subtle)]">
                  حضور: {selectedSession.totalPresent + selectedSession.totalLate} /{' '}
                  {selectedSession.totalExpected}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Viewfinder & Continuous Scanner Section */}
        <div className="relative mx-auto w-full max-w-lg overflow-hidden rounded-3xl border-2 border-[var(--accent-primary)]/40 bg-black shadow-2xl">
          {/* Video Feed */}
          <div className="relative aspect-[4/3] w-full bg-black overflow-hidden flex items-center justify-center">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              muted
              playsInline
              autoPlay
            />

            {/* Hidden Processing Canvas for jsQR Fallback */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Viewfinder Target Reticle & Scanlines */}
            {isCameraActive && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                {/* Target Square Bracket */}
                <div className="relative h-52 w-52 sm:h-60 sm:w-60 rounded-2xl border-2 border-emerald-400/70 shadow-2xl">
                  {/* Glowing Corner Brackets */}
                  <div className="absolute -top-1 -right-1 h-6 w-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                  <div className="absolute -top-1 -left-1 h-6 w-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                  <div className="absolute -bottom-1 -right-1 h-6 w-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
                  <div className="absolute -bottom-1 -left-1 h-6 w-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />

                  {/* Horizontal Animated Laser Scanline */}
                  <div className="absolute right-0 left-0 h-0.5 bg-gradient-to-r from-transparent via-[var(--accent-primary)] to-transparent shadow-[0_0_12px_var(--accent-primary)] animate-pulse-live" />
                </div>
              </div>
            )}

            {/* Camera Controls Overlay */}
            <div className="absolute top-3 right-3 left-3 flex items-center justify-between z-20">
              <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-md border border-white/10">
                <span className="h-2 w-2 rounded-full bg-[var(--accent-primary)] animate-pulse-live" />
                ماسح مستمر (Live Continuous)
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSoundEnabled((prev) => !prev)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md border border-white/10 hover:bg-black/90 cursor-pointer"
                  title="كتم / تفعيل الصوت"
                >
                  {soundEnabled ? (
                    <Volume2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <VolumeX className="h-4 w-4 text-gray-400" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleToggleFacingMode}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md border border-white/10 hover:bg-black/90 cursor-pointer"
                  title="تبديل الكاميرا الأمامية / الخلفية"
                >
                  <SwitchCamera className="h-4 w-4 text-emerald-400" />
                </button>
              </div>
            </div>

            {/* Camera Inactive / Error Fallback */}
            {!isCameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--bg-surface)] p-6 text-center text-[var(--text-muted)] z-10">
                <CameraOff className="h-12 w-12 text-red-500 mb-3 opacity-60" />
                <p className="text-sm font-bold text-[var(--text-main)]">الكاميرا غير مفعلة</p>
                <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xs">
                  {cameraError || 'انقر لتفعيل الكاميرا والبدء في مسح بطاقات اللاعبين.'}
                </p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] text-white px-5 py-2.5 text-xs font-bold shadow-lg hover:brightness-110 cursor-pointer"
                >
                  <Camera className="h-4 w-4" />
                  <span>تشغيل الكاميرا الآن</span>
                </button>
              </div>
            )}
          </div>

          {/* Real-Time Scan Feedback Overlay Banner */}
          {activeFeedback && (
            <div
              className={`p-4 border-t transition-all ${
                activeFeedback.type === 'ON_TIME'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : activeFeedback.type === 'LATE'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                    : activeFeedback.type === 'DUPLICATE'
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-500'
                      : activeFeedback.type === 'OFFLINE_QUEUED'
                        ? 'bg-orange-500/10 border-orange-500/30 text-orange-500'
                        : 'bg-red-500/10 border-red-500/30 text-red-500'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {activeFeedback.type === 'ON_TIME' && (
                    <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
                  )}
                  {activeFeedback.type === 'LATE' && (
                    <Clock className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
                  )}
                  {activeFeedback.type === 'DUPLICATE' && (
                    <CheckCircle2 className="h-6 w-6 text-blue-500 shrink-0 mt-0.5" />
                  )}
                  {activeFeedback.type === 'OFFLINE_QUEUED' && (
                    <UploadCloud className="h-6 w-6 text-orange-500 shrink-0 mt-0.5" />
                  )}
                  {activeFeedback.type === 'ERROR' && (
                    <AlertTriangle className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
                  )}

                  <div>
                    <h3 className="text-sm font-extrabold text-[var(--text-main)]">
                      {activeFeedback.playerName
                        ? `${activeFeedback.playerName} • ${activeFeedback.title}`
                        : activeFeedback.title}
                    </h3>
                    <p className="text-xs mt-0.5 opacity-90">{activeFeedback.message}</p>
                    {activeFeedback.membershipNumber && (
                      <span className="inline-block mt-1.5 font-mono text-[10px] font-bold bg-[var(--bg-surface-subtle)] px-2 py-0.5 rounded border border-[var(--border-subtle)] text-[var(--text-main)]">
                        {activeFeedback.membershipNumber}
                      </span>
                    )}

                    {/* Live Payment Status Banner */}
                    {activeFeedback.paymentStatus && (
                      <div className="mt-3 pt-2.5 border-t border-current/20 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 font-bold">
                          <CreditCard className="h-4 w-4 shrink-0" />
                          {activeFeedback.paymentStatus.status === 'ACTIVE' && (
                            <span className="text-emerald-400">✓ اشتراك ساري ومسدد بالكامل</span>
                          )}
                          {activeFeedback.paymentStatus.status === 'PARTIAL' && (
                            <span className="text-amber-300">
                              ⚠ متبقي: {activeFeedback.paymentStatus.outstandingBalance} ر.س
                            </span>
                          )}
                          {activeFeedback.paymentStatus.status === 'OVERDUE' && (
                            <span className="text-rose-300 animate-pulse">
                              ✕ متأخر:{' '}
                              {activeFeedback.paymentStatus.outstandingBalance ||
                                activeFeedback.paymentStatus.feeAmount}{' '}
                              ر.س
                            </span>
                          )}
                          {(activeFeedback.paymentStatus.status === 'EXEMPT' ||
                            activeFeedback.paymentStatus.status === 'PAUSED' ||
                            activeFeedback.paymentStatus.status === 'EXPIRED') && (
                            <span className="text-slate-300">
                              {activeFeedback.paymentStatus.status === 'EXEMPT'
                                ? 'معفى من الرسوم'
                                : activeFeedback.paymentStatus.status === 'PAUSED'
                                  ? 'اشتراك موقوف مؤقتاً'
                                  : 'اشتراك منتهي الصلاحية'}
                            </span>
                          )}
                        </div>

                        {activeFeedback.paymentStatus.status !== 'ACTIVE' &&
                          activeFeedback.playerId &&
                          selectedSession && (
                            <button
                              type="button"
                              onClick={() => handleOpenQuickPayment(activeFeedback)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 text-xs font-bold shadow transition-all cursor-pointer"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              <span>تحصيل الرسوم فوراً</span>
                            </button>
                          )}
                      </div>
                    )}
                  </div>
                </div>

                <span className="text-[10px] opacity-75 font-mono">{activeFeedback.timestamp}</span>
              </div>
            </div>
          )}
        </div>

        {/* Manual Input Fallback */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-5 shadow-sm">
          <form onSubmit={handleManualSubmit} className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-main)]">
              <Search className="h-4 w-4 text-[var(--accent-primary)]" />
              <span>تسجيل يدوي كبديل (Manual Entry Fallback)</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              إذا كانت عدسة الكاميرا متسخة أو البطاقة تالفة، أدخل رمز بطاقة اللاعب يدوياً:
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="أدخل رمز بطاقة اللاعب (مثال: a1b2c3d4e5...)"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={isSubmittingManual || !manualCode.trim()}
                className="flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] text-white px-4 py-2.5 text-xs font-bold hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isSubmittingManual ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span>تسجيل الحضور</span>
              </button>
            </div>
          </form>
        </div>

        {/* Live Scanned Activity Feed */}
        <div className="rounded-3xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
            <h2 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-[var(--accent-primary)]" />
              <span>سجل عمليات المسح الأخيرة في هذه الحصة ({recentScans.length})</span>
            </h2>

            {recentScans.length > 0 && (
              <button
                type="button"
                onClick={() => setRecentScans([])}
                className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
              >
                مسح السجل
              </button>
            )}
          </div>

          {recentScans.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--text-muted)]">
              لم يتم مسح أي بطاقة حتى الآن في هذه الجلسة. وجّه الكاميرا نحو بطاقة اللاعب للبدء.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)] max-h-80 overflow-y-auto">
              {recentScans.map((scan, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        scan.type === 'ON_TIME'
                          ? 'bg-emerald-400'
                          : scan.type === 'LATE'
                            ? 'bg-amber-400'
                            : scan.type === 'DUPLICATE'
                              ? 'bg-blue-400'
                              : scan.type === 'OFFLINE_QUEUED'
                                ? 'bg-orange-400'
                                : 'bg-red-400'
                      }`}
                    />
                    <div>
                      <span className="font-bold text-[var(--text-main)]">
                        {scan.playerName || 'بطاقة غير محددة'}
                      </span>
                      <p className="text-[11px] text-[var(--text-muted)]">{scan.title}</p>
                    </div>
                  </div>

                  <span className="font-mono text-[10px] text-[var(--text-muted)]">
                    {scan.timestamp}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* QUICK PAYMENT MODAL INSIDE SCANNER */}
      {isPaymentModalOpen && paymentPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-3xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-6 shadow-float relative space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-main)]">تحصيل فوري للاعب</h3>
                  <p className="text-xs text-[var(--text-muted)]">{paymentPlayer.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitQuickPayment} className="space-y-4">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3 text-xs flex justify-between items-center">
                <span className="text-[var(--text-muted)]">الرصيد المستحق:</span>
                <span className="font-extrabold text-[var(--accent-primary)]">
                  {paymentPlayer.outstandingBalance} ر.س
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                  المبلغ المحصل (ر.س) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-sm font-bold text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                  طريقة الدفع *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as 'CASH' | 'CARD' | 'POS' | 'BANK_TRANSFER')
                  }
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs font-semibold text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none cursor-pointer"
                >
                  <option value="CASH">نقدي (كاش بالملعب)</option>
                  <option value="POS">جهاز نقاط البيع (POS / شبكة)</option>
                  <option value="CARD">بطاقة مدى / ائتمانية</option>
                  <option value="BANK_TRANSFER">تحويل بنكي</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                  ملاحظات الدفعة (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="ملاحظات توثيقية إضافية..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment || paymentAmount <= 0}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSubmittingPayment && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>تأكيد استلام المبلغ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
