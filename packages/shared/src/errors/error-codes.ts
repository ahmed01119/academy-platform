/**
 * Stable machine-readable error codes for API and UI clients.
 * Do not reuse codes with changed semantics.
 */
export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  TENANT_REQUIRED: 'TENANT_REQUIRED',
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  BRANCH_REQUIRED: 'BRANCH_REQUIRED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
