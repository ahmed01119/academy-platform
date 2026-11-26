import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

type CheckResult = { ok: true } | { ok: false; reason: 'missing' | 'stale' };
const { checkPrismaClient, normalizeSchema } = createRequire(__filename)(
  '../scripts/check-prisma-client.cjs',
) as {
  checkPrismaClient: (paths: { schemaPath: string; generatedSchemaPath: string }) => CheckResult;
  normalizeSchema: (text: string) => string;
};

const SOURCE = `model Tenant {
  id   String @id @default(uuid()) @db.Uuid
  slug String @unique
  name String @default("My  Academy")
}
`;

describe('check-prisma-client', () => {
  let dir: string;
  let schemaPath: string;
  let generatedSchemaPath: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'prisma-check-'));
    schemaPath = path.join(dir, 'schema.prisma');
    generatedSchemaPath = path.join(dir, 'generated.prisma');
    writeFileSync(schemaPath, SOURCE);
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('fails as "missing" when the client was never generated', () => {
    expect(checkPrismaClient({ schemaPath, generatedSchemaPath })).toEqual({
      ok: false,
      reason: 'missing',
    });
  });

  it('accepts the re-aligned copy Prisma writes (formatting-only differences, CRLF)', () => {
    const realigned = SOURCE.replace(/ String/g, '        String').replace(/\n/g, '\r\n') + '\n\n';
    writeFileSync(generatedSchemaPath, realigned);
    expect(checkPrismaClient({ schemaPath, generatedSchemaPath })).toEqual({ ok: true });
  });

  it('fails as "stale" when the schema changed after generation', () => {
    writeFileSync(generatedSchemaPath, SOURCE.replace('  slug String @unique\n', ''));
    expect(checkPrismaClient({ schemaPath, generatedSchemaPath })).toEqual({
      ok: false,
      reason: 'stale',
    });
  });

  it('treats whitespace inside quoted strings as significant', () => {
    writeFileSync(generatedSchemaPath, SOURCE.replace('"My  Academy"', '"My Academy"'));
    expect(checkPrismaClient({ schemaPath, generatedSchemaPath }).ok).toBe(false);
    expect(normalizeSchema('a    "x  y"   b')).toBe('a "x  y" b');
  });
});
