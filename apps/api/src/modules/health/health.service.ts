import { Inject, Injectable } from '@nestjs/common';
import { type HealthStatus } from '@academy/shared';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class HealthService {
  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) {}

  getStatus(): HealthStatus {
    return {
      status: 'ok',
      service: 'academy-api',
      version: this.config.apiVersion,
      timestamp: new Date().toISOString(),
    };
  }
}
