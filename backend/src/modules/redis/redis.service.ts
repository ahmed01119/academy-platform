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
