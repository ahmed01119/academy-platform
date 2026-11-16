import { type ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ALLOW_WHILE_PASSWORD_CHANGE_REQUIRED } from './password-change-required.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {
    super();
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const authenticated = (await super.canActivate(context)) as boolean;
    if (!authenticated) return false;

    // A user who must change their password (set by a platform administrator) can only reach the endpoints marked
    // @AllowWhilePasswordChangeRequired until they do; the web app sends them to the account page meanwhile.
    const user = context.switchToHttp().getRequest()?.user as
      { mustResetPassword?: boolean } | undefined;
    if (user?.mustResetPassword) {
      const allowed = this.reflector.getAllAndOverride<boolean>(
        ALLOW_WHILE_PASSWORD_CHANGE_REQUIRED,
        [context.getHandler(), context.getClass()],
      );
      if (!allowed) {
        throw new ForbiddenException({
          code: 'PASSWORD_CHANGE_REQUIRED',
          message: 'You must change your password before continuing',
        });
      }
    }
    return true;
  }
}
