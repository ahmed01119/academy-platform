import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { AppConfigService } from '../../../config/app-config.service';
import { ErrorCode } from '@academy/shared';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method?.toUpperCase();

    // Safe HTTP methods are exempt from CSRF validation
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return true;
    }

    // CSRF protection specifically protects cookie-authenticated state-changing requests
    const hasAuthCookie = Boolean(request.cookies?.access_token || request.cookies?.refresh_token);
    if (!hasAuthCookie) {
      return true;
    }

    const origin = (request.headers['origin'] as string) || '';
    const referer = (request.headers['referer'] as string) || '';

    // If both origin and referer are missing on a cookie-authenticated mutation, reject
    if (!origin && !referer) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Origin or Referer header is required for cookie-authenticated mutation requests',
      });
    }

    // Wildcard CORS is not a valid CSRF trust boundary, even in development.
    // Only explicitly configured, well-formed HTTP(S) origins are trusted.
    const allowedOrigins = this.config.corsOrigin
      .split(',')
      .map((value) => value.trim())
      .filter((value) => {
        try {
          const url = new URL(value);
          return (
            (url.protocol === 'https:' || url.protocol === 'http:') &&
            url.origin === value &&
            !url.username &&
            !url.password
          );
        } catch {
          return false;
        }
      });

    if (origin) {
      const isAllowed = allowedOrigins.includes(origin);
      if (!isAllowed) {
        throw new ForbiddenException({
          code: ErrorCode.FORBIDDEN,
          message: 'Cross-site request forgery protection: untrusted origin',
        });
      }
      return true;
    }

    if (referer) {
      try {
        const refererOrigin = new URL(referer).origin;
        const isAllowed = allowedOrigins.includes(refererOrigin);
        if (!isAllowed) {
          throw new ForbiddenException({
            code: ErrorCode.FORBIDDEN,
            message: 'Cross-site request forgery protection: untrusted referer',
          });
        }
        return true;
      } catch {
        throw new ForbiddenException({
          code: ErrorCode.FORBIDDEN,
          message: 'Malformed referer header',
        });
      }
    }

    return true;
  }
}
