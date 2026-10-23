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

  // 12. Platform Super Admin User
  const superAdminPasswordHash = await hashPassword('SuperAdmin123!');
  let superAdminUser = await prisma.user.findUnique({
    where: { email: 'superadmin@platform.sa' },
  });
  if (!superAdminUser) {
    superAdminUser = await prisma.user.create({
      data: {
        email: 'superadmin@platform.sa',
        passwordHash: superAdminPasswordHash,
        name: 'مدير المنصة الرئيسي',
        phone: '+966500000001',
        isEmailVerified: true,
        isPlatformSuperAdmin: true,
      },
    });
    console.log('[Seed] Created Super Admin User:', superAdminUser.email);
  } else {
    await prisma.user.update({
      where: { id: superAdminUser.id },
      data: { isPlatformSuperAdmin: true },
    });
    console.log('[Seed] Updated Super Admin User:', superAdminUser.email);
  }

  // 13. Player User (Omar Al-Ghamdi)
  const playerPasswordHash = await hashPassword('PlayerPass123!');
  let playerUser = await prisma.user.findUnique({
    where: { email: 'player.omar@academy.sa' },
  });
  if (!playerUser) {
    playerUser = await prisma.user.create({
      data: {
        email: 'player.omar@academy.sa',
        passwordHash: playerPasswordHash,
        name: 'عمر الغامدي',
        phone: '+966551112233',
        isEmailVerified: true,
      },
    });
    console.log('[Seed] Created Player User:', playerUser.email);
  }

  // Link Omar's player record to playerUser
  if (seededPlayers[0]) {
    await prisma.player.update({
      where: { id: seededPlayers[0].id },
      data: { userId: playerUser.id },
    });
    console.log('[Seed] Linked Player Omar to user:', playerUser.email);
  }

  // 14. Guardian User (Fahad Al-Ghamdi)
  const parentPasswordHash = await hashPassword('ParentPass123!');
  let guardianUser = await prisma.user.findUnique({
    where: { email: 'parent.fahad@academy.sa' },
  });
  if (!guardianUser) {
    guardianUser = await prisma.user.create({
      data: {
        email: 'parent.fahad@academy.sa',
        passwordHash: parentPasswordHash,
        name: 'فهد الغامدي',
        phone: '+966551112233',
        isEmailVerified: true,
      },
    });
    console.log('[Seed] Created Guardian User:', guardianUser.email);
  }

  // Link Guardian record to guardianUser
  const omarGuardian = await prisma.guardian.findFirst({
    where: { playerId: seededPlayers[0].id },
  });
  if (omarGuardian) {
    await prisma.guardian.update({
      where: { id: omarGuardian.id },
      data: { userId: guardianUser.id },
    });
    console.log('[Seed] Linked Guardian record to user:', guardianUser.email);
  }

  // 15. Evaluation Templates
  let defaultTemplate = await prisma.evaluationTemplate.findFirst({
    where: { tenantId: tenant.id, isDefault: true },
  });

  if (!defaultTemplate) {
    defaultTemplate = await prisma.evaluationTemplate.create({
      data: {
        tenantId: tenant.id,
        sport: 'FOOTBALL',
        name: 'نموذج تقييم كرة القدم الشامل (معياري)',
        description: 'تقييم الأداء الرباعي المتوازن: المهارات الفنية، الوعي التكتيكي، الجاهزية البدنية، والسلوك الرياضي',
        isDefault: true,
        criteria: [
          { id: 'crit-1', name: 'التحكم بالكرة والمراوغة', category: 'TECHNICAL', weight: 1, maxScore: 10 },
          { id: 'crit-2', name: 'دقة وسرعة التمرير', category: 'TECHNICAL', weight: 1, maxScore: 10 },
          { id: 'crit-3', name: 'التمركز والرؤية الميدانية', category: 'TACTICAL', weight: 1, maxScore: 10 },
          { id: 'crit-4', name: 'السرعة والرشاقة بالكرة', category: 'PHYSICAL', weight: 1, maxScore: 10 },
          { id: 'crit-5', name: 'الانضباط والروح الرياضية', category: 'BEHAVIORAL', weight: 1, maxScore: 10 },
        ],
      },
    });
    console.log('[Seed] Created Default Evaluation Template:', defaultTemplate.name);
  }

  let u11Template = await prisma.evaluationTemplate.findFirst({
    where: { tenantId: tenant.id, ageCategory: 'U-11' },
  });

  if (!u11Template) {
    u11Template = await prisma.evaluationTemplate.create({
      data: {
        tenantId: tenant.id,
        sport: 'FOOTBALL',
        ageCategory: 'U-11',
        name: 'نموذج تقييم فئة البراعم U-11',
        description: 'معايير تقييم مبسطة تركز على الشغف باللعبة والمهارة الأساسية والعمل الجماعي',
        isDefault: false,
        criteria: [
          { id: 'u11-1', name: 'الاستلام والتسليم', category: 'TECHNICAL', weight: 1, maxScore: 10 },
          { id: 'u11-2', name: 'التسديد نحو المرمى', category: 'TECHNICAL', weight: 1, maxScore: 10 },
          { id: 'u11-3', name: 'التوافق العضلي والسرعة', category: 'PHYSICAL', weight: 1, maxScore: 10 },
          { id: 'u11-4', name: 'الاستماع لتوجيهات المدرب', category: 'BEHAVIORAL', weight: 1, maxScore: 10 },
        ],
      },
    });
    console.log('[Seed] Created U-11 Evaluation Template:', u11Template.name);
  }

  // 16. Player Evaluations (Realistic sample evaluations)
  const existingEvalsCount = await prisma.playerEvaluation.count({
    where: { tenantId: tenant.id },
  });

  if (existingEvalsCount === 0 && seededPlayers.length >= 3) {
    const omar = seededPlayers[0];
    const saud = seededPlayers[1];
    const yousef = seededPlayers[2];

    // Omar evaluation 1 (14 days ago)
    const date1 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    await prisma.playerEvaluation.create({
      data: {
        tenantId: tenant.id,
        playerId: omar.id,
        evaluatorUserId: coachUser.id,
        templateId: defaultTemplate.id,
        evaluationDate: date1,
        technicalScore: 8.5,
        tacticalScore: 8.0,
        physicalScore: 8.2,
        behavioralScore: 9.5,
        overallScore: 8.55,
        metrics: { passing: 8.5, dribbling: 8.5, speed: 8.2, discipline: 9.5 },
        strengths: 'دقة عالية في التمريرات القصيرة وهدوء رائع تحت الضغط',
        areasForImprovement: 'يحتاج لتطوير استخدام القدم اليسرى في التسديد السريع',
        privateCoachNotes: 'موهبة واعدة ومرشح لقيادة خط الوسط للفريق الأول في بطولات الأكاديميات',
        guardianFeedback: 'عمر يبدي تطوراً ملحوظاً في تركيزه ومهاراته الجماعية داخل الملعب',
        suggestedGoals: 'التدرب اليومي على الكرات العرضية والتسديد بالقدم الضعيفة',
        isPublished: true,
      },
    });

    // Omar evaluation 2 (3 days ago - improvement demonstrated)
    const date2 = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await prisma.playerEvaluation.create({
      data: {
        tenantId: tenant.id,
        playerId: omar.id,
        evaluatorUserId: coachUser.id,
        sessionId: sessionToday ? sessionToday.id : undefined,
        templateId: defaultTemplate.id,
        evaluationDate: date2,
        technicalScore: 9.0,
        tacticalScore: 8.8,
        physicalScore: 8.6,
        behavioralScore: 9.8,
        overallScore: 9.05,
        metrics: { passing: 9.0, dribbling: 9.0, speed: 8.6, discipline: 9.8 },
        strengths: 'تطور استثنائي في الربط بين خط الدفاع والهجوم، والتسديد من مسافات متوسطة',
        areasForImprovement: 'زيادة القوة البدنية في الالتحامات الهوائية',
        privateCoachNotes: 'أداء ناضج جداً يفوق فئته العمرية. يستحق الدعم الكامل.',
        guardianFeedback: 'مستوى متميز وشغف عالي جداً في التدريبات الأخيرة',
        suggestedGoals: 'المحافظة على المعدل اللياقي والتركيز على ألعاب الهواء',
        isPublished: true,
      },
    });

    // Saud evaluation
    await prisma.playerEvaluation.create({
      data: {
        tenantId: tenant.id,
        playerId: saud.id,
        evaluatorUserId: coachUser.id,
        templateId: defaultTemplate.id,
        evaluationDate: date2,
        technicalScore: 8.0,
        tacticalScore: 7.5,
        physicalScore: 8.5,
        behavioralScore: 8.8,
        overallScore: 8.2,
        metrics: { passing: 8.0, dribbling: 7.8, speed: 8.5, discipline: 8.8 },
        strengths: 'سرعة فائقة وانطلاقات هجومية سريعة على الجناح الأيمن',
        areasForImprovement: 'العودة الدفاعية عند فقدان الكرة',
        privateCoachNotes: 'جناح سريع يحتاج إلى تعزيز الحس الدفاعي',
        guardianFeedback: 'سعود لاعب مجتهد وسريع التطور ونشكر اهتمامكم',
        suggestedGoals: 'تمارين تغطية المساحات والضغط العالي',
        isPublished: true,
      },
    });

    // Yousef evaluation
    await prisma.playerEvaluation.create({
      data: {
        tenantId: tenant.id,
        playerId: yousef.id,
        evaluatorUserId: coachUser.id,
        templateId: defaultTemplate.id,
        evaluationDate: date2,
        technicalScore: 7.5,
        tacticalScore: 8.2,
        physicalScore: 7.8,
        behavioralScore: 9.0,
        overallScore: 8.13,
        metrics: { passing: 7.5, dribbling: 7.5, speed: 7.8, discipline: 9.0 },
        strengths: 'ذكاء تكتيكي عالي وتمركز ممتاز في عمق الملعب',
        areasForImprovement: 'اللياقة الهوائية وسرعة الارتداد',
        privateCoachNotes: 'رؤية ميدانية رائعة يحتاج إلى زيادة التحمل',
        guardianFeedback: 'يوسف يحب كرة القدم ويسعده هذا التقييم',
        suggestedGoals: 'تمارين الجري المتقطع لرفع مستوى التحمل',
        isPublished: true,
      },
    });

    console.log('[Seed] Seeded realistic performance evaluations for demo players');
  }

  // 15. Player Subscription Plans & Financial Data
  const omar = seededPlayers[0];
  const saud = seededPlayers[1];
  const yousef = seededPlayers[2];

  let monthlyPlan = await prisma.playerSubscriptionPlan.findFirst({
    where: { tenantId: tenant.id, name: 'الاشتراك الشهري الأساسي' },
  });
  if (!monthlyPlan) {
    monthlyPlan = await prisma.playerSubscriptionPlan.create({
      data: {
        tenantId: tenant.id,
        branchId: branchMain.id,
        sport: 'FOOTBALL',
        name: 'الاشتراك الشهري الأساسي',
        description: 'يشمل 3 حصص تدريبية أسبوعياً مع بطاقة QR وحصص التقييم الدوري',
        billingPeriod: 'MONTHLY',
        feeAmount: 650,
        currency: 'SAR',
      },
    });
    console.log('[Seed] Created PlayerSubscriptionPlan:', monthlyPlan.name);
  }

  // Player Subscriptions for Omar, Saud, Yousef
  const omarSub = await prisma.playerSubscription.findFirst({
    where: { tenantId: tenant.id, playerId: omar.id },
  });
  if (!omarSub) {
    const now = new Date();
    const nextMonth = new Date(Date.now() + 25 * 86400000);
    const sub = await prisma.playerSubscription.create({
      data: {
        tenantId: tenant.id,
        playerId: omar.id,
        planId: monthlyPlan.id,
        status: 'ACTIVE',
        startDate: now,
        dueDate: nextMonth,
        renewalDate: nextMonth,
        feeAmount: 650,
        paidAmount: 650,
        outstandingBalance: 0,
        lastPaymentDate: now,
        notes: 'تم سداد الرسوم بالكامل نقداً عند بدء الدورة',
      },
    });
    // Record payment transaction
    await prisma.academyFinancialTransaction.create({
      data: {
        tenantId: tenant.id,
        branchId: branchMain.id,
        playerId: omar.id,
        subscriptionId: sub.id,
        recordedByUserId: adminUser.id,
        type: 'MEMBERSHIP_FEE',
        amount: 650,
        currency: 'SAR',
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        receiptNumber: 'REC-2026-0001',
        referenceNumber: 'REF-CSH-01',
        notes: 'سداد رسوم اشتراك شهرية كاش',
      },
    });
    console.log('[Seed] Seeded Omar subscription: ACTIVE (Fully Paid)');
  }

  const saudSub = await prisma.playerSubscription.findFirst({
    where: { tenantId: tenant.id, playerId: saud.id },
  });
  if (!saudSub) {
    const now = new Date();
    const dueDate = new Date(Date.now() + 5 * 86400000);
    const sub = await prisma.playerSubscription.create({
      data: {
        tenantId: tenant.id,
        playerId: saud.id,
        planId: monthlyPlan.id,
        status: 'PARTIAL',
        startDate: now,
        dueDate: dueDate,
        feeAmount: 650,
        paidAmount: 350,
        outstandingBalance: 300,
        lastPaymentDate: now,
        notes: 'تم سداد دفعة أولى 350 ريال، والمتبقي 300 ريال',
      },
    });
    await prisma.academyFinancialTransaction.create({
      data: {
        tenantId: tenant.id,
        branchId: branchMain.id,
        playerId: saud.id,
        subscriptionId: sub.id,
        recordedByUserId: coachUser.id,
        type: 'MEMBERSHIP_FEE',
        amount: 350,
        currency: 'SAR',
        paymentMethod: 'CARD',
        status: 'COMPLETED',
        receiptNumber: 'REC-2026-0002',
        referenceNumber: 'POS-TX-9921',
        notes: 'سداد دفعة أولى عبر جهاز نقاط البيع',
      },
    });
    console.log('[Seed] Seeded Saud subscription: PARTIAL (300 SAR outstanding)');
  }

  const yousefSub = await prisma.playerSubscription.findFirst({
    where: { tenantId: tenant.id, playerId: yousef.id },
  });
  if (!yousefSub) {
    const pastDate = new Date(Date.now() - 7 * 86400000);
    await prisma.playerSubscription.create({
      data: {
        tenantId: tenant.id,
        playerId: yousef.id,
        planId: monthlyPlan.id,
        status: 'OVERDUE',
        startDate: new Date(Date.now() - 37 * 86400000),
        dueDate: pastDate,
        feeAmount: 650,
        paidAmount: 0,
        outstandingBalance: 650,
        notes: 'متأخر في سداد رسوم الشهر الحالي - تنبيه تلقائي للولي',
      },
    });
    console.log('[Seed] Seeded Yousef subscription: OVERDUE (650 SAR due)');
  }

  // Session expense sample
  const existingExpense = await prisma.academyFinancialTransaction.findFirst({
    where: { tenantId: tenant.id, type: 'SESSION_EXPENSE' },
  });
  if (!existingExpense) {
    await prisma.academyFinancialTransaction.create({
      data: {
        tenantId: tenant.id,
        branchId: branchMain.id,
        sessionId: sessionToday ? sessionToday.id : undefined,
        recordedByUserId: coachUser.id,
        type: 'SESSION_EXPENSE',
        amount: 120,
        currency: 'SAR',
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        receiptNumber: 'EXP-2026-0001',
        notes: 'مياه شرب ومشروبات ترطيب للاعبين أثناء الحصة',
      },
    });
    console.log('[Seed] Seeded session expense: 120 SAR for hydration');
  }


  console.log('\n=========================================');
  console.log(' Academy Platform — 5-Role Demo Ready! ');
  console.log('=========================================');
  console.log('1. Platform Super Admin: superadmin@platform.sa / SuperAdmin123!');
  console.log('2. Academy Owner/Admin:  admin@academy.sa / AdminPass123!');
  console.log('3. Coach / Trainer:      coach.ahmed@academy.sa / CoachPass123!');
  console.log('4. Player:               player.omar@academy.sa / PlayerPass123! (عمر الغامدي)');
  console.log('5. Parent / Guardian:    parent.fahad@academy.sa / ParentPass123! (فهد الغامدي)');
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
