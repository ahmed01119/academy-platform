import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TokenService } from '../auth/token.service';
import { PasswordService } from '../auth/password.service';
import { AuditService } from '../audit/audit.service';
import {
  ErrorCode,
  TenantRole,
  type AcceptInviteRequest,
  type InviteStaffRequest,
  type TenantContext,
  type TenantMembershipSummary,
} from '@academy/shared';

@Injectable()
export class TenancyService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TokenService) private readonly tokenService: TokenService,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  /**
   * Lists all active memberships for a user under authenticated discovery path.
   */
  async listUserMemberships(userId: string): Promise<TenantMembershipSummary[]> {
    return this.prisma.withAuthLookupTransaction({ actorUserId: userId }, async (tx) => {
      const memberships = await tx.tenantMembership.findMany({
        where: {
          userId,
          status: 'ACTIVE',
        },
        include: {
          tenant: true,
          branch: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      return memberships.map((m) => ({
        id: m.id,
        tenantId: m.tenantId,
        tenantName: m.tenant.name,
        tenantSlug: m.tenant.slug,
        role: m.role as TenantRole,
        status: m.status,
        branchId: m.branchId,
        branchName: m.branch?.name,
      }));
    });
  }

  /**
   * Switches tenant context and verifies active membership.
   */
  async switchTenant(userId: string, targetTenantId: string): Promise<TenantMembershipSummary> {
    const membership = await this.prisma.withAuthLookupTransaction(
      { actorUserId: userId },
      async (tx) => {
        return tx.tenantMembership.findFirst({
          where: {
            userId,
            tenantId: targetTenantId,
            status: 'ACTIVE',
          },
          include: {
            tenant: true,
            branch: true,
          },
        });
      },
    );

    if (!membership) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'You do not have an active membership in the selected academy',
      });
    }

    await this.auditService.logEvent({
      tenantId: targetTenantId,
      actorUserId: userId,
      action: 'TENANT_SWITCH',
      resourceType: 'Tenant',
      resourceId: targetTenantId,
    });

    return {
      id: membership.id,
      tenantId: membership.tenantId,
      tenantName: membership.tenant.name,
      tenantSlug: membership.tenant.slug,
      role: membership.role as TenantRole,
      status: membership.status,
      branchId: membership.branchId,
      branchName: membership.branch?.name,
    };
  }

  /**
   * Invites a staff member to the academy (staff.manage permission required).
   * Runs within isolated tenant transaction.
   */
  async inviteStaff(
    tenantContext: TenantContext,
    dto: InviteStaffRequest,
  ): Promise<{ id: string; email: string; role: TenantRole; token: string; expiresAt: string }> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        // Check if user is already an active member of this tenant
        const existingMember = await tx.tenantMembership.findFirst({
          where: {
            tenantId: tenantContext.tenantId,
            user: { email: normalizedEmail },
          },
        });

        if (existingMember && existingMember.status === 'ACTIVE') {
          throw new ConflictException({
            code: ErrorCode.CONFLICT,
            message: 'This user is already an active member of this academy',
          });
        }

        if (dto.branchId) {
          const branch = await tx.branch.findFirst({
            where: { id: dto.branchId, tenantId: tenantContext.tenantId },
          });
          if (!branch) {
            throw new NotFoundException({
              code: ErrorCode.NOT_FOUND,
              message: 'Branch not found in this academy',
            });
          }
        }

        const rawToken = this.tokenService.generateSecureRandomString(32);
        const tokenHash = this.tokenService.hashToken(rawToken);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        const invitation = await tx.invitation.create({
          data: {
            tenantId: tenantContext.tenantId,
            email: normalizedEmail,
            role: dto.role,
            branchId: dto.branchId,
            token: tokenHash,
            status: 'PENDING',
            invitedByUserId: tenantContext.actorUserId,
            expiresAt,
          },
        });

        await this.auditService.logEvent(
          {
            tenantId: tenantContext.tenantId,
            actorUserId: tenantContext.actorUserId,
            action: 'MEMBERSHIP_INVITED',
            resourceType: 'Invitation',
            resourceId: invitation.id,
            metadata: { email: normalizedEmail, role: dto.role, branchId: dto.branchId },
          },
          tx,
        );

        return {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role as TenantRole,
          token: rawToken,
          expiresAt: invitation.expiresAt.toISOString(),
        };
      },
    );
  }

  /**
   * Accepts an academy invitation under controlled, scoped redemption boundary.
   */
  async acceptInvitation(
    currentUserId: string | undefined,
    dto: AcceptInviteRequest,
  ): Promise<{ message: string; tenantId: string }> {
    if (!currentUserId) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Sign in with a verified account matching the invitation email',
      });
    }

    const tokenHash = this.tokenService.hashToken(dto.token);
    const redemptionChallenge = this.tokenService.generateSecureRandomString(32);
    const challengeHash = this.tokenService.hashToken(redemptionChallenge);

    return this.prisma.withAuthLookupTransaction(
      { context: 'invitation_lookup', actorUserId: currentUserId },
      async (tx) => {
        try {
          await tx.$executeRaw`
            SELECT public.issue_user_redemption_challenge(
              ${currentUserId}::uuid,
              ${challengeHash}
            )
          `;

          const rows = await tx.$queryRaw<
            Array<{
              invitation_id: string;
              tenant_id: string;
              tenant_name: string;
              role: string;
              branch_id: string | null;
              membership_id: string;
            }>
          >`SELECT * FROM public.redeem_invitation_and_activate_membership(
            ${currentUserId}::uuid,
            ${tokenHash},
            ${redemptionChallenge}
          )`;

          const redemption = rows[0];
          if (!redemption) {
            throw new BadRequestException({
              code: ErrorCode.TOKEN_INVALID,
              message: 'Invalid or expired invitation token',
            });
          }

          await this.auditService.logEvent(
            {
              tenantId: redemption.tenant_id,
              actorUserId: currentUserId,
              action: 'MEMBERSHIP_ACCEPTED',
              resourceType: 'Invitation',
              resourceId: redemption.invitation_id,
            },
            tx,
          );

          return {
            message: `Successfully joined ${redemption.tenant_name}`,
            tenantId: redemption.tenant_id,
          };
        } catch (err: unknown) {
          const pgErr = err as { code?: string; message?: string };
          if (pgErr.message?.includes('INVALID_OR_EXPIRED_INVITATION') || pgErr.code === 'P0002') {
            throw new BadRequestException({
              code: ErrorCode.TOKEN_INVALID,
              message: 'Invalid or expired invitation token',
            });
          }
          if (
            pgErr.message?.includes('INVITATION_EMAIL_MISMATCH') ||
            pgErr.message?.includes('EMAIL_NOT_VERIFIED') ||
            pgErr.message?.includes('INVALID_REDEMPTION_CHALLENGE') ||
            pgErr.code === '42501'
          ) {
            throw new UnauthorizedException({
              code: ErrorCode.UNAUTHORIZED,
              message: 'Verify and sign in with the email address that received this invitation',
            });
          }
          // Fail closed on any other unexpected error
          throw err;
        }
      },
    );
  }

  /**
   * Immediately revokes a membership.
   * Runs within isolated tenant transaction.
   */
  async revokeMembership(
    tenantContext: TenantContext,
    membershipId: string,
  ): Promise<{ message: string }> {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const membership = await tx.tenantMembership.findFirst({
          where: {
            id: membershipId,
            tenantId: tenantContext.tenantId,
          },
        });

        if (!membership) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Membership not found in this academy',
          });
        }

        if (membership.role === TenantRole.OWNER) {
          throw new ForbiddenException({
            code: ErrorCode.FORBIDDEN,
            message: 'Cannot revoke academy owner membership',
          });
        }

        await tx.tenantMembership.update({
          where: { id: membership.id },
          data: { status: 'REVOKED' },
        });

        // Keep session revocation atomic with the membership change and audit event.
        // A separate Prisma transaction could revoke sessions even if this one rolls back.
        await tx.refreshToken.updateMany({
          where: { userId: membership.userId, isRevoked: false },
          data: { isRevoked: true },
        });

        await this.auditService.logEvent(
          {
            tenantId: tenantContext.tenantId,
            actorUserId: tenantContext.actorUserId,
            action: 'MEMBERSHIP_REVOKED',
            resourceType: 'TenantMembership',
            resourceId: membership.id,
            metadata: { targetUserId: membership.userId, role: membership.role },
          },
          tx,
        );

        return { message: 'Membership revoked successfully' };
      },
    );
  }

  /**
   * Lists staff members in current academy within isolated tenant transaction.
   */
  async listStaff(tenantContext: TenantContext) {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        return tx.tenantMembership.findMany({
          where: { tenantId: tenantContext.tenantId },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                phone: true,
              },
            },
            branch: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        });
      },
    );
  }

  /**
   * Lists branches in current academy within isolated tenant transaction.
   */
  async listBranches(tenantContext: TenantContext) {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        return tx.branch.findMany({
          where: { tenantId: tenantContext.tenantId },
          orderBy: { name: 'asc' },
        });
      },
    );
  }
}
