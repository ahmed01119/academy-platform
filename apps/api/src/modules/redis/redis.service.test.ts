import { describe, expect, it } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { RedisService } from './redis.service';
import type { AppConfigService } from '../../config/app-config.service';

describe('RedisService rate limiting fail-closed policy', () => {
  const config = (nodeEnv: 'production' | 'test') =>
    ({ nodeEnv, redisUrl: undefined }) as AppConfigService;

  it('rejects authentication rate limiting without Redis in production', async () => {
    const service = new RedisService(config('production'));
    await expect(service.incrementRateLimit('login:user', 60)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(service.resetRateLimit('login:user')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await service.onModuleDestroy();
  });

  it('uses local fallback only for development and tests', async () => {
    const service = new RedisService(config('test'));
    expect(await service.incrementRateLimit('login:user', 60)).toMatchObject({ count: 1 });
    expect(await service.incrementRateLimit('login:user', 60)).toMatchObject({ count: 2 });
    await service.resetRateLimit('login:user');
    expect(await service.incrementRateLimit('login:user', 60)).toMatchObject({ count: 1 });
    await service.onModuleDestroy();
  });
});
