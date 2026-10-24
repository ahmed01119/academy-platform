import { baseConfig } from '@academy/eslint-config/base';

export default [
  ...baseConfig,
  {
    ignores: ['scripts/**', 'dist/**', 'node_modules/**'],
  },
];
