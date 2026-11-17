import { describe, expect, it, vi } from 'vitest';
import { GlobalExceptionFilter, type StandardErrorResponse } from './global-exception.filter';
import { HttpException, HttpStatus } from '@nestjs/common';
import { z, type ZodError } from 'zod';
import type { ArgumentsHost } from '@nestjs/common';

/** First argument of the first call; fails the test clearly if the mock was never called. */
function firstCallArg(mock: ReturnType<typeof vi.fn>): StandardErrorResponse {
  const call = mock.mock.calls[0];
  if (!call) throw new Error('expected the response body to have been sent');
  return call[0] as StandardErrorResponse;
}

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();

  const createMockHost = (url = '/v1/test', method = 'POST') => {
    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    const responseMock = { status: statusMock };
    const requestMock = { url, method, headers: { 'x-request-id': 'req-12345' } };

    const host = {
      switchToHttp: () => ({
        getResponse: () => responseMock,
        getRequest: () => requestMock,
      }),
    } as unknown as ArgumentsHost;

    return { host, statusMock, jsonMock };
  };

  it('normalizes Zod validation errors to 400 with details and issues', () => {
    const schema = z.object({ email: z.string().email(), age: z.number().positive() });
    let zodError: ZodError | null = null;

    try {
      schema.parse({ email: 'invalid-email', age: -5 });
    } catch (err) {
      zodError = err as ZodError;
    }

    const { host, statusMock, jsonMock } = createMockHost();
    filter.catch(zodError!, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const sent = firstCallArg(jsonMock);
    expect(sent.success).toBe(false);
    expect(sent.statusCode).toBe(400);
    expect(sent.code).toBe('VALIDATION_ERROR');
    expect(sent.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(sent.issues)).toBe(true);
    expect(sent.requestId).toBe('req-12345');
  });

  it('normalizes NestJS HttpExceptions while preserving status and code', () => {
    const exception = new HttpException(
      { code: 'ACADEMY_SUSPENDED', message: 'Academy has been suspended' },
      HttpStatus.FORBIDDEN,
    );

    const { host, statusMock, jsonMock } = createMockHost();
    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    const sent = firstCallArg(jsonMock);
    expect(sent.success).toBe(false);
    expect(sent.statusCode).toBe(403);
    expect(sent.code).toBe('ACADEMY_SUSPENDED');
    expect(sent.message).toBe('Academy has been suspended');
  });

  it('normalizes Prisma P2002 unique constraint violations to 409 Conflict', () => {
    const prismaError = {
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
      meta: { target: ['email'] },
      clientVersion: '6.19.3',
    };

    const { host, statusMock, jsonMock } = createMockHost();
    filter.catch(prismaError, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    const sent = firstCallArg(jsonMock);
    expect(sent.success).toBe(false);
    expect(sent.statusCode).toBe(409);
    expect(sent.code).toBe('CONFLICT');
    expect(sent.message).toContain('email');
  });

  it.each([
    { name: 'PrismaClientKnownRequestError', code: 'P1001' },
    { name: 'PrismaClientKnownRequestError', code: 'P2024' },
    { name: 'PrismaClientInitializationError', errorCode: 'P1001' },
  ])(
    'maps an unreachable database ($name $code$errorCode) to 503 DATABASE_UNAVAILABLE',
    (prismaError) => {
      const { host, statusMock, jsonMock } = createMockHost('/v1/auth/login');
      filter.catch({ ...prismaError, clientVersion: '6.19.3' }, host);

      expect(statusMock).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      const sent = firstCallArg(jsonMock);
      expect(sent.code).toBe('DATABASE_UNAVAILABLE');
      expect(sent.message).not.toContain('constraint');
    },
  );

  it('normalizes unexpected runtime errors to 500 without crashing', () => {
    const error = new Error('Database connection reset abruptly');

    const { host, statusMock, jsonMock } = createMockHost();
    filter.catch(error, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const sent = firstCallArg(jsonMock);
    expect(sent.success).toBe(false);
    expect(sent.statusCode).toBe(500);
    expect(sent.code).toBe('INTERNAL_SERVER_ERROR');
  });
});
