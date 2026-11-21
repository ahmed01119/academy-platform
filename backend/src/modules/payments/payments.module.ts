import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { FinanceModule } from '../finance/finance.module';
import { PaymentsController } from './payments.controller';
import { PAYMOB_CLIENT, PaymentsService } from './payments.service';
import { PaymobClient } from './paymob.client';

@Module({
  imports: [DatabaseModule, AuditModule, FinanceModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, { provide: PAYMOB_CLIENT, useFactory: () => new PaymobClient() }],
})
export class PaymentsModule {}
