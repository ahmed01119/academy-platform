import { describe, expect, it } from 'vitest';
import { academySports } from './tenancy.service';

describe('academySports', () => {
  it('keeps the order given (main sport first)', () => {
    expect(academySports([{ sport: 'SWIMMING' }, { sport: 'FOOTBALL' }])).toEqual([
      'SWIMMING',
      'FOOTBALL',
    ]);
  });

  it('treats an academy with no recorded sport as a football academy', () => {
    expect(academySports([])).toEqual(['FOOTBALL']);
  });

  it('drops values the platform does not know', () => {
    expect(academySports([{ sport: 'CRICKET' }, { sport: 'PADEL' }])).toEqual(['PADEL']);
  });
});
