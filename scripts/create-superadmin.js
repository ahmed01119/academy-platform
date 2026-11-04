const fs = require('fs');
const path = require('path');

// Read DATABASE_URL from backend/.env or .env
function loadEnv() {
  const envPaths = [
    path.resolve(__dirname, '../backend/.env'),
    path.resolve(__dirname, '../packages/database/.env'),
    path.resolve(__dirname, '../.env'),
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [key, ...vals] = trimmed.split('=');
        if (key && !process.env[key.trim()]) {
          let val = vals.join('=').trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          process.env[key.trim()] = val;
        }
      }
    }
  }
}

loadEnv();

const prismaPath = path.resolve(__dirname, '../packages/database/node_modules/@prisma/client');
const { PrismaClient } = require(prismaPath);
const argon2Path = path.resolve(__dirname, '../backend/node_modules/argon2');
const argon2 = require(argon2Path);

const TARGET_EMAIL = (process.argv[2] || process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
const TARGET_NAME = process.argv[3] || process.env.SUPERADMIN_NAME || 'Platform Super Admin';
const INITIAL_PASSWORD = process.argv[4] || process.env.SUPERADMIN_PASSWORD;

if (!TARGET_EMAIL || !INITIAL_PASSWORD) {
  console.error('Usage: node scripts/create-superadmin.js <email> [name] <password>');
  console.error('Or set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD environment variables.');
  process.exit(1);
}

async function hashPassword(plain) {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL not found in environment.');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const prisma = new PrismaClient({
    datasources: {
      db: { url: dbUrl },
    },
  });

  try {
    const passwordHash = await hashPassword(INITIAL_PASSWORD);

    const existingUser = await prisma.user.findUnique({
      where: { email: TARGET_EMAIL },
    });

    let resultUser;
    if (existingUser) {
      console.log(`User ${TARGET_EMAIL} already exists (ID: ${existingUser.id}). Promoting to Super Admin & Platform Owner...`);
      resultUser = await prisma.user.update({
        where: { email: TARGET_EMAIL },
        data: {
          name: TARGET_NAME,
          passwordHash,
          isPlatformSuperAdmin: true,
          isPlatformOwner: true,
          isEmailVerified: true,
          isSuspended: false,
        },
      });
      console.log('User updated successfully.');
    } else {
      console.log(`Creating new Super Admin user for ${TARGET_EMAIL}...`);
      resultUser = await prisma.user.create({
        data: {
          email: TARGET_EMAIL,
          name: TARGET_NAME,
          passwordHash,
          isPlatformSuperAdmin: true,
          isPlatformOwner: true,
          isEmailVerified: true,
          isSuspended: false,
        },
      });
      console.log('Super Admin user created successfully.');
    }

    console.log('\n======================================================');
    console.log('SUPER ADMIN ACCOUNT READY');
    console.log('======================================================');
    console.log(`ID:                    ${resultUser.id}`);
    console.log(`Name:                  ${resultUser.name}`);
    console.log(`Email:                 ${resultUser.email}`);
    console.log(`Password:              [SET_FROM_INPUT]`);
    console.log(`isPlatformSuperAdmin:  ${resultUser.isPlatformSuperAdmin}`);
    console.log(`isPlatformOwner:       ${resultUser.isPlatformOwner}`);
    console.log(`isEmailVerified:       ${resultUser.isEmailVerified}`);
    console.log('======================================================\n');
  } catch (err) {
    console.error('Failed to create/update super admin:', err.message || err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
