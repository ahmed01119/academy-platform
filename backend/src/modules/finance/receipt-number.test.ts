import { describe, expect, it } from 'vitest';
import { generateReceiptNumber } from './finance.service';

describe('generateReceiptNumber (K11)', () => {
  it('uses the prefix, the UTC date and 8 Crockford base-32 characters', () => {
    const n = generateReceiptNumber('REC', new Date('2026-11-16T22:30:00Z'));
    expect(n).toMatch(/^REC-20261116-[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(generateReceiptNumber('EXP')).toMatch(/^EXP-\d{8}-[0-9A-HJKMNP-TV-Z]{8}$/);
  });

  it('does not repeat across many receipts on the same day (40 random bits)', () => {
    const day = new Date('2026-11-16T10:00:00Z');
    const numbers = new Set(
      Array.from({ length: 20_000 }, () => generateReceiptNumber('REC', day)),
    );
    expect(numbers.size).toBe(20_000);
  });
});
