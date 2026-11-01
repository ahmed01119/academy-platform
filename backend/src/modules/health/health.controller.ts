import { Controller, Get, Head, Inject, ServiceUnavailableException } from '@nestjs/common';
import { type HealthStatus } from '@academy/shared';
import { Public } from '../auth/guards/public.decorator';
import { HealthService } from './health.service';

@Public()
@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  @Head()
  getHealth(): HealthStatus {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  async getReady(): Promise<HealthStatus> {
    const status = await this.healthService.getReadiness();
    if (status.status === 'down') {
      throw new ServiceUnavailableException(status);
    }
    return status;
  }
}
