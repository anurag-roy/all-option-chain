import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@server': path.resolve(__dirname, './server'),
      '@shared': path.resolve(__dirname, './server/shared'),
      '@client': path.resolve(__dirname, './client/src'),
    },
  },
});
