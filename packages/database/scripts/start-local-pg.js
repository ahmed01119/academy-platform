const { default: EmbeddedPostgres } = require('embedded-postgres');
const path = require('path');
const fs = require('fs');

async function main() {
  const dbDir = path.resolve(__dirname, '../data/db');
  console.log(`[Local Postgres] Target data directory: ${dbDir}`);

  const pg = new EmbeddedPostgres({
    databaseDir: dbDir,
    port: 5432,
    user: 'academy',
    password: 'academy',
    authMethod: 'password',
    persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  });

  const isInitialized = fs.existsSync(path.join(dbDir, 'PG_VERSION'));
  if (!isInitialized) {
    console.log('[Local Postgres] Initializing new database cluster...');
    await pg.initialise();
    console.log('[Local Postgres] Initialization complete.');
  } else {
    console.log('[Local Postgres] Existing database cluster detected.');
  }

  console.log('[Local Postgres] Starting PostgreSQL server on port 5432...');
  await pg.start();
  console.log('[Local Postgres] Server started successfully!');

  try {
    await pg.createDatabase('academy');
    console.log('[Local Postgres] Database "academy" created successfully.');
  } catch (err) {
    // Database might already exist, which is expected
    console.log('[Local Postgres] Database "academy" ready.');
  }

  console.log('[Local Postgres] Ready for connections at: postgresql://academy:academy@localhost:5432/academy');

  // Keep process alive
  setInterval(() => {}, 1000 * 60 * 60);

  const cleanup = async () => {
    console.log('\n[Local Postgres] Shutting down PostgreSQL...');
    try {
      await pg.stop();
      console.log('[Local Postgres] Stopped.');
    } catch {
      // Ignore
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main().catch((err) => {
  console.error('[Local Postgres] Fatal error:', err);
  process.exit(1);
});
