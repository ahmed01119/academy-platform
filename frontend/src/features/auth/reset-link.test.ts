import { describe, expect, it } from 'vitest';
import { ResetPasswordRequestSchema } from '@academy/shared';
import { buildResetPasswordPayload, hasResetSecret, readResetLinkParams } from './reset-link';
import { validateResetPasswordForm } from './password-reset-validation';

const LINK = 'a1'.repeat(32); // 64 hex characters
const STRONG = 'Str0ng!Passw0rd';

describe('readResetLinkParams (K1)', () => {
  it('reads the link token and e-mail from the URL fragment', () => {
    expect(readResetLinkParams(`#token=${LINK}&email=user%40example.com`, '')).toEqual({
      linkToken: LINK,
      email: 'user@example.com',
    });
  });

  it('accepts query-string links (older e-mails, platform activation links)', () => {
    expect(readResetLinkParams('', `?token=${LINK}`)).toEqual({
      linkToken: LINK,
      email: undefined,
    });
    expect(readResetLinkParams('', '?token=123456&email=u%40x.com')).toEqual({
      code: '123456',
      email: 'u@x.com',
    });
  });

  it('never truncates or digit-strips a link token (activation links were broken by this)', () => {
    const activation = 'f0'.repeat(32);
    expect(readResetLinkParams('', `?token=${activation}`).linkToken).toBe(activation);
  });

  it('ignores malformed tokens', () => {
    expect(readResetLinkParams('#token=<script>', '')).toEqual({ email: undefined });
    expect(hasResetSecret(readResetLinkParams('#token=abc', ''))).toBe(false);
    expect(hasResetSecret(readResetLinkParams(`#token=${LINK}`, ''))).toBe(true);
  });
});

describe('buildResetPasswordPayload', () => {
  it('sends a link token without requiring the e-mail, and passes the schema', () => {
    const payload = buildResetPasswordPayload({
      linkToken: LINK,
      code: '',
      email: '',
      newPassword: STRONG,
    });
    expect(payload).toEqual({ token: LINK, email: undefined, newPassword: STRONG });
    expect(ResetPasswordRequestSchema.safeParse(payload).success).toBe(true);
  });

  it('an invitation (activation) link asks the server to sign the device in', () => {
    const params = readResetLinkParams(
      `#token=${LINK}&activate=1&email=new.admin%40example.com`,
      '',
    );
    expect(params).toEqual({ linkToken: LINK, email: 'new.admin@example.com', activate: true });
    const payload = buildResetPasswordPayload({
      linkToken: params.linkToken,
      code: '',
      email: params.email ?? '',
      newPassword: STRONG,
      activate: params.activate,
    });
    expect(payload.signIn).toBe(true);
    expect(ResetPasswordRequestSchema.safeParse(payload).success).toBe(true);
  });

  it('a plain reset link does not sign in', () => {
    const payload = buildResetPasswordPayload({
      linkToken: LINK,
      code: '',
      email: '',
      newPassword: STRONG,
    });
    expect(payload.signIn).toBeUndefined();
  });

  it('sends a code together with the normalised e-mail', () => {
    const payload = buildResetPasswordPayload({
      code: ' 123456 ',
      email: ' User@Example.com ',
      newPassword: STRONG,
    });
    expect(payload).toEqual({ token: '123456', email: 'user@example.com', newPassword: STRONG });
    expect(ResetPasswordRequestSchema.safeParse(payload).success).toBe(true);
  });

  it('the shared schema rejects a code without an e-mail', () => {
    expect(
      ResetPasswordRequestSchema.safeParse({ token: '123456', newPassword: STRONG }).success,
    ).toBe(false);
  });
});

describe('validateResetPasswordForm with links and codes', () => {
  const base = { token: '', password: STRONG, confirmPassword: STRONG };

  it('needs no code or e-mail in link mode', () => {
    expect(validateResetPasswordForm({ ...base, linkToken: LINK }, 'en')).toBeNull();
  });

  it('requires the e-mail with a code', () => {
    expect(validateResetPasswordForm({ ...base, token: '123456', email: '' }, 'en')).toBe(
      'Please enter the email address the code was sent to.',
    );
    expect(
      validateResetPasswordForm({ ...base, token: '123456', email: 'u@x.com' }, 'en'),
    ).toBeNull();
  });
});
