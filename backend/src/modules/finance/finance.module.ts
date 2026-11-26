import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { FinancePlansService } from './finance-plans.service';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [DatabaseModule, AuditModule, NotificationsModule],
  controllers: [FinanceController],
  providers: [FinanceService, FinancePlansService],
  exports: [FinanceService, FinancePlansService],
})
export class FinanceModule {}
