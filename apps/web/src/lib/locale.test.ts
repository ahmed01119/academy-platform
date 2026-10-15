import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, LOCALE_DIRECTION } from '@academy/shared';

describe('web locale defaults', () => {
  it('uses Arabic RTL as the platform default', () => {
    expect(DEFAULT_LOCALE).toBe('ar');
    expect(LOCALE_DIRECTION[DEFAULT_LOCALE]).toBe('rtl');
  });
});
