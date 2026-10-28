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
export class PlatformOwnerGuard implements CanActivate {
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

    // Direct database check ensures server-side authority
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { isPlatformOwner: true },
    });

    if (!dbUser || !dbUser.isPlatformOwner) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Access restricted strictly to Platform Owners',
      });
    }

    return true;
  }
}
