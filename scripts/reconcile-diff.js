const path = require('path');
const fs = require('fs');
const epPath = require.resolve('embedded-postgres', { paths: [path.resolve(__dirname, '../packages/database')] });
const { default: EmbeddedPostgres } = require(epPath);
const prismaPath = require.resolve('@prisma/client', { paths: [path.resolve(__dirname, '../packages/database')] });
const { PrismaClient } = require(prismaPath);

async function main() {
  const dbDir = path.resolve(__dirname, '../packages/database/data/db');
  const pg = new EmbeddedPostgres({
    databaseDir: dbDir,
    port: 5432,
    user: 'academy',
    password: 'academy',
    authMethod: 'password',
    persistent: true,
  });

  console.log('[Diff Check] Starting embedded PostgreSQL to inspect live data...');
  try {
    await pg.start();
  } catch (e) {
    console.log('[Diff Check] (Server might already be running: ' + e.message + ')');
  }

  // Wait 3 seconds for PostgreSQL socket to be ready
  await new Promise(r => setTimeout(r, 3000));

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://academy:academy@127.0.0.1:5432/academy?schema=public'
      }
    }
  });
  const backup = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../backups/sportexus_backup_2026-10-28T00-57-09-057Z.json'), 'utf8'));

  const liveTenants = await prisma.tenant.findMany({ select: { id: true, name: true, slug: true, status: true, createdAt: true } });
  const liveUsers = await prisma.user.findMany({ select: { id: true, name: true, email: true, createdAt: true } });
  const liveAuditCount = await prisma.auditLog.count();

  console.log('\n--- LIVE DATABASE COUNTS ---');
  console.log(`Live Tenants Count: ${liveTenants.length}`);
  console.log(`Live Users Count: ${liveUsers.length}`);
  console.log(`Live Audit Logs Count: ${liveAuditCount}`);

  console.log('\n--- BACKUP JSON COUNTS ---');
  console.log(`Backup Tenants Count: ${backup.data.tenant.length}`);
  console.log(`Backup Users Count: ${backup.data.user.length}`);
  console.log(`Backup Audit Logs Count: ${backup.data.auditLog.length}`);

  const backupTenantIds = new Set(backup.data.tenant.map(t => t.id));
  const newTenants = liveTenants.filter(t => !backupTenantIds.has(t.id));

  console.log('\n--- NEW TENANTS IN LIVE DB NOT IN BACKUP ---');
  console.log(JSON.stringify(newTenants, null, 2));

  const backupUserIds = new Set(backup.data.user.map(u => u.id));
  const newUsers = liveUsers.filter(u => !backupUserIds.has(u.id));

  console.log('\n--- NEW USERS IN LIVE DB NOT IN BACKUP ---');
  console.log(JSON.stringify(newUsers, null, 2));

  await prisma.$disconnect();
  try {
    await pg.stop();
  } catch (e) {}
}

main().catch(console.error);
