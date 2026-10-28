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
import type { Prisma } from '@prisma/client';
import { TokenService } from '../auth/token.service';
import { PasswordService } from '../auth/password.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import {
  ErrorCode,
  TenantRole,
  type AcceptInviteRequest,
  type InviteStaffRequest,
  type DelegateCoachReviewRequest,
  type TenantContext,
  type TenantMembershipSummary,
  type UpdateAcademySettings,
} from '@academy/shared';

@Injectable()
export class TenancyService {
  private readonly appPublicUrl: string;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TokenService) private readonly tokenService: TokenService,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(EmailService) private readonly emailService: EmailService,
  ) {
    this.appPublicUrl =
      process.env.APP_PUBLIC_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000';
  }

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
        canReviewApplications: Boolean((m as any).canReviewApplications),
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
      canReviewApplications: Boolean((membership as any).canReviewApplications),
    };
  }

  /**
   * Invites a staff member to the academy (staff.manage permission required).
   * Runs within isolated tenant transaction.
   */
  async inviteStaff(
    tenantContext: TenantContext,
    dto: InviteStaffRequest,
  ): Promise<{
    id: string;
    email: string;
    role: TenantRole;
    token: string;
    expiresAt: string;
    emailDelivered: boolean;
    deliveryStatus: 'SENT' | 'DEV_LOGGED' | 'FAILED';
    deliveryMessage: string;
  }> {
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

        // Prevent duplicate active pending invitations for the same email in this academy
        const existingPendingInvite = await tx.invitation.findFirst({
          where: {
            tenantId: tenantContext.tenantId,
            email: normalizedEmail,
            status: 'PENDING',
            expiresAt: { gt: new Date() },
          },
        });

        if (existingPendingInvite) {
          throw new ConflictException({
            code: ErrorCode.CONFLICT,
            message:
              'An active invitation is already pending for this email address. Please resend or revoke the existing invitation.',
          });
        }

        let branchName: string | undefined;
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
          branchName = branch.name;
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

        // Fetch tenant and inviter details for the invitation email
        const tenant = await tx.tenant.findUnique({
          where: { id: tenantContext.tenantId },
          select: { name: true },
        });

        const inviter = await tx.user.findUnique({
          where: { id: tenantContext.actorUserId },
          select: { name: true },
        });

        const activationUrl = `${this.appPublicUrl}/auth/accept-invite?token=${rawToken}`;

        const emailResult = await this.emailService.sendStaffInvite({
          to: normalizedEmail,
          academyName: tenant?.name || 'Academy',
          role: dto.role,
          activationUrl,
          invitedByName: inviter?.name,
          branchName,
        });

        return {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role as TenantRole,
          token: rawToken,
          expiresAt: invitation.expiresAt.toISOString(),
          emailDelivered: emailResult.delivered,
          deliveryStatus: emailResult.status,
          deliveryMessage:
            emailResult.status === 'SENT'
              ? 'تم إرسال دعوة الانضمام ورابط التفعيل بالبريد الإلكتروني بنجاح'
              : emailResult.status === 'DEV_LOGGED'
                ? 'تم تسجيل الدعوة في سجل التطوير المحلي (Dev email logger active)'
                : `فشل إرسال البريد الإلكتروني: ${emailResult.error || 'خطأ غير معروف'}`,
        };
      },
    );
  }

  /**
   * Lists all pending invitations for the tenant.
   */
  async listPendingInvitations(tenantContext: TenantContext) {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const invitations = await tx.invitation.findMany({
          where: {
            tenantId: tenantContext.tenantId,
          },
          include: {
            branch: { select: { id: true, name: true } },
            invitedByUser: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        });

        return invitations.map((inv) => ({
          id: inv.id,
          email: inv.email,
          role: inv.role as TenantRole,
          status: inv.status,
          branchId: inv.branchId,
          branchName: inv.branch?.name || null,
          invitedByName: inv.invitedByUser?.name || null,
          expiresAt: inv.expiresAt.toISOString(),
          createdAt: inv.createdAt.toISOString(),
          isExpired: inv.expiresAt.getTime() < Date.now(),
        }));
      },
    );
  }

  /**
   * Resends an invitation with a fresh single-use token and email dispatch.
   */
  async resendInvitation(
    tenantContext: TenantContext,
    invitationId: string,
  ): Promise<{
    id: string;
    email: string;
    emailDelivered: boolean;
    deliveryStatus: 'SENT' | 'DEV_LOGGED' | 'FAILED';
    deliveryMessage: string;
  }> {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const invitation = await tx.invitation.findFirst({
          where: { id: invitationId, tenantId: tenantContext.tenantId },
          include: { branch: true },
        });

        if (!invitation) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Invitation not found',
          });
        }

        if (invitation.status === 'ACCEPTED') {
          throw new ConflictException({
            code: ErrorCode.CONFLICT,
            message: 'Invitation has already been accepted and cannot be resent',
          });
        }

        const rawToken = this.tokenService.generateSecureRandomString(32);
        const tokenHash = this.tokenService.hashToken(rawToken);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // fresh 7 days

        const updated = await tx.invitation.update({
          where: { id: invitation.id },
          data: {
            token: tokenHash,
            status: 'PENDING',
            expiresAt,
            invitedByUserId: tenantContext.actorUserId,
          },
        });

        const tenant = await tx.tenant.findUnique({
          where: { id: tenantContext.tenantId },
          select: { name: true },
        });

        const inviter = await tx.user.findUnique({
          where: { id: tenantContext.actorUserId },
          select: { name: true },
        });

        const activationUrl = `${this.appPublicUrl}/auth/accept-invite?token=${rawToken}`;

        const emailResult = await this.emailService.sendStaffInvite({
          to: updated.email,
          academyName: tenant?.name || 'Academy',
          role: updated.role,
          activationUrl,
          invitedByName: inviter?.name,
          branchName: invitation.branch?.name,
        });

        await this.auditService.logEvent(
          {
            tenantId: tenantContext.tenantId,
            actorUserId: tenantContext.actorUserId,
            action: 'MEMBERSHIP_INVITATION_RESENT',
            resourceType: 'Invitation',
            resourceId: updated.id,
            metadata: { email: updated.email, role: updated.role },
          },
          tx,
        );

        return {
          id: updated.id,
          email: updated.email,
          emailDelivered: emailResult.delivered,
          deliveryStatus: emailResult.status,
          deliveryMessage:
            emailResult.status === 'SENT'
              ? 'تمت إعادة إرسال الدعوة بالبريد الإلكتروني بنجاح'
              : emailResult.status === 'DEV_LOGGED'
                ? 'تم تسجيل إعادة إرسال الدعوة محلياً في بيئة التطوير'
                : `فشل إعادة إرسال البريد: ${emailResult.error || 'خطأ غير معروف'}`,
        };
      },
    );
  }

  /**
   * Revokes a pending invitation so it can no longer be accepted.
   */
  async revokeInvitation(
    tenantContext: TenantContext,
    invitationId: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const invitation = await tx.invitation.findFirst({
          where: { id: invitationId, tenantId: tenantContext.tenantId },
        });

        if (!invitation) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Invitation not found',
          });
        }

        if (invitation.status === 'ACCEPTED') {
          throw new ConflictException({
            code: ErrorCode.CONFLICT,
            message: 'Accepted invitation cannot be revoked',
          });
        }

        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: 'REVOKED' },
        });

        await this.auditService.logEvent(
          {
            tenantId: tenantContext.tenantId,
            actorUserId: tenantContext.actorUserId,
            action: 'MEMBERSHIP_INVITATION_REVOKED',
            resourceType: 'Invitation',
            resourceId: invitation.id,
            metadata: { email: invitation.email, role: invitation.role },
          },
          tx,
        );

        return { success: true, message: 'Invitation revoked successfully' };
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
              ${tokenHash},
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
   * Delegates or revokes player application review permission for a coach.
   */
  async updateCoachDelegation(
    tenantContext: TenantContext,
    membershipId: string,
    dto: DelegateCoachReviewRequest,
  ) {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const membership = await tx.tenantMembership.findFirst({
          where: {
            id: membershipId,
            tenantId: tenantContext.tenantId,
          },
          include: { user: { select: { email: true, name: true } } },
        });

        if (!membership) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Membership not found in this academy',
          });
        }

        if (membership.role !== 'COACH') {
          throw new BadRequestException({
            code: ErrorCode.VALIDATION_FAILED,
            message: 'Can only toggle application review delegation for coaches',
          });
        }

        const updated = await tx.tenantMembership.update({
          where: { id: membership.id },
          data: { canReviewApplications: dto.canReviewApplications },
        });

        await this.auditService.logEvent(
          {
            tenantId: tenantContext.tenantId,
            actorUserId: tenantContext.actorUserId,
            action: dto.canReviewApplications
              ? 'COACH_APPLICATION_REVIEW_DELEGATED'
              : 'COACH_APPLICATION_REVIEW_REVOKED',
            resourceType: 'TenantMembership',
            resourceId: membership.id,
            metadata: {
              targetCoachEmail: membership.user.email,
              canReviewApplications: dto.canReviewApplications,
            },
          },
          tx,
        );

        return {
          message: dto.canReviewApplications
            ? 'Player application review delegated to coach successfully'
            : 'Coach player application review delegation revoked',
          membership: updated,
        };
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

  /**
   * Retrieves full profile and operational statistics for the active academy.
   */
  async getProfile(tenantContext: TenantContext) {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const tenant = await tx.tenant.findUnique({
          where: { id: tenantContext.tenantId },
          include: {
            _count: {
              select: {
                branches: true,
                memberships: { where: { status: 'ACTIVE' } },
                players: { where: { status: 'ACTIVE' } },
              },
            },
          },
        });

        if (!tenant) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Academy not found',
          });
        }

        return {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          status: tenant.status,
          currency: tenant.currency,
          timezone: tenant.timezone,
          phone: tenant.phone,
          email: tenant.email,
          address: tenant.address,
          logoUrl: tenant.logoUrl,
          createdAt: tenant.createdAt.toISOString(),
          updatedAt: tenant.updatedAt.toISOString(),
          _count: tenant._count,
        };
      },
    );
  }

  /**
   * Updates academy settings and contact profile.
   */
  async updateProfile(tenantContext: TenantContext, dto: UpdateAcademySettings) {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const updateData: Prisma.TenantUpdateInput = {};
        if (dto.name !== undefined) updateData.name = dto.name.trim();
        if (dto.phone !== undefined) updateData.phone = dto.phone?.trim() || null;
        if (dto.email !== undefined) updateData.email = dto.email?.trim() || null;
        if (dto.address !== undefined) updateData.address = dto.address?.trim() || null;
        if (dto.logoUrl !== undefined) updateData.logoUrl = dto.logoUrl?.trim() || null;
        if (dto.currency !== undefined) updateData.currency = dto.currency;
        if (dto.timezone !== undefined) updateData.timezone = dto.timezone;

        const tenant = await tx.tenant.update({
          where: { id: tenantContext.tenantId },
          data: updateData,
          include: {
            _count: {
              select: {
                branches: true,
                memberships: { where: { status: 'ACTIVE' } },
                players: { where: { status: 'ACTIVE' } },
              },
            },
          },
        });

        await this.auditService.logEvent(
          {
            tenantId: tenantContext.tenantId,
            actorUserId: tenantContext.actorUserId,
            action: 'TENANT_UPDATE',
            resourceType: 'Tenant',
            resourceId: tenant.id,
            metadata: {
              changedFields: Object.keys(updateData),
            },
          },
          tx,
        );

        return {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          status: tenant.status,
          currency: tenant.currency,
          timezone: tenant.timezone,
          phone: tenant.phone,
          email: tenant.email,
          address: tenant.address,
          logoUrl: tenant.logoUrl,
          createdAt: tenant.createdAt.toISOString(),
          updatedAt: tenant.updatedAt.toISOString(),
          _count: tenant._count,
        };
      },
    );
  }
}
