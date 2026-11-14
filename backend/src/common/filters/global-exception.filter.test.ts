import { describe, expect, it, vi } from 'vitest';
import { GlobalExceptionFilter } from './global-exception.filter';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ZodError, z } from 'zod';
import type { ArgumentsHost } from '@nestjs/common';

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
    const sent = jsonMock.mock.calls[0][0];
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
    const sent = jsonMock.mock.calls[0][0];
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
    const sent = jsonMock.mock.calls[0][0];
    expect(sent.success).toBe(false);
    expect(sent.statusCode).toBe(409);
    expect(sent.code).toBe('CONFLICT');
    expect(sent.message).toContain('email');
  });

  it('normalizes unexpected runtime errors to 500 without crashing', () => {
    const error = new Error('Database connection reset abruptly');

    const { host, statusMock, jsonMock } = createMockHost();
    filter.catch(error, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const sent = jsonMock.mock.calls[0][0];
    expect(sent.success).toBe(false);
    expect(sent.statusCode).toBe(500);
    expect(sent.code).toBe('INTERNAL_SERVER_ERROR');
  });
});

