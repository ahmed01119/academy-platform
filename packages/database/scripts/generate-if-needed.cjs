/**
 * Runs `prisma generate` only when the generated client does not match prisma/schema.prisma.
 *
 * On Windows a running API (or any Node process that loaded Prisma) keeps the query-engine DLL locked, and
 * `prisma generate` rewrites that DLL every time, failing with EPERM even when nothing changed. The root `build` and
 * `dev` scripts use this instead, so building while the API runs works whenever the schema is unchanged. When the
 * schema did change, generation is still required: stop the running API first. `pnpm db:generate` always regenerates.
 */
const path = require('path');
const { spawnSync } = require('child_process');
const { checkPrismaClient, resolveGeneratedSchemaPath } = require('./check-prisma-client.cjs');

const packageDir = path.resolve(__dirname, '..');
const result = checkPrismaClient({
  schemaPath: path.join(packageDir, 'prisma', 'schema.prisma'),
  generatedSchemaPath: resolveGeneratedSchemaPath(packageDir),
});

if (result.ok) {
  console.log('[@academy/database] Prisma Client is up to date; generation skipped.');
  process.exit(0);
}

console.log(
  `[@academy/database] Prisma Client is ${result.reason === 'missing' ? 'missing' : 'out of date'}; generating.`,
);
const run = spawnSync('pnpm', ['exec', 'prisma', 'generate'], {
  cwd: packageDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (run.status !== 0) {
  console.error(
    '\n[@academy/database] prisma generate failed. On Windows this is usually EPERM: a running API keeps the Prisma\n' +
      'query engine locked. Stop the API (and any other Node process using the database), then build again.\n',
  );
}
process.exit(run.status ?? 1);
