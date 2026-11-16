import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Pins every guarded page to its access rule. Changing a page's rule is a permissions change and must be a deliberate
 * decision. Named rules are written as-is; permission rules as "anyOf:Permission.X|Permission.Y" (the page's
 * module-level PAGE_ACCESS constant, see lib/auth/access-rules.ts).
 */
const APP_DIR = path.resolve(__dirname, '../../app');

const PAGE_RULES: Record<string, string> = {
  'account/page.tsx': 'authenticated',
  'attendance/page.tsx': 'authenticated',
  'attendance/sessions/[id]/page.tsx': 'authenticated',
  'coach/page.tsx': 'authenticated',
  'groups/[id]/page.tsx': 'authenticated',
  'guardian/page.tsx': 'authenticated',
  'player/page.tsx': 'authenticated',
  'players/[id]/page.tsx': 'authenticated',
  'players/new/page.tsx': 'authenticated',
  'dashboard/page.tsx': 'admin',
  'settings/page.tsx': 'admin',
  'platform/page.tsx': 'platform-staff',
  'attendance/reports/page.tsx': 'anyOf:Permission.ATTENDANCE_READ',
  'branches/page.tsx': 'anyOf:Permission.BRANCHES_READ',
  'players/page.tsx': 'anyOf:Permission.PLAYERS_READ',
  'groups/page.tsx': 'anyOf:Permission.GROUPS_READ',
  'sessions/page.tsx': 'anyOf:Permission.SESSIONS_READ',
  'attendance/quick/page.tsx': 'anyOf:Permission.ATTENDANCE_MARK',
  'attendance/scanner/page.tsx': 'anyOf:Permission.ATTENDANCE_MARK',
  'finance/page.tsx':
    'anyOf:Permission.PAYMENTS_READ|Permission.SESSION_EXPENSES_READ|Permission.REPORTS_READ',
};

/** The rule a page passes to useAccessGuard, in the notation of PAGE_RULES. */
function pageRule(source: string): string[] {
  const named = [...source.matchAll(/useAccessGuard\('([a-z-]+)'/g)].map((m) => m[1] ?? '');
  if (!source.includes('useAccessGuard(PAGE_ACCESS')) return named;
  const def = /const PAGE_ACCESS: AccessRule = \{ anyOf: \[([^\]]*)\] \};/.exec(source);
  const perms = (def?.[1] ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  return [...named, `anyOf:${perms.join('|')}`];
}

const read = (rel: string) => fs.readFileSync(path.join(APP_DIR, rel), 'utf8');

describe('page access map', () => {
  it.each(Object.entries(PAGE_RULES))('%s uses access rule %s exactly once', (rel, rule) => {
    expect(pageRule(read(rel))).toEqual([rule]);
  });

  it.each(Object.keys(PAGE_RULES))('%s no longer carries an inline login redirect', (rel) => {
    expect(read(rel)).not.toMatch(/router\.(push|replace)\('\/login'\)/);
  });

  it('attendance-marking pages explain a refused visit', () => {
    expect(read('attendance/quick/page.tsx')).toContain(
      'Your role does not include recording attendance.',
    );
    expect(read('attendance/scanner/page.tsx')).toContain(
      'Your role does not include scanning attendance.',
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
