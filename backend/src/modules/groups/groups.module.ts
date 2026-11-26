import { Module } from '@nestjs/common';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { GroupScheduleService } from './group-schedule.service';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [GroupsController],
  providers: [GroupsService, GroupScheduleService],
  exports: [GroupsService],
})
export class GroupsModule {}
