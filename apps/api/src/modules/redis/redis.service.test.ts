import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RedisService } from './redis.service';
import { ServiceUnavailableException } from '@nestjs/common';
import type { AppConfigService } from '../../config/app-config.service';

describe('RedisService', () => {
  let service: RedisService;
  let mockConfig: { nodeEnv: string; redisUrl?: string };

  describe('Non-production (in-memory fallback)', () => {
    beforeEach(() => {
      mockConfig = { nodeEnv: 'test', redisUrl: undefined };
      service = new RedisService(mockConfig as unknown as AppConfigService);
    });

    it('tracks rate limits in memory', async () => {
      const first = await service.incrementRateLimit('test-key', 60);
      expect(first.count).toBe(1);
      expect(first.remainingTime).toBe(60);

      const second = await service.incrementRateLimit('test-key', 60);
      expect(second.count).toBe(2);
    });

    it('resets rate limits in memory', async () => {
      await service.incrementRateLimit('test-key', 60);
      await service.resetRateLimit('test-key');

      const afterReset = await service.incrementRateLimit('test-key', 60);
      expect(afterReset.count).toBe(1);
    });
  });

  describe('Production fail-closed behavior', () => {
    it('throws ServiceUnavailableException when Redis is not connected in production', async () => {
      mockConfig = { nodeEnv: 'production', redisUrl: undefined };
      service = new RedisService(mockConfig as unknown as AppConfigService);

      await expect(service.incrementRateLimit('prod-key', 60)).rejects.toThrow(
        ServiceUnavailableException,
      );
      await expect(service.resetRateLimit('prod-key')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('fails closed when Redis client throws error during increment in production', async () => {
      mockConfig = { nodeEnv: 'production', redisUrl: 'redis://localhost:6379' };
      service = new RedisService(mockConfig as unknown as AppConfigService);

      const mockClient = {
        incr: vi.fn().mockRejectedValue(new Error('Connection lost')),
        expire: vi.fn(),
        ttl: vi.fn(),
        del: vi.fn().mockRejectedValue(new Error('Connection lost')),
        quit: vi.fn().mockResolvedValue('OK'),
      };
      (service as unknown as { client: typeof mockClient }).client = mockClient;

      await expect(service.incrementRateLimit('prod-key', 60)).rejects.toThrow(
        ServiceUnavailableException,
      );
      await expect(service.resetRateLimit('prod-key')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('returns rate limit count when Redis operations succeed in production', async () => {
      mockConfig = { nodeEnv: 'production', redisUrl: 'redis://localhost:6379' };
      service = new RedisService(mockConfig as unknown as AppConfigService);

      const mockClient = {
        incr: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
        ttl: vi.fn().mockResolvedValue(60),
        del: vi.fn().mockResolvedValue(1),
        quit: vi.fn().mockResolvedValue('OK'),
      };
      (service as unknown as { client: typeof mockClient }).client = mockClient;

      const result = await service.incrementRateLimit('prod-key', 60);
      expect(result.count).toBe(1);
      expect(result.remainingTime).toBe(60);
      expect(mockClient.expire).toHaveBeenCalledWith('prod-key', 60);

      await expect(service.resetRateLimit('prod-key')).resolves.toBeUndefined();
    });
  });
});
