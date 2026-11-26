export interface SafeParseResult<T> {
  success: boolean;
  data?: T;
  error?: {
    issues: Array<{
      path: (string | number)[];
      message: string;
    }>;
  };
}

export interface SchemaValidator<T> {
  safeParse(data: unknown): SafeParseResult<T>;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Record<string, string>;
}

/**
 * Validates arbitrary form data against any schema (e.g. Zod) and maps issues to a field -> error message record.
 */
export function validateWithSchema<T>(
  schema: SchemaValidator<T>,
  data: unknown,
): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success && result.data !== undefined) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  if (result.error?.issues) {
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (field && typeof field === 'string' && !errors[field]) {
        errors[field] = issue.message;
      }
    }
  }

  return { success: false, errors };
}
