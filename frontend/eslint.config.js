import { nextConfig } from '@academy/eslint-config/next';

export default [
  ...nextConfig,
  {
    ignores: ['public/**', '.next/**'],
  },
];
