import {
  RESET_CODE_PATTERN,
  RESET_LINK_TOKEN_PATTERN,
  type ResetPasswordRequest,
} from '@academy/shared';

/**
 * Password-reset link handling (K1).
 *
 * Reset e-mails link to `/reset-password#token=<64 hex>&email=<email>`. The token is in the URL *fragment*, which
 * browsers never send to servers (so it never reaches access logs or `Referer` headers). Older e-mails and platform
 * staff activation links use the query string (`?token=…`); both are accepted.
 */
export interface ResetLinkParams {
  /** 64-hex link or activation token: used as-is, no code entry needed. */
  linkToken?: string;
  /** 6-digit code from an older e-mail link. */
  code?: string;
  email?: string;
  /** Activation link of an invited account: the page sets the first password and signs the device in. */
  activate?: boolean;
}

export function readResetLinkParams(hash: string, search: string): ResetLinkParams {
  const fragment = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const query = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);

  const rawToken = (
    fragment.get('token') ??
    query.get('token') ??
    query.get('otp') ??
    query.get('code') ??
    ''
  ).trim();
  const email = (fragment.get('email') ?? query.get('email') ?? '').trim() || undefined;
  const activate = (fragment.get('activate') ?? query.get('activate')) === '1';

  if (RESET_LINK_TOKEN_PATTERN.test(rawToken)) {
    return activate ? { linkToken: rawToken, email, activate } : { linkToken: rawToken, email };
  }
  if (RESET_CODE_PATTERN.test(rawToken)) return { code: rawToken, email };
  return { email };
}

/** True when the URL carried a secret that must be removed from the address bar and history. */
export function hasResetSecret(params: ResetLinkParams): boolean {
  return Boolean(params.linkToken || params.code);
}

export function buildResetPasswordPayload(input: {
  linkToken?: string;
  code: string;
  email: string;
  newPassword: string;
  /** Activation: ask the server to sign this device in as well. */
  activate?: boolean;
}): ResetPasswordRequest {
  const email = input.email.trim().toLowerCase() || undefined;
  if (input.linkToken) {
    return input.activate
      ? { token: input.linkToken, email, newPassword: input.newPassword, signIn: true }
      : { token: input.linkToken, email, newPassword: input.newPassword };
  }
  return { token: input.code.trim(), email, newPassword: input.newPassword };
}
