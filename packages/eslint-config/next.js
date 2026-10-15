import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { baseConfig } from './base.js';

/** @type {import('eslint').Linter.Config[]} */
export const nextConfig = [
  ...baseConfig,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
];

export default nextConfig;
