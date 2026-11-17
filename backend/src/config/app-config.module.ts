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
      // Search for .env in the api app directory first, then the monorepo root (first match wins per variable).
      // __dirname at runtime = backend/dist/config/
      // ../../.env    → backend/.env          ✅ primary (API settings, runtime database role)
      // ../../../.env → monorepo root .env    ✅ fallback
      envFilePath: [
        `${__dirname}/../../.env`, // backend/.env  (from dist/config → up 2 levels)
        `${__dirname}/../../../.env`, // monorepo root .env (fallback)
      ],
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
