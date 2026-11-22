import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  type OnModuleDestroy,
} from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../../config/app-config.service';

interface MemoryRateLimitEntry {
  count: number;
  resetAt: number;
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private memoryStore = new Map<string, MemoryRateLimitEntry>();
  private valueStore = new Map<string, { value: string; expiresAt: number }>();

  private get requiresRedis(): boolean {
    return this.config.nodeEnv === 'production' && !this.config.allowInMemoryRateLimit;
  }

  private assertFallbackAllowed(): void {
    if (this.requiresRedis) {
      throw new ServiceUnavailableException(
        'Authentication rate limiting is temporarily unavailable',
      );
    }
  }

  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) {
    const redisUrl = this.config.redisUrl;
    if (redisUrl) {
      try {
        this.client = new Redis(redisUrl, {
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          retryStrategy: () => null,
        });
        this.client.on('error', (err) => {
          this.logger.warn(
            `Redis client error (${err.message}). Shared rate limiting may be unavailable.`,
          );
          this.client = null;
        });
        this.client.connect().catch((err) => {
          this.logger.warn(
            `Redis connection failed (${err.message}). Shared rate limiting may be unavailable.`,
          );
          this.client = null;
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to initialize Redis (${msg}).`);
        this.client = null;
      }
    } else {
      this.logger.log('No REDIS_URL configured. Development-only in-memory rate limiting.');
    }
  }

  get isConfigured(): boolean {
    return Boolean(this.config.redisUrl);
  }

  async ping(): Promise<boolean> {
    if (!this.client) {
      return false;
    }
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (err) {
      this.logger.warn(`Redis ping failed: ${(err as Error).message}`);
      return false;
    }
  }

  async getCacheMetrics(): Promise<{
    isAvailable: boolean;
    status: 'CONNECTED' | 'IN_MEMORY' | 'UNAVAILABLE';
    keyCount: number | null;
  }> {
    if (!this.client) {
      return {
        isAvailable: false,
        status: this.isConfigured ? 'UNAVAILABLE' : 'IN_MEMORY',
        keyCount: this.memoryStore.size,
      };
    }
    try {
      const isAlive = await this.ping();
      if (!isAlive) {
        return {
          isAvailable: false,
          status: 'UNAVAILABLE',
          keyCount: null,
        };
      }
      const count = await this.client.dbsize();
      return {
        isAvailable: true,
        status: 'CONNECTED',
        keyCount: count,
      };
    } catch {
      return {
        isAvailable: false,
        status: 'UNAVAILABLE',
        keyCount: null,
      };
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit().catch(() => {});
    }
    this.memoryStore.clear();
    this.valueStore.clear();
  }

  /**
   * Sliding window / Fixed window rate limiter.
   * Increments the attempt count for key and expires after windowSeconds.
   */
  async incrementRateLimit(
    key: string,
    windowSeconds: number,
  ): Promise<{ count: number; remainingTime: number }> {
    const now = Date.now();

    if (!this.client) {
      this.assertFallbackAllowed();
    }

    if (this.client) {
      try {
        const count = await this.client.incr(key);
        if (count === 1) {
          await this.client.expire(key, windowSeconds);
        }
        const ttl = await this.client.ttl(key);
        return { count, remainingTime: Math.max(0, ttl) };
      } catch (err) {
        this.logger.warn(`Redis incr error: ${(err as Error).message}.`);
        this.assertFallbackAllowed();
      }
    }

    // Development/test-only fallback. Production must not bypass shared rate limits.
    const entry = this.memoryStore.get(key);
    if (!entry || now > entry.resetAt) {
      this.memoryStore.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
      return { count: 1, remainingTime: windowSeconds };
    }

    entry.count += 1;
    const remainingTime = Math.max(0, Math.ceil((entry.resetAt - now) / 1000));
    return { count: entry.count, remainingTime };
  }

  /**
   * Reads a rate-limit counter without incrementing it (0 when absent or expired). Same fail-closed rule as
   * {@link incrementRateLimit}: in production without Redis the call throws instead of returning a guess.
   */
  async peekRateLimit(key: string): Promise<number> {
    if (this.client) {
      try {
        const value = await this.client.get(key);
        return value ? Number.parseInt(value, 10) || 0 : 0;
      } catch (err) {
        this.logger.warn(`Redis get error: ${(err as Error).message}.`);
        this.assertFallbackAllowed();
      }
    } else {
      this.assertFallbackAllowed();
    }
    const entry = this.memoryStore.get(key);
    return entry && Date.now() <= entry.resetAt ? entry.count : 0;
  }

  /**
   * Stores a short-lived string value (for example a hashed one-time code). Same fail-closed rule as the rate limiter:
   * in production without Redis the call throws instead of keeping the value in this process only.
   */
  async setValue(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (this.client) {
      try {
        await this.client.set(key, value, 'EX', ttlSeconds);
        return;
      } catch (err) {
        this.logger.warn(`Redis set error: ${(err as Error).message}.`);
        this.assertFallbackAllowed();
      }
    } else {
      this.assertFallbackAllowed();
    }
    this.valueStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  /** Reads a value stored with {@link setValue}; null when absent or expired. */
  async getValue(key: string): Promise<string | null> {
    if (this.client) {
      try {
        return await this.client.get(key);
      } catch (err) {
        this.logger.warn(`Redis get error: ${(err as Error).message}.`);
        this.assertFallbackAllowed();
      }
    } else {
      this.assertFallbackAllowed();
    }
    const entry = this.valueStore.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.valueStore.delete(key);
      return null;
    }
    return entry.value;
  }

  /** Removes a value stored with {@link setValue}. */
  async deleteValue(key: string): Promise<void> {
    this.valueStore.delete(key);
    await this.resetRateLimit(key);
  }

  async resetRateLimit(key: string): Promise<void> {
    if (this.client) {
      try {
        await this.client.del(key);
        return;
      } catch (err) {
        this.logger.warn(`Redis reset error: ${(err as Error).message}.`);
        this.assertFallbackAllowed();
      }
    } else {
      this.assertFallbackAllowed();
    }
    this.memoryStore.delete(key);
  }
}
