import { Module } from '@nestjs/common';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';
import { GuardianLinkService } from './guardian-link.service';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule, NotificationsModule],
  controllers: [PortalController],
  providers: [PortalService, GuardianLinkService],
  exports: [PortalService],
})
export class PortalModule {}
