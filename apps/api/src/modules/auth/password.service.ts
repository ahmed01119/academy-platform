import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  /**
   * Hashes a password using Argon2id with recommended OWASP parameters.
   */
  async hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * Verifies plain password against stored Argon2id hash.
   * Returns false without throwing on mismatch.
   */
  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /**
   * Checks if hash needs to be re-hashed (e.g. if algorithm parameters increased).
   */
  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, {
      memoryCost: 65536,
      timeCost: 3,
    });
  }
}
