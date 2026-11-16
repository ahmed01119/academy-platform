import { type ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { cookieOrBearerExtractor } from './jwt.strategy';

/**
 * Authentication for endpoints that serve both anonymous and signed-in callers (e.g. the public join request).
 *
 *  - No access token (cookie or Bearer header): the request continues anonymously (`req.user` stays undefined).
 *  - A token is present: it is validated exactly like `JwtAuthGuard` (signature, expiry, session version). An invalid or
 *    expired token is a 401, never a silent downgrade to anonymous, so the client refreshes and retries as the same
 *    user instead of acting as someone else.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  override canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (!cookieOrBearerExtractor(request)) {
      return true;
    }
    return super.canActivate(context);
  }
}
