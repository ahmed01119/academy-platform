const { PrismaClient } = require('../packages/database/node_modules/@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runRestore() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node scripts/db-restore.js <path-to-backup.json>');
    process.exit(1);
  }

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`File does not exist: ${resolved}`);
    process.exit(1);
  }

  console.log(`[Restore] Reading backup file: ${resolved}`);
  const content = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
  const data = content.data || content;

  // Insert in dependency order
  const order = [
    'user',
    'tenant',
    'membership',
    'branch',
    'trainingGroup',
    'player',
    'coach',
    'subscriptionPlan',
    'playerSubscription',
    'attendanceRecord',
    'evaluation',
    'paymentRecord',
    'notification',
    'auditLog',
    'academyApplication'
  ];

  let restoredTotal = 0;

  for (const model of order) {
    const list = data[model];
    if (Array.isArray(list) && list.length > 0 && prisma[model]) {
      let count = 0;
      for (const item of list) {
        try {
          await prisma[model].upsert({
            where: { id: item.id },
            update: item,
            create: item
          });
          count++;
        } catch (err) {
          // ignore duplicate / constraint conflicts on upsert
        }
      }
      console.log(`  + Restored ${count}/${list.length} rows for ${model}`);
      restoredTotal += count;
    }
  }

  console.log(`[Restore] Finished! Restored ${restoredTotal} total records.`);
  await prisma.$disconnect();
}

runRestore().catch((e) => {
  console.error('[Restore Error]', e);
  process.exit(1);
});
