import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceRosterService } from './attendance-roster.service';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceRosterService],
  exports: [AttendanceService, AttendanceRosterService],
})
export class AttendanceModule {}
