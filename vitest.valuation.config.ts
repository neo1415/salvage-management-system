import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Never load vitest.setup.ts: its schema setup is not appropriate for pure pricing tests.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'node',
    setupFiles: [],
    include: [
      'tests/unit/internet-search/**/*.test.ts',
      'tests/unit/valuations/price-adjudication.test.ts',
      'tests/unit/valuations/valuation-benchmark.test.ts',
      'tests/unit/cases/market-evidence-required.test.ts',
      'tests/unit/market-data/*evidence*.test.ts',
    ],
    env: {
      DATABASE_URL: 'postgres://invalid:invalid@127.0.0.1:1/valuation_tests_disabled',
      TEST_DATABASE_URL: 'postgres://invalid:invalid@127.0.0.1:1/valuation_tests_disabled',
    },
    maxWorkers: 1,
    testTimeout: 15000,
  },
});
