import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  ErrorCode,
  isBranchScopedRole,
  type TenantContext,
  type TenantRole,
} from '@academy/shared';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
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
      request.query.tenantId ||
      request.params.tenantId ||
      user.activeTenantId;

    if (!tenantIdHeader || typeof tenantIdHeader !== 'string') {
      throw new BadRequestException({
        code: ErrorCode.TENANT_REQUIRED,
        message: 'Header x-tenant-id or active tenant context is required',
      });
    }

    const tenantId = tenantIdHeader.trim();

    // Verify user belongs to this tenant and membership is ACTIVE
    const membership = user.memberships?.find((m: { tenantId: string }) => m.tenantId === tenantId);

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
