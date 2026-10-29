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
      // __dirname at runtime = apps/api/dist/config/
      // ../../.env  → apps/api/dist/.env          (does not exist — skipped gracefully)
      // ../../../.env → apps/api/.env              ✅ primary
      // ../../../../.env → monorepo root .env      ✅ fallback
      envFilePath: [
        `${__dirname}/../../../.env`,   // apps/api/.env  (from dist/config → up 3 levels)
        `${__dirname}/../../../../.env`, // monorepo root .env (fallback)
      ],
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
