import { Controller, Get } from '@nestjs/common';
import { type HealthStatus } from '@academy/shared';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(): HealthStatus {
    return this.healthService.getStatus();
  }
}
