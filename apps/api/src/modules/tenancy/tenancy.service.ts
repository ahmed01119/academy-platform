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
   * Accepts an academy invitation under controlled invitation lookup context.
   */
  async acceptInvitation(
    currentUserId: string | undefined,
    dto: AcceptInviteRequest,
  ): Promise<{ message: string; tenantId: string }> {
    const tokenHash = this.tokenService.hashToken(dto.token);

    return this.prisma.withAuthLookupTransaction(
      { context: 'invitation_lookup', actorUserId: currentUserId },
      async (tx) => {
        const invitation = await tx.invitation.findFirst({
          where: {
            token: tokenHash,
            status: 'PENDING',
            expiresAt: { gt: new Date() },
          },
          include: { tenant: true },
        });

        if (!invitation) {
          throw new BadRequestException({
            code: ErrorCode.TOKEN_INVALID,
            message: 'Invalid or expired invitation token',
          });
        }

        // An invitation token alone does not establish email ownership.
        // Only an authenticated, email-verified account matching the invitee may join.
        // New-account redemption stays disabled until email verification is implemented.
        if (!currentUserId) {
          throw new UnauthorizedException({
            code: ErrorCode.UNAUTHORIZED,
            message: 'Sign in with a verified account matching the invitation email',
          });
        }

        const authenticatedUser = await tx.user.findUnique({
          where: { id: currentUserId },
          select: { email: true, isEmailVerified: true },
        });
        if (
          !authenticatedUser?.isEmailVerified ||
          authenticatedUser.email.toLowerCase().trim() !== invitation.email.toLowerCase().trim()
        ) {
          throw new UnauthorizedException({
            code: ErrorCode.UNAUTHORIZED,
            message: 'Verify and sign in with the email address that received this invitation',
          });
        }
        const targetUserId = currentUserId;

        // Upsert membership
        await tx.tenantMembership.upsert({
          where: {
            tenantId_userId: {
              tenantId: invitation.tenantId,
              userId: targetUserId!,
            },
          },
          create: {
            tenantId: invitation.tenantId,
            userId: targetUserId!,
            role: invitation.role,
            branchId: invitation.branchId,
            status: 'ACTIVE',
          },
          update: {
            role: invitation.role,
            branchId: invitation.branchId,
            status: 'ACTIVE',
          },
        });

        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: 'ACCEPTED' },
        });

        await this.auditService.logEvent(
          {
            tenantId: invitation.tenantId,
            actorUserId: targetUserId,
            action: 'MEMBERSHIP_ACCEPTED',
            resourceType: 'Invitation',
            resourceId: invitation.id,
          },
          tx,
        );

        return {
          message: `Successfully joined ${invitation.tenant.name}`,
          tenantId: invitation.tenantId,
        };
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
