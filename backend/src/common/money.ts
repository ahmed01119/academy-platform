/**
 * Money columns are `numeric(12, 2)` in PostgreSQL (K16): exact storage, no floating-point drift in the ledger.
 * Prisma returns them as Decimal objects; the API contract (packages/shared) and the arithmetic in the services use
 * plain numbers. Convert at the read boundary with these helpers, rounded to the cent.
 */
type DecimalLike = { toNumber(): number } | number | string;

/** A money value as a number rounded to 2 decimals (null/undefined → 0). */
export function money(value: DecimalLike | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : value.toNumber();
  return Math.round(n * 100) / 100;
}

/** Like money(), but keeps null for optional amounts (e.g. a negotiated price that was never set). */
export function moneyOrNull(value: DecimalLike | null | undefined): number | null {
  return value === null || value === undefined ? null : money(value);
}
