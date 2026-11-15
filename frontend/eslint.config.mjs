import { nextConfig } from '@academy/eslint-config/next';

export default [
  ...nextConfig,
  {
    ignores: ['public/**', '.next/**'],
  },
  // ─── Architecture Boundary Enforcement ─────────────────────────────────────────────────
  // Frontend must NOT import from backend source, database package, or
  // password hashing libraries. All backend communication goes through
  // the HTTP API client layer (src/api/client.ts).
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../backend/**', '../../backend/**', '**/backend/src/**'],
              message:
                'Frontend must not import from backend source. Use the API client (src/api/client.ts) instead.',
            },
            {
              group: ['@academy/database', '@prisma/client'],
              message:
                'Frontend must not import from the database package. Database access is strictly a backend responsibility.',
            },
            {
              group: ['argon2', 'bcrypt', 'bcryptjs'],
              message:
                'Frontend must not perform password hashing. This is a backend-only concern.',
            },
          ],
        },
      ],
    },
  },
];
