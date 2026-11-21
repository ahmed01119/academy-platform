import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DEFAULT_SPORT, SPORT_CODES, SportCodeSchema, isSportCode } from './sports';

describe('sports', () => {
  it('matches the database enum SportCode exactly (same values, same order)', () => {
    const schema = fs.readFileSync(
      path.resolve(__dirname, '../../../database/prisma/schema.prisma'),
      'utf8',
    );
    const block = /enum SportCode \{([^}]*)\}/.exec(schema)?.[1] ?? '';
    const values = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    expect(values).toEqual([...SPORT_CODES]);
  });

  it('keeps football as the default and first sport (older records and clients)', () => {
    expect(DEFAULT_SPORT).toBe('FOOTBALL');
    expect(SPORT_CODES[0]).toBe('FOOTBALL');
  });

  it('accepts listed sports and rejects anything else', () => {
    expect(SportCodeSchema.parse('SWIMMING')).toBe('SWIMMING');
    expect(() => SportCodeSchema.parse('CRICKET')).toThrow();
    expect(isSportCode('PADEL')).toBe(true);
    expect(isSportCode('padel')).toBe(false);
  });
});
