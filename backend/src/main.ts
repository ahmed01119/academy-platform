import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import express from 'express';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { correlationMiddleware } from './common/correlation.middleware';
import { securityHeadersMiddleware } from './common/security-headers.middleware';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    abortOnError: true,
  });

  const config = app.get(AppConfigService);

  // Request parsing with size protection
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());
  app.use(correlationMiddleware);
  app.use(securityHeadersMiddleware);

  const rawOrigins = config.corsOrigin.includes(',')
    ? config.corsOrigin.split(',').map((o) => o.trim())
    : [config.corsOrigin.trim()];

  // Separate exact origins from wildcard patterns (e.g. *.trycloudflare.com)
  const exactOrigins = rawOrigins.filter((o) => !o.startsWith('*'));
  const wildcardPatterns = rawOrigins
    .filter((o) => o.startsWith('*.'))
    .map((o) => {
      const suffix = o.slice(1); // e.g. ".trycloudflare.com"
      return suffix;
    });

  app.enableCors({
    origin: (
      requestOrigin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow server-to-server or non-browser requests with no origin header
      if (!requestOrigin) {
        return callback(null, true);
      }
      // Allow exact matches
      if (exactOrigins.includes('*') || exactOrigins.includes(requestOrigin)) {
        return callback(null, true);
      }
      // Allow wildcard pattern matches (e.g. *.trycloudflare.com)
      const matchesWildcard = wildcardPatterns.some((suffix) => requestOrigin.endsWith(suffix));
      if (matchesWildcard) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-tenant-id',
      'x-branch-id',
      'Accept-Language',
      'Origin',
      'Referer',
      'x-request-id',
    ],
  });

  app.setGlobalPrefix('v1');

  // Global exception filter for unified, production-grade error response contract
  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.listen(config.port, '0.0.0.0');
}

void bootstrap();
