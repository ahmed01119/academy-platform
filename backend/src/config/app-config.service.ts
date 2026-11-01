import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type AppEnv } from './env.validation';

@Injectable()
export class AppConfigService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService<AppEnv, true>) {}

  get nodeEnv(): AppEnv['NODE_ENV'] {
    return this.config.get('NODE_ENV', { infer: true });
  }

  get port(): number {
    return this.config.get('PORT', { infer: true });
  }

  get apiVersion(): string {
    return this.config.get('API_VERSION', { infer: true });
  }

  get databaseUrl(): string | undefined {
    return this.config.get('DATABASE_URL', { infer: true });
  }

  get redisUrl(): string | undefined {
    return this.config.get('REDIS_URL', { infer: true });
  }

  get allowInMemoryRateLimit(): boolean {
    return this.config.get('ALLOW_IN_MEMORY_RATE_LIMIT', { infer: true }) ?? false;
  }

  get jwtSecret(): string {
    return this.config.get('JWT_SECRET', { infer: true });
  }

  get jwtExpiresIn(): string {
    return this.config.get('JWT_EXPIRES_IN', { infer: true });
  }

  get refreshTokenExpiresDays(): number {
    return this.config.get('REFRESH_TOKEN_EXPIRES_DAYS', { infer: true });
  }

  get corsOrigin(): string {
    return this.config.get('CORS_ORIGIN', { infer: true });
  }

  get cookieSecure(): boolean {
    return this.config.get('COOKIE_SECURE', { infer: true }) || this.nodeEnv === 'production';
  }
}
