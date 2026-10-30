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
    const commitSha =
      process.env.COMMIT_SHA || process.env.SOURCE_COMMIT || process.env.GITHUB_SHA || undefined;

    return {
      status: 'ok',
      service: 'academy-api',
      version: this.config.apiVersion,
      commitSha: commitSha ? commitSha.slice(0, 12) : undefined,
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness(): Promise<HealthStatus> {
    const postgres = await this.checkPostgres();
    const redis = await this.checkRedis();

    let status: HealthStatus['status'] = 'ok';

    // PostgreSQL is always critical
    if (postgres === 'down') {
      status = 'down';
    }
    // Redis is optional in non-production — only degrade/down in production
    else if (redis === 'down') {
      status = this.config.nodeEnv === 'production' ? 'down' : 'degraded';
    } else if (redis === 'skipped' && this.config.nodeEnv === 'production') {
      // Redis required in production unless in-memory fallback is explicitly permitted
      status = this.config.allowInMemoryRateLimit ? 'ok' : 'degraded';
    }
    // redis === 'skipped' in development/test → status stays 'ok'

    const commitSha =
      process.env.COMMIT_SHA || process.env.SOURCE_COMMIT || process.env.GITHUB_SHA || undefined;

    return {
      status,
      service: 'academy-api',
      version: this.config.apiVersion,
      commitSha: commitSha ? commitSha.slice(0, 12) : undefined,
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
