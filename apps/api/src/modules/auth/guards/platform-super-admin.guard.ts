import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { ErrorCode } from '@academy/shared';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class PlatformSuperAdminGuard implements CanActivate {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Authentication required',
      });
    }

    // Direct database check ensures server-side authority (cannot be spoofed by token/client flag)
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { isPlatformSuperAdmin: true, isPlatformOwner: true },
    });

    if (!dbUser || (!dbUser.isPlatformSuperAdmin && !dbUser.isPlatformOwner)) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Access restricted strictly to Platform Super Administrators and Platform Owners',
      });
    }

    return true;
  }
}
