import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { correlationMiddleware } from './common/correlation.middleware';
import { securityHeadersMiddleware } from './common/security-headers.middleware';
import { ZodExceptionFilter } from './common/zod-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    abortOnError: true,
  });

  const config = app.get(AppConfigService);

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
      const matchesWildcard = wildcardPatterns.some((suffix) =>
        requestOrigin.endsWith(suffix),
      );
      if (matchesWildcard) {
        return callback(null, true);
      }
      return callback(new Error('CORS origin not allowed by policy'));
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

  // Convert Zod validation errors to 400 Bad Request (not 500)
  app.useGlobalFilters(new ZodExceptionFilter());

  await app.listen(config.port, '0.0.0.0');
}

void bootstrap();
