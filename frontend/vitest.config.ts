import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Mirror the TypeScript path aliases so vitest can resolve @/ imports
      '@': resolve(__dirname, './src'),
      '@/api': resolve(__dirname, './src/api'),
      '@/contexts': resolve(__dirname, './src/contexts'),
      '@/utils': resolve(__dirname, './src/utils'),
      '@/locales': resolve(__dirname, './src/locales'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
