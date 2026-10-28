const { PrismaClient } = require('../packages/database/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function check() {
  console.log('--- Checking PostgreSQL Functions ---');
  const procs = await prisma.$queryRawUnsafe(
    "SELECT proname FROM pg_proc WHERE proname IN ('issue_user_onboarding_token', 'provision_tenant_onboarding')"
  );
  console.log('Procs found:', procs);

  console.log('--- Checking Migrations ---');
  try {
    const migrations = await prisma.$queryRawUnsafe(
      'SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at DESC LIMIT 5'
    );
    console.log('Latest migrations:', migrations);
  } catch (err) {
    console.error('Migration table error:', err.message);
  }

  await prisma.$disconnect();
}

check().catch((e) => {
  console.error(e);
  process.exit(1);
});
