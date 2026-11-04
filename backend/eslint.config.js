import { nestConfig } from '@academy/eslint-config/nest';

export default [
  ...nestConfig,
  // ─── Architecture Boundary Enforcement ─────────────────────────────────────────────────
  // Backend must NOT import from frontend source, components, or hooks.
  // All shared types must come from @academy/shared.
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../frontend/**', '../../frontend/**', '**/frontend/src/**'],
              message:
                'Backend must not import from frontend source. Frontend types must be in @academy/shared.',
            },
          ],
        },
      ],
    },
  },
];
