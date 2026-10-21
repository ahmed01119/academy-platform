const path = require('path');
const fs = require('fs');

// Load environment variables
const envPath = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const { PrismaClient } = require('@prisma/client');
const argon2 = require(path.resolve(__dirname, '../../../apps/api/node_modules/argon2'));

const prisma = new PrismaClient();

async function hashPassword(plain) {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

async function main() {
  console.log('[Seed] Starting local demo data seeding...');

  // 1. Password hashes
  const adminPasswordHash = await hashPassword('AdminPass123!');
  const coachPasswordHash = await hashPassword('CoachPass123!');

  // 2. Admin User
  let adminUser = await prisma.user.findUnique({
    where: { email: 'admin@academy.sa' },
  });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        email: 'admin@academy.sa',
        passwordHash: adminPasswordHash,
        name: 'أحمد المنصور',
        phone: '+966501234567',
        isEmailVerified: true,
      },
    });
    console.log('[Seed] Created Admin User:', adminUser.email);
  } else {
    console.log('[Seed] Existing Admin User found:', adminUser.email);
  }

  // 3. Coach User
  let coachUser = await prisma.user.findUnique({
    where: { email: 'coach.ahmed@academy.sa' },
  });
  if (!coachUser) {
    coachUser = await prisma.user.create({
      data: {
        email: 'coach.ahmed@academy.sa',
        passwordHash: coachPasswordHash,
        name: 'كابتن طارق السعيد',
        phone: '+966507654321',
        isEmailVerified: true,
      },
    });
    console.log('[Seed] Created Coach User:', coachUser.email);
  } else {
    console.log('[Seed] Existing Coach User found:', coachUser.email);
  }

  // 4. Academy Tenant
  let tenant = await prisma.tenant.findUnique({
    where: { slug: 'stars-academy' },
  });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        slug: 'stars-academy',
        name: 'أكاديمية النجوم الرياضية',
        status: 'ACTIVE',
        currency: 'SAR',
        timezone: 'Asia/Riyadh',
        phone: '+966112345678',
        email: 'info@stars-academy.sa',
        address: 'طريق الملك فهد، الرياض، المملكة العربية السعودية',
      },
    });
    console.log('[Seed] Created Tenant:', tenant.name, `(${tenant.slug})`);
  } else {
    console.log('[Seed] Existing Tenant found:', tenant.name);
  }

  // 5. Tenant Sport
  await prisma.tenantSport.upsert({
    where: {
      tenantId_sport: {
        tenantId: tenant.id,
        sport: 'FOOTBALL',
      },
    },
    update: { isPrimary: true },
    create: {
      tenantId: tenant.id,
      sport: 'FOOTBALL',
      isPrimary: true,
    },
  });
  console.log('[Seed] Configured Primary Sport: FOOTBALL');

  // 6. Branches
  let branchMain = await prisma.branch.findUnique({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: 'RUH-MAIN',
      },
    },
  });
  if (!branchMain) {
    branchMain = await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        code: 'RUH-MAIN',
        name: 'فرع الرياض - النخيل (الرئيسي)',
        status: 'ACTIVE',
        city: 'الرياض',
        country: 'SA',
        address: 'حي النخيل، طريق الملك فهد',
        capacity: 150,
        managerUserId: adminUser.id,
      },
    });
    console.log('[Seed] Created Branch 1:', branchMain.name);
  }

  let branchJeddah = await prisma.branch.findUnique({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: 'JED-BEACH',
      },
    },
  });
  if (!branchJeddah) {
    branchJeddah = await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        code: 'JED-BEACH',
        name: 'فرع جدة - الكورنيش',
        status: 'ACTIVE',
        city: 'جدة',
        country: 'SA',
        address: 'حي الشاطئ، طريق الكورنيش الشمالي',
        capacity: 100,
      },
    });
    console.log('[Seed] Created Branch 2:', branchJeddah.name);
  }

  // 7. Tenant Memberships
  await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: adminUser.id,
      },
    },
    update: {
      role: 'OWNER',
      status: 'ACTIVE',
      branchId: branchMain.id,
    },
    create: {
      tenantId: tenant.id,
      userId: adminUser.id,
      role: 'OWNER',
      status: 'ACTIVE',
      branchId: branchMain.id,
    },
  });

  await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: coachUser.id,
      },
    },
    update: {
      role: 'COACH',
      status: 'ACTIVE',
      branchId: branchMain.id,
    },
    create: {
      tenantId: tenant.id,
      userId: coachUser.id,
      role: 'COACH',
      status: 'ACTIVE',
      branchId: branchMain.id,
    },
  });
  console.log('[Seed] Memberships configured (Admin: OWNER, Coach: COACH)');

  // 8. Players & Guardians & Enrollments
  const demoPlayersData = [
    {
      firstName: 'عمر',
      lastName: 'الغامدي',
      gender: 'MALE',
      dateOfBirth: new Date('2014-05-12'),
      nationalId: '1098765431',
      emergencyContactName: 'فهد الغامدي',
      emergencyContactPhone: '+966551112233',
      guardianFirstName: 'فهد',
      guardianLastName: 'الغامدي',
      relationship: 'FATHER',
    },
    {
      firstName: 'سعود',
      lastName: 'العتيبي',
      gender: 'MALE',
      dateOfBirth: new Date('2014-08-20'),
      nationalId: '1098765432',
      emergencyContactName: 'سلطان العتيبي',
      emergencyContactPhone: '+966552223344',
      guardianFirstName: 'سلطان',
      guardianLastName: 'العتيبي',
      relationship: 'FATHER',
    },
    {
      firstName: 'يوسف',
      lastName: 'الشهري',
      gender: 'MALE',
      dateOfBirth: new Date('2013-11-03'),
      nationalId: '1098765433',
      emergencyContactName: 'نوف الشهري',
      emergencyContactPhone: '+966553334455',
      guardianFirstName: 'نوف',
      guardianLastName: 'الشهري',
      relationship: 'MOTHER',
    },
    {
      firstName: 'ريان',
      lastName: 'القرني',
      gender: 'MALE',
      dateOfBirth: new Date('2011-02-14'),
      nationalId: '1098765434',
      emergencyContactName: 'سعيد القرني',
      emergencyContactPhone: '+966554445566',
      guardianFirstName: 'سعيد',
      guardianLastName: 'القرني',
      relationship: 'FATHER',
    },
    {
      firstName: 'خالد',
      lastName: 'الدوسري',
      gender: 'MALE',
      dateOfBirth: new Date('2011-07-25'),
      nationalId: '1098765435',
      emergencyContactName: 'عبدالله الدوسري',
      emergencyContactPhone: '+966555556677',
      guardianFirstName: 'عبدالله',
      guardianLastName: 'الدوسري',
      relationship: 'FATHER',
    },
  ];

  const seededPlayers = [];

  for (const p of demoPlayersData) {
    let player = await prisma.player.findFirst({
      where: {
        tenantId: tenant.id,
        nationalId: p.nationalId,
      },
    });

    if (!player) {
      player = await prisma.player.create({
        data: {
          tenantId: tenant.id,
          firstName: p.firstName,
          lastName: p.lastName,
          gender: p.gender,
          dateOfBirth: p.dateOfBirth,
          nationalId: p.nationalId,
          emergencyContactName: p.emergencyContactName,
          emergencyContactPhone: p.emergencyContactPhone,
          status: 'ACTIVE',
        },
      });

      await prisma.guardian.create({
        data: {
          tenantId: tenant.id,
          playerId: player.id,
          firstName: p.guardianFirstName,
          lastName: p.guardianLastName,
          relationship: p.relationship,
          phone: p.emergencyContactPhone,
          isPrimary: true,
        },
      });

      await prisma.playerEnrollment.create({
        data: {
          tenantId: tenant.id,
          playerId: player.id,
          branchId: branchMain.id,
          sport: 'FOOTBALL',
          status: 'ACTIVE',
        },
      });
      console.log(`[Seed] Created Player: ${player.firstName} ${player.lastName}`);
    }
    seededPlayers.push(player);
  }

  // 9. Training Groups
  let groupU11 = await prisma.trainingGroup.findFirst({
    where: {
      tenantId: tenant.id,
      name: 'فريق البراعم U-11 (متقدم)',
    },
  });

  if (!groupU11) {
    groupU11 = await prisma.trainingGroup.create({
      data: {
        tenantId: tenant.id,
        branchId: branchMain.id,
        sport: 'FOOTBALL',
        name: 'فريق البراعم U-11 (متقدم)',
        description: 'تدريبات تأسيس المهارات والتحكم بالكرة للفئات العمرية 9-11 سنة',
        ageCategory: 'U-11',
        capacity: 18,
        status: 'ACTIVE',
      },
    });

    await prisma.groupCoach.create({
      data: {
        tenantId: tenant.id,
        groupId: groupU11.id,
        coachUserId: coachUser.id,
        isHeadCoach: true,
      },
    });

    // Add Players 0, 1, 2 to U-11
    for (let i = 0; i < 3; i++) {
      await prisma.groupMember.create({
        data: {
          tenantId: tenant.id,
          groupId: groupU11.id,
          playerId: seededPlayers[i].id,
          status: 'ACTIVE',
        },
      });
    }

    // Schedule: Mon (1) & Wed (3) at 16:30
    await prisma.trainingSchedule.createMany({
      data: [
        {
          tenantId: tenant.id,
          groupId: groupU11.id,
          dayOfWeek: 1,
          startTime: '16:30',
          endTime: '18:00',
          location: 'الملعب الرئيسي A',
          status: 'ACTIVE',
        },
        {
          tenantId: tenant.id,
          groupId: groupU11.id,
          dayOfWeek: 3,
          startTime: '16:30',
          endTime: '18:00',
          location: 'الملعب الرئيسي A',
          status: 'ACTIVE',
        },
      ],
    });
    console.log('[Seed] Created Group U-11 with members and schedules');
  }

  let groupU14 = await prisma.trainingGroup.findFirst({
    where: {
      tenantId: tenant.id,
      name: 'فريق الناشئين U-14 (المنافسات)',
    },
  });

  if (!groupU14) {
    groupU14 = await prisma.trainingGroup.create({
      data: {
        tenantId: tenant.id,
        branchId: branchMain.id,
        sport: 'FOOTBALL',
        name: 'فريق الناشئين U-14 (المنافسات)',
        description: 'إعداد تكتيكي وبدني للمباريات والبطولات الإقليمية',
        ageCategory: 'U-14',
        capacity: 22,
        status: 'ACTIVE',
      },
    });

    await prisma.groupCoach.create({
      data: {
        tenantId: tenant.id,
        groupId: groupU14.id,
        coachUserId: coachUser.id,
        isHeadCoach: true,
      },
    });

    // Add Players 3, 4 to U-14
    for (let i = 3; i < 5; i++) {
      await prisma.groupMember.create({
        data: {
          tenantId: tenant.id,
          groupId: groupU14.id,
          playerId: seededPlayers[i].id,
          status: 'ACTIVE',
        },
      });
    }

    // Schedule: Sun (0) & Tue (2) at 18:00
    await prisma.trainingSchedule.createMany({
      data: [
        {
          tenantId: tenant.id,
          groupId: groupU14.id,
          dayOfWeek: 0,
          startTime: '18:00',
          endTime: '19:30',
          location: 'الملعب العشبي B',
          status: 'ACTIVE',
        },
        {
          tenantId: tenant.id,
          groupId: groupU14.id,
          dayOfWeek: 2,
          startTime: '18:00',
          endTime: '19:30',
          location: 'الملعب العشبي B',
          status: 'ACTIVE',
        },
      ],
    });
    console.log('[Seed] Created Group U-14 with members and schedules');
  }

  // 10. Attendance Sessions
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let sessionToday = await prisma.attendanceSession.findFirst({
    where: {
      tenantId: tenant.id,
      groupId: groupU11.id,
      sessionDate: today,
    },
  });

  if (!sessionToday) {
    sessionToday = await prisma.attendanceSession.create({
      data: {
        tenantId: tenant.id,
        branchId: branchMain.id,
        groupId: groupU11.id,
        coachUserId: coachUser.id,
        sport: 'FOOTBALL',
        groupName: groupU11.name,
        sessionDate: today,
        startTime: '16:30',
        endTime: '18:00',
        status: 'IN_PROGRESS',
        qrCodeSecret: 'sec_seed_qr_today_demo_123',
        qrCodeExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 2), // 2 hours
      },
    });

    // Add Records for U-11 players:
    // Player 0: PRESENT
    await prisma.attendanceRecord.create({
      data: {
        tenantId: tenant.id,
        sessionId: sessionToday.id,
        playerId: seededPlayers[0].id,
        status: 'PRESENT',
        checkInTime: new Date(Date.now() - 1000 * 60 * 25),
        markedByUserId: coachUser.id,
        remarks: 'حضور مبكر وحماس ممتاز',
      },
    });

    // Player 1: LATE
    await prisma.attendanceRecord.create({
      data: {
        tenantId: tenant.id,
        sessionId: sessionToday.id,
        playerId: seededPlayers[1].id,
        status: 'LATE',
        checkInTime: new Date(Date.now() - 1000 * 60 * 10),
        markedByUserId: coachUser.id,
        remarks: 'تأخر 15 دقيقة بسبب الازدحام',
      },
    });

    // Player 2: UNMARKED (ready for manual testing)
    await prisma.attendanceRecord.create({
      data: {
        tenantId: tenant.id,
        sessionId: sessionToday.id,
        playerId: seededPlayers[2].id,
        status: 'UNMARKED',
      },
    });

    console.log('[Seed] Created Today Training Session (IN_PROGRESS) with 3 player records');
  }

  // Session 2: Tomorrow scheduled session
  const tomorrow = new Date(Date.now() + 1000 * 60 * 60 * 24);
  tomorrow.setHours(0, 0, 0, 0);

  let sessionTomorrow = await prisma.attendanceSession.findFirst({
    where: {
      tenantId: tenant.id,
      groupId: groupU14.id,
      sessionDate: tomorrow,
    },
  });

  if (!sessionTomorrow) {
    sessionTomorrow = await prisma.attendanceSession.create({
      data: {
        tenantId: tenant.id,
        branchId: branchMain.id,
        groupId: groupU14.id,
        coachUserId: coachUser.id,
        sport: 'FOOTBALL',
        groupName: groupU14.name,
        sessionDate: tomorrow,
        startTime: '18:00',
        endTime: '19:30',
        status: 'SCHEDULED',
      },
    });

    for (let i = 3; i < 5; i++) {
      await prisma.attendanceRecord.create({
        data: {
          tenantId: tenant.id,
          sessionId: sessionTomorrow.id,
          playerId: seededPlayers[i].id,
          status: 'UNMARKED',
        },
      });
    }
    console.log('[Seed] Created Tomorrow Training Session (SCHEDULED) with 2 player records');
  }

  console.log('\n=========================================');
  console.log(' Demo Seeding Completed Successfully! ');
  console.log('=========================================');
  console.log('Tenant:     أكاديمية النجوم الرياضية (stars-academy)');
  console.log('Admin User: admin@academy.sa / AdminPass123!');
  console.log('Coach User: coach.ahmed@academy.sa / CoachPass123!');
  console.log('=========================================\n');
}

main()
  .catch((e) => {
    console.error('[Seed] Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
