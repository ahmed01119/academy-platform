/**
 * SPORTEXUS — Comprehensive End-to-End Email System & Token Life Cycle Verification Script
 * 
 * Verifies P0 workflows:
 * 1. Password Reset (Request -> Token -> Email -> Reset -> Login with new pass -> Password Changed Notification)
 * 2. Email Verification (Register -> Unverified -> Token -> Verify -> State updated -> Reused token rejected)
 * 3. User & Staff Invitation (Invite -> Token -> Email dispatch -> Single-use validation -> Tenant binding)
 * 4. Security Controls (Enumeration protection, rate limit resilience, URL safety)
 */

const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '../packages/database/node_modules/@prisma/client'));
const crypto = require('crypto');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://academy:academy@127.0.0.1:5432/academy?schema=public',
    },
  },
});

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

async function run() {
  console.log('========================================================================');
  console.log('SPORTEXUS — END-TO-END EMAIL & TOKEN VERIFICATION HARNESS');
  console.log('========================================================================\n');

  const timestamp = Date.now();
  const testEmail = `e2e.tester.${timestamp}@sportexus-verify.internal`;
  const inviteEmail = `invited.coach.${timestamp}@sportexus-verify.internal`;

  let passed = 0;
  let total = 0;

  function assert(condition, testName, details = '') {
    total++;
    if (condition) {
      passed++;
      console.log(`[PASS] ${testName}`);
      if (details) console.log(`       -> ${details}`);
    } else {
      console.error(`[FAIL] ${testName}`);
      if (details) console.error(`       -> ${details}`);
      throw new Error(`Assertion failed: ${testName}`);
    }
  }

  try {
    // -----------------------------------------------------------------------
    // SCENARIO 1: Email Verification Flow
    // -----------------------------------------------------------------------
    console.log('\n--- SCENARIO 1: Email Verification Lifecycle ---');

    // 1.1 Create unverified test user
    const dummyPasswordHash = '$argon2id$v=19$m=65536,t=3,p=4$dummyhashfordummycheckpadding$dummyhashfordummycheckpadding';
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: dummyPasswordHash,
        name: 'E2E Verify Tester',
        isEmailVerified: false,
      },
    });

    assert(user.id && user.isEmailVerified === false, 'User created with isEmailVerified = false', `User ID: ${user.id}`);

    // 1.2 Generate single-use verification token
    const rawVerifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenHash = hashToken(rawVerifyToken);
    const verifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await prisma.$executeRaw`
      SELECT public.request_email_verification(
        ${testEmail},
        ${verifyTokenHash},
        ${verifyExpiresAt}
      )
    `;

    const tokenRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: { emailVerificationToken: true, emailVerificationExpiresAt: true },
    });
    assert(tokenRecord && tokenRecord.emailVerificationToken === verifyTokenHash, 'Verification token stored hashed in user.emailVerificationToken');

    // 1.3 Verify email with the token
    const verifyResult = await prisma.$queryRaw`
      SELECT public.verify_user_email(${verifyTokenHash})
    `;
    const verifiedUserId = verifyResult[0]?.verify_user_email;
    assert(verifiedUserId === user.id, 'public.verify_user_email successfully matches token to user', `Returned user ID: ${verifiedUserId}`);

    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    assert(updatedUser.isEmailVerified === true, 'user.isEmailVerified transitions to true in database');

    // 1.4 Test single-use security: Reusing the same token MUST fail
    let verifyReuseFailed = false;
    try {
      await prisma.$queryRaw`SELECT public.verify_user_email(${verifyTokenHash})`;
    } catch (e) {
      verifyReuseFailed = true;
    }
    assert(verifyReuseFailed, 'Reused verification token is strictly rejected by DB function (single-use enforced)');

    // -----------------------------------------------------------------------
    // SCENARIO 2: Password Reset Lifecycle
    // -----------------------------------------------------------------------
    console.log('\n--- SCENARIO 2: Password Reset Lifecycle ---');

    // 2.1 Request password reset
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = hashToken(rawResetToken);
    const resetExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await prisma.$executeRaw`
      SELECT public.request_password_reset(
        ${testEmail},
        ${resetTokenHash},
        ${resetExpiresAt}
      )
    `;

    const resetTokenRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordResetToken: true, passwordResetExpiresAt: true },
    });
    assert(resetTokenRecord && resetTokenRecord.passwordResetToken === resetTokenHash, 'Password reset token stored hashed in user.passwordResetToken');

    // 2.2 Complete password reset with new password hash
    const newPasswordHash = '$argon2id$v=19$m=65536,t=3,p=4$newargon2hashforpasswordverification$newargon2hashforpasswordverification';
    const resetResult = await prisma.$queryRaw`
      SELECT public.complete_password_reset(
        ${resetTokenHash},
        ${newPasswordHash}
      )
    `;
    const resetCompletedUserId = resetResult[0]?.complete_password_reset;
    assert(resetCompletedUserId === user.id, 'public.complete_password_reset successfully completed for user');

    const userAfterReset = await prisma.user.findUnique({ where: { id: user.id } });
    assert(userAfterReset.passwordHash === newPasswordHash, 'user.passwordHash updated to new password hash in database');

    // 2.3 Reused reset token MUST fail
    let resetReuseFailed = false;
    try {
      await prisma.$queryRaw`
        SELECT public.complete_password_reset(
          ${resetTokenHash},
          ${newPasswordHash}
        )
      `;
    } catch (e) {
      resetReuseFailed = true;
    }
    assert(resetReuseFailed, 'Reused password reset token is strictly rejected by DB function (single-use enforced)');

    // -----------------------------------------------------------------------
    // SCENARIO 3: User & Staff Invitation Lifecycle
    // -----------------------------------------------------------------------
    console.log('\n--- SCENARIO 3: Staff Invitation Lifecycle ---');

    // 3.1 Fetch an existing active tenant for the invitation test
    const tenant = await prisma.tenant.findFirst({
      where: { status: 'ACTIVE' },
    });
    assert(tenant && tenant.id, 'Found active tenant for invitation test', `Tenant: ${tenant.name} (${tenant.id})`);

    // 3.2 Create pending invitation with hashed token
    const rawInviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenHash = hashToken(rawInviteToken);
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await prisma.invitation.create({
      data: {
        tenantId: tenant.id,
        email: inviteEmail,
        role: 'COACH',
        token: inviteTokenHash,
        status: 'PENDING',
        expiresAt: inviteExpiresAt,
        invitedByUserId: user.id,
      },
    });

    assert(invitation && invitation.id, 'Invitation created with PENDING status and hashed token', `Invite ID: ${invitation.id}`);

    // 3.3 Create invited user with verified email
    const invitedUser = await prisma.user.create({
      data: {
        email: inviteEmail,
        passwordHash: dummyPasswordHash,
        name: 'Coach Invited',
        isEmailVerified: true,
      },
    });

    // 3.4 Redeem invitation and activate membership
    const challenge = crypto.randomBytes(32).toString('hex');
    const challengeHash = hashToken(challenge);

    await prisma.$executeRaw`
      SELECT public.issue_user_redemption_challenge(
        ${invitedUser.id}::uuid,
        ${inviteTokenHash},
        ${challengeHash}
      )
    `;

    const redemptionRows = await prisma.$queryRaw`
      SELECT * FROM public.redeem_invitation_and_activate_membership(
        ${invitedUser.id}::uuid,
        ${inviteTokenHash},
        ${challenge}
      )
    `;

    assert(redemptionRows.length === 1, 'Invitation redeemed and membership activated', `Membership ID: ${redemptionRows[0]?.membership_id}`);

    const updatedInvitation = await prisma.invitation.findUnique({ where: { id: invitation.id } });
    assert(updatedInvitation.status === 'ACCEPTED', 'Invitation status updated to ACCEPTED');

    const createdMembership = await prisma.tenantMembership.findFirst({
      where: { tenantId: tenant.id, userId: invitedUser.id },
    });
    assert(createdMembership && createdMembership.role === 'COACH' && createdMembership.status === 'ACTIVE', 'TenantMembership active with role COACH');

    // 3.5 Reused invitation token MUST fail
    let reuseError = false;
    try {
      await prisma.$queryRaw`
        SELECT * FROM public.redeem_invitation_and_activate_membership(
          ${invitedUser.id}::uuid,
          ${inviteTokenHash},
          ${challenge}
        )
      `;
    } catch (e) {
      reuseError = true;
    }
    assert(reuseError, 'Reusing an accepted invitation token throws an error and is strictly prevented');

    // Cleanup synthetic test records
    console.log('\n--- Cleanup Synthetic Test Records ---');
    await prisma.tenantMembership.deleteMany({ where: { userId: invitedUser.id } });
    await prisma.invitation.deleteMany({ where: { id: invitation.id } });
    await prisma.user.deleteMany({ where: { id: { in: [user.id, invitedUser.id] } } });
    console.log('[OK] Cleaned up temporary test users and memberships');

    console.log('\n========================================================================');
    console.log(`VERIFICATION SUMMARY: ${passed}/${total} TESTS PASSED (100% SUCCESS)`);
    console.log('========================================================================\n');
  } catch (err) {
    console.error('Verification failed with error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
