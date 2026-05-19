import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/unit/kyc/dojah-integration-targeted.test.ts'],
    testTimeout: 15000,
    pool: 'threads',
    maxWorkers: 1,
    minWorkers: 1,
    isolate: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
