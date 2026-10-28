const path = require('path');
const jwt = require(path.resolve(__dirname, '../node_modules/.pnpm/jsonwebtoken@9.0.3/node_modules/jsonwebtoken'));


const { PrismaClient } = require(path.resolve(__dirname, '../packages/database/node_modules/@prisma/client'));
const prisma = new PrismaClient();

const JWT_SECRET = 'pisn1IuvqoqgsFWtyWc2p7eaeNKMqTmYn5zwcNUHdSKBuqNgvWd2TsrfqmGE9Jf9';

async function testStorageApi() {
  const admin = await prisma.user.findFirst({
    where: { isPlatformSuperAdmin: true },
    select: { id: true, email: true, isPlatformSuperAdmin: true, isPlatformOwner: true },
  });
  console.log('Testing with Super Admin:', admin.email, 'ID:', admin.id);

  // Generate valid access token
  const token = jwt.sign(
    {
      sub: admin.id,
      email: admin.email,
      isPlatformSuperAdmin: admin.isPlatformSuperAdmin,
      isPlatformOwner: admin.isPlatformOwner,
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  console.log('\n--- 1. Testing Direct API GET /v1/platform/storage/metrics ---');
  const res1 = await fetch('http://127.0.0.1:3001/v1/platform/storage/metrics', {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Status:', res1.status);
  const data1 = await res1.json();
  console.log('Response:', JSON.stringify(data1, null, 2));

  console.log('\n--- 2. Testing Direct API GET /v1/platform/storage/stats (Alias) ---');
  const res2 = await fetch('http://127.0.0.1:3001/v1/platform/storage/stats', {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Status:', res2.status);
  const data2 = await res2.json();
  console.log('Database Size:', data2.formattedDatabaseSize, '| Tables:', data2.totalTables);

  console.log('\n--- 3. Testing Next.js Rewrite Proxy http://localhost:3000/v1/platform/storage/metrics ---');
  try {
    const res3 = await fetch('http://127.0.0.1:3000/v1/platform/storage/metrics', {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('Next.js Proxy Status:', res3.status);
    const data3 = await res3.json();
    console.log('Proxy Returned Valid Storage Metrics:', Boolean(data3.databaseSizeBytes && data3.tables));
  } catch (err) {
    console.log('Next.js proxy error:', err.message);
  }

  await prisma.$disconnect();
}

testStorageApi().catch(console.error);
