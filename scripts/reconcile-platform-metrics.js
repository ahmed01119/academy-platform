const path = require('path');
const { PrismaClient } = require(
  path.resolve(__dirname, '../packages/database/node_modules/@prisma/client'),
);
const prisma = new PrismaClient();

async function main() {
  const [
    dbIdentity,
    totalTenants,
    activeTenants,
    suspendedTenants,
    provisioningTenants,
    totalPlayers,
    totalUsers,
    platformAdmins,
    platformOwners,
    totalBranches,
    totalCoachesMemberships,
    distinctCoaches,
    totalGuardians,
    totalSessions,
    closedSessions,
    activeSubscriptions,
    trialSubscriptions,
    expiredSubscriptions,
    activeSubsWithPlans,
    paidSaaSInvoices,
    pendingSaaSInvoices,
    overdueSaaSInvoices,
    totalAcademyApplications,
    pendingAcademyApplications,
    totalAuditLogs,
    dbSizeResult,
    totalTablesResult,
  ] = await Promise.all([
    prisma.$queryRaw`SELECT current_database() as db_name, current_user as db_user, version() as pg_version`,
    prisma.tenant.count(),
    prisma.tenant.count({ where: { status: 'ACTIVE' } }),
    prisma.tenant.count({ where: { status: 'SUSPENDED' } }),
    prisma.tenant.count({ where: { status: 'PROVISIONING' } }),
    prisma.player.count(),
    prisma.user.count(),
    prisma.user.count({ where: { isPlatformSuperAdmin: true } }),
    prisma.user.count({ where: { isPlatformOwner: true } }),
    prisma.branch.count(),
    prisma.tenantMembership.count({ where: { role: 'COACH', status: 'ACTIVE' } }),
    prisma.tenantMembership.findMany({
      where: { role: 'COACH', status: 'ACTIVE' },
      select: { userId: true },
      distinct: ['userId'],
    }),
    prisma.guardian.count(),
    prisma.attendanceSession.count(),
    prisma.attendanceSession.count({ where: { status: 'CLOSED' } }),
    prisma.tenantSubscription.count({ where: { status: 'ACTIVE' } }),
    prisma.tenantSubscription.count({ where: { status: 'TRIAL' } }),
    prisma.tenantSubscription.count({ where: { status: 'EXPIRED' } }),
    prisma.tenantSubscription.findMany({
      where: { status: 'ACTIVE' },
      include: { plan: true },
    }),
    prisma.saaSInvoice.aggregate({
      where: { status: 'PAID' },
      _sum: { amount: true },
    }),
    prisma.saaSInvoice.count({ where: { status: 'PENDING' } }),
    prisma.saaSInvoice.count({ where: { status: 'OVERDUE' } }),
    prisma.academyApplication.count(),
    prisma.academyApplication.count({ where: { status: 'PENDING_REVIEW' } }),
    prisma.auditLog.count(),
    prisma.$queryRaw`SELECT pg_database_size(current_database())::text AS db_size`,
    prisma.$queryRaw`SELECT count(*)::text as count FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r'`,
  ]);

  const mrr = activeSubsWithPlans.reduce((acc, sub) => {
    const monthly = sub.negotiatedPrice ?? sub.plan?.priceMonthly ?? 0;
    return acc + monthly;
  }, 0);

  console.log('=== DATABASE IDENTITY ===');
  console.log(dbIdentity);

  console.log('=== METRICS AUDIT ===');
  console.log({
    totalTenants,
    activeTenants,
    suspendedTenants,
    provisioningTenants,
    totalPlayers,
    totalUsers,
    platformAdmins,
    platformOwners,
    totalBranches,
    totalCoachesMemberships,
    distinctCoachesCount: distinctCoaches.length,
    totalGuardians,
    totalSessions,
    closedSessions,
    activeSubscriptions,
    trialSubscriptions,
    expiredSubscriptions,
    mrr,
    paidSaaSInvoicesSum: paidSaaSInvoices._sum.amount,
    pendingSaaSInvoices,
    overdueSaaSInvoices,
    totalAcademyApplications,
    pendingAcademyApplications,
    totalAuditLogs,
    dbSizeBytes: dbSizeResult[0]?.db_size,
    totalTables: totalTablesResult[0]?.count,
  });

  await prisma.$disconnect();
}

main().catch(console.error);
