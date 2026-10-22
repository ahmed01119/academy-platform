import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ErrorCode } from '@academy/shared';

@Injectable()
export class PlatformSuperAdminGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
      select: { isPlatformSuperAdmin: true },
    });

    if (!dbUser || !dbUser.isPlatformSuperAdmin) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Access restricted strictly to Platform Super Administrators',
      });
    }

    return true;
  }
}
