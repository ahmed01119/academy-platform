import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { TenantContext as TenantContextType } from '@academy/shared';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);

export const CurrentTenant = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const membership = request.tenantMembership;
    return data ? membership?.[data] : membership;
  },
);

export const CurrentTenantContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContextType => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantContext;
  },
);
