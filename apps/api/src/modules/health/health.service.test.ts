import { describe, expect, it, vi } from 'vitest';
import { HealthService } from './health.service';
import { type AppConfigService } from '../../config/app-config.service';
import { type PrismaService } from '../database/prisma.service';
import { type RedisService } from '../redis/redis.service';

function makeService(options: {
  nodeEnv?: 'development' | 'production';
  postgresOk?: boolean;
  redisConfigured?: boolean;
  redisOk?: boolean;
}) {
  const config = {
    apiVersion: '0.0.0',
    nodeEnv: options.nodeEnv ?? 'development',
  } as AppConfigService;

  const prisma = {
    $queryRaw:
      options.postgresOk === false
        ? vi.fn().mockRejectedValue(new Error('db'))
        : vi.fn().mockResolvedValue([{ 1: 1 }]),
  } as unknown as PrismaService;

  const redis = {
    isConfigured: options.redisConfigured ?? true,
    ping: vi.fn().mockResolvedValue(options.redisOk ?? true),
  } as unknown as RedisService;

  return new HealthService(config, prisma, redis);
}

describe('HealthService', () => {
  it('liveness is process-local and does not claim dependency health', () => {
    const service = makeService({});
    const result = service.getLiveness();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('academy-api');
    expect(result.checks).toBeUndefined();
  });

  it('readiness is ok when postgres and redis respond', async () => {
    const service = makeService({ redisConfigured: true, redisOk: true });
    const result = await service.getReadiness();
    expect(result.status).toBe('ok');
    expect(result.checks).toEqual({ postgres: 'ok', redis: 'ok' });
    await expect(service.getPlatformHealth()).resolves.toBe('HEALTHY');
  });

  it('readiness is down when postgres is unreachable', async () => {
    const service = makeService({ postgresOk: false });
    const result = await service.getReadiness();
    expect(result.status).toBe('down');
    expect(result.checks?.postgres).toBe('down');
    await expect(service.getPlatformHealth()).resolves.toBe('CRITICAL');
  });

  it('skips redis in development when unconfigured and reports ok', async () => {
    const service = makeService({ redisConfigured: false, nodeEnv: 'development' });
    const result = await service.getReadiness();
    expect(result.checks?.redis).toBe('skipped');
    expect(result.status).toBe('ok');
  });

  it('skips redis in production when unconfigured and reports degraded', async () => {
    const service = makeService({ redisConfigured: false, nodeEnv: 'production' });
    const result = await service.getReadiness();
    expect(result.checks?.redis).toBe('skipped');
    expect(result.status).toBe('degraded');
  });
});
