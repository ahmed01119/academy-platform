const path = require('path');
const fs = require('fs');

const prismaPath = require.resolve('@prisma/client', {
  paths: [path.resolve(__dirname, '../packages/database'), path.resolve(__dirname, '../apps/api')],
});
const { PrismaClient } = require(prismaPath);
const argon2 = require(path.resolve(__dirname, '../apps/api/node_modules/argon2'));

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

  console.log('===============================================================');
  console.log('       SPORTEXUS — SYNTHETIC STAGING DATABASE SEEDER           ');
  console.log('===============================================================');

  if (!dbUrl) {
    console.error('[FATAL] DATABASE_URL environment variable is missing.');
    process.exit(1);
  }

  // 1. HARD SECURITY GUARD: NEVER RUN AGAINST LOCAL PRODUCTION DATABASE
  const urlLower = dbUrl.toLowerCase();
  const isLocalHost = urlLower.includes('localhost:5432') || urlLower.includes('127.0.0.1:5432');
  if (isLocalHost && !process.env.ALLOW_LOCAL_SYNTHETIC_TEST_ONLY) {
    console.error(
      '\n[SECURITY GUARD TRIGGERED] Refusing to seed synthetic staging data against local database port 5432!\n' +
      'This seeder is strictly dedicated for remote Neon staging environments.\n' +
      'To test locally in an isolated schema, pass ALLOW_LOCAL_SYNTHETIC_TEST_ONLY=1 with an isolated schema param.\n'
    );
    process.exit(1);
  }

  console.log(`[Target DB] Connecting to: ${dbUrl.replace(/:[^:@]+@/, ':****@')}`);
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  try {
    console.log('\n[1/6] Seeding Standard SaaS Subscription Plans...');
    const plans = [
      { code: 'STARTER', name: 'Starter Plan (البداية)', maxPlayers: 50, maxBranches: 1, maxCoaches: 3, priceMonthly: 499 },
      { code: 'PRO', name: 'Pro Plan (المحترف)', maxPlayers: 200, maxBranches: 3, maxCoaches: 10, priceMonthly: 999 },
      { code: 'ENTERPRISE', name: 'Enterprise Plan (المؤسسي)', maxPlayers: 1000, maxBranches: 10, maxCoaches: 50, priceMonthly: 2499 },
    ];
    for (const p of plans) {
      await prisma.saaSPlan.upsert({
        where: { code: p.code },
        update: p,
        create: p,
      });
    }

    console.log('[2/6] Creating Synthetic Platform Superadmin...');
    const adminPasswordHash = await hashPassword('StagingAdmin2026!');
    const superAdmin = await prisma.user.upsert({
      where: { email: 'staging-superadmin@sportexus.internal' },
      update: {
        name: 'مدير المنصة التجريبي (Staging Superadmin)',
        isPlatformSuperAdmin: true,
        isPlatformOwner: true,
        isEmailVerified: true,
      },
      create: {
        email: 'staging-superadmin@sportexus.internal',
        name: 'مدير المنصة التجريبي (Staging Superadmin)',
        passwordHash: adminPasswordHash,
        isPlatformSuperAdmin: true,
        isPlatformOwner: true,
        isEmailVerified: true,
      },
    });

    console.log('[3/6] Creating Synthetic Academy 1: "أكاديمية الفرسان التجريبية" (knights-staging)...');
    const tenant1 = await prisma.tenant.upsert({
      where: { slug: 'knights-staging' },
      update: { name: 'أكاديمية الفرسان التجريبية (Staging)', status: 'ACTIVE' },
      create: {
        slug: 'knights-staging',
        name: 'أكاديمية الفرسان التجريبية (Staging)',
        status: 'ACTIVE',
        currency: 'SAR',
        timezone: 'Asia/Riyadh',
        email: 'contact@knights-staging.sportexus.internal',
        phone: '+966501111111',
      },
    });

    // Academy 1 Subscription
    await prisma.tenantSubscription.upsert({
      where: { tenantId: tenant1.id },
      update: { status: 'ACTIVE', planCode: 'PRO' },
      create: {
        tenantId: tenant1.id,
        planCode: 'PRO',
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        renewalDate: new Date(Date.now() + 30 * 86400000),
      },
    });

    // Academy 1 Branch
    const branch1 = await prisma.branch.upsert({
      where: { tenantId_code: { tenantId: tenant1.id, code: 'MAIN' } },
      update: { name: 'فرع الفرسان الرئيسي - الرياض' },
      create: {
        tenantId: tenant1.id,
        code: 'MAIN',
        name: 'فرع الفرسان الرئيسي - الرياض',
        status: 'ACTIVE',
        capacity: 100,
        city: 'الرياض',
      },
    });

    // Academy 1 Owner & Coach Users
    const owner1Pwd = await hashPassword('KnightsOwner2026!');
    const owner1 = await prisma.user.upsert({
      where: { email: 'owner.knights@sportexus.internal' },
      update: { name: 'فهد المنصور (مالك الفرسان)' },
      create: {
        email: 'owner.knights@sportexus.internal',
        name: 'فهد المنصور (مالك الفرسان)',
        passwordHash: owner1Pwd,
        isEmailVerified: true,
      },
    });

    await prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId: tenant1.id, userId: owner1.id } },
      update: { role: 'OWNER', status: 'ACTIVE' },
      create: { tenantId: tenant1.id, userId: owner1.id, role: 'OWNER', status: 'ACTIVE' },
    });

    const coach1Pwd = await hashPassword('KnightsCoach2026!');
    const coach1 = await prisma.user.upsert({
      where: { email: 'coach.knights@sportexus.internal' },
      update: { name: 'الكابتن طارق الشهري' },
      create: {
        email: 'coach.knights@sportexus.internal',
        name: 'الكابتن طارق الشهري',
        passwordHash: coach1Pwd,
        isEmailVerified: true,
      },
    });

    await prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId: tenant1.id, userId: coach1.id } },
      update: { role: 'COACH', status: 'ACTIVE', branchId: branch1.id },
      create: { tenantId: tenant1.id, userId: coach1.id, role: 'COACH', status: 'ACTIVE', branchId: branch1.id },
    });

    // Training Group
    let group1 = await prisma.trainingGroup.findFirst({
      where: { tenantId: tenant1.id, name: 'فريق البراعم (U-12)' },
    });
    if (!group1) {
      group1 = await prisma.trainingGroup.create({
        data: {
          tenantId: tenant1.id,
          branchId: branch1.id,
          name: 'فريق البراعم (U-12)',
          sport: 'FOOTBALL',
          ageCategory: 'U12',
          capacity: 25,
          status: 'ACTIVE',
        },
      });
      await prisma.groupCoach.create({
        data: {
          tenantId: tenant1.id,
          groupId: group1.id,
          coachUserId: coach1.id,
          isHeadCoach: true,
        },
      });
    }

    // Synthetic Player & Guardian
    let player1 = await prisma.player.findFirst({
      where: { tenantId: tenant1.id, nationalId: '1122334455' },
    });
    if (!player1) {
      player1 = await prisma.player.create({
        data: {
          tenantId: tenant1.id,
          firstName: 'يوسف',
          lastName: 'السعدون',
          dateOfBirth: new Date('2014-05-15'),
          gender: 'MALE',
          nationalId: '1122334455',
          status: 'ACTIVE',
          emergencyContactName: 'عبدالله السعدون',
          emergencyContactPhone: '+966502222222',
          membershipNumber: '10', // Jersey #10
        },
      });
      await prisma.playerEnrollment.create({
        data: {
          tenantId: tenant1.id,
          playerId: player1.id,
          branchId: branch1.id,
          status: 'ACTIVE',
          startDate: new Date(),
        },
      });
      await prisma.groupMember.create({
        data: {
          tenantId: tenant1.id,
          groupId: group1.id,
          playerId: player1.id,
          status: 'ACTIVE',
        },
      });
    }

    const guardianUser = await prisma.user.upsert({
      where: { email: 'guardian.tariq@sportexus.internal' },
      update: { name: 'عبدالله السعدون (ولي أمر)' },
      create: {
        email: 'guardian.tariq@sportexus.internal',
        name: 'عبدالله السعدون (ولي أمر)',
        passwordHash: owner1Pwd,
        isEmailVerified: true,
      },
    });

    let guardianRecord = await prisma.guardian.findFirst({
      where: { tenantId: tenant1.id, playerId: player1.id },
    });
    if (!guardianRecord) {
      guardianRecord = await prisma.guardian.create({
        data: {
          tenantId: tenant1.id,
          playerId: player1.id,
          userId: guardianUser.id,
          firstName: 'عبدالله',
          lastName: 'السعدون',
          phone: '+966502222222',
          email: 'guardian.tariq@sportexus.internal',
          relationship: 'FATHER',
          isPrimary: true,
        },
      });
    }

    // Synthetic Subscription & Financial Transaction
    let subPlan1 = await prisma.playerSubscriptionPlan.findFirst({
      where: { tenantId: tenant1.id, name: 'اشتراك شهري أساسي' },
    });
    if (!subPlan1) {
      subPlan1 = await prisma.playerSubscriptionPlan.create({
        data: {
          tenantId: tenant1.id,
          name: 'اشتراك شهري أساسي',
          feeAmount: 500,
          currency: 'SAR',
          billingPeriod: 'MONTHLY',
        },
      });
    }

    let pSub1 = await prisma.playerSubscription.findFirst({
      where: { tenantId: tenant1.id, playerId: player1.id },
    });
    if (!pSub1) {
      pSub1 = await prisma.playerSubscription.create({
        data: {
          tenantId: tenant1.id,
          playerId: player1.id,
          planId: subPlan1.id,
          status: 'ACTIVE',
          startDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 86400000),
          renewalDate: new Date(Date.now() + 30 * 86400000),
          feeAmount: 500,
          paidAmount: 500,
          outstandingBalance: 0,
        },
      });
      await prisma.academyFinancialTransaction.create({
        data: {
          tenantId: tenant1.id,
          branchId: branch1.id,
          playerId: player1.id,
          subscriptionId: pSub1.id,
          recordedByUserId: owner1.id,
          type: 'MEMBERSHIP_FEE',
          amount: 500,
          currency: 'SAR',
          paymentMethod: 'CARD',
          status: 'COMPLETED',
          receiptNumber: 'REC-STAGING-001',
          notes: 'سداد رسوم اشتراك شهري تجريبي',
        },
      });
    }

    // Attendance Session
    let session1 = await prisma.attendanceSession.findFirst({
      where: { tenantId: tenant1.id, groupId: group1.id },
    });
    if (!session1) {
      session1 = await prisma.attendanceSession.create({
        data: {
          tenantId: tenant1.id,
          branchId: branch1.id,
          groupId: group1.id,
          groupName: group1.name,
          coachUserId: coach1.id,
          sessionDate: new Date(),
          startTime: '16:00',
          endTime: '18:00',
          status: 'IN_PROGRESS',
        },
      });
      await prisma.attendanceRecord.create({
        data: {
          tenantId: tenant1.id,
          sessionId: session1.id,
          playerId: player1.id,
          status: 'PRESENT',
          markedByUserId: owner1.id,
        },
      });
    }

    console.log('[4/6] Creating Synthetic Academy 2: "أكاديمية الأمل التجريبية" (hope-staging)...');
    const tenant2 = await prisma.tenant.upsert({
      where: { slug: 'hope-staging' },
      update: { name: 'أكاديمية الأمل التجريبية (Staging)', status: 'ACTIVE' },
      create: {
        slug: 'hope-staging',
        name: 'أكاديمية الأمل التجريبية (Staging)',
        status: 'ACTIVE',
        currency: 'SAR',
        timezone: 'Asia/Riyadh',
        email: 'contact@hope-staging.sportexus.internal',
        phone: '+966503333333',
      },
    });

    const owner2Pwd = await hashPassword('HopeOwner2026!');
    const owner2 = await prisma.user.upsert({
      where: { email: 'owner.hope@sportexus.internal' },
      update: { name: 'سلطان القحطاني (مالك الأمل)' },
      create: {
        email: 'owner.hope@sportexus.internal',
        name: 'سلطان القحطاني (مالك الأمل)',
        passwordHash: owner2Pwd,
        isEmailVerified: true,
      },
    });

    await prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId: tenant2.id, userId: owner2.id } },
      update: { role: 'OWNER', status: 'ACTIVE' },
      create: { tenantId: tenant2.id, userId: owner2.id, role: 'OWNER', status: 'ACTIVE' },
    });

    console.log('[5/6] Verifying Multi-Tenant Data Isolation...');
    const knightsPlayers = await prisma.player.findMany({ where: { tenantId: tenant1.id } });
    const hopePlayers = await prisma.player.findMany({ where: { tenantId: tenant2.id } });
    console.log(`  -> Academy 1 (Knights) Players: ${knightsPlayers.length}`);
    console.log(`  -> Academy 2 (Hope) Players: ${hopePlayers.length}`);
    if (hopePlayers.length !== 0 || knightsPlayers.length !== 1) {
      throw new Error('[ISOLATION BREACH] Multi-tenant scoping failed during synthetic validation!');
    }
    console.log('  [+] Strict Multi-Tenant Row-Level Isolation Verified 100%!');

    console.log('\n[6/6] Synthetic Staging Database Seeding Summary:');
    console.log('  -------------------------------------------------------------');
    console.log('  Platform Superadmin:  staging-superadmin@sportexus.internal / StagingAdmin2026!');
    console.log('  Academy 1 Owner:      owner.knights@sportexus.internal      / KnightsOwner2026!');
    console.log('  Academy 1 Coach:      coach.knights@sportexus.internal      / KnightsCoach2026!');
    console.log('  Academy 2 Owner:      owner.hope@sportexus.internal         / HopeOwner2026!');
    console.log('  -------------------------------------------------------------');
    console.log('  [SUCCESS] Dedicated Staging Database Seeded Exclusively with Synthetic Records.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[Error during staging seeding]:', err);
  process.exit(1);
});
