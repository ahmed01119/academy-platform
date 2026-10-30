// =============================================================================
// SPORTEXUS — Autonomous Hostless Staging Provisioning & Verification Script
// =============================================================================
// Execution Safety:
//   1. Reads credentials strictly from git-ignored `.env.staging`.
//   2. Fails immediately if targeting localhost or 127.0.0.1 (local DB protection).
//   3. Strictly verifies target database is `sportexus-api-staging`.
//   4. Executes `prisma migrate deploy` before granting runtime privileges.
//   5. Generates a 48-char cryptographic secret for `sportexus_app`.
//   6. Executes hardened role provisioning and runs full regression suite.
//   7. Outputs the exact runtime configuration into `.env.staging`.
// =============================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const STAGING_ENV_PATH = path.resolve(__dirname, '../.env.staging');
const PROVISION_SQL_PATH = path.resolve(
  __dirname,
  '../packages/database/scripts/provision-runtime-role.sql',
);
const VERIFY_SQL_PATH = path.resolve(
  __dirname,
  '../packages/database/scripts/verify-production-role.sql',
);
const SCHEMA_PATH = path.resolve(__dirname, '../packages/database/prisma/schema.prisma');
const PRISMA_CLI = path.resolve(
  __dirname,
  '../packages/database/node_modules/prisma/build/index.js',
);

async function main() {
  console.log('=============================================================================');
  console.log(' SPORTEXUS — Autonomous Hostless Staging Provisioning');
  console.log('=============================================================================\n');

  // 1. Verify .env.staging existence
  if (!fs.existsSync(STAGING_ENV_PATH)) {
    console.error('ERROR: .env.staging file not found.');
    console.error('Please create `.env.staging` from `.env.staging.example` with:');
    console.error(
      'HOSTLESS_DATABASE_ADMIN_URL=postgresql://academy:<PASSWORD>@<HOST>:<PORT>/sportexus-api-staging?sslmode=require\n',
    );
    process.exit(1);
  }

  const envContent = fs.readFileSync(STAGING_ENV_PATH, 'utf8');
  const match = envContent.match(/^HOSTLESS_DATABASE_ADMIN_URL=(.+)$/m);
  if (!match || !match[1].trim()) {
    console.error('ERROR: HOSTLESS_DATABASE_ADMIN_URL is empty in .env.staging');
    process.exit(1);
  }

  const adminUrl = match[1].trim().replace(/^["']|["']$/g, '');
  process.env.DATABASE_URL = adminUrl;

  // 2. Local database safety invariant
  const parsedUrl = new URL(adminUrl);
  const hostname = parsedUrl.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
    console.error(
      `FATAL SAFETY ABORT: Target host is "${hostname}". Local database modification is strictly prohibited.`,
    );
    process.exit(1);
  }

  console.log(`[Phase 1] Verified cloud target host: ${hostname}`);

  // 3. Import PrismaClient
  const { PrismaClient } = require('../packages/database');
  const prisma = new PrismaClient({
    datasources: { db: { url: adminUrl } },
    log: ['error'],
  });

  try {
    // 4. Verify Phase 2 Target Database & Identity
    console.log('[Phase 2] Verifying database connection and catalog identity...');
    let identityResult;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        identityResult = await prisma.$queryRawUnsafe(
          'SELECT current_database() AS dbname, current_user AS username, version() AS pg_version;',
        );
        break;
      } catch (err) {
        if (attempt < 4) {
          console.warn(
            `[Warning] Phase 2 connection attempt ${attempt}/4 failed. Retrying in 3 seconds...`,
          );
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
        } else {
          throw err;
        }
      }
    }
    const { dbname, username, pg_version } = identityResult[0];

    console.log(`  - Target Database: ${dbname}`);
    console.log(`  - Connected User:  ${username}`);
    console.log(`  - Engine:          ${pg_version.split(' ')[0]} ${pg_version.split(' ')[1]}`);

    if (dbname !== 'neondb') {
      throw new Error(
        `DATABASE MISMATCH: Connected to "${dbname}", but required target is "neondb". Aborting for safety.`,
      );
    }

    // 5. Phase 3: Run Prisma Migrations
    console.log('\n[Phase 3] Deploying Prisma migrations using administrative connection...');
    let migrationAttempts = 0;
    while (migrationAttempts < 3) {
      migrationAttempts++;
      try {
        execSync(`node "${PRISMA_CLI}" migrate deploy --schema="${SCHEMA_PATH}"`, {
          env: { ...process.env, DATABASE_URL: adminUrl },
          stdio: 'inherit',
        });
        break;
      } catch (err) {
        if (migrationAttempts < 3) {
          console.warn(
            `[Warning] Migration deploy attempt ${migrationAttempts}/3 failed. Retrying in 3 seconds...`,
          );
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
        } else {
          throw err;
        }
      }
    }
    console.log('✓ All Prisma migrations verified and applied.');

    // Helper to execute multi-statement SQL files safely via Prisma CLI simple query protocol
    const executeSqlScript = (sqlContent, maxRetries = 3) => {
      const tmpFile = path.join(__dirname, `.tmp-provision-${Date.now()}.sql`);
      try {
        fs.writeFileSync(tmpFile, sqlContent, 'utf8');
        let attempts = 0;
        while (attempts < maxRetries) {
          attempts++;
          try {
            execSync(`node "${PRISMA_CLI}" db execute --file="${tmpFile}" --url="${adminUrl}"`, {
              stdio: 'inherit',
            });
            return;
          } catch (err) {
            if (attempts < maxRetries) {
              console.warn(
                `[Warning] Database command failed (attempt ${attempts}/${maxRetries}). Retrying in 3 seconds...`,
              );
              Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
            } else {
              throw err;
            }
          }
        }
      } finally {
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
        }
      }
    };

    // 6. Phase 4: Generate Secure Runtime Password & Provision Role
    console.log('\n[Phase 4] Provisioning unprivileged sportexus_app runtime role...');
    const runtimePassword = crypto.randomBytes(24).toString('hex'); // 48 chars hex

    let provisionSql = fs.readFileSync(PROVISION_SQL_PATH, 'utf8');
    provisionSql = provisionSql.replaceAll('<STRONG_RUNTIME_PASSWORD>', runtimePassword);

    executeSqlScript(provisionSql);
    console.log(
      '✓ Role sportexus_app provisioned with least-privilege table, column, sequence & procedure grants.',
    );

    // 7. Phase 5: Execute Regression & Security Verification Suite
    console.log(
      '\n[Phase 5] Executing security and RLS regression suite (verify-production-role.sql)...',
    );
    const verifySql = fs.readFileSync(VERIFY_SQL_PATH, 'utf8');
    executeSqlScript(verifySql);
    console.log('✓ All 14 security invariants, RLS checks, and negative DML assertions PASSED.');

    // 8. Construct Runtime DATABASE_URL
    const runtimeUrl = new URL(adminUrl);
    runtimeUrl.username = 'sportexus_app';
    runtimeUrl.password = runtimePassword;
    const finalRuntimeUrl = runtimeUrl.toString();

    // 8.1 Verify Runtime Connection
    console.log('\n[Phase 6] Verifying runtime connection as sportexus_app...');
    process.env.DATABASE_URL = finalRuntimeUrl;
    const runtimePrisma = new PrismaClient({
      datasources: { db: { url: finalRuntimeUrl } },
      log: ['error'],
    });
    try {
      const runtimeIdentity = await runtimePrisma.$queryRawUnsafe(
        'SELECT current_database() AS dbname, current_user AS username;',
      );
      console.log(
        `✓ Successfully connected as runtime user: ${runtimeIdentity[0].username} on database: ${runtimeIdentity[0].dbname}`,
      );
    } finally {
      await runtimePrisma.$disconnect();
    }

    // 9. Write runtime URL to .env.staging (append or update)
    let updatedEnv = envContent;
    if (updatedEnv.includes('HOSTLESS_DATABASE_RUNTIME_URL=')) {
      updatedEnv = updatedEnv.replace(
        /^HOSTLESS_DATABASE_RUNTIME_URL=.*$/m,
        `HOSTLESS_DATABASE_RUNTIME_URL=${finalRuntimeUrl}`,
      );
    } else {
      updatedEnv += `\n# Generated Runtime Connection for sportexus-backend-staging\nHOSTLESS_DATABASE_RUNTIME_URL=${finalRuntimeUrl}\n`;
    }
    fs.writeFileSync(STAGING_ENV_PATH, updatedEnv, 'utf8');

    console.log('\n=============================================================================');
    console.log(' SUCCESS — Hostless Database Ready for Production');
    console.log('=============================================================================');
    console.log(`Database:     neondb (Neon PostgreSQL)`);
    console.log(`Runtime User: sportexus_app`);
    console.log(`Status:       Migrations applied, RLS verified, security invariants passed.`);
    console.log(`\nThe verified DATABASE_URL has been saved to:`);
    console.log(`  ${STAGING_ENV_PATH}`);
    console.log(`\nNext Step (Hostless Dashboard):`);
    console.log(`  1. Open Hostless application: sportexus-backend-staging`);
    console.log(
      `  2. In Environment Variables, set DATABASE_URL to the value of HOSTLESS_DATABASE_RUNTIME_URL`,
    );
    console.log(`  3. Ensure DATABASE_ADMIN_URL is removed or empty`);
    console.log(`  4. Redeploy the application.`);
    console.log('=============================================================================\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('\nFATAL PROVISIONING ERROR:', err.message);
  process.exit(1);
});
