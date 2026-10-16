import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  ErrorCode,
  isBranchScopedRole,
  type TenantContext,
  type TenantRole,
} from '@academy/shared';
import { PrismaService } from '../../database/prisma.service';

const UUID_PATTERN = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Authentication required before tenant resolution',
      });
    }

    // Resolve tenant ID from header, cookies, query, or activeTenantId in payload
    const tenantIdHeader =
      request.headers['x-tenant-id'] ||
      (request.cookies && request.cookies.tenant_id) ||
      request.query?.tenantId ||
      request.params?.tenantId ||
      user.activeTenantId;

    if (!tenantIdHeader || typeof tenantIdHeader !== 'string') {
      throw new BadRequestException({
        code: ErrorCode.TENANT_REQUIRED,
        message: 'Header x-tenant-id or active tenant context is required',
      });
    }

    const tenantId = tenantIdHeader.trim();

    if (!UUID_PATTERN.test(tenantId)) {
      throw new BadRequestException({
        code: ErrorCode.TENANT_REQUIRED,
        message: 'Invalid tenant ID format',
      });
    }

    // Verify user belongs to this tenant and membership is ACTIVE from a trusted source
    let membership: {
      id: string;
      tenantId: string;
      userId: string;
      role: string;
      status: string;
      branchId: string | null;
    } | null = null;

    // Always verify membership against the database; never trust cached JWT claims.
    membership = await this.prisma.withAuthLookupTransaction(
      { actorUserId: user.id },
      (tx) =>
        tx.tenantMembership.findUnique({
          where: {
            tenantId_userId: {
              tenantId,
              userId: user.id,
            },
          },
        }),
    );

    if (!membership) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'You are not a member of this academy',
      });
    }

    if (membership.status === 'REVOKED') {
      throw new ForbiddenException({
        code: ErrorCode.MEMBERSHIP_REVOKED,
        message: 'Your membership in this academy has been revoked',
      });
    }

    if (membership.status === 'SUSPENDED') {
      throw new ForbiddenException({
        code: ErrorCode.MEMBERSHIP_REQUIRED,
        message: 'Your membership in this academy is suspended',
      });
    }

    if (membership.status !== 'ACTIVE') {
      throw new ForbiddenException({
        code: ErrorCode.MEMBERSHIP_REQUIRED,
        message: `Your membership is currently ${membership.status}`,
      });
    }

    // Branch scoping validation
    const requestedBranchId = (request.headers['x-branch-id'] as string) || undefined;
    let effectiveBranchId = requestedBranchId;

    if (isBranchScopedRole(membership.role as TenantRole)) {
      if (!membership.branchId) {
        throw new ForbiddenException({
          code: ErrorCode.BRANCH_REQUIRED,
          message: 'This role must be assigned to a specific branch',
        });
      }

      if (requestedBranchId && requestedBranchId !== membership.branchId) {
        throw new ForbiddenException({
          code: ErrorCode.FORBIDDEN,
          message: 'Access restricted to your assigned branch',
        });
      }

      effectiveBranchId = membership.branchId;
    }

    const tenantContext: TenantContext = {
      tenantId,
      branchId: effectiveBranchId,
      actorUserId: user.id,
      locale: request.headers['accept-language']?.startsWith('en') ? 'en' : 'ar',
    };

    request.tenantContext = tenantContext;
    request.tenantMembership = membership;

    return true;
  }
}
