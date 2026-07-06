import { defineConfig, globalIgnores } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  ...nextCoreWebVitals,
  {
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      'react/no-unescaped-entities': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // These React Compiler migration rules were not part of the previous
      // Next.js lint contract. Adopt them separately from the app lint gate.
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'coverage/**',
    'load-tests/**',
    'node_modules/**',
    'playwright-report/**',
    'scripts/**',
    // Story/demo components are not imported by the application runtime.
    // Their corresponding production components remain part of the lint gate.
    'src/**/*.example.tsx',
    // Dormant node-cron intelligence jobs. Nothing imports or starts this job
    // manager in runtime, and the live monitoring route explicitly reports the
    // jobs as disabled for Vercel. Active intelligence services remain linted.
    'src/features/intelligence/jobs/**',
    // Legacy, standalone browser verification harnesses. These modules have no
    // runtime imports or package-script entry points; active voice code remains linted.
    'src/lib/voice/compatibility-verification.ts',
    'src/lib/voice/feature-integration-verification.ts',
    'src/lib/voice/form-integration-verification.ts',
    'test-results/**',
    'tests/**',
  ]),
]);
