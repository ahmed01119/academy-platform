const { PrismaClient } = require('../packages/database/node_modules/@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runBackup() {
  const backupDir = path.resolve(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const targetFile = path.join(backupDir, `sportexus_backup_${timestamp}.json`);

  console.log(`[Backup] Starting PostgreSQL data export to ${targetFile}...`);

  const models = [
    'user',
    'tenant',
    'tenantMembership',
    'tenantSport',
    'tenantSubscription',
    'branch',
    'trainingGroup',
    'trainingSchedule',
    'groupCoach',
    'groupMember',
    'player',
    'guardian',
    'playerEnrollment',
    'playerSubscriptionPlan',
    'playerSubscription',
    'academyFinancialTransaction',
    'sessionCashierClosing',
    'attendanceSession',
    'attendanceRecord',
    'attendanceCorrection',
    'attendanceEvent',
    'attendanceIdempotency',
    'evaluationTemplate',
    'playerEvaluation',
    'appNotification',
    'auditLog',
    'academyApplication',
    'playerRegistrationRequest',
    'saaSPlan',
    'saaSInvoice',
    'platformAnnouncement',
    'invitation',
    'refreshToken',
  ];

  const exportData = {
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
    app: 'SPORTEXUS',
    data: {},
  };

  let totalRecords = 0;

  for (const model of models) {
    if (prisma[model]) {
      try {
        const records = await prisma[model].findMany();
        exportData.data[model] = records;
        totalRecords += records.length;
        console.log(`  - ${model}: ${records.length} records`);
      } catch (err) {
        console.warn(`  ! Could not export model ${model}: ${err.message}`);
        exportData.data[model] = [];
      }
    }
  }

  fs.writeFileSync(targetFile, JSON.stringify(exportData, null, 2), 'utf-8');
  console.log(`[Backup] Successfully exported ${totalRecords} records to ${targetFile}`);
  await prisma.$disconnect();
}

runBackup().catch((e) => {
  console.error('[Backup Error]', e);
  process.exit(1);
});
