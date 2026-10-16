import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type StrategyOptions } from 'passport-jwt';
import type { Request } from 'express';
import { AppConfigService } from '../../../config/app-config.service';
import { PrismaService } from '../../database/prisma.service';
import type { JwtPayload } from '../token.service';
import { ErrorCode } from '@academy/shared';

function cookieOrBearerExtractor(req: Request): string | null {
  if (req && req.cookies && req.cookies.access_token) {
    return req.cookies.access_token;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(AppConfigService) config: AppConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {
    const opts: StrategyOptions = {
      jwtFromRequest: cookieOrBearerExtractor,
      ignoreExpiration: false,
      secretOrKey: config.jwtSecret,
    };
    super(opts);
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        memberships: {
          include: {
            tenant: true,
            branch: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'User no longer exists or session is invalid',
      });
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      isEmailVerified: user.isEmailVerified,
      memberships: user.memberships,
      activeTenantId: payload.tenantId,
    };
  }
}
