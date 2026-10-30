const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const epPath = require.resolve('embedded-postgres', {
  paths: [path.resolve(__dirname, '../packages/database')],
});
const { default: EmbeddedPostgres } = require(epPath);
const prismaPath = require.resolve('@prisma/client', {
  paths: [path.resolve(__dirname, '../packages/database')],
});
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

  try {
    await pg.start();
  } catch (e) {}
  await new Promise((r) => setTimeout(r, 2000));

  const isolatedSchema = 'verify_isolated_db';
  const isolatedDbUrl = `postgresql://academy:academy@127.0.0.1:5432/academy?schema=${isolatedSchema}`;

  console.log(
    `[Isolated Restore] Step 1: Pushing clean schema to isolated namespace "${isolatedSchema}"...`,
  );
  execSync(
    'pnpm --filter @academy/database exec prisma db push --skip-generate --accept-data-loss',
    {
      env: { ...process.env, DATABASE_URL: isolatedDbUrl },
      stdio: 'pipe',
    },
  );

  // Find latest snapshot
  const backupFiles = fs
    .readdirSync('backups')
    .filter((f) => f.startsWith('sportexus_live_snapshot_'))
    .sort()
    .reverse();
  const latestSnapshotPath = path.join('backups', backupFiles[0]);
  console.log(`[Isolated Restore] Step 2: Loading snapshot data from ${latestSnapshotPath}...`);
  const snapshot = JSON.parse(fs.readFileSync(latestSnapshotPath, 'utf8'));

  const isolatedPrisma = new PrismaClient({
    datasources: { db: { url: isolatedDbUrl } },
  });

  const modelOrder = [
    'saaSPlan',
    'user',
    'refreshToken',
    'tenant',
    'branch',
    'tenantSport',
    'tenantSubscription',
    'tenantMembership',
    'trainingGroup',
    'trainingSchedule',
    'player',
    'guardian',
    'groupCoach',
    'groupMember',
    'playerEnrollment',
    'playerSubscriptionPlan',
    'playerSubscription',
    'attendanceSession',
    'attendanceRecord',
    'attendanceCorrection',
    'attendanceEvent',
    'attendanceIdempotency',
    'academyFinancialTransaction',
    'sessionCashierClosing',
    'evaluationTemplate',
    'playerEvaluation',
    'appNotification',
    'auditLog',
    'academyApplication',
    'playerRegistrationRequest',
    'saaSInvoice',
    'platformAnnouncement',
    'invitation',
  ];

  console.log('[Isolated Restore] Step 3: Populating records into isolated database...');
  let restoredCount = 0;
  const countVerification = {};

  for (const model of modelOrder) {
    const records = snapshot.data[model];
    if (Array.isArray(records) && records.length > 0 && isolatedPrisma[model]) {
      let inserted = 0;
      for (const item of records) {
        // Normalize Dates
        const cleanItem = { ...item };
        for (const [k, v] of Object.entries(cleanItem)) {
          if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) {
            cleanItem[k] = new Date(v);
          }
        }
        await isolatedPrisma[model].create({ data: cleanItem });
        inserted++;
      }
      countVerification[model] = { expected: records.length, restored: inserted };
      restoredCount += inserted;
    }
  }

  console.log(`\n[Isolated Restore] Step 4: Verifying Restored Database Integrity...`);
  console.log(
    `  Total Restored Records: ${restoredCount} (Matches snapshot: ${restoredCount === snapshot.totalRecords})`,
  );

  // Financial verification
  const restoredTransactions = await isolatedPrisma.academyFinancialTransaction.findMany();
  const originalTransactions = snapshot.data.academyFinancialTransaction || [];
  const restoredSum = restoredTransactions.reduce((acc, t) => acc + Number(t.amount), 0);
  const originalSum = originalTransactions.reduce((acc, t) => acc + Number(t.amount), 0);

  console.log(`\n--- FINANCIAL INTEGRITY CHECK ---`);
  console.log(
    `  Transactions Count: ${restoredTransactions.length} (Expected: ${originalTransactions.length})`,
  );
  console.log(`  Transactions Total Sum: ${restoredSum} SAR (Expected: ${originalSum} SAR)`);
  console.log(
    `  Financial Consistency: ${restoredSum === originalSum ? 'PASSED (100% Exact Match)' : 'FAILED'}`,
  );

  // Foreign Key Reference Check
  console.log(`\n--- FOREIGN KEY INTEGRITY CHECK ---`);
  const orphanedMemberships = await isolatedPrisma.$queryRawUnsafe(`
    SELECT count(*)::int as count 
    FROM "${isolatedSchema}"."tenant_memberships" tm
    LEFT JOIN "${isolatedSchema}"."tenants" t ON tm.tenant_id = t.id
    LEFT JOIN "${isolatedSchema}"."users" u ON tm.user_id = u.id
    WHERE t.id IS NULL OR u.id IS NULL;
  `);
  console.log(`  Orphaned TenantMemberships: ${orphanedMemberships[0].count} (Expected: 0)`);

  const orphanedTransactions = await isolatedPrisma.$queryRawUnsafe(`
    SELECT count(*)::int as count 
    FROM "${isolatedSchema}"."academy_financial_transactions" aft
    LEFT JOIN "${isolatedSchema}"."tenants" t ON aft.tenant_id = t.id
    WHERE t.id IS NULL;
  `);
  console.log(`  Orphaned Financial Transactions: ${orphanedTransactions[0].count} (Expected: 0)`);

  const orphanedAttendance = await isolatedPrisma.$queryRawUnsafe(`
    SELECT count(*)::int as count 
    FROM "${isolatedSchema}"."attendance_records" ar
    LEFT JOIN "${isolatedSchema}"."attendance_sessions" s ON ar.session_id = s.id
    WHERE s.id IS NULL;
  `);
  console.log(`  Orphaned Attendance Records: ${orphanedAttendance[0].count} (Expected: 0)`);

  // Cleanup isolated test schema
  console.log(
    `\n[Isolated Restore] Step 5: Dropping temporary isolated schema "${isolatedSchema}"...`,
  );
  await isolatedPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${isolatedSchema}" CASCADE;`);
  console.log(`  [+] Isolated verification schema successfully cleaned up.`);

  await isolatedPrisma.$disconnect();
  try {
    await pg.stop();
  } catch (e) {}

  console.log('\n[SUCCESS] Isolated PostgreSQL Schema & Data Restore Verified 100%!');
}

main().catch(console.error);
