import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * The QR check-in simulator is a development-only testing aid (owner decision 2026-11-14).
 * It must be compiled out of production bundles, which only happens when the guard is an
 * inline `process.env.NODE_ENV === 'development'` expression (Next.js replaces it with a literal).
 */
const SRC_ROOT = path.resolve(__dirname, '../../..');

function sourceFilesUsing(identifier: string): string[] {
  const results: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        if (fs.readFileSync(full, 'utf8').includes(`<${identifier}`)) results.push(full);
      }
    }
  };
  walk(SRC_ROOT);
  return results;
}

describe('QrCheckInSimulator production safety', () => {
  const usages = sourceFilesUsing('QrCheckInSimulator');

  it('is rendered somewhere (feature still available in development)', () => {
    expect(usages.length).toBeGreaterThan(0);
  });

  it.each(usages.map((f) => [path.relative(SRC_ROOT, f), f]))(
    '%s renders it only behind an inline NODE_ENV development guard',
    (_rel, file) => {
      const source = fs.readFileSync(file, 'utf8');
      const guarded = /process\.env\.NODE_ENV === 'development' && \(\s*<QrCheckInSimulator/.test(
        source,
      );
      expect(guarded).toBe(true);
    },
  );
});
