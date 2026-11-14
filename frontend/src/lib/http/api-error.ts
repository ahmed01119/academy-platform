/**
 * Error thrown for every non-2xx API response.
 * `code` carries the backend's stable machine-readable `ErrorCode` when present.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Returns the API message for an `ApiError`, otherwise the provided fallback.
 * Mirrors the `err instanceof ApiError ? err.message : fallback` pattern used across pages,
 * so non-API errors (network failures, bugs) never leak raw messages into the UI.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
