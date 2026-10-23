'use client';

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6 text-center">
      <p className="text-sm font-semibold tracking-wide text-[var(--accent-primary)] uppercase">
        Academy Platform
      </p>
      <h1 className="text-3xl font-semibold text-[var(--text-main)]">أنت غير متصل</h1>
      <p className="text-[var(--text-muted)]">
        يمكن تسجيل الحضور ومسودات التقييم محلياً بعد تسجيل الدخول مسبقاً. العمليات المالية والإدارية تحتاج اتصالاً.
      </p>
      <p className="text-[var(--text-muted)]">You are offline. Attendance and evaluation drafts can wait locally. Finance requires the server.</p>
      <button
        type="button"
        className="mx-auto rounded-md bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-[var(--accent-primary-fg)]"
        onClick={() => window.location.reload()}
      >
        إعادة المحاولة / Retry
      </button>
    </main>
  );
}
