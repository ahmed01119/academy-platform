const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '../packages/database/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function run() {
  const dbSizeRes = await prisma.$queryRaw`SELECT pg_database_size(current_database())::text AS db_size`;
  const tableCountRes = await prisma.$queryRaw`
    SELECT count(*)::text as count 
    FROM pg_class c 
    JOIN pg_namespace n ON n.oid = c.relnamespace 
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  `;
  const tablesRes = await prisma.$queryRaw`
    SELECT
      c.relname AS table_name,
      c.reltuples::bigint::text AS row_count,
      pg_total_relation_size(c.oid)::bigint::text AS total_bytes,
      pg_relation_size(c.oid)::bigint::text AS table_bytes,
      pg_indexes_size(c.oid)::bigint::text AS index_bytes
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY pg_total_relation_size(c.oid) DESC
    LIMIT 10
  `;
  console.log('DB Size:', dbSizeRes);
  console.log('Total Tables Count:', tableCountRes);
  console.log('Top Tables:', tablesRes);
  await prisma.$disconnect();
}
run().catch(console.error);
