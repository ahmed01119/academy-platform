import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './require-permissions.decorator';
import { ErrorCode, hasPermission, Permission, type TenantRole } from '@academy/shared';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const membership = request.tenantMembership;

    if (!membership) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Tenant context is required before checking permissions',
      });
    }

    const userRole = membership.role as TenantRole;
    const hasAll = requiredPermissions.every((perm) => {
      if (
        perm === Permission.PLAYER_APPLICATION_REVIEW &&
        userRole === 'COACH' &&
        Boolean(membership.canReviewApplications)
      ) {
        return true;
      }
      return hasPermission(userRole, perm);
    });

    if (!hasAll) {
      throw new ForbiddenException({
        code: ErrorCode.INSUFFICIENT_PERMISSIONS,
        message: `Role ${userRole} lacks required permission(s): ${requiredPermissions.join(', ')}`,
      });
    }

    return true;
  }
}
