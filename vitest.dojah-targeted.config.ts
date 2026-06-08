import { defineConfig } from 'vitest/config';
import path from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'tests/unit/kyc/dojah-integration-targeted.test.ts',
      'tests/unit/kyc/tier2-status-ui.test.tsx',
    ],
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
