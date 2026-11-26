import { describe, expect, it } from 'vitest';
import { databaseFunctionErrorCode } from './db-function-error';

describe('databaseFunctionErrorCode', () => {
  const codes = ['CLAIM_INVALID', 'CLAIM_ALREADY_LINKED'] as const;

  it('finds a raised code in a Prisma raw-query error message', () => {
    const err = new Error(
      'Invalid `prisma.$queryRaw()` invocation:\nRaw query failed. Code: `22023`. Message: `ERROR: CLAIM_INVALID`',
    );
    expect(databaseFunctionErrorCode(err, codes)).toBe('CLAIM_INVALID');
  });

  it('reads meta.message as well', () => {
    expect(
      databaseFunctionErrorCode({ meta: { message: 'ERROR: CLAIM_ALREADY_LINKED' } }, codes),
    ).toBe('CLAIM_ALREADY_LINKED');
  });

  it('matches whole codes only and ignores unrelated errors', () => {
    expect(databaseFunctionErrorCode(new Error('ERROR: CLAIM_INVALID_X'), codes)).toBeUndefined();
    expect(databaseFunctionErrorCode(new Error('connection reset'), codes)).toBeUndefined();
    expect(databaseFunctionErrorCode(undefined, codes)).toBeUndefined();
  });
});
