import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { correlationMiddleware } from './common/correlation.middleware';
import { securityHeadersMiddleware } from './common/security-headers.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    abortOnError: true,
  });

  const config = app.get(AppConfigService);

  app.use(cookieParser());
  app.use(correlationMiddleware);
  app.use(securityHeadersMiddleware);

  const allowedOrigins = config.corsOrigin.includes(',')
    ? config.corsOrigin.split(',').map((o) => o.trim())
    : [config.corsOrigin.trim()];

  app.enableCors({
    origin: (
      requestOrigin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow server-to-server or non-browser requests with no origin header
      if (!requestOrigin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes('*') || allowedOrigins.includes(requestOrigin)) {
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

  await app.listen(config.port);
}

void bootstrap();
