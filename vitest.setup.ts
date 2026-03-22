import { config } from 'dotenv';
import { resolve } from 'path';
import '@testing-library/jest-dom/vitest';
import { afterAll } from 'vitest';

// Load environment variables from .env file for tests
config({ path: resolve(__dirname, '.env') });

// Ensure required environment variables are set
const requiredEnvVars = [
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
  'DATABASE_URL',
];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.warn(
    `Warning: Missing environment variables: ${missingEnvVars.join(', ')}`
  );
  console.warn('Some tests may fail without proper configuration.');
}

// Set test environment
// NODE_ENV is already set to 'test' by vitest

// Global cleanup - close database connections after all tests
afterAll(async () => {
  try {
    // Dynamically import the client to close connections
    const { client } = await import('./src/lib/db/drizzle');
    await client.end({ timeout: 5 });
    console.log('Database connections closed successfully');
  } catch (error) {
    console.error('Error closing database connections:', error);
  }
});
