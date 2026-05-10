import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest configuration for documentation system tests
 * 
 * These tests don't require database access since the documentation
 * system is read-only and only scans files.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/documentation/**/*.test.ts'],
    // No setupFiles - we don't need database setup
    testTimeout: 10000,
    pool: 'threads',
    maxWorkers: 4,
    minWorkers: 1,
    maxConcurrency: 2,
    isolate: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../../src'),
    },
  },
});
