import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// `prisma generate` never connects to a database, so it must work without DATABASE_URL: Docker
// image builds, CI and fresh checkouts generate the client before any database exists. Prisma's
// strict `env()` helper threw PrismaConfigEnvError in exactly those cases. The URL is passed only
// when it is set; commands that do need a database (migrate, studio, db) still require it and
// fail with Prisma's own "DATABASE_URL not found" error when it is missing.
const databaseUrl = process.env.DATABASE_URL?.trim();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});
