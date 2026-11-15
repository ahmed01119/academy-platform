/**
 * Verifies that the generated Prisma Client matches prisma/schema.prisma.
 *
 * `prisma generate` is deliberately NOT part of this package's `build` script: on Windows the
 * running API keeps the query-engine DLL loaded, so regenerating during every lint/typecheck/test
 * (turbo runs `^build` first) failed with EPERM. Generation is an explicit step instead
 * (`pnpm db:generate`, run by the root `build`/`dev` scripts, CI and the Dockerfiles).
 *
 * This check prevents the opposite failure mode — silently compiling against a missing or stale
 * client: the build fails with an actionable message instead.
 *
 * Prisma writes a re-aligned copy of the schema next to the generated client, so the comparison
 * ignores differences in horizontal whitespace and blank lines (never inside quoted strings).
 */
const fs = require('fs');
const path = require('path');

/** Normalises formatting-only differences: line endings, runs of spaces/tabs, blank lines. */
function normalizeSchema(text) {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => {
      // Collapse whitespace outside double-quoted strings only.
      let out = '';
      let inString = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"' && line[i - 1] !== '\\') inString = !inString;
        if (!inString && (ch === ' ' || ch === '\t')) {
          if (!out.endsWith(' ')) out += ' ';
        } else {
          out += ch;
        }
      }
      return out.trim();
    })
    .filter((line) => line !== '')
    .join('\n');
}

/**
 * @param {{ schemaPath: string, generatedSchemaPath: string }} paths
 * @returns {{ ok: true } | { ok: false, reason: 'missing' | 'stale' }}
 */
function checkPrismaClient({ schemaPath, generatedSchemaPath }) {
  if (!fs.existsSync(generatedSchemaPath)) return { ok: false, reason: 'missing' };
  const source = normalizeSchema(fs.readFileSync(schemaPath, 'utf8'));
  const generated = normalizeSchema(fs.readFileSync(generatedSchemaPath, 'utf8'));
  return source === generated ? { ok: true } : { ok: false, reason: 'stale' };
}

/** Location of the default `prisma-client-js` output (node_modules/.prisma/client). */
function resolveGeneratedSchemaPath(packageDir) {
  const clientPkg = require.resolve('@prisma/client/package.json', { paths: [packageDir] });
  // .../node_modules/@prisma/client/package.json -> .../node_modules/.prisma/client/schema.prisma
  return path.join(path.dirname(clientPkg), '..', '..', '.prisma', 'client', 'schema.prisma');
}

function main() {
  const packageDir = path.resolve(__dirname, '..');
  const result = checkPrismaClient({
    schemaPath: path.join(packageDir, 'prisma', 'schema.prisma'),
    generatedSchemaPath: resolveGeneratedSchemaPath(packageDir),
  });
  if (result.ok) return;

  const what =
    result.reason === 'missing'
      ? 'Prisma Client has not been generated.'
      : 'Prisma Client is out of date: prisma/schema.prisma changed since the last generation.';
  console.error(
    `\n[@academy/database] ${what}\nRun \`pnpm db:generate\` from the repository root, then build again.\n` +
      '(On Windows, stop the running API first: it locks the Prisma query engine.)\n',
  );
  process.exit(1);
}

module.exports = { normalizeSchema, checkPrismaClient, resolveGeneratedSchemaPath };

if (require.main === module) {
  main();
}
