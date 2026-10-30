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

  console.log('[PG Dump] Ensuring PostgreSQL server is running...');
  try {
    await pg.start();
  } catch (e) {
    console.log('[PG Dump] (Server note: ' + e.message + ')');
  }

  await new Promise((r) => setTimeout(r, 2000));

  const prisma = new PrismaClient({
    datasources: {
      db: { url: 'postgresql://academy:academy@127.0.0.1:5432/academy?schema=public' },
    },
  });

  // 1. Generate Schema DDL
  console.log('[PG Dump] Generating complete PostgreSQL schema DDL via Prisma engine...');
  const ddlSql = execSync(
    'pnpm --filter @academy/database exec prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script',
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  );

  // 2. Query all tables in topological foreign key dependency order
  const modelExportOrder = [
    { model: 'saaSPlan', table: 'saas_plans' },
    { model: 'user', table: 'users' },
    { model: 'refreshToken', table: 'refresh_tokens' },
    { model: 'tenant', table: 'tenants' },
    { model: 'branch', table: 'branches' },
    { model: 'tenantSport', table: 'tenant_sports' },
    { model: 'tenantSubscription', table: 'tenant_subscriptions' },
    { model: 'tenantMembership', table: 'tenant_memberships' },
    { model: 'trainingGroup', table: 'training_groups' },
    { model: 'trainingSchedule', table: 'training_schedules' },
    { model: 'player', table: 'players' },
    { model: 'guardian', table: 'guardians' },
    { model: 'groupCoach', table: 'group_coaches' },
    { model: 'groupMember', table: 'group_members' },
    { model: 'playerEnrollment', table: 'player_enrollments' },
    { model: 'playerSubscriptionPlan', table: 'player_subscription_plans' },
    { model: 'playerSubscription', table: 'player_subscriptions' },
    { model: 'attendanceSession', table: 'attendance_sessions' },
    { model: 'attendanceRecord', table: 'attendance_records' },
    { model: 'attendanceCorrection', table: 'attendance_corrections' },
    { model: 'attendanceEvent', table: 'attendance_events' },
    { model: 'attendanceIdempotency', table: 'attendance_idempotency' },
    { model: 'academyFinancialTransaction', table: 'academy_financial_transactions' },
    { model: 'sessionCashierClosing', table: 'session_cashier_closings' },
    { model: 'evaluationTemplate', table: 'evaluation_templates' },
    { model: 'playerEvaluation', table: 'player_evaluations' },
    { model: 'appNotification', table: 'app_notifications' },
    { model: 'auditLog', table: 'audit_logs' },
    { model: 'academyApplication', table: 'academy_applications' },
    { model: 'playerRegistrationRequest', table: 'player_registration_requests' },
    { model: 'saaSInvoice', table: 'saas_invoices' },
    { model: 'platformAnnouncement', table: 'platform_announcements' },
    { model: 'invitation', table: 'invitations' },
  ];

  console.log('[PG Dump] Exporting table records...');
  let totalRecords = 0;
  const jsonData = {};
  const insertStatements = [];

  for (const { model, table } of modelExportOrder) {
    if (!prisma[model]) continue;
    try {
      const records = await prisma[model].findMany();
      jsonData[model] = records;
      totalRecords += records.length;
      console.log(`  -> ${table} (${model}): ${records.length} records`);

      if (records.length > 0) {
        insertStatements.push(`\n-- Data for ${table} (${records.length} rows)`);
        for (const row of records) {
          const keys = Object.keys(row);
          // Query raw SQL table column names to map camelCase prisma fields to snake_case table columns
          // Using JSON serialize / parameterized structure
        }
      }
    } catch (err) {
      console.warn(`  ! Could not export model ${model}:`, err.message);
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  // Save full JSON backup
  const jsonPath = path.join(backupDir, `sportexus_live_snapshot_${timestamp}.json`);
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        totalRecords,
        tenantCount: jsonData.tenant?.length || 0,
        userCount: jsonData.user?.length || 0,
        data: jsonData,
      },
      null,
      2,
    ),
    'utf8',
  );

  // Save complete DDL SQL
  const ddlPath = path.join(backupDir, `sportexus_schema_${timestamp}.sql`);
  fs.writeFileSync(ddlPath, ddlSql, 'utf8');

  console.log(`\n[PG Dump] Fresh Snapshot Export Complete:`);
  console.log(`  JSON Snapshot: ${jsonPath} (${totalRecords} records)`);
  console.log(`  DDL Schema:    ${ddlPath}`);

  await prisma.$disconnect();
  try {
    await pg.stop();
  } catch (e) {}
}

main().catch(console.error);
