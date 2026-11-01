import {
  type ExceptionFilter,
  Catch,
  type ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ZodError } from 'zod';

/**
 * Global exception filter that converts Zod validation errors into structured
 * 400 Bad Request responses instead of leaking a 500 Internal Server Error.
 *
 * This preserves security (no stack traces in responses) while returning
 * actionable validation details to the client.
 */
@Catch(ZodError)
export class ZodExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ZodExceptionFilter.name);

  catch(exception: ZodError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ url: string; method: string }>();

    const issues = exception.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));

    this.logger.warn(
      `Validation error on ${request.method} ${request.url}: ${issues.map((i) => `${i.field}: ${i.message}`).join(', ')}`,
    );

    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      error: 'Bad Request',
      message: 'Validation failed',
      issues,
    });
  }
}
