/**
 * The Phase 3A SECURITY DEFINER functions report failures as `RAISE EXCEPTION '<CODE>'`. Prisma surfaces them as
 * raw-query errors whose message contains that code. This returns the first expected code found, so callers can map
 * it to an HTTP error without depending on Prisma's error class or message layout.
 */
export function databaseFunctionErrorCode<T extends string>(
  error: unknown,
  expectedCodes: readonly T[],
): T | undefined {
  const parts: string[] = [];
  const collect = (value: unknown) => {
    if (typeof value === 'string') parts.push(value);
  };
  const err = error as { message?: unknown; meta?: { message?: unknown } } | null | undefined;
  collect(err?.message);
  collect(err?.meta?.message);
  const text = parts.join('\n');
  if (!text) return undefined;
  return expectedCodes.find((code) => new RegExp(`\\b${code}\\b`).test(text));
}

/** The single row a scalar `SELECT public.fn(...)` returns; fails loudly instead of yielding undefined. */
export function singleRow<T>(rows: readonly T[]): T {
  const row = rows[0];
  if (row === undefined) {
    throw new Error('Database function returned no row');
  }
  return row;
}
