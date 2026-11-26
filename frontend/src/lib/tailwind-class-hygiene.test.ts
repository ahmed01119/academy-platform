import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Guards against classes glued together after a CSS-variable shorthand, e.g. "bg-(--bg-base)px-3": Tailwind then
 * ignores both classes (the background and the padding are silently lost). 50 such cases were fixed on 2026-11-20.
 */
const SRC = path.resolve(__dirname, '..');
const GLUED = /\(--[a-z0-9-]+\)[a-z]/;

function tsxFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : tsxFiles(full);
    return e.name.endsWith('.tsx') ? [full] : [];
  });
}

describe('Tailwind class hygiene', () => {
  it('no class is glued to a CSS-variable shorthand', () => {
    const offenders = tsxFiles(SRC).flatMap((file) =>
      fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => (GLUED.test(line) ? `${path.relative(SRC, file)}:${i + 1}` : null))
        .filter((x): x is string => x !== null),
    );
    expect(offenders).toEqual([]);
  });
});
