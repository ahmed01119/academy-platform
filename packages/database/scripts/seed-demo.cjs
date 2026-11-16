#!/usr/bin/env node
/**
 * Sportexus demo data: WIPES the target database and fills it with synthetic, mixed Arabic / English data that
 * exercises every role and screen. For development / demo databases only.
 *
 *   SEED_DATABASE_URL=<owner connection, direct endpoint>
 *   SEED_CONFIRM_WIPE=<host>/<database>          must match the URL exactly (guard against wiping the wrong database)
 *   SEED_CREDENTIALS_FILE=<path>                 optional; default ~/sportexus-demo-accounts.txt (outside the repo)
 *   node packages/database/scripts/seed-demo.cjs
 *
 * What it does:
 *   1. TRUNCATE every application table except _prisma_migrations and saas_plans (the plan catalogue the migrations
 *      seed). Row triggers (append-only audit/attendance logs) do not fire on TRUNCATE.
 *   2. Inserts: platform owner + super admin; three academies (an Arabic one with two branches and every staff role,
 *      an English one, and a SUSPENDED one to show K3); groups, schedules, players, guardians, enrollments; past,
 *      today's and upcoming sessions with attendance; an evaluation template and published evaluations; plans,
 *      subscriptions, payments and expenses in the academy's currency; a player portal account and a guardian portal
 *      account; pending join requests (guardian and player) with pending accounts; a pending academy application;
 *      a platform announcement and notifications.
 *   3. Writes every account's e-mail and random password to SEED_CREDENTIALS_FILE (never printed, never in git).
 *
 * Runs as the owner connection (bypasses RLS). Re-runnable: it wipes first every time.
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PrismaClient, Prisma } = require('@prisma/client');
const argon2 = require(
  require.resolve('argon2', { paths: [path.resolve(__dirname, '../../../backend')] }),
);

// ------------------------------------------------------------------------------------------------------------ guard
const url = process.env.SEED_DATABASE_URL;
if (!url)
  throw new Error(
    'SEED_DATABASE_URL is required (owner connection to the database to wipe and seed)',
  );
const parsed = new URL(url);
const target = `${parsed.hostname}/${parsed.pathname.replace(/^\//, '')}`;
if (process.env.SEED_CONFIRM_WIPE !== target) {
  throw new Error(
    `Refusing to wipe: set SEED_CONFIRM_WIPE to "${target}" to confirm this database`,
  );
}
if (process.env.NODE_ENV === 'production')
  throw new Error('Refusing to run with NODE_ENV=production');
const credentialsFile =
  process.env.SEED_CREDENTIALS_FILE || path.join(os.homedir(), 'sportexus-demo-accounts.txt');

const prisma = new PrismaClient({ datasources: { db: { url } } });

// ---------------------------------------------------------------------------------------------------------- helpers
const accounts = [];
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const code = (n) => Array.from(crypto.randomBytes(n), (b) => CROCKFORD[b & 31]).join('');
/** Strong random password meeting PasswordSchema (upper, lower, digit, special, >= 8). */
const newPassword = () => `Sx-${crypto.randomBytes(9).toString('base64url')}7a!`;
const today = new Date();
const day = (offset) => {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};
const at = (offsetDays, hh, mm = 0) => {
  const d = day(offsetDays);
  d.setUTCHours(hh, mm);
  return d;
};
const receipt = (prefix, date) =>
  `${prefix}-${date.toISOString().slice(0, 10).replace(/-/g, '')}-${code(8)}`;
const membershipNumber = () => `MEM-${today.getUTCFullYear()}-${code(6)}`;
const qrCode = (tenantId) =>
  `QR-${tenantId.slice(0, 8)}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

async function user({
  email,
  name,
  phone,
  role,
  isPlatformSuperAdmin = false,
  isPlatformOwner = false,
}) {
  const password = newPassword();
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const created = await prisma.user.create({
    data: {
      email,
      name,
      phone,
      passwordHash,
      isEmailVerified: true,
      isPlatformSuperAdmin,
      isPlatformOwner,
    },
  });
  accounts.push({ role, email, password, name });
  return created;
}

async function wipe() {
  const tables = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations', 'saas_plans')`;
  if (!tables.length) return 0;
  const list = tables.map((t) => `public."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  return tables.length;
}

// ----------------------------------------------------------------------------------------------------- one academy
async function academy(spec) {
  const tenant = await prisma.tenant.create({
    data: {
      slug: spec.slug,
      name: spec.name,
      status: spec.status ?? 'ACTIVE',
      currency: spec.currency ?? 'EGP',
      phone: spec.phone,
      email: spec.email,
      address: spec.address,
    },
  });
  await prisma.tenantSport.create({
    data: { tenantId: tenant.id, sport: 'FOOTBALL', isPrimary: true },
  });
  await prisma.tenantSubscription.create({
    data: {
      tenantId: tenant.id,
      planCode: spec.plan ?? 'PRO',
      status: spec.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
      renewalDate: day(30),
      currency: 'EGP',
    },
  });

  const branches = {};
  for (const b of spec.branches) {
    branches[b.code] = await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        code: b.code,
        name: b.name,
        city: b.city,
        address: b.address,
        capacity: 120,
      },
    });
  }

  const staff = {};
  for (const s of spec.staff) {
    const u = await user({
      email: s.email,
      name: s.name,
      phone: s.phone,
      role: `${spec.name} - ${s.role}`,
    });
    await prisma.tenantMembership.create({
      data: {
        tenantId: tenant.id,
        userId: u.id,
        role: s.role,
        status: 'ACTIVE',
        branchId: s.branch ? branches[s.branch].id : null,
        canReviewApplications: Boolean(s.canReview),
      },
    });
    staff[s.key] = u;
    if (s.role === 'BRANCH_MANAGER' && s.branch) {
      await prisma.branch.update({
        where: { id: branches[s.branch].id },
        data: { managerUserId: u.id },
      });
    }
  }

  const groups = {};
  for (const g of spec.groups ?? []) {
    const group = await prisma.trainingGroup.create({
      data: {
        tenantId: tenant.id,
        branchId: branches[g.branch].id,
        name: g.name,
        ageCategory: g.age,
        capacity: 25,
        description: g.description,
      },
    });
    await prisma.groupCoach.create({
      data: {
        tenantId: tenant.id,
        groupId: group.id,
        coachUserId: staff[g.coach].id,
        isHeadCoach: true,
      },
    });
    for (const s of g.schedule) {
      await prisma.trainingSchedule.create({
        data: {
          tenantId: tenant.id,
          groupId: group.id,
          dayOfWeek: s.day,
          startTime: s.start,
          endTime: s.end,
          location: s.location,
        },
      });
    }
    groups[g.key] = { ...group, coachId: staff[g.coach].id, branchId: branches[g.branch].id };
  }

  // Players, guardians, enrollment, group membership
  const players = [];
  for (const p of spec.players ?? []) {
    const group = groups[p.group];
    const player = await prisma.player.create({
      data: {
        tenantId: tenant.id,
        firstName: p.first,
        lastName: p.last,
        gender: p.gender ?? 'MALE',
        dateOfBirth: new Date(`${p.born}-03-15T00:00:00Z`),
        emergencyContactName: p.guardian
          ? `${p.guardian.first} ${p.guardian.last}`
          : `${p.first} ${p.last}`,
        emergencyContactPhone: p.guardian?.phone ?? p.phone ?? '+201000000000',
        medicalNotes: p.medical,
        userId: p.userId ?? null,
        membershipNumber: membershipNumber(),
        qrCardCode: qrCode(tenant.id),
        qrCardIssuedAt: day(-40),
      },
    });
    if (p.guardian) {
      await prisma.guardian.create({
        data: {
          tenantId: tenant.id,
          playerId: player.id,
          firstName: p.guardian.first,
          lastName: p.guardian.last,
          relationship: p.guardian.relationship ?? 'FATHER',
          phone: p.guardian.phone,
          email: p.guardian.email,
          userId: p.guardian.userId ?? null,
          isPrimary: true,
        },
      });
    }
    await prisma.playerEnrollment.create({
      data: {
        tenantId: tenant.id,
        playerId: player.id,
        branchId: group.branchId,
        startDate: day(-60),
      },
    });
    await prisma.groupMember.create({
      data: { tenantId: tenant.id, groupId: group.id, playerId: player.id, startDate: day(-60) },
    });
    players.push({ ...player, group, spec: p });
  }

  // Subscription plans and subscriptions (amounts in the academy currency, K4)
  const plans = [];
  for (const pl of spec.plans ?? []) {
    plans.push(
      await prisma.playerSubscriptionPlan.create({
        data: {
          tenantId: tenant.id,
          name: pl.name,
          description: pl.description,
          billingPeriod: pl.period,
          feeAmount: new Prisma.Decimal(pl.fee),
          currency: tenant.currency,
        },
      }),
    );
  }
  const recorder = staff[spec.recorder];
  const subscriptions = [];
  for (const [i, pl] of players.entries()) {
    if (!plans.length) break;
    const plan = plans[i % plans.length];
    const fee = Number(plan.feeAmount);
    // a mix of paid, partially paid and overdue subscriptions
    const paid = i % 4 === 3 ? 0 : i % 4 === 2 ? Math.round(fee / 2) : fee;
    const status = paid === fee ? 'ACTIVE' : paid === 0 ? 'OVERDUE' : 'PARTIAL';
    const sub = await prisma.playerSubscription.create({
      data: {
        tenantId: tenant.id,
        playerId: pl.id,
        planId: plan.id,
        status,
        startDate: day(-30),
        dueDate: paid === 0 ? day(-3) : day(25),
        feeAmount: new Prisma.Decimal(fee),
        paidAmount: new Prisma.Decimal(paid),
        outstandingBalance: new Prisma.Decimal(fee - paid),
        lastPaymentDate: paid ? day(-20 + (i % 10)) : null,
      },
    });
    subscriptions.push(sub);
    if (paid) {
      const when = at(-20 + (i % 10), 16, 30);
      await prisma.academyFinancialTransaction.create({
        data: {
          tenantId: tenant.id,
          branchId: pl.group.branchId,
          playerId: pl.id,
          subscriptionId: sub.id,
          recordedByUserId: recorder.id,
          type: 'MEMBERSHIP_FEE',
          amount: new Prisma.Decimal(paid),
          currency: tenant.currency,
          paymentMethod: i % 3 === 0 ? 'BANK_TRANSFER' : 'CASH',
          receiptNumber: receipt('REC', when),
          notes: i % 2 ? 'دفعة اشتراك شهري' : 'Monthly subscription payment',
          createdAt: when,
        },
      });
    }
  }

  // Sessions: three past (closed, with attendance), today, two upcoming
  const statuses = ['PRESENT', 'PRESENT', 'LATE', 'PRESENT', 'ABSENT', 'PRESENT', 'EXCUSED'];
  const sessions = [];
  for (const g of Object.values(groups)) {
    for (const offset of [-7, -5, -2, 0, 2, 5]) {
      const past = offset < 0;
      const session = await prisma.attendanceSession.create({
        data: {
          tenantId: tenant.id,
          branchId: g.branchId,
          groupId: g.id,
          coachUserId: g.coachId,
          groupName: g.name,
          sessionDate: day(offset),
          startTime: '17:00',
          endTime: '18:30',
          status: past ? 'CLOSED' : 'SCHEDULED',
          closedAt: past ? at(offset, 18, 45) : null,
          closedByUserId: past ? g.coachId : null,
        },
      });
      sessions.push(session);
      if (past) {
        const members = players.filter((p) => p.group.id === g.id);
        for (const [j, p] of members.entries()) {
          const status = statuses[(j + offset + 7) % statuses.length];
          await prisma.attendanceRecord.create({
            data: {
              tenantId: tenant.id,
              sessionId: session.id,
              playerId: p.id,
              status,
              checkInTime:
                status === 'PRESENT' || status === 'LATE'
                  ? at(offset, 17, status === 'LATE' ? 20 : 0)
                  : null,
              markedByUserId: g.coachId,
            },
          });
        }
      }
    }
    // an expense claimed by the coach on the last past session: one approved, one waiting for review
    const lastPast = sessions.filter((s) => s.groupId === g.id && s.status === 'CLOSED').at(-1);
    if (lastPast && spec.expenses) {
      await prisma.academyFinancialTransaction.create({
        data: {
          tenantId: tenant.id,
          branchId: g.branchId,
          sessionId: lastPast.id,
          recordedByUserId: g.coachId,
          type: 'SESSION_EXPENSE',
          amount: new Prisma.Decimal(150),
          currency: tenant.currency,
          paymentMethod: 'CASH',
          status: 'PENDING',
          receiptNumber: receipt('EXP', lastPast.sessionDate),
          notes: 'مواصلات وأدوات تدريب / Transport and training cones',
        },
      });
    }
  }

  // Evaluation template and published evaluations for half of the players
  if (players.length) {
    const template = await prisma.evaluationTemplate.create({
      data: {
        tenantId: tenant.id,
        name: spec.evaluationTemplate,
        ageCategory: 'U12-U14',
        isDefault: true,
        criteria: [
          {
            id: 'tech-1',
            category: 'TECHNICAL',
            name: 'التحكم بالكرة / Ball control',
            weight: 1,
            maxScore: 10,
          },
          {
            id: 'tact-1',
            category: 'TACTICAL',
            name: 'التمركز / Positioning',
            weight: 1,
            maxScore: 10,
          },
          { id: 'phys-1', category: 'PHYSICAL', name: 'السرعة / Speed', weight: 1, maxScore: 10 },
          {
            id: 'behv-1',
            category: 'BEHAVIORAL',
            name: 'الالتزام / Discipline',
            weight: 1,
            maxScore: 10,
          },
        ],
      },
    });
    for (const [i, p] of players.entries()) {
      if (i % 2) continue;
      const s = [7 + (i % 3), 6 + (i % 4), 8 - (i % 2), 9 - (i % 3)];
      await prisma.playerEvaluation.create({
        data: {
          tenantId: tenant.id,
          playerId: p.id,
          evaluatorUserId: p.group.coachId,
          templateId: template.id,
          evaluationDate: day(-2),
          technicalScore: s[0],
          tacticalScore: s[1],
          physicalScore: s[2],
          behavioralScore: s[3],
          overallScore: (s[0] + s[1] + s[2] + s[3]) / 4,
          metrics: { 'tech-1': s[0], 'tact-1': s[1], 'phys-1': s[2], 'behv-1': s[3] },
          strengths: i % 4 ? 'Excellent first touch and vision' : 'ممتاز في التمرير والرؤية',
          areasForImprovement: i % 4 ? 'Weak foot finishing' : 'يحتاج تحسين التسديد بالقدم اليسرى',
          guardianFeedback: i % 4 ? 'Great progress this month!' : 'تقدم رائع هذا الشهر!',
          isPublished: true,
        },
      });
    }
  }

  return { tenant, branches, staff, groups, players };
}

// ------------------------------------------------------------------------------------------------------------- main
async function main() {
  const wiped = await wipe();
  console.log(`[seed] wiped ${wiped} tables`);

  // Platform
  const owner = await user({
    email: 'owner@example.com',
    name: 'مالك المنصة / Platform Owner',
    role: 'Platform owner',
    isPlatformOwner: true,
    isPlatformSuperAdmin: true,
  });
  await user({
    email: 'admin@example.com',
    name: 'Platform Admin',
    role: 'Platform super admin',
    isPlatformSuperAdmin: true,
  });

  // Portal accounts (linked to records below)
  const playerAccount = await user({
    email: 'ziad.player@example.com',
    name: 'زياد طارق',
    phone: '+201011110001',
    role: 'Player portal',
  });
  const guardianAccount = await user({
    email: 'hany.parent@example.com',
    name: 'Hany Mahmoud',
    phone: '+201011110002',
    role: 'Guardian portal (2 children)',
  });

  // Academy 1 - Arabic, two branches, every staff role
  const nogoom = await academy({
    slug: 'nogoom-academy',
    name: 'أكاديمية النجوم لكرة القدم',
    phone: '+20225550101',
    email: 'info@nogoom.example.com',
    address: 'مدينة نصر، القاهرة',
    branches: [
      { code: 'NSR', name: 'فرع مدينة نصر', city: 'القاهرة', address: 'شارع عباس العقاد' },
      { code: 'ZAY', name: 'Sheikh Zayed Branch', city: 'Giza', address: 'Beverly Hills Club' },
    ],
    staff: [
      {
        key: 'owner',
        role: 'OWNER',
        email: 'ahmed.owner@example.com',
        name: 'أحمد سمير',
        phone: '+201022220001',
      },
      {
        key: 'manager',
        role: 'MANAGER',
        email: 'mona.manager@example.com',
        name: 'منى عادل',
        phone: '+201022220002',
      },
      {
        key: 'bm',
        role: 'BRANCH_MANAGER',
        branch: 'NSR',
        email: 'karim.branch@example.com',
        name: 'كريم فؤاد',
      },
      {
        key: 'reception',
        role: 'RECEPTIONIST',
        branch: 'NSR',
        email: 'sara.reception@example.com',
        name: 'سارة حسن',
      },
      {
        key: 'coach1',
        role: 'COACH',
        branch: 'NSR',
        canReview: true,
        email: 'mohamed.coach@example.com',
        name: 'كابتن محمد علي',
      },
      {
        key: 'coach2',
        role: 'COACH',
        branch: 'ZAY',
        email: 'omar.coach@example.com',
        name: 'Coach Omar Khaled',
      },
      {
        key: 'accountant',
        role: 'ACCOUNTANT',
        email: 'hala.accounts@example.com',
        name: 'هالة مصطفى',
      },
      {
        key: 'viewer',
        role: 'VIEWER',
        email: 'youssef.viewer@example.com',
        name: 'Youssef Nabil (Viewer)',
      },
    ],
    groups: [
      {
        key: 'u12',
        branch: 'NSR',
        coach: 'coach1',
        name: 'ناشئين تحت 12 سنة',
        age: 'U12',
        description: 'تدريب المهارات الأساسية',
        schedule: [
          { day: 0, start: '17:00', end: '18:30', location: 'الملعب الرئيسي' },
          { day: 2, start: '17:00', end: '18:30', location: 'الملعب الرئيسي' },
        ],
      },
      {
        key: 'u14',
        branch: 'ZAY',
        coach: 'coach2',
        name: 'U14 Elite Squad',
        age: 'U14',
        description: 'Competitive squad - tactical sessions',
        schedule: [
          { day: 1, start: '18:00', end: '19:30', location: 'Pitch 2' },
          { day: 3, start: '18:00', end: '19:30', location: 'Pitch 2' },
        ],
      },
    ],
    players: [
      {
        first: 'يوسف',
        last: 'أحمد',
        born: 2015,
        group: 'u12',
        guardian: {
          first: 'أحمد',
          last: 'يوسف',
          phone: '+201033330001',
          email: 'ahmed.youssef.parent@example.com',
        },
      },
      {
        first: 'مريم',
        last: 'خالد',
        gender: 'FEMALE',
        born: 2015,
        group: 'u12',
        guardian: {
          first: 'خالد',
          last: 'إبراهيم',
          phone: '+201033330002',
          relationship: 'FATHER',
        },
      },
      {
        first: 'Adam',
        last: 'Mahmoud',
        born: 2014,
        group: 'u12',
        guardian: {
          first: 'Hany',
          last: 'Mahmoud',
          phone: '+201011110002',
          email: 'hany.parent@example.com',
          userId: guardianAccount.id,
        },
      },
      {
        first: 'Laila',
        last: 'Mahmoud',
        gender: 'FEMALE',
        born: 2016,
        group: 'u12',
        guardian: {
          first: 'Hany',
          last: 'Mahmoud',
          phone: '+201011110002',
          email: 'hany.parent@example.com',
          userId: guardianAccount.id,
        },
        medical: 'Asthma - inhaler in bag',
      },
      {
        first: 'عمر',
        last: 'السيد',
        born: 2014,
        group: 'u12',
        guardian: { first: 'منال', last: 'سعيد', phone: '+201033330003', relationship: 'MOTHER' },
      },
      {
        first: 'زياد',
        last: 'طارق',
        born: 2012,
        group: 'u14',
        userId: playerAccount.id,
        phone: '+201011110001',
        guardian: { first: 'طارق', last: 'محمود', phone: '+201033330004' },
      },
      {
        first: 'Liam',
        last: 'Mostafa',
        born: 2012,
        group: 'u14',
        guardian: {
          first: 'Mostafa',
          last: 'Fathy',
          phone: '+201033330005',
          email: 'mostafa.fathy@example.com',
        },
      },
      {
        first: 'حمزة',
        last: 'رامي',
        born: 2013,
        group: 'u14',
        guardian: { first: 'رامي', last: 'عبد الله', phone: '+201033330006' },
      },
      {
        first: 'Jana',
        last: 'Ashraf',
        gender: 'FEMALE',
        born: 2012,
        group: 'u14',
        guardian: {
          first: 'Ashraf',
          last: 'Samir',
          phone: '+201033330007',
          relationship: 'FATHER',
        },
      },
      {
        first: 'سليم',
        last: 'وائل',
        born: 2013,
        group: 'u14',
        guardian: { first: 'وائل', last: 'جمال', phone: '+201033330008' },
      },
    ],
    plans: [
      { name: 'اشتراك شهري', description: 'حصتين أسبوعياً', period: 'MONTHLY', fee: 600 },
      {
        name: 'Quarterly Elite',
        description: 'Elite squad, 3 months',
        period: 'QUARTERLY',
        fee: 1650,
      },
    ],
    recorder: 'reception',
    expenses: true,
    evaluationTemplate: 'تقييم المهارات الأساسية / Core skills',
  });

  // Academy 2 - English
  const champions = await academy({
    slug: 'champions-academy',
    name: 'Champions Football Academy',
    phone: '+20345550202',
    email: 'hello@champions.example.com',
    address: 'Smouha, Alexandria',
    plan: 'STARTER',
    branches: [
      {
        code: 'ALX',
        name: 'Alexandria - Smouha',
        city: 'Alexandria',
        address: 'Smouha Sporting Club',
      },
    ],
    staff: [
      { key: 'owner', role: 'OWNER', email: 'sarah.owner@example.com', name: 'Sarah Williams' },
      {
        key: 'coach',
        role: 'COACH',
        branch: 'ALX',
        email: 'david.coach@example.com',
        name: 'Coach David Hassan',
      },
    ],
    groups: [
      {
        key: 'kids',
        branch: 'ALX',
        coach: 'coach',
        name: 'Kids Academy (U10)',
        age: 'U10',
        description: 'Fun football fundamentals',
        schedule: [{ day: 5, start: '10:00', end: '11:30', location: 'Main pitch' }],
      },
    ],
    players: [
      {
        first: 'Noah',
        last: 'Samir',
        born: 2017,
        group: 'kids',
        guardian: { first: 'Samir', last: 'Adel', phone: '+201044440001' },
      },
      {
        first: 'Malak',
        last: 'Hossam',
        gender: 'FEMALE',
        born: 2017,
        group: 'kids',
        guardian: { first: 'Hossam', last: 'Ali', phone: '+201044440002' },
      },
      {
        first: 'آدم',
        last: 'شريف',
        born: 2016,
        group: 'kids',
        guardian: { first: 'شريف', last: 'منير', phone: '+201044440003' },
      },
      {
        first: 'Ethan',
        last: 'Karim',
        born: 2016,
        group: 'kids',
        guardian: { first: 'Karim', last: 'Nour', phone: '+201044440004' },
      },
    ],
    plans: [{ name: 'Monthly Kids', description: 'Weekly session', period: 'MONTHLY', fee: 450 }],
    recorder: 'owner',
    evaluationTemplate: 'Kids fundamentals',
  });

  // Academy 3 - suspended by the platform (K3: its members cannot sign in)
  await academy({
    slug: 'falcons-academy',
    name: 'أكاديمية الصقور (موقوفة)',
    status: 'SUSPENDED',
    plan: 'STARTER',
    branches: [{ code: 'TNT', name: 'فرع طنطا', city: 'طنطا' }],
    staff: [
      {
        key: 'owner',
        role: 'OWNER',
        email: 'falcons.owner@example.com',
        name: 'مالك أكاديمية الصقور',
      },
    ],
  });

  // Pending join requests (K6): a guardian and a player with pending accounts at Nogoom
  const pendingGuardian = await user({
    email: 'nadia.pending@example.com',
    name: 'نادية فتحي',
    role: 'Pending guardian (join request under review)',
  });
  await prisma.playerRegistrationRequest.create({
    data: {
      tenantId: nogoom.tenant.id,
      applicantUserId: pendingGuardian.id,
      requesterType: 'GUARDIAN',
      playerName: 'علي فتحي',
      guardianName: 'نادية فتحي',
      contactEmail: 'nadia.pending@example.com',
      contactPhone: '+201055550001',
      dateOfBirth: new Date('2015-06-01T00:00:00Z'),
    },
  });
  const pendingPlayer = await user({
    email: 'mazen.pending@example.com',
    name: 'Mazen Adel',
    role: 'Pending player (join request under review)',
  });
  await prisma.playerRegistrationRequest.create({
    data: {
      tenantId: nogoom.tenant.id,
      applicantUserId: pendingPlayer.id,
      requesterType: 'PLAYER',
      playerName: 'Mazen Adel',
      contactEmail: 'mazen.pending@example.com',
      contactPhone: '+201055550002',
      dateOfBirth: new Date('2011-02-10T00:00:00Z'),
    },
  });

  // Pending academy application (coach / owner applicant)
  const applicant = await user({
    email: 'padel.applicant@example.com',
    name: 'Rana Elite Padel',
    role: 'Pending academy applicant',
  });
  await prisma.academyApplication.create({
    data: {
      applicantUserId: applicant.id,
      academyName: 'Elite Padel Club',
      academySlug: 'elite-padel-club',
      city: 'New Cairo',
      contactEmail: 'padel.applicant@example.com',
      contactPhone: '+201066660001',
      notes: 'Sport: PADEL',
    },
  });

  // Platform announcement and notifications
  await prisma.platformAnnouncement.create({
    data: {
      title: 'مرحباً بكم في سبورتكسس / Welcome to Sportexus',
      message: 'هذه بيانات تجريبية للتجربة فقط. This is demo data for testing.',
      type: 'INFO',
    },
  });
  await prisma.appNotification.createMany({
    data: [
      {
        userId: owner.id,
        type: 'ACADEMY_APPLICATION',
        title: 'New Academy Application',
        body: '"Elite Padel Club" submitted a registration application for review.',
        href: '/platform?tab=applications',
      },
      {
        userId: nogoom.staff.owner.id,
        tenantId: nogoom.tenant.id,
        type: 'PLAYER_REGISTRATION',
        title: 'طلب انضمام جديد',
        body: '"علي فتحي" طلب انضمام بواسطة ولي الأمر نادية فتحي.',
        href: '/players?tab=applications',
      },
      {
        userId: nogoom.staff.owner.id,
        tenantId: nogoom.tenant.id,
        type: 'PLAYER_REGISTRATION',
        title: 'New Player Join Request',
        body: '"Mazen Adel" submitted a join request for review.',
        href: '/players?tab=applications',
      },
      {
        userId: nogoom.staff.accountant.id,
        tenantId: nogoom.tenant.id,
        type: 'EXPENSE_APPROVAL',
        title: 'مصروف بانتظار الاعتماد',
        body: 'مصروف حصة بقيمة 150 بانتظار مراجعتك.',
        href: '/finance',
      },
      {
        userId: guardianAccount.id,
        tenantId: nogoom.tenant.id,
        type: 'EVALUATION_PUBLISHED',
        title: 'New evaluation published',
        body: "Adam's latest evaluation is available.",
        href: '/guardian',
      },
    ],
  });

  // Credentials file (outside the repository; never printed)
  const lines = [
    '# Sportexus demo accounts - synthetic data. Keep this file private; it is not part of the repository.',
    `# Generated ${new Date().toISOString()} for ${target}`,
    '',
    ...accounts.map((a) => `${a.role.padEnd(58)} ${a.email.padEnd(36)} ${a.password}`),
    '',
  ];
  fs.writeFileSync(credentialsFile, lines.join('\n'), { mode: 0o600 });

  const counts = {
    users: await prisma.user.count(),
    academies: await prisma.tenant.count(),
    players: await prisma.player.count(),
    sessions: await prisma.attendanceSession.count(),
    attendance: await prisma.attendanceRecord.count(),
    payments: await prisma.academyFinancialTransaction.count(),
  };
  console.log(
    `[seed] done: ${JSON.stringify(counts)}; ${accounts.length} accounts written to the credentials file`,
  );
  void champions;
}

main()
  .catch((err) => {
    console.error('[seed] failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
