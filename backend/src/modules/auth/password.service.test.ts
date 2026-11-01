import { describe, expect, it } from 'vitest';
import { PasswordService } from './password.service';

describe('PasswordService (Argon2id)', () => {
  const service = new PasswordService();

  it('hashes password with argon2id and verifies successfully', async () => {
    const plain = 'StrongPass123!';
    const hash = await service.hash(plain);

    expect(hash).toBeDefined();
    expect(hash.startsWith('$argon2id$')).toBe(true);

    const isValid = await service.verify(hash, plain);
    expect(isValid).toBe(true);
  });

  it('returns false when verifying incorrect password without throwing', async () => {
    const plain = 'StrongPass123!';
    const hash = await service.hash(plain);

    const isValid = await service.verify(hash, 'WrongPassword456!');
    expect(isValid).toBe(false);
  });

  it('handles invalid hash formats safely by returning false', async () => {
    const isValid = await service.verify('invalid-hash-string', 'somePassword');
    expect(isValid).toBe(false);
  });
});
