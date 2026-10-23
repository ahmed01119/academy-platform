import { Inject, Injectable } from '@nestjs/common';
import { type HealthStatus } from '@academy/shared';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class HealthService {
  constructor(
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  getLiveness(): HealthStatus {
    return {
      status: 'ok',
      service: 'academy-api',
      version: this.config.apiVersion,
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness(): Promise<HealthStatus> {
    const postgres = await this.checkPostgres();
    const redis = await this.checkRedis();

    let status: HealthStatus['status'] = 'ok';
    if (postgres === 'down' || redis === 'down') {
      status = this.config.nodeEnv === 'production' || postgres === 'down' ? 'down' : 'degraded';
    } else if (redis === 'skipped') {
      status = this.config.nodeEnv === 'production' ? 'down' : 'degraded';
    }

    return {
      status,
      service: 'academy-api',
      version: this.config.apiVersion,
      timestamp: new Date().toISOString(),
      checks: { postgres, redis },
    };
  }

  getStatus(): HealthStatus {
    return this.getLiveness();
  }

  async getPlatformHealth(): Promise<'HEALTHY' | 'DEGRADED' | 'CRITICAL'> {
    const ready = await this.getReadiness();
    if (ready.status === 'ok') return 'HEALTHY';
    if (ready.status === 'degraded') return 'DEGRADED';
    return 'CRITICAL';
  }

  private async checkPostgres(): Promise<'ok' | 'down'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<'ok' | 'down' | 'skipped'> {
    if (!this.redis.isConfigured) {
      return 'skipped';
    }
    const ok = await this.redis.ping();
    return ok ? 'ok' : 'down';
  }
}
