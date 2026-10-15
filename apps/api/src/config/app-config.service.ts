import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type AppEnv } from './env.validation';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<AppEnv, true>) {}

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
}
