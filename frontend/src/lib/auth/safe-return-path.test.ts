import { describe, expect, it } from 'vitest';
import {
  invitationPath,
  readReturnPath,
  sanitizeReturnPath,
  withReturnPath,
} from './safe-return-path';

describe('sanitizeReturnPath — allowed invitation destinations', () => {
  it.each([
    ['/accept-invite?token=abc123', '/accept-invite?token=abc123'],
    ['/auth/accept-invite?token=abc123', '/auth/accept-invite?token=abc123'],
    ['/accept-invite', '/accept-invite'],
    ['/accept-invite?token=a%2Bb%3Dc&lang=ar', '/accept-invite?token=a%2Bb%3Dc&lang=ar'],
  ])('%s → %s', (raw, expected) => {
    expect(sanitizeReturnPath(raw)).toBe(expected);
  });

  it('drops the fragment but keeps the query', () => {
    expect(sanitizeReturnPath('/accept-invite?token=t#section')).toBe('/accept-invite?token=t');
  });
});

describe('sanitizeReturnPath — rejected destinations', () => {
  it.each([
    // missing / wrong types
    [null],
    [undefined],
    [''],
    [42],
    // external & protocol-relative
    ['https://evil.com/accept-invite'],
    ['http://evil.com'],
    ['//evil.com/accept-invite'],
    ['///evil.com'],
    ['/\\evil.com'],
    ['\\\\evil.com'],
    // other schemes
    ['javascript:alert(1)'],
    ['JavaScript:alert(1)'],
    ['data:text/html,<script>alert(1)</script>'],
    ['mailto:a@b.co'],
    // not on the allow-list (internal but not permitted)
    ['/dashboard'],
    ['/platform'],
    ['/login?redirect=/accept-invite'],
    ['/accept-invite-evil'],
    ['/accept-invite/extra'],
    ['/ACCEPT-INVITE'],
    // traversal & normalization tricks
    ['/accept-invite/../platform'],
    ['/./accept-invite'],
    ['/foo/../accept-invite'],
    ['/%2e%2e/accept-invite'],
    ['/%2F%2Fevil.com'],
    ['/accept-invite%2F..%2Fplatform'],
    ['/%5Cevil.com'],
    // whitespace & control characters
    [' /accept-invite'],
    ['/accept-invite '],
    ['/accept-invite\n'],
    ['\t/accept-invite'],
    ['/accept-invite\u0000'],
    // credentials / authority smuggling
    ['//user:pass@evil.com'],
    ['/@evil.com'],
    // oversized
    [`/accept-invite?token=${'a'.repeat(3000)}`],
  ])('rejects %j', (raw) => {
    expect(sanitizeReturnPath(raw)).toBeNull();
  });
});

describe('readReturnPath', () => {
  it('reads and decodes the redirect query parameter', () => {
    expect(readReturnPath('?redirect=%2Faccept-invite%3Ftoken%3Dabc123')).toBe(
      '/accept-invite?token=abc123',
    );
  });

  it('returns null when absent or unsafe', () => {
    expect(readReturnPath('')).toBeNull();
    expect(readReturnPath('?other=1')).toBeNull();
    expect(readReturnPath('?redirect=https%3A%2F%2Fevil.com')).toBeNull();
    expect(readReturnPath('?redirect=%2F%2Fevil.com')).toBeNull();
  });
});

describe('withReturnPath / invitationPath', () => {
  it('builds an invitation round-trip that survives login', () => {
    const link = withReturnPath('/login', invitationPath('abc123'));
    expect(link).toBe('/login?redirect=%2Faccept-invite%3Ftoken%3Dabc123');
    // What the login page reads back after the user signs in:
    expect(readReturnPath(link.slice('/login'.length))).toBe('/accept-invite?token=abc123');
  });

  it('encodes tokens with reserved characters safely', () => {
    const path = invitationPath('a&b=c/../x');
    expect(path).toBe('/accept-invite?token=a%26b%3Dc%2F..%2Fx');
    expect(readReturnPath(withReturnPath('/register', path).slice('/register'.length))).toBe(path);
  });

  it('omits the parameter when the destination is unsafe or missing', () => {
    expect(withReturnPath('/login', null)).toBe('/login');
    expect(withReturnPath('/login', 'https://evil.com')).toBe('/login');
    expect(withReturnPath('/register', '/platform')).toBe('/register');
  });
});
