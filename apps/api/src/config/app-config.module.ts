import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigService } from './app-config.service';
import { validateEnv } from './env.validation';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      // Search for .env in the api app directory and the monorepo root.
      // This ensures the correct .env is loaded regardless of the CWD
      // when the process is started (e.g. from repo root vs apps/api).
      envFilePath: [
        `${__dirname}/../../.env`,   // apps/api/dist/../../.env = apps/api/.env
        `${__dirname}/../../../.env`, // fallback to monorepo root .env
      ],
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
