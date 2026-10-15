import globals from 'globals';
import { baseConfig } from './base.js';

/** @type {import('eslint').Linter.Config[]} */
export const nestConfig = [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // NestJS relies on constructor DI and decorator metadata.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      'no-console': 'off',
    },
  },
];

export default nestConfig;
