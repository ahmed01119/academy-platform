import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { AccessRule } from './access-rules';

/**
 * Pins every guarded page to the access rule it enforced before Phase 1 Step 2.
 * Changing a page's rule is a permissions change and must be a deliberate decision.
 */
const APP_DIR = path.resolve(__dirname, '../../app');

const PAGE_RULES: Record<string, AccessRule> = {
  'account/page.tsx': 'authenticated',
  'attendance/page.tsx': 'authenticated',
  'attendance/sessions/[id]/page.tsx': 'authenticated',
  'coach/page.tsx': 'authenticated',
  'finance/page.tsx': 'authenticated',
  'groups/[id]/page.tsx': 'authenticated',
  'guardian/page.tsx': 'authenticated',
  'player/page.tsx': 'authenticated',
  'players/[id]/page.tsx': 'authenticated',
  'players/new/page.tsx': 'authenticated',
  'attendance/reports/page.tsx': 'admin',
  'branches/page.tsx': 'admin',
  'dashboard/page.tsx': 'admin',
  'players/page.tsx': 'admin',
  'settings/page.tsx': 'admin',
  'groups/page.tsx': 'admin-or-coach',
  'sessions/page.tsx': 'admin-or-coach',
  'attendance/quick/page.tsx': 'no-coach',
  'attendance/scanner/page.tsx': 'no-coach',
  'platform/page.tsx': 'platform-staff',
};

const read = (rel: string) => fs.readFileSync(path.join(APP_DIR, rel), 'utf8');

describe('page access map', () => {
  it.each(Object.entries(PAGE_RULES))('%s uses useAccessGuard(%s) exactly once', (rel, rule) => {
    const source = read(rel);
    const calls = source.match(/useAccessGuard\('([a-z-]+)'/g) ?? [];
    expect(calls).toEqual([`useAccessGuard('${rule}'`]);
  });

  it.each(Object.keys(PAGE_RULES))('%s no longer carries an inline login redirect', (rel) => {
    expect(read(rel)).not.toMatch(/router\.(push|replace)\('\/login'\)/);
  });

  it('coach-restricted attendance pages keep their policy toast', () => {
    expect(read('attendance/quick/page.tsx')).toContain(
      'Coaches are not permitted to record player attendance.',
    );
    expect(read('attendance/scanner/page.tsx')).toContain(
      'Coaches are not authorized to scan or record attendance per academy policy',
    );
  });

  it('no other page under app/ calls useAccessGuard (map is complete)', () => {
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (
          e.name === 'page.tsx' &&
          fs.readFileSync(full, 'utf8').includes('useAccessGuard(')
        ) {
          found.push(path.relative(APP_DIR, full).split(path.sep).join('/'));
        }
      }
    };
    walk(APP_DIR);
    expect(found.sort()).toEqual(Object.keys(PAGE_RULES).sort());
  });
});
