import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { HealthModule } from './modules/health/health.module';

/**
 * Root module for the modular monolith.
 * Domain modules are registered here as they are introduced.
 * Do not place business logic in this file.
 */
@Module({
  imports: [AppConfigModule, HealthModule],
})
export class AppModule {}
