const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Academy Platform';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm tracking-[0.2em] text-[var(--color-muted)] uppercase">Sprint 0</p>
      <h1 className="max-w-3xl text-4xl leading-tight font-semibold md:text-6xl">{appName}</h1>
      <p className="max-w-2xl text-lg text-[var(--color-muted)]">
        Foundation ready: multi-tenant modular monolith, shared TypeScript toolchain, and local
        infrastructure for PostgreSQL and Redis.
      </p>
      <div className="flex flex-wrap gap-3 pt-2">
        <a
          className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)]"
          href="http://localhost:3001/v1/health"
        >
          API health
        </a>
        <span className="rounded-md border border-[var(--color-muted)] px-4 py-2 text-sm text-[var(--color-muted)]">
          Architecture docs live in /docs
        </span>
      </div>
    </main>
  );
}
