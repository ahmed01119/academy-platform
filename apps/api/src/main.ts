import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    abortOnError: true,
  });

  const config = app.get(AppConfigService);

  app.use(cookieParser());

  const origin = config.corsOrigin.includes(',')
    ? config.corsOrigin.split(',').map((o) => o.trim())
    : config.corsOrigin === '*'
      ? true
      : config.corsOrigin;

  app.enableCors({
    origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-tenant-id',
      'x-branch-id',
      'Accept-Language',
    ],
  });

  app.setGlobalPrefix('v1');

  await app.listen(config.port);
}

void bootstrap();
