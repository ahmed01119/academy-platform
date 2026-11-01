import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { DatabaseModule } from './modules/database/database.module';
import { RedisModule } from './modules/redis/redis.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { HealthModule } from './modules/health/health.module';
import { BranchesModule } from './modules/branches/branches.module';
import { PlayersModule } from './modules/players/players.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { GroupsModule } from './modules/groups/groups.module';
import { PlatformModule } from './modules/platform/platform.module';
import { EvaluationsModule } from './modules/evaluations/evaluations.module';
import { PortalModule } from './modules/portal/portal.module';
import { FinanceModule } from './modules/finance/finance.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { EmailModule } from './modules/email/email.module';

/**
 * Root module for the modular monolith.
 * Domain modules are registered here as they are introduced.
 * Do not place business logic in this file.
 */
@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    RedisModule,
    AuditModule,
    EmailModule,
    AuthModule,
    TenancyModule,
    AttendanceModule,
    HealthModule,
    BranchesModule,
    PlayersModule,
    EnrollmentsModule,
    GroupsModule,
    PlatformModule,
    EvaluationsModule,
    PortalModule,
    FinanceModule,
    NotificationsModule,
  ],
})
export class AppModule {}
