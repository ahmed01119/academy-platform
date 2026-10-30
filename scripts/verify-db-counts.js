const path = require('path');
const { PrismaClient } = require(
  path.resolve(__dirname, '../packages/database/node_modules/@prisma/client'),
);
const prisma = new PrismaClient();

async function main() {
  const modelKeys = Object.keys(prisma).filter(
    (k) =>
      !k.startsWith('_') &&
      !k.startsWith('$') &&
      typeof prisma[k] === 'object' &&
      prisma[k] !== null &&
      typeof prisma[k].count === 'function',
  );

  let total = 0;
  const counts = {};
  for (const m of modelKeys) {
    try {
      const c = await prisma[m].count();
      counts[m] = c;
      total += c;
    } catch (e) {
      // ignore non-model delegate
    }
  }

  console.log(
    'Model counts (' + Object.keys(counts).length + ' models):',
    JSON.stringify(counts, null, 2),
  );
  console.log('TOTAL VERIFIED LIVE DATABASE RECORDS:', total);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
