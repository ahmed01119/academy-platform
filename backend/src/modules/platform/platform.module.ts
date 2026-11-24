import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { PlatformMetricsService } from './platform-metrics.service';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { HealthModule } from '../health/health.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ApplicationReplyController } from './application-reply.controller';
import { ApplicationReplyService } from './application-reply.service';

@Module({
  imports: [DatabaseModule, AuditModule, HealthModule, NotificationsModule],
  controllers: [PlatformController, ApplicationReplyController],
  providers: [PlatformService, PlatformMetricsService, ApplicationReplyService],
  exports: [PlatformService, PlatformMetricsService],
})
export class PlatformModule {}
