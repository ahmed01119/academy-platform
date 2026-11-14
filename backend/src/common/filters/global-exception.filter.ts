import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { CORRELATION_HEADER } from '../correlation.middleware';

export interface StandardErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  code: string;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  issues?: unknown[];
  timestamp: string;
  path: string;
  requestId?: string;
}

/**
 * Centralized, production-ready Global Exception Filter.
 *
 * Normalizes all error responses (Zod, NestJS HttpExceptions, Prisma database errors,
 * and uncaught runtime errors) into a consistent, secure contract.
 *
 * Security:
 * - Redacts stack traces and internal SQL statements in production.
 * - Logs unexpected internal errors with correlation request ID.
 * - Backward-compatible with client error parsers (providing top-level message & code).
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      (request.headers[CORRELATION_HEADER] as string) ||
      (request.headers['x-request-id'] as string) ||
      undefined;

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected internal server error occurred';
    let details: unknown = undefined;
    let issues: unknown[] | undefined = undefined;

    // 1. Zod Validation Errors
    if (exception instanceof ZodError) {
      statusCode = HttpStatus.BAD_REQUEST;
      code = 'VALIDATION_ERROR';
      issues = exception.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }));
      const firstIssue = exception.issues[0];
      message = firstIssue
        ? `Validation failed: ${firstIssue.path.join('.')} - ${firstIssue.message}`
        : 'Validation failed';
      details = issues;

      this.logger.warn(
        `[${requestId || 'no-req-id'}] Validation error on ${request.method} ${request.url}: ${message}`,
      );
    }
    // 2. Standard NestJS HttpExceptions
    else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
        code = HttpStatus[statusCode] || 'HTTP_ERROR';
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        message =
          (resObj.message as string) ||
          (Array.isArray(resObj.message) ? resObj.message.join(', ') : exception.message);
        code = (resObj.code as string) || HttpStatus[statusCode] || 'HTTP_ERROR';
        details = resObj.details || resObj.error || undefined;
      }
    }
    // 3. Prisma Known Database Request Errors
    else if (this.isPrismaClientKnownRequestError(exception)) {
      const prismaError = exception as { code: string; meta?: Record<string, unknown> };

      switch (prismaError.code) {
        case 'P2002': {
          statusCode = HttpStatus.CONFLICT;
          code = 'CONFLICT';
          const target = prismaError.meta?.target;
          const fields = Array.isArray(target) ? target.join(', ') : String(target || 'field');
          message = `A record with this ${fields} already exists`;
          details = { target: prismaError.meta?.target };
          break;
        }
        case 'P2025': {
          statusCode = HttpStatus.NOT_FOUND;
          code = 'NOT_FOUND';
          message = 'The requested database record was not found';
          break;
        }
        case 'P2003': {
          statusCode = HttpStatus.BAD_REQUEST;
          code = 'FOREIGN_KEY_VIOLATION';
          message = 'Referenced related record does not exist or cannot be modified';
          break;
        }
        case 'P2028': {
          statusCode = HttpStatus.GATEWAY_TIMEOUT;
          code = 'TRANSACTION_TIMEOUT';
          message = 'Database transaction timed out. Please retry with a smaller batch.';
          break;
        }
        default: {
          statusCode = HttpStatus.BAD_REQUEST;
          code = `DATABASE_ERROR_${prismaError.code}`;
          message = 'A database constraint or query operation error occurred';
          break;
        }
      }

      this.logger.warn(
        `[${requestId || 'no-req-id'}] Prisma error [${prismaError.code}] on ${request.method} ${request.url}: ${message}`,
      );
    }
    // 4. Other Unhandled Runtime Errors
    else {
      const err = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(
        `[${requestId || 'no-req-id'}] Unhandled exception on ${request.method} ${request.url}: ${err.message}`,
        err.stack,
      );

      // In development or test, allow the error message to be inspected; in production, keep generic
      const isDevOrTest = process.env.NODE_ENV !== 'production';
      if (isDevOrTest) {
        message = err.message || 'Internal server error';
        details = { name: err.name };
      }
    }

    const payload: StandardErrorResponse = {
      success: false,
      statusCode,
      message,
      code,
      error: {
        code,
        message,
        details,
      },
      issues,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
    };

    response.status(statusCode).json(payload);
  }

  private isPrismaClientKnownRequestError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    const err = error as { name?: string; code?: string };
    return err.name === 'PrismaClientKnownRequestError' && typeof err.code === 'string';
  }
}

