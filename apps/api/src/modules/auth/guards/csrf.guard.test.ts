import { describe, expect, it } from 'vitest';
import { CsrfGuard } from './csrf.guard';
import type { AppConfigService } from '../../../config/app-config.service';
import { type ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('CsrfGuard', () => {
  const mockConfig = {
    corsOrigin: 'http://localhost:3000, https://academy.app',
  } as AppConfigService;

  const guard = new CsrfGuard(mockConfig);

  const createMockContext = (
    method: string,
    cookies: Record<string, string>,
    headers: Record<string, string>,
  ) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          cookies,
          headers,
        }),
      }),
    }) as unknown as ExecutionContext;

  it('allows safe HTTP methods (GET, HEAD, OPTIONS) regardless of cookies', () => {
    const ctx = createMockContext('GET', { access_token: 'valid' }, { origin: 'https://evil.com' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows mutation requests when auth cookies are absent (e.g. Bearer token auth)', () => {
    const ctx = createMockContext(
      'POST',
      {},
      { authorization: 'Bearer token', origin: 'https://evil.com' },
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows cookie-authenticated mutation when Origin matches CORS allowlist', () => {
    const ctx = createMockContext(
      'POST',
      { access_token: 'valid' },
      { origin: 'http://localhost:3000' },
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows cookie-authenticated mutation when Referer matches CORS allowlist', () => {
    const ctx = createMockContext(
      'POST',
      { access_token: 'valid' },
      { referer: 'https://academy.app/dashboard' },
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rejects cookie-authenticated mutation when Origin does not match CORS allowlist', () => {
    const ctx = createMockContext(
      'POST',
      { access_token: 'valid' },
      { origin: 'https://evil-attacker.com' },
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rejects cookie-authenticated mutation when Origin and Referer are missing', () => {
    const ctx = createMockContext('POST', { access_token: 'valid' }, {});
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
  it('rejects wildcard CORS as a CSRF bypass', () => {
    const wildcardGuard = new CsrfGuard({ corsOrigin: '*' } as AppConfigService);
    const ctx = createMockContext(
      'POST',
      { refresh_token: 'valid' },
      { origin: 'https://evil-attacker.com' },
    );
    expect(() => wildcardGuard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rejects invalid allowlist entries instead of trusting them', () => {
    const invalidGuard = new CsrfGuard({ corsOrigin: 'null, *' } as AppConfigService);
    const ctx = createMockContext('DELETE', { access_token: 'valid' }, { origin: 'null' });
    expect(() => invalidGuard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
