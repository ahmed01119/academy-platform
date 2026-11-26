import { afterEach, describe, expect, it, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ALLOW_WHILE_PASSWORD_CHANGE_REQUIRED } from './password-change-required.decorator';

/** Item 6: while users.must_reset_password is set, only endpoints marked @AllowWhilePasswordChangeRequired work. */
describe('JwtAuthGuard - password change required', () => {
  const passportCanActivate = vi
    .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
    .mockResolvedValue(true);

  afterEach(() => passportCanActivate.mockClear());

  const run = async (user: { mustResetPassword?: boolean }, allowed: boolean) => {
    const handler = () => undefined;
    if (allowed) Reflect.defineMetadata(ALLOW_WHILE_PASSWORD_CHANGE_REQUIRED, true, handler);
    const context = {
      getHandler: () => handler,
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
    return new JwtAuthGuard(new Reflector()).canActivate(context);
  };

  it('lets a normal user through', async () => {
    await expect(run({ mustResetPassword: false }, false)).resolves.toBe(true);
  });

  it('refuses other endpoints while a password change is required', async () => {
    await expect(run({ mustResetPassword: true }, false)).rejects.toMatchObject({
      response: { code: 'PASSWORD_CHANGE_REQUIRED' },
    });
  });

  it('keeps /auth/me and /auth/change-password usable', async () => {
    await expect(run({ mustResetPassword: true }, true)).resolves.toBe(true);
  });
});
