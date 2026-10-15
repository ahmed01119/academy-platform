import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    abortOnError: true,
  });

  const config = app.get(AppConfigService);
  app.setGlobalPrefix('v1');

  await app.listen(config.port);
}

void bootstrap();
