import { z } from 'zod';

/**
 * Sports an academy can run on the platform. Must match the database enum `SportCode` (schema.prisma and the
 * migrations that add values). `OTHER` covers any sport not listed yet.
 * Order = the order shown to people (registration, settings, group forms).
 */
export const SPORT_CODES = [
  'FOOTBALL',
  'SWIMMING',
  'TENNIS',
  'PADEL',
  'BASKETBALL',
  'VOLLEYBALL',
  'HANDBALL',
  'MARTIAL_ARTS',
  'GYMNASTICS',
  'ATHLETICS',
  'SQUASH',
  'OTHER',
] as const;

export type SportCode = (typeof SPORT_CODES)[number];

/** Sport used when an older record or client sends none (the platform started as football-only). */
export const DEFAULT_SPORT: SportCode = 'FOOTBALL';

export const SportCodeSchema = z.enum(SPORT_CODES);

export function isSportCode(value: unknown): value is SportCode {
  return typeof value === 'string' && (SPORT_CODES as readonly string[]).includes(value);
}
