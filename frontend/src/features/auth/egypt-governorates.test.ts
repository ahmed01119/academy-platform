import { describe, expect, it } from 'vitest';
import { EGYPT_GOVERNORATES, governorateLabel } from './egypt-governorates';

describe('Egypt governorates', () => {
  it('lists all 27 governorates once', () => {
    expect(EGYPT_GOVERNORATES).toHaveLength(27);
    expect(new Set(EGYPT_GOVERNORATES.map((g) => g.value)).size).toBe(27);
  });

  it('shows the stored value in the page language, and older free text as it is', () => {
    expect(governorateLabel('Alexandria', 'ar')).toBe('الإسكندرية');
    expect(governorateLabel('Alexandria', 'en')).toBe('Alexandria');
    expect(governorateLabel('Riyadh, KSA', 'ar')).toBe('Riyadh, KSA');
  });
});
