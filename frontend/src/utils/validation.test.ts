import { describe, it, expect } from 'vitest';
import { validateWithSchema } from './validation';
import { RegisterRequestSchema } from '@academy/shared';

describe('validateWithSchema utility', () => {
  it('returns success: true for valid registration data', () => {
    const validData = {
      name: 'Capt Ahmed',
      email: 'ahmed@example.com',
      password: 'Password123!',
      academyName: 'Al-Hilal Academy',
      sport: 'FOOTBALL',
      emailProof: 'v1.0.proof',
    };

    const result = validateWithSchema(RegisterRequestSchema, validData);
    expect(result.success).toBe(true);
    expect(result.errors).toBeUndefined();
    expect(result.data?.email).toBe('ahmed@example.com');
  });

  it('maps invalid fields into error records', () => {
    const invalidData = {
      name: 'A', // too short
      email: 'not-an-email',
      password: 'weak',
      academyName: '',
      sport: 'FOOTBALL',
    };

    const result = validateWithSchema(RegisterRequestSchema, invalidData);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.name).toBeDefined();
    expect(result.errors?.email).toBeDefined();
    expect(result.errors?.password).toBeDefined();
  });
});
