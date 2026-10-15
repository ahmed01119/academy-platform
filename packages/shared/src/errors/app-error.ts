import { type ErrorCode } from './error-codes';

export type AppErrorDetails = Record<string, unknown>;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: AppErrorDetails;
  readonly isOperational: boolean;

  constructor(options: {
    code: ErrorCode;
    message: string;
    statusCode: number;
    details?: AppErrorDetails;
    isOperational?: boolean;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = 'AppError';
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.details = options.details;
    this.isOperational = options.isOperational ?? true;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}
